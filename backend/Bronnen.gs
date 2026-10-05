/**
 * Bronnen.gs — leest alle bronnen uit de sheet en maakt er één catalogus van.
 *
 * bouwCatalogus(spreadsheet) geeft terug:
 *   {
 *       collecties: [{ naam, aantal }],          in de volgorde van het tabblad "Website"
 *       filters:    ['Thema', 'Niveau', ...],     alle filternamen, in volgorde van eerste gebruik
 *       items:      [ ...één object per link... ],
 *       problemen:  [ { collectie, tabblad, rij, titel, probleem, link } ]   (voor het tabblad Controle)
 *   }
 */

function bouwCatalogus(spreadsheet) {
    var bronnen = leesBronnen(spreadsheet);
    var items = [];
    var problemen = [];
    var collecties = [];
    var filterLabels = [];
    // Per filterlabel: kleine letters → eerste schrijfwijze, zodat "school" en "School" samen één keuze worden.
    var schrijfwijze = {};

    // Hoeveel bronnen gebruiken hetzelfde tabblad? (bv. PJM: video, Canva, onthoudblad)
    var perTabblad = {};
    bronnen.forEach(function (bron) {
        perTabblad[bron.tabblad] = (perTabblad[bron.tabblad] || 0) + 1;
    });

    bronnen.forEach(function (bron) {
        // In een tabblad met meerdere linkkolommen is een lege link normaal
        // (niet elke rij heeft een video): dan melden we dat niet.
        bron.legeLinkMelden = perTabblad[bron.tabblad] === 1;
        var aantalVoor = items.length;
        leesEenBron(spreadsheet, bron, items, problemen, filterLabels, schrijfwijze);

        var bestaande = collecties.filter(function (c) {
            return c.naam === bron.collectie;
        })[0];
        if (bestaande) {
            bestaande.aantal += items.length - aantalVoor;
        } else {
            collecties.push({ naam: bron.collectie, aantal: items.length - aantalVoor });
        }
    });

    return {
        collecties: collecties,
        filters: filterLabels,
        items: items,
        problemen: problemen
    };
}

/** Leest één bron (= één linkkolom van één tabblad) en voegt de items toe. */
function leesEenBron(spreadsheet, bron, items, problemen, filterLabels, schrijfwijze) {
    function meld(rij, titel, probleem, link) {
        problemen.push({
            collectie: bron.collectie,
            tabblad: bron.tabblad,
            rij: rij,
            titel: titel || '',
            probleem: probleem,
            link: link || ''
        });
    }

    var blad = spreadsheet.getSheetByName(bron.tabblad);
    if (!blad) {
        meld('', '', 'Tabblad "' + bron.tabblad + '" bestaat niet (zie rij ' + bron.rijInWebsiteTab + ' van tabblad Website).');
        return;
    }

    var laatsteRij = blad.getLastRow();
    var laatsteKolom = blad.getLastColumn();
    var aantalRijen = laatsteRij - bron.koprij;
    if (aantalRijen < 1 || laatsteKolom < 1) {
        return;
    }

    // Eén keer alles inlezen is veel sneller dan cel per cel.
    var bereik = blad.getRange(bron.koprij, 1, aantalRijen + 1, laatsteKolom);
    var waarden = bereik.getDisplayValues();
    var koppen = waarden[0].map(normaliseerKop);

    function kolom(kopnaam, verplicht) {
        if (!kopnaam) {
            return -1;
        }
        var index = koppen.indexOf(normaliseerKop(kopnaam));
        if (index === -1 && verplicht) {
            meld(bron.koprij, '', 'Kolom "' + kopnaam + '" niet gevonden in rij ' + bron.koprij + ' van tabblad "' + bron.tabblad + '".');
        }
        return index;
    }

    var kTitel = kolom(bron.titel, true);
    var kLink = kolom(bron.link, true);
    if (kTitel === -1 || kLink === -1) {
        return;
    }
    var kInsluit = kolom(bron.insluit, true);
    var kOmschrijving = kolom(bron.omschrijving, true);
    var kOpWebsite = kolom(bron.opWebsite, false);
    var kVrij = kolom(bron.vrijTeDelen, false);
    var filterKolommen = bron.filters.map(function (f) {
        if (filterLabels.indexOf(f.label) === -1) {
            filterLabels.push(f.label);
        }
        return { label: f.label, index: kolom(f.kolom, true) };
    }).filter(function (f) {
        return f.index !== -1;
    });

    // Hyperlinks zitten niet in de gewone waarden: die halen we apart op.
    var linkBereik = blad.getRange(bron.koprij + 1, kLink + 1, aantalRijen, 1);
    var rijkeTekst = linkBereik.getRichTextValues();
    var formules = linkBereik.getFormulas();

    var gezien = {};

    for (var i = 1; i < waarden.length; i++) {
        var rij = waarden[i];
        var rijNummer = bron.koprij + i;
        var titel = String(rij[kTitel]).trim();
        var gevonden = haalLinkUitCel(rij[kLink], rijkeTekst[i - 1][0], formules[i - 1][0]);

        if (!titel && !gevonden.link && !String(rij[kLink]).trim()) {
            continue; // lege rij
        }
        if (kOpWebsite !== -1 && isNee(rij[kOpWebsite])) {
            continue; // bewust verborgen
        }
        if (!gevonden.link) {
            if (String(rij[kLink]).trim()) {
                meld(rijNummer, titel, 'Geen geldige link in de linkkolom.', String(rij[kLink]));
            } else if (bron.legeLinkMelden) {
                meld(rijNummer, titel, 'Linkkolom is leeg.', '');
            }
            continue;
        }

        var analyse = analyseerLink(gevonden.link);
        if (!analyse) {
            meld(rijNummer, titel, 'Geen geldige link.', gevonden.link);
            continue;
        }
        if (gevonden.verschil) {
            meld(rijNummer, titel, 'De zichtbare tekst en de hyperlink verschillen. De hyperlink wordt gebruikt.', gevonden.tekst + '  →  ' + gevonden.link);
        }
        if (analyse.programma === 'YouTube' && analyse.type === 'link') {
            meld(rijNummer, titel, 'YouTube-link zonder herkenbare video of afspeellijst: opent als gewone link.', analyse.url);
        }

        // Een insluitcode krijgt voorrang voor het afspelen (bv. SoundCloud met geheime link).
        if (kInsluit !== -1) {
            var insluitSrc = maakLinkSchoon(rij[kInsluit]);
            if (insluitSrc && /^https:\/\//.test(insluitSrc)) {
                analyse.embed = /w\.soundcloud\.com\/player/i.test(insluitSrc) ? verbeterSoundcloud(insluitSrc) : insluitSrc;
            }
        }

        if (!titel) {
            meld(rijNummer, '', 'Titel ontbreekt: de link wordt getoond als titel.', analyse.url);
            titel = analyse.url;
        }

        var sleutel = linkSleutel(analyse);
        if (gezien[sleutel]) {
            meld(rijNummer, titel, 'Dezelfde link staat ook in rij ' + gezien[sleutel] + ' (zelfde collectie).', analyse.url);
        } else {
            gezien[sleutel] = rijNummer;
        }

        var vrij = kVrij !== -1 && isJa(rij[kVrij]);
        if (vrij && analyse.alleenLigo) {
            meld(rijNummer, titel, 'Staat op "vrij te delen", maar SharePoint-links werken niet voor cursisten. Er komt geen deelknop.', analyse.url);
            vrij = false;
        }

        var filters = {};
        filterKolommen.forEach(function (f) {
            var waarde = String(rij[f.index]).replace(/\s+/g, ' ').trim();
            if (waarde) {
                filters[f.label] = eenheidSchrijfwijze(schrijfwijze, f.label, waarde);
            }
        });

        var item = {
            id: maakItemId(sleutel),
            collectie: bron.collectie,
            titel: titel,
            omschrijving: kOmschrijving === -1 ? '' : String(rij[kOmschrijving]).trim(),
            filters: filters,
            type: analyse.type,
            soort: analyse.soort,
            programma: analyse.programma,
            embed: analyse.embed,
            thumb: analyse.thumb,
            start: analyse.start,
            deelbaar: vrij,
            alleenLigo: analyse.alleenLigo,
            bron: bron.tabblad + ' – rij ' + rijNummer
        };
        // Bij video en audio sturen we de oorspronkelijke link niet mee naar de website:
        // de speler heeft genoeg aan het insluitadres.
        if (!item.embed || ['canva', 'genially'].indexOf(item.type) !== -1) {
            item.url = analyse.url;
        }
        items.push(laatLegeVeldenWeg(item));
    }
}

/**
 * Bepaalt de link van een cel. Volgorde:
 *   1. de hyperlink achter de cel (rijke tekst),
 *   2. de tekst zelf als die een link is,
 *   3. een HYPERLINK("...")-formule met een vaste link.
 */
function haalLinkUitCel(tekst, rijkeTekst, formule) {
    var tekstLink = maakLinkSchoon(tekst);
    var hyperlink = '';

    if (rijkeTekst) {
        hyperlink = rijkeTekst.getLinkUrl() || '';
        if (!hyperlink && rijkeTekst.getRuns) {
            var runs = rijkeTekst.getRuns();
            for (var i = 0; i < runs.length && !hyperlink; i++) {
                hyperlink = runs[i].getLinkUrl() || '';
            }
        }
        hyperlink = maakLinkSchoon(hyperlink);
    }

    if (!hyperlink && formule) {
        var m = String(formule).match(/HYPERLINK\(\s*"([^"]+)"/i);
        if (m) {
            hyperlink = maakLinkSchoon(m[1]);
        }
    }

    var link = hyperlink || tekstLink;
    var verschil = Boolean(hyperlink && tekstLink &&
        linkSleutel(analyseerLink(hyperlink)) !== linkSleutel(analyseerLink(tekstLink)));
    return { link: link, tekst: String(tekst || '').trim(), verschil: verschil };
}

/**
 * Velden zonder inhoud (null, '', false, 0) weglaten: de catalogus telt duizenden items,
 * dus dat scheelt flink in de hoeveelheid gegevens die de website moet downloaden.
 * De website behandelt een ontbrekend veld als "leeg".
 */
function laatLegeVeldenWeg(object) {
    Object.keys(object).forEach(function (sleutel) {
        var w = object[sleutel];
        if (w === null || w === undefined || w === '' || w === false || w === 0) {
            delete object[sleutel];
        }
    });
    return object;
}

/** "school" en "School" → altijd de eerst geziene schrijfwijze. */
function eenheidSchrijfwijze(schrijfwijze, label, waarde) {
    if (!schrijfwijze[label]) {
        schrijfwijze[label] = {};
    }
    var sleutel = waarde.toLowerCase();
    if (!schrijfwijze[label][sleutel]) {
        // Eerste letter als hoofdletter voor een nette filterlijst.
        schrijfwijze[label][sleutel] = waarde.charAt(0).toUpperCase() + waarde.slice(1);
    }
    return schrijfwijze[label][sleutel];
}

/**
 * Een korte, stabiele code voor een link, voor in de deellink (?id=...).
 * Ze wordt berekend uit de link zelf: zolang de link niet verandert, blijft de deellink werken,
 * ook als de rij verschuift of de collectie een andere naam krijgt.
 * Uit de code kan je de link niet terugrekenen.
 */
function maakItemId(sleutel) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'ligo|' + sleutel, Utilities.Charset.UTF_8);
    return Utilities.base64EncodeWebSafe(bytes).replace(/[=_-]/g, '').slice(0, 10);
}
