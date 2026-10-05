/**
 * Menu.gs — het menu "Website" in de sheet en de automatische cache-lediging.
 *
 * onOpen en onEdit zijn "eenvoudige triggers": Google roept ze vanzelf aan
 * bij het openen of bewerken van de sheet. Ze horen bij het BESTAND, niet bij een persoon,
 * dus ze blijven werken als de maker vertrekt.
 */

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('🌐 Website')
        .addItem('1. Instellingen-tabbladen aanmaken', 'menuInstellingenAanmaken')
        .addItem('2. Kolommen "Op website" en "Vrij te delen" toevoegen', 'menuKolommenToevoegen')
        .addSeparator()
        .addItem('Excel-bestand inladen (als de bron een Excel-bestand is)', 'menuExcelInladen')
        .addSeparator()
        .addItem('Controle uitvoeren', 'menuControle')
        .addItem('Website nu vernieuwen', 'menuVernieuwen')
        .addToUi();
}

/** Bij elke wijziging in de sheet: cache leegmaken, zodat de website meteen de nieuwe versie toont. */
function onEdit() {
    try {
        leegCache();
    } catch (fout) {
        // Een fout hier mag het bewerken van de sheet nooit hinderen.
    }
}

function menuVernieuwen() {
    leegCache();
    SpreadsheetApp.getActive().toast('De website toont bij de volgende keer laden de nieuwste gegevens.', 'Website', 5);
}

// ---------------------------------------------------------------------------
// 1. Instellingen-tabbladen aanmaken
// ---------------------------------------------------------------------------

function menuInstellingenAanmaken() {
    var ss = SpreadsheetApp.getActive();
    var ui = SpreadsheetApp.getUi();
    var berichten = [];

    if (!ss.getSheetByName(TAB_INSTELLINGEN)) {
        var inst = ss.insertSheet(TAB_INSTELLINGEN);
        var rijen = [['Instelling', 'Waarde', 'Uitleg']].concat(STANDAARD_INSTELLINGEN.map(function (i) {
            return [i.naam, i.waarde, i.uitleg];
        }));
        inst.getRange(1, 1, rijen.length, 3).setValues(rijen);
        opmaakKoprij(inst, 3);
        inst.setColumnWidth(1, 220);
        inst.setColumnWidth(2, 220);
        inst.setColumnWidth(3, 480);
        berichten.push('Tabblad "' + TAB_INSTELLINGEN + '" aangemaakt.');
    }

    if (ss.getSheetByName(TAB_BRONNEN)) {
        berichten.push('Tabblad "' + TAB_BRONNEN + '" bestond al en is niet gewijzigd.');
    } else {
        var blad = ss.insertSheet(TAB_BRONNEN, 0);
        var koppen = BRON_KOLOMMEN.map(function (k) {
            return k.kop;
        });
        blad.getRange(1, 1, 1, koppen.length).setValues([koppen]);
        // Uitleg als notitie bij elke kop.
        BRON_KOLOMMEN.forEach(function (k, i) {
            blad.getRange(1, i + 1).setNote(k.uitleg);
        });
        opmaakKoprij(blad, koppen.length);

        var voorstel = raadBronnen(ss);
        if (voorstel.length) {
            var rijenVoorstel = voorstel.map(function (b) {
                return BRON_KOLOMMEN.map(function (k) {
                    return b[k.sleutel] === undefined ? '' : b[k.sleutel];
                });
            });
            blad.getRange(2, 1, rijenVoorstel.length, koppen.length).setValues(rijenVoorstel);
        }

        // Keuzelijsten: Actief (ja/nee) en Tabblad (alle tabbladnamen).
        var jaNee = SpreadsheetApp.newDataValidation().requireValueInList(['ja', 'nee'], true).build();
        blad.getRange(2, 1, 200, 1).setDataValidation(jaNee);
        var namen = ss.getSheets().map(function (s) {
            return s.getName();
        }).filter(function (n) {
            return [TAB_BRONNEN, TAB_INSTELLINGEN, TAB_CONTROLE].indexOf(n) === -1;
        });
        var tabbladLijst = SpreadsheetApp.newDataValidation().requireValueInList(namen, true).setAllowInvalid(true).build();
        blad.getRange(2, 3, 200, 1).setDataValidation(tabbladLijst);
        blad.autoResizeColumns(1, koppen.length);
        berichten.push('Tabblad "' + TAB_BRONNEN + '" aangemaakt met ' + voorstel.length + ' voorgestelde bron(nen). Kijk ze na en pas ze aan waar nodig.');
    }

    ui.alert('Website', berichten.join('\n\n'), ui.ButtonSet.OK);
}

function opmaakKoprij(blad, aantalKolommen) {
    blad.getRange(1, 1, 1, aantalKolommen).setFontWeight('bold').setBackground('#056181').setFontColor('#ffffff');
    blad.setFrozenRows(1);
}

/**
 * Doet een voorstel voor het tabblad "Website" door elk tabblad te bekijken:
 *   - de koprij is de eerste rij (van de eerste 10) met een titelkop én een linkkop;
 *   - per tabblad één bron, met de beste linkkolom.
 * Het is een voorstel: de beheerder kijkt het na.
 */
function raadBronnen(ss) {
    var TITEL = /^(titel|naam|title|name|wat|onderwerp)$/;
    var LINK = /(^url$|url|link|website)/;
    var GEEN_LINK = /(hulp|qr|insluit|kopieer|code|klad|omzetting)/;
    var FILTER = /^(thema|niveau|vaardigheid|programma|type|soort|kern|boekje|sterren|module|categorie)/;
    var OMSCHRIJVING = /(omschrijving|beschrijving|uitleg)/;
    var overslaan = [TAB_BRONNEN, TAB_INSTELLINGEN, TAB_CONTROLE];
    var voorstel = [];

    ss.getSheets().forEach(function (blad) {
        if (overslaan.indexOf(blad.getName()) !== -1 || blad.isSheetHidden() || blad.getLastRow() < 2) {
            return;
        }
        var aantal = Math.min(10, blad.getLastRow());
        var bovenkant = blad.getRange(1, 1, aantal, blad.getLastColumn()).getDisplayValues();

        for (var r = 0; r < bovenkant.length; r++) {
            var koppen = bovenkant[r].map(normaliseerKop);
            var titelIndex = indexVan(koppen, TITEL);
            if (titelIndex === -1) {
                continue;
            }
            // Linkkolom: liefst exact "URL", dan een zichtbare kolom met "url" in de kop,
            // dan een zichtbare kolom met "link" in de kop.
            var linkIndex = -1;
            [/^url$/, /url/, LINK].forEach(function (patroon) {
                for (var k = 0; k < koppen.length && linkIndex === -1; k++) {
                    if (patroon.test(koppen[k]) && !GEEN_LINK.test(koppen[k]) && !blad.isColumnHiddenByUser(k + 1)) {
                        linkIndex = k;
                    }
                }
            });
            // Geen linkkolom: de link zit misschien als hyperlink in de titel.
            if (linkIndex === -1) {
                linkIndex = titelIndex;
            }

            var filters = [];
            koppen.forEach(function (kop, k) {
                // Ook verborgen kolommen: in PJM zijn Thema en Sterren bijvoorbeeld verborgen.
                if (FILTER.test(kop)) {
                    filters.push(bovenkant[r][k].trim());
                }
            });
            var omschrijvingIndex = indexVan(koppen, OMSCHRIJVING);

            voorstel.push({
                actief: 'ja',
                collectie: blad.getName(),
                tabblad: blad.getName(),
                koprij: r + 1,
                titel: bovenkant[r][titelIndex].trim(),
                link: bovenkant[r][linkIndex].trim(),
                insluit: '',
                omschrijving: omschrijvingIndex === -1 ? '' : bovenkant[r][omschrijvingIndex].trim(),
                filters: filters.join('; '),
                opWebsite: 'Op website',
                vrijTeDelen: 'Vrij te delen'
            });
            return;
        }
    });
    return voorstel;
}

function indexVan(lijst, patroon) {
    for (var i = 0; i < lijst.length; i++) {
        if (patroon.test(lijst[i])) {
            return i;
        }
    }
    return -1;
}

// ---------------------------------------------------------------------------
// 2. Kolommen "Op website" en "Vrij te delen" toevoegen
// ---------------------------------------------------------------------------

function menuKolommenToevoegen() {
    var ss = SpreadsheetApp.getActive();
    var ui = SpreadsheetApp.getUi();
    var bronnen = leesBronnen(ss);
    var toegevoegd = [];

    bronnen.forEach(function (bron) {
        var blad = ss.getSheetByName(bron.tabblad);
        if (!blad) {
            return;
        }
        [bron.opWebsite, bron.vrijTeDelen].forEach(function (kop, nummer) {
            if (!kop) {
                return;
            }
            var koppen = blad.getRange(bron.koprij, 1, 1, blad.getLastColumn()).getDisplayValues()[0].map(normaliseerKop);
            if (koppen.indexOf(normaliseerKop(kop)) !== -1) {
                return; // bestaat al
            }
            // Nieuwe kolom achteraan, zodat bestaande formules niet verschuiven.
            var nieuweKolom = blad.getLastColumn() + 1;
            if (blad.getMaxColumns() < nieuweKolom) {
                blad.insertColumnAfter(blad.getMaxColumns());
            }
            blad.getRange(bron.koprij, nieuweKolom).setValue(kop).setFontWeight('bold');
            var aantalRijen = Math.max(blad.getMaxRows() - bron.koprij, 1);
            var lijst = SpreadsheetApp.newDataValidation().requireValueInList(['ja', 'nee'], true).build();
            blad.getRange(bron.koprij + 1, nieuweKolom, aantalRijen, 1).setDataValidation(lijst);
            blad.getRange(bron.koprij, nieuweKolom).setNote(nummer === 0
                ? 'Leeg of "ja" = staat op de website. "nee" = verborgen.'
                : 'Alleen bij "ja" verschijnt de deelknop voor cursisten. Leeg = niet delen.');
            toegevoegd.push('"' + kop + '" in ' + bron.tabblad);
        });
    });

    ui.alert('Website', toegevoegd.length
        ? 'Toegevoegd:\n' + toegevoegd.join('\n') + '\n\nJe mag de kolom "Vrij te delen" verbergen.'
        : 'Alle kolommen bestonden al. Er is niets gewijzigd.', ui.ButtonSet.OK);
}

// ---------------------------------------------------------------------------
// Controle
// ---------------------------------------------------------------------------

function menuControle() {
    var ss = SpreadsheetApp.getActive();
    var catalogus = bouwCatalogus(ss);
    var blad = ss.getSheetByName(TAB_CONTROLE) || ss.insertSheet(TAB_CONTROLE);
    blad.clear();

    var deelbaar = catalogus.items.filter(function (i) {
        return i.deelbaar;
    }).length;
    var samenvatting = [
        ['Controle van ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'), '', '', '', '', ''],
        ['Items op de website: ' + catalogus.items.length + ' — waarvan vrij te delen: ' + deelbaar +
            ' — meldingen: ' + catalogus.problemen.length, '', '', '', '', ''],
        ['', '', '', '', '', ''],
        ['Collectie', 'Tabblad', 'Rij', 'Titel', 'Probleem', 'Link']
    ];
    var rijen = catalogus.problemen.map(function (p) {
        return [p.collectie, p.tabblad, p.rij, p.titel, p.probleem, p.link];
    });
    var alles = samenvatting.concat(rijen);
    blad.getRange(1, 1, alles.length, 6).setValues(alles);
    blad.getRange(1, 1).setFontWeight('bold').setFontSize(12);
    blad.getRange(4, 1, 1, 6).setFontWeight('bold').setBackground('#056181').setFontColor('#ffffff');
    blad.setFrozenRows(4);
    blad.setColumnWidths(1, 3, 140);
    blad.setColumnWidth(4, 280);
    blad.setColumnWidth(5, 420);
    blad.setColumnWidth(6, 360);
    ss.setActiveSheet(blad);
    leegCache();
}
