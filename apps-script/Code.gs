/**
 * Weergavewebsite — backend (versie 1.1)
 *
 * Dit bestand is automatisch samengevoegd uit de map backend/ (zie tools/maak-code-gs.js).
 * Pas bij voorkeur de losse bestanden aan en voeg ze daarna opnieuw samen.
 *
 * Inhoud: Api.gs, Instellingen.gs, Bronnen.gs, Links.gs, Cache.gs, Login.gs, Menu.gs, Import.gs, Lijsten.gs
 */

// ============================================================================
// Api.gs
// ============================================================================

/**
 * Api.gs — de "voordeur" van het backend. De websites praten alleen met deze twee functies.
 *
 * Google roept doGet aan bij een GET-verzoek en doPost bij een POST-verzoek
 * naar het webadres van de implementatie (…/exec).
 *
 *   GET  ?actie=info                 → titel, ondertitel, is login verplicht?
 *   GET  ?actie=catalogus            → alle items (alleen als login NIET verplicht is)
 *   POST {"actie":"catalogus","token":"…"}  → alle items, na controle van de login
 *   GET  ?actie=item&id=abc123       → één item voor de cursistenpagina, alleen als het vrij te delen is
 *   GET  ?actie=item&v=<YouTube-ID>  → idem, voor oude deellinks (zie instelling "Oude deellinks")
 *   GET  ?actie=controle             → de meldingen van de controle (zelfde toegang als catalogus)
 *   GET  ?actie=vernieuw             → de cache legen (hoogstens één keer per minuut)
 *   GET  ?actie=aanmeldinfo          → mag je aanmelden? met welk account moet je delen? code nodig?
 *   POST {"actie":"aanmelden", ...}  → zelf een lijst toevoegen (zie Aanmelden in Lijsten.gs)
 *
 * Elk verzoek kan &lijst=<code> meekrijgen: dan gaat het over die lijst uit het tabblad "Lijsten"
 * (zie Lijsten.gs). Zonder lijst gaat het over de gegevens in deze sheet.
 *
 * Elk antwoord is JSON met { ok: true, ... } of { ok: false, fout: "..." }.
 */

var VERSIE = '1.1';

function doGet(e) {
    var p = (e && e.parameter) || {};
    return verwerk(p.actie || 'info', p);
}

function doPost(e) {
    var gegevens = {};
    try {
        gegevens = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (fout) {
        return alsJson({ ok: false, fout: 'Ongeldig verzoek.' });
    }
    return verwerk(gegevens.actie || 'info', gegevens);
}

function verwerk(actie, p) {
    try {
        var lijst = normaliseerLijstCode(p.lijst);

        if (actie === 'vernieuw') {
            return alsJson({ ok: true, vernieuwd: vernieuwIndienOud(lijst, 60) });
        }
        if (actie === 'aanmeldinfo') {
            return alsJson(aanmeldInfo());
        }
        if (actie === 'aanmelden') {
            return alsJson(meldLijstAan(p));
        }

        // Instellingen: van deze sheet (snel), of van de lijst (zitten in de catalogus in de cache).
        var instellingen = lijst ? haalCatalogus(lijst).instellingen : leesInstellingen(SpreadsheetApp.getActive());

        if (actie === 'info') {
            return alsJson({
                ok: true,
                titel: instellingen.titel,
                ondertitel: instellingen.ondertitel,
                loginVerplicht: instellingen.loginVerplicht,
                versie: VERSIE
            });
        }

        if (actie === 'catalogus' || actie === 'controle') {
            var gebruiker = null;
            if (instellingen.loginVerplicht) {
                var login = controleerLogin(p.token, instellingen);
                if (!login.ok) {
                    return alsJson({ ok: false, fout: login.fout, loginNodig: true });
                }
                gebruiker = login.email;
            }
            var catalogus = haalCatalogus(lijst);
            if (actie === 'controle') {
                return alsJson({
                    ok: true,
                    items: catalogus.items.length,
                    gemaakt: catalogus.gemaakt,
                    problemen: catalogus.problemen
                });
            }
            return alsJson({
                ok: true,
                titel: instellingen.titel,
                ondertitel: instellingen.ondertitel,
                gebruiker: gebruiker,
                gemaakt: catalogus.gemaakt,
                collecties: catalogus.collecties,
                filters: catalogus.filters,
                items: catalogus.items
            });
        }

        if (actie === 'item') {
            if (p.v && !lijst) {
                return alsJson(zoekOudeLink(String(p.v), instellingen));
            }
            return alsJson(zoekDeelbaarItem(String(p.id || ''), false, lijst));
        }

        return alsJson({ ok: false, fout: 'Onbekende actie: ' + actie });
    } catch (fout) {
        return alsJson({ ok: false, fout: fout.message || String(fout) });
    }
}

/**
 * Zoekt één item voor de cursistenpagina.
 * Geeft alleen gegevens terug als het item op "vrij te delen" staat:
 * zo kan niemand met een zelfverzonnen of oude deellink iets anders openen.
 */
function zoekDeelbaarItem(id, ookNietDeelbaar, lijst) {
    if (!/^[A-Za-z0-9]{6,20}$/.test(id)) {
        return { ok: false, fout: 'Deze link is niet geldig.' };
    }
    var catalogus = haalCatalogus(lijst || '');
    var item = catalogus.items.filter(function (i) {
        return i.id === id && (i.deelbaar || (ookNietDeelbaar && i.type === 'youtube'));
    })[0];
    if (!item) {
        return { ok: false, fout: 'Deze oefening is niet (meer) beschikbaar.' };
    }
    // Alleen wat de cursist nodig heeft: geen collectie, geen bronrij, geen filters.
    return {
        ok: true,
        item: {
            titel: item.titel,
            type: item.type,
            soort: item.soort,
            programma: item.programma,
            embed: item.embed,
            thumb: item.thumb,
            start: item.start,
            url: item.url || null
        }
    };
}

/**
 * Oude deellinks hadden de vorm …/?v=<YouTube-ID>. We zoeken de video in de lijst
 * (dezelfde code als een nieuwe deellink, want die wordt berekend uit de video-ID).
 * Video's die NIET in de lijst staan, worden nooit getoond.
 */
function zoekOudeLink(videoId, instellingen) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        return { ok: false, fout: 'Deze link is niet geldig.' };
    }
    return zoekDeelbaarItem(maakItemId('yt:' + videoId), instellingen.oudeLinks, '');
}

function alsJson(object) {
    return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// Instellingen.gs
// ============================================================================

/**
 * Instellingen.gs — leest de twee instellingen-tabbladen van de sheet.
 *
 *  1. Tabblad "Website": één rij per BRON. Een bron = één linkkolom uit één tabblad.
 *     Een tabblad met drie soorten links (bv. PJM: video, Canva, onthoudblad) krijgt
 *     dus drie rijen, en elke link wordt een apart item op de website.
 *
 *  2. Tabblad "Website-instellingen": algemene instellingen (titel, login, ...).
 *
 * Kolommen worden altijd aangeduid met hun KOPNAAM, nooit met een letter.
 * Zo blijft alles werken als iemand een kolom invoegt of verplaatst.
 */

var TAB_BRONNEN = 'Website';
var TAB_INSTELLINGEN = 'Website-instellingen';
var TAB_CONTROLE = 'Controle';

/** De kolommen van het tabblad "Website", in volgorde, met uitleg voor de beheerder. */
var BRON_KOLOMMEN = [
    { sleutel: 'actief', kop: 'Actief', uitleg: 'ja / nee — staat deze bron op de website?' },
    { sleutel: 'collectie', kop: 'Collectie', uitleg: 'Naam van de groep op de website, bv. "PJM video\'s"' },
    { sleutel: 'tabblad', kop: 'Tabblad', uitleg: 'Naam van het tabblad met de gegevens' },
    { sleutel: 'koprij', kop: 'Koprij', uitleg: 'Rijnummer met de kolomkoppen (bv. 1 of 4)' },
    { sleutel: 'titel', kop: 'Titelkolom', uitleg: 'Kop van de kolom met de titel' },
    { sleutel: 'link', kop: 'Linkkolom', uitleg: 'Kop van de kolom met de link' },
    { sleutel: 'insluit', kop: 'Insluitkolom', uitleg: '(optioneel) kolom met een insluitcode die voorrang krijgt' },
    { sleutel: 'omschrijving', kop: 'Omschrijvingkolom', uitleg: '(optioneel) kolom met een korte omschrijving' },
    { sleutel: 'filters', kop: 'Filters', uitleg: 'Koppen van filterkolommen, gescheiden door ; — "Kern=Thema" toont kolom Kern als filter Thema' },
    { sleutel: 'opWebsite', kop: 'Op-website-kolom', uitleg: '(optioneel) kolom waarin "nee" een rij verbergt' },
    { sleutel: 'vrijTeDelen', kop: 'Vrij-te-delen-kolom', uitleg: '(optioneel) kolom waarin "ja" de deelknop toont' }
];

/** De algemene instellingen met hun standaardwaarde. */
var STANDAARD_INSTELLINGEN = [
    { sleutel: 'titel', naam: 'Titel van de website', waarde: 'Digitale oefeningen', uitleg: 'Bovenaan de website' },
    { sleutel: 'ondertitel', naam: 'Ondertitel', waarde: 'Alfa NT2', uitleg: 'Klein onder de titel' },
    { sleutel: 'login', naam: 'Login verplicht', waarde: 'nee', uitleg: 'ja = lesgevers moeten inloggen met hun Microsoft-account' },
    { sleutel: 'domeinen', naam: 'Toegelaten e-maildomeinen', waarde: '', uitleg: 'Bij login: bv. ligo.be; limino.be' },
    { sleutel: 'cacheMinuten', naam: 'Vernieuwen na (minuten)', waarde: '5', uitleg: 'Na een wijziging in de sheet staat ze ten laatste zo lang later online' },
    { sleutel: 'websiteAdres', naam: 'Adres van de website', waarde: '', uitleg: 'bv. https://ligolimino.github.io/digimateriaal/ — om links naar lijsten te tonen' },
    { sleutel: 'aanmelden', naam: 'Aanmelden via de website', waarde: 'ja', uitleg: 'ja = collega\'s kunnen zelf een lijst toevoegen via de aanmeldpagina (…/aanmelden/)' },
    { sleutel: 'aanmeldcode', naam: 'Aanmeldcode', waarde: '', uitleg: 'Een wachtwoord dat je alleen aan collega\'s geeft. Leeg = geen code nodig (iedereen met de link kan aanmelden)' },
    { sleutel: 'oudeLinks', naam: 'Oude deellinks (?v=) voor alle video\'s', waarde: 'nee', uitleg: 'Links van de oude cursistenpagina (…/?v=YouTube-ID). nee = alleen video\'s die vrij te delen zijn; ja = elke YouTube-video uit de lijst (voor de overgang)' }
];

/** Woorden die als "ja" of "nee" tellen in ja/nee-kolommen. */
function isJa(waarde) {
    var w = String(waarde === null || waarde === undefined ? '' : waarde).trim().toLowerCase();
    return ['ja', 'j', 'yes', 'y', 'x', 'true', 'waar', '1', 'v', '✓', '✔'].indexOf(w) !== -1;
}

function isNee(waarde) {
    var w = String(waarde === null || waarde === undefined ? '' : waarde).trim().toLowerCase();
    return ['nee', 'n', 'no', 'false', 'onwaar', '0', '-'].indexOf(w) !== -1;
}

/** Vergelijkt kopnamen zonder te letten op hoofdletters en spaties. */
function normaliseerKop(tekst) {
    return String(tekst === null || tekst === undefined ? '' : tekst).replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Leest het tabblad "Website" en geeft een lijst bronnen terug.
 * Rijen met Actief = nee of zonder tabblad worden overgeslagen.
 */
function leesBronnen(spreadsheet) {
    var blad = spreadsheet.getSheetByName(TAB_BRONNEN);
    if (!blad) {
        throw new Error('Het tabblad "' + TAB_BRONNEN + '" ontbreekt. Gebruik het menu Website → Instellingen-tabbladen aanmaken.');
    }
    var waarden = blad.getDataRange().getDisplayValues();
    if (waarden.length < 2) {
        return [];
    }

    // Zoek elke kolom op via zijn kop, zodat de volgorde in het tabblad niet uitmaakt.
    var koppen = waarden[0].map(normaliseerKop);
    var positie = {};
    BRON_KOLOMMEN.forEach(function (k) {
        positie[k.sleutel] = koppen.indexOf(normaliseerKop(k.kop));
    });

    var bronnen = [];
    for (var r = 1; r < waarden.length; r++) {
        var rij = waarden[r];
        var bron = { rijInWebsiteTab: r + 1 };
        BRON_KOLOMMEN.forEach(function (k) {
            bron[k.sleutel] = positie[k.sleutel] === -1 ? '' : String(rij[positie[k.sleutel]]).trim();
        });
        if (!bron.tabblad || isNee(bron.actief)) {
            continue;
        }
        bron.koprij = parseInt(bron.koprij, 10) || 1;
        bron.collectie = bron.collectie || bron.tabblad;
        bron.filters = leesFilterDefinitie(bron.filters);
        bronnen.push(bron);
    }
    return bronnen;
}

/**
 * "Thema; Niveau; Sterren=Niveau" → [{kolom:'Thema', label:'Thema'}, ...]
 * Met "Kolom=Label" kan je een kolom onder een andere filternaam tonen,
 * zodat verschillende tabbladen dezelfde filter delen.
 */
function leesFilterDefinitie(tekst) {
    if (!tekst) {
        return [];
    }
    return String(tekst).split(/[;\n]/).map(function (deel) {
        var stukken = deel.split('=');
        var kolom = stukken[0].trim();
        var label = (stukken[1] || stukken[0]).trim();
        return { kolom: kolom, label: label };
    }).filter(function (f) {
        return f.kolom !== '';
    });
}

/** Leest het tabblad "Website-instellingen". Ontbrekende waarden krijgen de standaardwaarde. */
function leesInstellingen(spreadsheet) {
    var resultaat = {};
    STANDAARD_INSTELLINGEN.forEach(function (i) {
        resultaat[i.sleutel] = i.waarde;
    });

    var blad = spreadsheet.getSheetByName(TAB_INSTELLINGEN);
    if (blad) {
        var waarden = blad.getDataRange().getDisplayValues();
        waarden.forEach(function (rij) {
            var naam = normaliseerKop(rij[0]);
            STANDAARD_INSTELLINGEN.forEach(function (i) {
                if (normaliseerKop(i.naam) === naam && String(rij[1]).trim() !== '') {
                    resultaat[i.sleutel] = String(rij[1]).trim();
                }
            });
        });
    }

    resultaat.loginVerplicht = isJa(resultaat.login);
    resultaat.oudeLinks = isJa(resultaat.oudeLinks);
    resultaat.aanmelden = !isNee(resultaat.aanmelden);
    resultaat.domeinen = String(resultaat.domeinen).split(/[;,\s]+/).map(function (d) {
        return d.trim().toLowerCase().replace(/^@/, '');
    }).filter(Boolean);
    var minuten = parseInt(resultaat.cacheMinuten, 10);
    resultaat.cacheMinuten = isNaN(minuten) ? 5 : Math.max(1, Math.min(minuten, 360));
    return resultaat;
}

// ============================================================================
// Bronnen.gs
// ============================================================================

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

// ============================================================================
// Links.gs
// ============================================================================

/**
 * Links.gs — herkent wat voor link iets is en hoe de website hem moet tonen.
 *
 * Eén functie doet het echte werk: analyseerLink(url).
 * Ze krijgt een link uit de sheet en geeft een object terug:
 *
 *   {
 *       url:       de opgekuiste link,
 *       type:      'youtube' | 'youtube-lijst' | 'vimeo' | 'soundcloud' | 'genially' | 'afbeelding'
 *                  | 'canva' | 'thinglink' | 'drive' | 'sharepoint' | 'link',
 *       soort:     label voor de lesgever: 'Video', 'Audio', 'Interactief', 'Afbeelding', 'Document', 'Website',
 *       programma: naam van het programma ('YouTube', 'ThingLink', 'Quizlet', ...),
 *       embed:     adres om in de pagina af te spelen (of null als de link in een nieuw venster opent),
 *       thumb:     adres van een voorbeeldafbeelding (of null),
 *       start:     starttijd in seconden (alleen YouTube, anders 0),
 *       alleenLigo: true als de link alleen met een Ligo-account werkt (SharePoint)
 *   }
 *
 * Deze functies gebruiken GEEN Google-diensten: daardoor kan je ze ook gewoon
 * in Node.js testen (zie de map tests/).
 */

/** Herkenbare programma's op basis van de domeinnaam. */
var PROGRAMMAS = [
    { domein: 'thinglink.com', naam: 'ThingLink', soort: 'Interactief' },
    { domein: 'quizlet.com', naam: 'Quizlet', soort: 'Interactief' },
    { domein: 'kahoot.it', naam: 'Kahoot', soort: 'Interactief' },
    { domein: 'learningapps.org', naam: 'LearningApps', soort: 'Interactief' },
    { domein: 'wordwall.net', naam: 'Wordwall', soort: 'Interactief' },
    { domein: 'educaplay.com', naam: 'Educaplay', soort: 'Interactief' },
    { domein: 'bookwidgets.com', naam: 'BookWidgets', soort: 'Interactief' },
    { domein: 'genially.com', naam: 'Genially', soort: 'Interactief' },
    { domein: 'canva.com', naam: 'Canva', soort: 'Interactief' },
    { domein: 'docs.google.com/forms', naam: 'Google Forms', soort: 'Interactief' },
    { domein: 'forms.gle', naam: 'Google Forms', soort: 'Interactief' },
    { domein: 'forms.office.com', naam: 'Microsoft Forms', soort: 'Interactief' },
    { domein: 'sharepoint.com', naam: 'SharePoint', soort: 'Document' },
    { domein: 'computermeester.be', naam: 'Computermeester', soort: 'Interactief' },
    { domein: 'nedbox.be', naam: 'Nedbox', soort: 'Website' },
    { domein: 'jimdofree.com', naam: 'Website', soort: 'Website' },
    { domein: 'sites.google.com', naam: 'Website', soort: 'Website' },
    { domein: 'bit.ly', naam: 'Link', soort: 'Website' }
];

/**
 * Maakt een link schoon: spaties weg, typfouten als 'hhttps' rechtzetten,
 * een src uit een <iframe>-code halen, rommel aan het einde weghalen.
 * Geeft '' terug als er geen bruikbare link in staat.
 */
function maakLinkSchoon(ruw) {
    if (ruw === null || ruw === undefined) {
        return '';
    }
    var tekst = String(ruw).trim();

    // Insluitcode geplakt in plaats van een link? Neem dan de src.
    var iframe = tekst.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
    if (iframe) {
        tekst = iframe[1];
    }

    // Veelvoorkomende typfouten.
    tekst = tekst.replace(/^h+ttps?:\/\//i, function (begin) {
        return begin.toLowerCase().indexOf('https') !== -1 ? 'https://' : 'http://';
    });
    if (/^\/\//.test(tekst)) {
        tekst = 'https:' + tekst;
    }
    if (/^www\./i.test(tekst)) {
        tekst = 'https://' + tekst;
    }
    if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(tekst)) {
        return '';
    }

    // Alles na een spatie is geen deel van de link meer.
    tekst = tekst.split(/\s/)[0];
    // Losse leestekens of vreemde tekens aan het einde weghalen.
    tekst = tekst.replace(/[#.,;)\]µ]+$/, '');
    return tekst;
}

/** Haalt de 11 tekens lange YouTube-video-ID uit een link, of null. */
function youtubeId(url) {
    var m = url.match(
        /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/i
    );
    return m ? m[1] : null;
}

/** Haalt de ID van een YouTube-afspeellijst uit een link, of null. */
function youtubeLijstId(url) {
    var m = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
}

/** Starttijd uit ?t=90, ?t=1m30s of ?start=90, in seconden. */
function youtubeStart(url) {
    var m = url.match(/[?&#](?:t|start)=(\d+h)?(\d+m)?(\d+)?s?(?:&|$)/);
    if (!m) {
        return 0;
    }
    var uren = m[1] ? parseInt(m[1], 10) : 0;
    var minuten = m[2] ? parseInt(m[2], 10) : 0;
    var seconden = m[3] ? parseInt(m[3], 10) : 0;
    return uren * 3600 + minuten * 60 + seconden;
}

/** Zoekt het programma op basis van de domeinnaam. */
function zoekProgramma(url) {
    var zonderProtocol = url.replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
    for (var i = 0; i < PROGRAMMAS.length; i++) {
        var p = PROGRAMMAS[i];
        // Domein moet aan het begin staan of na een punt (sub.domein.com).
        var host = zonderProtocol.split('/')[0];
        if (p.domein.indexOf('/') !== -1) {
            if (zonderProtocol.indexOf(p.domein) === 0) {
                return p;
            }
        } else if (host === p.domein || host.slice(-(p.domein.length + 1)) === '.' + p.domein) {
            return p;
        }
    }
    var domein = zonderProtocol.split('/')[0];
    return { domein: domein, naam: domein, soort: 'Website' };
}

/**
 * De hoofdfunctie: analyseert een (ruwe) link.
 * Geeft null terug als er geen bruikbare link is.
 */
function analyseerLink(ruw) {
    var url = maakLinkSchoon(ruw);
    if (!url) {
        return null;
    }

    var resultaat = {
        url: url,
        type: 'link',
        soort: 'Website',
        programma: '',
        embed: null,
        thumb: null,
        start: 0,
        alleenLigo: false
    };

    // --- YouTube ------------------------------------------------------------
    if (/(youtube(-nocookie)?\.com|youtu\.be)\//i.test(url)) {
        var id = youtubeId(url);
        var lijst = youtubeLijstId(url);
        resultaat.programma = 'YouTube';
        resultaat.soort = 'Video';
        if (id) {
            resultaat.type = 'youtube';
            resultaat.embed = 'https://www.youtube-nocookie.com/embed/' + id;
            // mqdefault is 16:9 (zonder zwarte balken), net als de kaarten op de website.
            resultaat.thumb = 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
            resultaat.start = youtubeStart(url);
            resultaat.videoId = id;
        } else if (lijst) {
            resultaat.type = 'youtube-lijst';
            resultaat.embed = 'https://www.youtube-nocookie.com/embed/videoseries?list=' + lijst;
        }
        // Een YouTube-kanaal of iets anders: gewoon een link.
        return resultaat;
    }

    // --- Vimeo --------------------------------------------------------------
    var vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (vimeo) {
        resultaat.type = 'vimeo';
        resultaat.programma = 'Vimeo';
        resultaat.soort = 'Video';
        resultaat.embed = 'https://player.vimeo.com/video/' + vimeo[1];
        // Geen thumbnail: daarvoor zou het script Vimeo moeten bevragen. De website toont een plaatsvervanger.
        return resultaat;
    }

    // --- SoundCloud ---------------------------------------------------------
    if (/soundcloud\.com\//i.test(url)) {
        resultaat.type = 'soundcloud';
        resultaat.programma = 'SoundCloud';
        resultaat.soort = 'Audio';
        if (/w\.soundcloud\.com\/player/i.test(url)) {
            resultaat.embed = verbeterSoundcloud(url);
        } else {
            resultaat.embed = verbeterSoundcloud('https://w.soundcloud.com/player/?url=' + encodeURIComponent(url));
        }
        return resultaat;
    }

    // --- Google Drive: thumbnail via Google (werkt als het bestand gedeeld is met "iedereen met de link")
    var drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([A-Za-z0-9_-]{20,})/i);
    if (drive) {
        resultaat.type = 'drive';
        resultaat.programma = 'Google Drive';
        resultaat.soort = 'Document';
        resultaat.thumb = 'https://drive.google.com/thumbnail?id=' + drive[1] + '&sz=w640';
        return resultaat;
    }

    // --- Afbeeldingen: een link die rechtstreeks naar een beeldbestand wijst ---
    var isBeeld = /\.(jpe?g|png|gif|webp|svg|bmp)(?:[?#]|$)/i.test(url);
    if (isBeeld && !/sharepoint\.com/i.test(url)) {
        resultaat.type = 'afbeelding';
        resultaat.soort = 'Afbeelding';
        resultaat.programma = zoekProgramma(url).naam;
        resultaat.embed = url;
        resultaat.thumb = url;
        return resultaat;
    }

    var programma = zoekProgramma(url);
    resultaat.programma = programma.naam;
    resultaat.soort = programma.soort;

    // --- ThingLink ----------------------------------------------------------
    if (programma.naam === 'ThingLink') {
        resultaat.type = 'thinglink';
        var tl = url.match(/thinglink\.com\/(?:card|scene|video|view\/scene|channelcard|channel)\/(\d{10,})/i);
        if (tl) {
            resultaat.thumb = 'https://cdn.thinglink.me/api/image/' + tl[1] + '/1024/10/scaletowidth';
        }
        return resultaat;
    }

    // --- Genially: kan in de pagina getoond worden --------------------------
    if (programma.naam === 'Genially' && /view\.genially\.com\//i.test(url)) {
        resultaat.type = 'genially';
        resultaat.embed = url;
        return resultaat;
    }

    // --- Canva: nooit de bewerkingslink doorgeven ---------------------------
    if (programma.naam === 'Canva') {
        resultaat.type = 'canva';
        var canva = url.match(/canva\.com\/design\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)/i);
        if (canva) {
            // /edit wordt /view: wie de link krijgt, kan het ontwerp bekijken, niet bewerken.
            resultaat.url = 'https://www.canva.com/design/' + canva[1] + '/' + canva[2] + '/view';
            resultaat.embed = resultaat.url + '?embed';
        }
        return resultaat;
    }

    // --- SharePoint: werkt alleen met een Ligo-account ----------------------
    if (programma.naam === 'SharePoint') {
        resultaat.type = 'sharepoint';
        resultaat.alleenLigo = true;
        if (isBeeld) {
            // Een afbeelding op SharePoint (bv. een onthoudblad). De thumbnail lukt alleen
            // in een browser die al aangemeld is bij SharePoint; anders toont de website een plaatsvervanger.
            resultaat.soort = 'Afbeelding';
            resultaat.thumb = url;
        }
        return resultaat;
    }

    return resultaat;
}

/**
 * Zet de instellingen van een SoundCloud-speler altijd goed:
 * geen gerelateerde fragmenten, geen reacties, geen gebruikersnaam, niet automatisch starten.
 * Bestaande waarden in de link worden overschreven.
 */
function verbeterSoundcloud(src) {
    var gewenst = {
        auto_play: 'false',
        hide_related: 'true',
        show_comments: 'false',
        show_user: 'false',
        show_reposts: 'false',
        show_teaser: 'false',
        visual: 'false',
        color: '%23056181'
    };
    var delen = src.split('?');
    var basis = delen[0];
    var parameters = (delen.slice(1).join('?') || '').split('&').filter(function (p) {
        var naam = p.split('=')[0];
        return p && !Object.prototype.hasOwnProperty.call(gewenst, naam);
    });
    Object.keys(gewenst).forEach(function (naam) {
        parameters.push(naam + '=' + gewenst[naam]);
    });
    return basis + '?' + parameters.join('&');
}

/** Een korte, stabiele vergelijkingsvorm van een link (om dubbels te vinden). */
function linkSleutel(analyse) {
    if (!analyse) {
        return '';
    }
    if (analyse.videoId) {
        return 'yt:' + analyse.videoId;
    }
    return analyse.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '');
}

// ============================================================================
// Cache.gs
// ============================================================================

/**
 * Cache.gs — bewaart de catalogus even, zodat niet elke bezoeker de hele sheet laat inlezen.
 *
 * Hoe het werkt:
 *   - De eerste bezoeker laat de catalogus opbouwen (enkele seconden).
 *   - Het resultaat gaat gecomprimeerd in de cache van Google, voor "Vernieuwen na (minuten)".
 *   - Volgende bezoekers krijgen het resultaat meteen.
 *   - Wie iets wijzigt in DEZE sheet, leegt automatisch de cache (zie onEdit in Menu.gs).
 *     Voor lijsten van anderen (zie Lijsten.gs) kan dat niet: daar telt "Vernieuwen na (minuten)"
 *     van die lijst, of de knop "Gegevens vernieuwen" op de website.
 *
 * Elke lijst heeft zijn eigen plek in de cache. Een cache-waarde mag maximaal 100 KB zijn:
 * daarom knippen we de gegevens in stukken. Elke versie krijgt een eigen nummer, zodat
 * niemand ooit stukken van twee verschillende versies door elkaar leest.
 */

var CACHE_STUKGROOTTE = 90000;

function cacheSleutel(lijst) {
    return 'cat_' + (lijst || 'eigen');
}

/**
 * Geeft de volledige catalogus van een lijst terug ('' = deze sheet):
 *   { collecties, filters, items, problemen, instellingen, gemaakt }
 * Uit de cache als dat kan, anders opnieuw opgebouwd.
 */
function haalCatalogus(lijst) {
    var sleutel = cacheSleutel(lijst);
    var uitCache = leesUitCache(sleutel);
    if (uitCache) {
        return uitCache;
    }

    // Vermijd dat tien bezoekers tegelijk de sheet inlezen: één doet het, de rest wacht.
    var slot = LockService.getScriptLock();
    var gekregen = slot.tryLock(30000);
    try {
        uitCache = leesUitCache(sleutel);
        if (uitCache) {
            return uitCache;
        }
        var catalogus = bouwVoorLijst(lijst);
        schrijfInCache(sleutel, catalogus, catalogus.instellingen.cacheMinuten * 60);
        return catalogus;
    } finally {
        if (gekregen) {
            slot.releaseLock();
        }
    }
}

/** Bouwt de catalogus van een lijst op, met de instellingen van die lijst erbij. */
function bouwVoorLijst(lijst) {
    var bron = openLijst(lijst);
    try {
        var instellingen = leesInstellingen(bron.spreadsheet);
        var catalogus = bouwCatalogus(bron.spreadsheet);
        catalogus.instellingen = {
            titel: instellingen.titel,
            ondertitel: instellingen.ondertitel,
            loginVerplicht: instellingen.loginVerplicht,
            domeinen: instellingen.domeinen,
            cacheMinuten: instellingen.cacheMinuten,
            oudeLinks: instellingen.oudeLinks
        };
        catalogus.gemaakt = new Date().toISOString();
        return catalogus;
    } finally {
        bron.opruimen();
    }
}

function schrijfInCache(sleutel, object, seconden) {
    var cache = CacheService.getScriptCache();
    var gezipt = Utilities.gzip(Utilities.newBlob(JSON.stringify(object), 'application/json'));
    var tekst = Utilities.base64Encode(gezipt.getBytes());
    var versie = String(new Date().getTime());

    var stukken = {};
    var aantal = Math.ceil(tekst.length / CACHE_STUKGROOTTE);
    for (var i = 0; i < aantal; i++) {
        stukken[sleutel + '_' + versie + '_' + i] = tekst.slice(i * CACHE_STUKGROOTTE, (i + 1) * CACHE_STUKGROOTTE);
    }
    // Eerst de stukken, dan pas de index: zo leest niemand een half geschreven catalogus.
    cache.putAll(stukken, seconden);
    cache.put(sleutel + '_index', JSON.stringify({ aantal: aantal, versie: versie, gemaakt: object.gemaakt }), seconden);
}

function leesUitCache(sleutel) {
    var cache = CacheService.getScriptCache();
    var index = cache.get(sleutel + '_index');
    if (!index) {
        return null;
    }
    var info = JSON.parse(index);
    var sleutels = [];
    for (var i = 0; i < info.aantal; i++) {
        sleutels.push(sleutel + '_' + info.versie + '_' + i);
    }
    var stukken = cache.getAll(sleutels);
    var tekst = '';
    for (var j = 0; j < sleutels.length; j++) {
        if (!stukken[sleutels[j]]) {
            return null; // een stuk is al verlopen: opnieuw opbouwen
        }
        tekst += stukken[sleutels[j]];
    }
    var blob = Utilities.newBlob(Utilities.base64Decode(tekst), 'application/x-gzip');
    return JSON.parse(Utilities.ungzip(blob).getDataAsString());
}

/** Leegt de cache van een lijst ('' = deze sheet): de volgende bezoeker ziet meteen de nieuwste versie. */
function leegCache(lijst) {
    CacheService.getScriptCache().remove(cacheSleutel(lijst) + '_index');
}

/**
 * Voor de knop "Gegevens vernieuwen" op de website: leegt de cache, maar alleen als de
 * gegevens ouder zijn dan `minSeconden`. Zo kan niemand het script laten overuren door
 * honderd keer op de knop te drukken.
 */
function vernieuwIndienOud(lijst, minSeconden) {
    var index = CacheService.getScriptCache().get(cacheSleutel(lijst) + '_index');
    if (index) {
        var leeftijd = (new Date().getTime() - new Date(JSON.parse(index).gemaakt).getTime()) / 1000;
        if (leeftijd < minSeconden) {
            return false;
        }
    }
    leegCache(lijst);
    return true;
}

// ============================================================================
// Login.gs
// ============================================================================

/**
 * Login.gs — controleert of een lesgever echt ingelogd is met een toegelaten Microsoft-account.
 *
 * Alleen nodig als in "Website-instellingen" staat: Login verplicht = ja.
 *
 * Hoe het werkt:
 *   1. De website laat de lesgever inloggen bij Microsoft (met de bibliotheek MSAL).
 *   2. Microsoft geeft de website een toegangssleutel (access token).
 *   3. De website stuurt die sleutel mee bij het opvragen van de catalogus.
 *   4. Dit script vraagt aan Microsoft zelf: "van wie is deze sleutel?" (Microsoft Graph /me).
 *      Een valse of verlopen sleutel wordt door Microsoft geweigerd.
 *   5. Het e-mailadres moet eindigen op een toegelaten domein (bv. ligo.be).
 *
 * Er wordt nergens een wachtwoord of geheime sleutel bewaard.
 */

function controleerLogin(token, instellingen) {
    if (!token) {
        return { ok: false, fout: 'Je bent niet ingelogd.' };
    }

    // Een goedgekeurde sleutel onthouden we 10 minuten, zodat we Microsoft niet bij elke klik bevragen.
    var cache = CacheService.getScriptCache();
    var cacheSleutel = 'login_' + Utilities.base64EncodeWebSafe(
        Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
    ).slice(0, 40);
    var onthouden = cache.get(cacheSleutel);
    if (onthouden) {
        return { ok: true, email: onthouden };
    }

    var antwoord = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true
    });
    if (antwoord.getResponseCode() !== 200) {
        return { ok: false, fout: 'Je login is verlopen of ongeldig. Log opnieuw in.' };
    }

    var gegevens = JSON.parse(antwoord.getContentText());
    var email = String(gegevens.mail || gegevens.userPrincipalName || '').toLowerCase();
    var domein = email.split('@')[1] || '';

    if (instellingen.domeinen.length === 0) {
        return { ok: false, fout: 'Er zijn nog geen toegelaten e-maildomeinen ingesteld (tabblad Website-instellingen).' };
    }
    if (instellingen.domeinen.indexOf(domein) === -1) {
        return { ok: false, fout: 'Het account ' + email + ' heeft geen toegang tot deze website.' };
    }

    cache.put(cacheSleutel, email, 600);
    return { ok: true, email: email };
}

// ============================================================================
// Menu.gs
// ============================================================================

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
        .addSeparator()
        .addSubMenu(SpreadsheetApp.getUi().createMenu('Lijsten van anderen')
            .addItem('Lijst toevoegen…', 'menuLijstToevoegen')
            .addItem('Controle van een lijst…', 'menuLijstControle')
            .addItem('Alle lijsten vernieuwen', 'menuLijstenVernieuwen'))
        .addToUi();
}

/** Bij elke wijziging in de sheet: cache leegmaken, zodat de website meteen de nieuwe versie toont. */
function onEdit() {
    try {
        leegCache('');
    } catch (fout) {
        // Een fout hier mag het bewerken van de sheet nooit hinderen.
    }
}

function menuVernieuwen() {
    leegCache('');
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
    var overslaan = [TAB_BRONNEN, TAB_INSTELLINGEN, TAB_CONTROLE, TAB_LIJSTEN];
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
    schrijfControle(ss, bouwCatalogus(ss), 'deze sheet');
    leegCache('');
}

/** Schrijft het controlerapport in het tabblad "Controle" van deze sheet. */
function schrijfControle(ss, catalogus, over) {
    var blad = ss.getSheetByName(TAB_CONTROLE) || ss.insertSheet(TAB_CONTROLE);
    blad.clear();

    var deelbaar = catalogus.items.filter(function (i) {
        return i.deelbaar;
    }).length;
    var samenvatting = [
        ['Controle van ' + over + ' — ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'), '', '', '', '', ''],
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
}

// ---------------------------------------------------------------------------
// Lijsten van anderen (zie Lijsten.gs)
// ---------------------------------------------------------------------------

/** Vraagt iets via een venstertje; geeft null terug bij Annuleren. */
function vraag(titel, tekst) {
    var ui = SpreadsheetApp.getUi();
    var antwoord = ui.prompt(titel, tekst, ui.ButtonSet.OK_CANCEL);
    if (antwoord.getSelectedButton() !== ui.Button.OK) {
        return null;
    }
    return antwoord.getResponseText().trim();
}

function menuLijstToevoegen() {
    var ui = SpreadsheetApp.getUi();
    var ss = SpreadsheetApp.getActive();

    var link = vraag('Lijst toevoegen (1/2)',
        'Plak de link naar de Google Sheet of het Excel-bestand op Google Drive.\n' +
        'De eigenaar moet het eerst delen met dit account (lezen volstaat).');
    if (!link) return;

    // Eerst proberen te openen en in te lezen: zo weet je meteen of alles klopt.
    var bron;
    var catalogus;
    try {
        bron = openBestand(link);
        catalogus = bouwCatalogus(bron.spreadsheet);
    } catch (fout) {
        ui.alert('Lijst toevoegen', 'Dat lukte niet:\n' + fout.message, ui.ButtonSet.OK);
        return;
    } finally {
        if (bron) bron.opruimen();
    }

    var code = normaliseerLijstCode(vraag('Lijst toevoegen (2/2)',
        'Geef een korte code voor deze lijst (kleine letters, geen spaties), bv. leerlijn-alfa.\n' +
        'De lijst komt dan op het adres van de website met ?lijst=<code> erachter.'));
    if (!code) return;
    if (leesLijsten(ss).some(function (l) { return l.code === code; })) {
        ui.alert('Lijst toevoegen', 'De code "' + code + '" bestaat al. Kies een andere code.', ui.ButtonSet.OK);
        return;
    }

    var blad = ss.getSheetByName(TAB_LIJSTEN) || maakLijstenTabblad(ss);
    blad.getRange(blad.getLastRow() + 1, 1, 1, LIJST_KOLOMMEN.length)
        .setValues([['ja', code, bron.naam || '', link, '']]);

    var adres = leesInstellingen(ss).websiteAdres;
    var ernstig = catalogus.problemen.filter(function (p) {
        return /niet gevonden|bestaat niet|ontbreekt/.test(p.probleem);
    });
    ui.alert('Lijst toegevoegd',
        'Code: ' + code + '\nItems: ' + catalogus.items.length + '\nMeldingen: ' + catalogus.problemen.length +
        (ernstig.length ? '\n\nLET OP:\n' + ernstig.slice(0, 5).map(function (p) { return p.probleem; }).join('\n') : '') +
        '\n\nAdres: ' + (adres ? adres.replace(/\/?$/, '/') + '?lijst=' + code : '(adres van de website)?lijst=' + code),
        ui.ButtonSet.OK);
}

function menuLijstControle() {
    var ui = SpreadsheetApp.getUi();
    var code = normaliseerLijstCode(vraag('Controle van een lijst', 'Code van de lijst (zie tabblad Lijsten):'));
    if (!code) return;
    try {
        leegCache(code);
        schrijfControle(SpreadsheetApp.getActive(), haalCatalogus(code), 'lijst "' + code + '"');
    } catch (fout) {
        ui.alert('Controle', fout.message, ui.ButtonSet.OK);
    }
}

function menuLijstenVernieuwen() {
    var ss = SpreadsheetApp.getActive();
    leegCache('');
    leesLijsten(ss).forEach(function (l) {
        leegCache(l.code);
    });
    ss.toast('Alle lijsten tonen bij de volgende keer laden de nieuwste gegevens.', 'Website', 5);
}

// ============================================================================
// Import.gs
// ============================================================================

/**
 * Import.gs — een Excel-bestand inladen in deze Google Sheet.
 *
 * Voor overzichten die in Excel (op SharePoint) bijgehouden worden:
 * de Google Sheet is dan een KOPIE die alleen dient om de website te voeden.
 * Af en toe laadt iemand de nieuwste Excel-versie in via 🌐 Website → Excel-bestand inladen.
 *
 * Wat er gebeurt:
 *   1. Het venster stuurt het Excel-bestand naar dit script.
 *   2. Google Drive zet het om naar een tijdelijke Google Sheet (daarvoor is de dienst "Drive API" nodig).
 *   3. Elk tabblad met gegevens wordt overgenomen: de getoonde waarden, de hyperlinks
 *      en de verborgen kolommen. Formules niet: de kopie hoeft niets te berekenen.
 *   4. De tabbladen Website, Website-instellingen en Controle blijven ONGEWIJZIGD.
 *   5. Het tijdelijke bestand gaat naar de prullenbak, de cache wordt geleegd,
 *      en je krijgt meteen een verslag met de controle.
 *
 * Belangrijk: werk nooit in de kopie zelf. Bij het volgende inladen wordt alles overschreven.
 * "Op website" en "Vrij te delen" horen dus in het Excel-bestand.
 */

var IMPORT_BLOK = 500; // zoveel rijen per keer wegschrijven

/** Toont het venster om een Excel-bestand te kiezen. */
function menuExcelInladen() {
    var html = HtmlService.createHtmlOutput(IMPORT_VENSTER_HTML).setWidth(460).setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(html, 'Excel-bestand inladen');
}

/**
 * Wordt aangeroepen vanuit het venster (google.script.run).
 * @param bestandsnaam  naam van het gekozen bestand
 * @param base64        de inhoud van het bestand, als base64-tekst
 * @return              een verslag voor het venster
 */
function importeerExcel(bestandsnaam, base64) {
    if (!/\.xls[xm]?$/i.test(bestandsnaam)) {
        throw new Error('Kies een Excel-bestand (.xlsx).');
    }
    var doel = SpreadsheetApp.getActive();
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), MimeType.MICROSOFT_EXCEL, bestandsnaam);
    var tijdelijkId = zetOmNaarGoogleSheet(blob, 'Tijdelijk – ' + bestandsnaam);

    var verslag = [];
    try {
        var bron = SpreadsheetApp.openById(tijdelijkId);
        var overslaan = [TAB_BRONNEN, TAB_INSTELLINGEN, TAB_CONTROLE, TAB_LIJSTEN];
        var namenInExcel = [];

        bron.getSheets().forEach(function (blad) {
            var naam = blad.getName();
            namenInExcel.push(naam);
            if (overslaan.indexOf(naam) !== -1) {
                verslag.push('Overgeslagen: "' + naam + '" (instellingen blijven in de Google Sheet).');
                return;
            }
            var nieuw = !doel.getSheetByName(naam);
            var rijen = kopieerBlad(blad, doel);
            verslag.push((nieuw ? 'Nieuw tabblad: "' : 'Bijgewerkt: "') + naam + '" (' + rijen + ' rijen).');
        });

        doel.getSheets().forEach(function (blad) {
            var naam = blad.getName();
            if (overslaan.indexOf(naam) === -1 && namenInExcel.indexOf(naam) === -1) {
                verslag.push('Niet in het Excel-bestand, ongewijzigd: "' + naam + '".');
            }
        });
    } finally {
        // Het tijdelijke bestand altijd opruimen, ook als er iets misliep.
        DriveApp.getFileById(tijdelijkId).setTrashed(true);
    }

    noteerImport(doel, bestandsnaam);
    leegCache('');

    var catalogus = bouwCatalogus(doel);
    var ernstig = catalogus.problemen.filter(function (p) {
        return /niet gevonden|bestaat niet/.test(p.probleem);
    });
    return {
        verslag: verslag,
        items: catalogus.items.length,
        deelbaar: catalogus.items.filter(function (i) {
            return i.deelbaar;
        }).length,
        meldingen: catalogus.problemen.length,
        ernstig: ernstig.map(function (p) {
            return p.probleem;
        })
    };
}

/** Zet een Excel-bestand om naar een (tijdelijke) Google Sheet en geeft de ID terug. */
function zetOmNaarGoogleSheet(blob, naam) {
    if (typeof Drive === 'undefined') {
        throw new Error('De dienst "Drive API" staat niet aan. Open Extensies → Apps Script, klik links bij ' +
            '"Services" op + , kies "Drive API" en klik op "Toevoegen". Probeer daarna opnieuw.');
    }
    var googleSheet = 'application/vnd.google-apps.spreadsheet';
    if (Drive.Files.create) {
        // Drive API versie 3 (standaard voor nieuwe projecten)
        return Drive.Files.create({ name: naam, mimeType: googleSheet }, blob).id;
    }
    // Drive API versie 2 (oudere projecten)
    return Drive.Files.insert({ title: naam, mimeType: googleSheet }, blob, { convert: true }).id;
}

/**
 * Neemt één tabblad over: getoonde waarden + hyperlinks + verborgen kolommen + vastgezette rijen.
 * Geeft het aantal rijen terug.
 */
function kopieerBlad(bronBlad, doel) {
    var naam = bronBlad.getName();
    var doelBlad = doel.getSheetByName(naam) || doel.insertSheet(naam);
    var aantalRijen = bronBlad.getLastRow();
    var aantalKolommen = bronBlad.getLastColumn();

    // Het oude tabblad leegmaken (inhoud, opmaak, keuzelijsten) en alle kolommen weer tonen.
    doelBlad.clear();
    doelBlad.getRange(1, 1, doelBlad.getMaxRows(), doelBlad.getMaxColumns()).clearDataValidations();
    doelBlad.showColumns(1, doelBlad.getMaxColumns());
    if (aantalRijen === 0 || aantalKolommen === 0) {
        return 0;
    }

    // Genoeg rijen en kolommen voorzien.
    if (doelBlad.getMaxRows() < aantalRijen) {
        doelBlad.insertRowsAfter(doelBlad.getMaxRows(), aantalRijen - doelBlad.getMaxRows());
    }
    if (doelBlad.getMaxColumns() < aantalKolommen) {
        doelBlad.insertColumnsAfter(doelBlad.getMaxColumns(), aantalKolommen - doelBlad.getMaxColumns());
    }

    // Per blok van 500 rijen: zo blijft het geheugen binnen de grenzen van Google.
    for (var start = 1; start <= aantalRijen; start += IMPORT_BLOK) {
        var n = Math.min(IMPORT_BLOK, aantalRijen - start + 1);
        var bereik = bronBlad.getRange(start, 1, n, aantalKolommen);
        var tekst = bereik.getDisplayValues();
        var rijk = bereik.getRichTextValues();
        var formules = bereik.getFormulas();

        var uit = tekst.map(function (rij, r) {
            return rij.map(function (waarde, k) {
                return celMetLink(waarde, rijk[r][k], formules[r][k]);
            });
        });
        doelBlad.getRange(start, 1, n, aantalKolommen).setRichTextValues(uit);
    }

    for (var kol = 1; kol <= aantalKolommen; kol++) {
        if (bronBlad.isColumnHiddenByUser(kol)) {
            doelBlad.hideColumns(kol);
        }
    }
    doelBlad.setFrozenRows(Math.min(bronBlad.getFrozenRows(), aantalRijen));
    return aantalRijen;
}

/**
 * Eén cel als tekst, met de hyperlink als die er is.
 * Een link kan op twee manieren in een cel zitten: als hyperlink achter de tekst,
 * of als formule =HYPERLINK("https://...";"tekst").
 */
function celMetLink(waarde, rijkeTekst, formule) {
    var link = '';
    if (rijkeTekst) {
        link = rijkeTekst.getLinkUrl() || '';
        if (!link && rijkeTekst.getRuns) {
            var runs = rijkeTekst.getRuns();
            for (var i = 0; i < runs.length && !link; i++) {
                link = runs[i].getLinkUrl() || '';
            }
        }
    }
    if (!link && formule) {
        var m = String(formule).match(/HYPERLINK\(\s*"([^"]+)"/i);
        if (m) {
            link = m[1];
        }
    }
    var bouwer = SpreadsheetApp.newRichTextValue().setText(String(waarde));
    if (link && String(waarde) !== '') {
        bouwer.setLinkUrl(link);
    }
    return bouwer.build();
}

/** Schrijft in Website-instellingen wanneer welk bestand ingeladen werd. */
function noteerImport(spreadsheet, bestandsnaam) {
    var blad = spreadsheet.getSheetByName(TAB_INSTELLINGEN);
    if (!blad) {
        return;
    }
    var tekst = bestandsnaam + ' — ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    var waarden = blad.getDataRange().getDisplayValues();
    for (var r = 0; r < waarden.length; r++) {
        if (normaliseerKop(waarden[r][0]) === 'laatste excel-import') {
            blad.getRange(r + 1, 2).setValue(tekst);
            return;
        }
    }
    blad.getRange(waarden.length + 1, 1, 1, 3).setValues([['Laatste Excel-import', tekst, 'Wordt automatisch ingevuld']]);
}

/** Het venster (HTML + een beetje JavaScript), als tekst zodat alles in één bestand Code.gs past. */
var IMPORT_VENSTER_HTML = [
    '<!DOCTYPE html><html><head><base target="_top"><style>',
    'body{font-family:Arial,sans-serif;font-size:14px;color:#15303d;margin:0;padding:4px 2px}',
    'p{margin:0 0 12px;line-height:1.4}',
    '.let{background:#fdf1dc;color:#93500b;padding:8px 10px;border-radius:6px}',
    'input[type=file]{margin:6px 0 14px;width:100%}',
    'button{background:#056181;color:#fff;border:0;border-radius:6px;padding:10px 18px;font-size:14px;font-weight:bold;cursor:pointer}',
    'button:disabled{background:#9bb;cursor:wait}',
    '#status{margin-top:14px;white-space:pre-line;line-height:1.45}',
    '.fout{color:#b42318}.ok{color:#087443}',
    '</style></head><body>',
    '<p>Kies de <b>nieuwste versie</b> van het Excel-bestand. De tabbladen met gegevens worden vervangen.</p>',
    '<p class="let">Werk nooit in deze Google-kopie: wijzigingen hier gaan verloren bij het volgende inladen.</p>',
    '<input type="file" id="bestand" accept=".xlsx,.xlsm,.xls">',
    '<button id="knop" onclick="laad()">Inladen</button>',
    '<div id="status"></div>',
    '<script>',
    'function toon(t,k){var s=document.getElementById("status");s.className=k||"";s.textContent=t;}',
    'function laad(){',
    '  var f=document.getElementById("bestand").files[0];',
    '  if(!f){toon("Kies eerst een bestand.","fout");return;}',
    '  if(f.size>40*1024*1024){toon("Dit bestand is te groot (meer dan 40 MB).","fout");return;}',
    '  var knop=document.getElementById("knop");knop.disabled=true;',
    '  toon("Bezig met inladen… Dit kan een minuut duren. Sluit dit venster niet.");',
    '  var lezer=new FileReader();',
    '  lezer.onload=function(){',
    '    var base64=String(lezer.result).split(",")[1];',
    '    google.script.run',
    '      .withSuccessHandler(function(r){',
    '        knop.disabled=false;',
    '        var t="Klaar.\\n\\n"+r.verslag.join("\\n")+"\\n\\nOp de website: "+r.items+" items, waarvan "+r.deelbaar+" vrij te delen.";',
    '        if(r.ernstig.length){t+="\\n\\nLET OP:\\n"+r.ernstig.join("\\n");toon(t,"fout");}',
    '        else{t+="\\nMeldingen: "+r.meldingen+" (zie Website → Controle uitvoeren).";toon(t,"ok");}',
    '      })',
    '      .withFailureHandler(function(e){knop.disabled=false;toon("Het inladen is mislukt:\\n"+e.message,"fout");})',
    '      .importeerExcel(f.name,base64);',
    '  };',
    '  lezer.readAsDataURL(f);',
    '}',
    '</script></body></html>'
].join('\n');

// ============================================================================
// Lijsten.gs
// ============================================================================

/**
 * Lijsten.gs — één centrale website voor meerdere lijsten.
 *
 * Naast de eigen gegevens kan dit script ook lijsten van ANDEREN tonen:
 * een opleidingsverantwoordelijke vult het sjabloon in, deelt de sheet (alleen lezen)
 * met het account dat dit script beheert, en de beheerder zet één rij in het tabblad "Lijsten".
 * De lijst staat dan op  <adres van de website>?lijst=<code>
 *
 * De lijst mag zijn:
 *   - een Google Sheet, of
 *   - een Excel-bestand (.xlsx) op Google Drive. Dat wordt bij het inlezen omgezet
 *     (daarvoor is de dienst Drive API nodig, net als bij Excel-bestand inladen).
 *     Bijwerken = in Drive een nieuwe versie van hetzelfde bestand uploaden.
 *
 * Alleen lijsten die in het tabblad "Lijsten" staan (en Actief zijn) kunnen geopend worden:
 * niemand kan via de website een willekeurige sheet laten inlezen.
 */

var TAB_LIJSTEN = 'Lijsten';

var LIJST_KOLOMMEN = [
    { sleutel: 'actief', kop: 'Actief', uitleg: 'ja / nee' },
    { sleutel: 'code', kop: 'Code', uitleg: 'Kort, zonder spaties, bv. leerlijn-alfa. Komt in het adres: ?lijst=leerlijn-alfa' },
    { sleutel: 'naam', kop: 'Naam', uitleg: 'Voor jezelf: wat is dit voor lijst?' },
    { sleutel: 'link', kop: 'Link naar de sheet', uitleg: 'De link naar de Google Sheet of het Excel-bestand op Google Drive' },
    { sleutel: 'contact', kop: 'Contactpersoon', uitleg: 'Wie houdt deze lijst bij?' }
];

var MIME_GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet';
var MIME_EXCEL = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroEnabled.12'
];

/** "Leerlijn Alfa!" → "leerlijnalfa". Alleen kleine letters, cijfers en koppeltekens. */
function normaliseerLijstCode(code) {
    return String(code || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function leesLijsten(spreadsheet) {
    var blad = spreadsheet.getSheetByName(TAB_LIJSTEN);
    if (!blad || blad.getLastRow() < 2) {
        return [];
    }
    var waarden = blad.getDataRange().getDisplayValues();
    var koppen = waarden[0].map(normaliseerKop);
    var positie = {};
    LIJST_KOLOMMEN.forEach(function (k) {
        positie[k.sleutel] = koppen.indexOf(normaliseerKop(k.kop));
    });
    var lijsten = [];
    for (var r = 1; r < waarden.length; r++) {
        var lijst = {};
        LIJST_KOLOMMEN.forEach(function (k) {
            lijst[k.sleutel] = positie[k.sleutel] === -1 ? '' : String(waarden[r][positie[k.sleutel]]).trim();
        });
        lijst.code = normaliseerLijstCode(lijst.code);
        if (lijst.code && lijst.link) {
            lijst.actief = !isNee(lijst.actief);
            lijsten.push(lijst);
        }
    }
    return lijsten;
}

/** Haalt de bestands-ID uit een link van Google Sheets of Google Drive. */
function haalBestandsId(link) {
    var tekst = String(link || '').trim();
    var m = tekst.match(/\/d\/([A-Za-z0-9_-]{20,})/) || tekst.match(/[?&]id=([A-Za-z0-9_-]{20,})/);
    if (m) {
        return m[1];
    }
    return /^[A-Za-z0-9_-]{20,}$/.test(tekst) ? tekst : '';
}

/**
 * Opent de spreadsheet van een lijst. Geeft { spreadsheet, opruimen } terug.
 * Na gebruik ALTIJD opruimen() aanroepen (bij Excel: het tijdelijke bestand weggooien).
 */
function openLijst(code) {
    code = normaliseerLijstCode(code);
    if (!code) {
        return { spreadsheet: SpreadsheetApp.getActive(), opruimen: function () {} };
    }
    var lijst = leesLijsten(SpreadsheetApp.getActive()).filter(function (l) {
        return l.code === code && l.actief;
    })[0];
    if (!lijst) {
        throw new Error('De lijst "' + code + '" bestaat niet (meer).');
    }
    return openBestand(lijst.link);
}

/** Opent een Google Sheet of een Excel-bestand op Drive, via de link. */
function openBestand(link) {
    var id = haalBestandsId(link);
    if (!id) {
        throw new Error('Dit is geen geldige link naar een Google Sheet of een bestand op Google Drive.');
    }
    var bestand;
    try {
        bestand = DriveApp.getFileById(id);
    } catch (fout) {
        throw new Error('Geen toegang tot deze lijst. Deel de sheet (lezen volstaat) met het account dat de website beheert.');
    }
    var soort = bestand.getMimeType();
    if (soort === MIME_GOOGLE_SHEET) {
        return { spreadsheet: SpreadsheetApp.openById(id), opruimen: function () {}, naam: bestand.getName() };
    }
    if (MIME_EXCEL.indexOf(soort) !== -1) {
        var tijdelijkId = zetOmNaarGoogleSheet(bestand.getBlob(), 'Tijdelijk – ' + bestand.getName());
        return {
            spreadsheet: SpreadsheetApp.openById(tijdelijkId),
            naam: bestand.getName(),
            opruimen: function () {
                DriveApp.getFileById(tijdelijkId).setTrashed(true);
            }
        };
    }
    throw new Error('Dit bestand is geen Google Sheet en geen Excel-bestand.');
}

// ---------------------------------------------------------------------------
// Zelf aanmelden via de website (pagina …/aanmelden/)
// ---------------------------------------------------------------------------

/** Wat de aanmeldpagina moet weten. */
function aanmeldInfo() {
    var instellingen = leesInstellingen(SpreadsheetApp.getActive());
    return {
        ok: true,
        toegelaten: instellingen.aanmelden,
        codeNodig: Boolean(instellingen.aanmeldcode),
        // Met dit account moet de lijst gedeeld worden (het account dat het script uitvoert).
        account: Session.getEffectiveUser().getEmail()
    };
}

/**
 * Voegt een lijst toe op vraag van de website.
 * p: { link, code, contact, aanmeldcode }
 * Alles wordt eerst gecontroleerd; pas als de lijst echt werkt, komt ze in het tabblad Lijsten.
 */
function meldLijstAan(p) {
    var ss = SpreadsheetApp.getActive();
    var instellingen = leesInstellingen(ss);

    if (!instellingen.aanmelden) {
        return { ok: false, fout: 'Zelf aanmelden staat uit. Vraag de beheerder van de website om je lijst toe te voegen.' };
    }
    if (instellingen.aanmeldcode && String(p.aanmeldcode || '').trim() !== instellingen.aanmeldcode) {
        return { ok: false, fout: 'De aanmeldcode klopt niet.' };
    }

    var code = normaliseerLijstCode(p.code);
    if (code.length < 3 || code.length > 40) {
        return { ok: false, fout: 'Kies een code van 3 tot 40 tekens: kleine letters, cijfers en koppeltekens.' };
    }
    var id = haalBestandsId(p.link);
    if (!id) {
        return { ok: false, fout: 'Dit is geen geldige link naar een Google Sheet of een bestand op Google Drive.' };
    }
    var contact = String(p.contact || '').trim().slice(0, 100);
    if (!contact) {
        return { ok: false, fout: 'Vul je naam of e-mailadres in, zodat de beheerder weet wie deze lijst bijhoudt.' };
    }

    // Staat dit bestand er al? Geef dan de bestaande code terug.
    var bestaand = leesLijsten(ss).filter(function (l) {
        return haalBestandsId(l.link) === id;
    })[0];
    if (bestaand) {
        return { ok: false, fout: 'Deze lijst staat al online, met de code "' + bestaand.code + '".', code: bestaand.code };
    }

    // Openen en inlezen: werkt de lijst echt?
    var bron;
    var catalogus;
    var titel = '';
    try {
        bron = openBestand(p.link);
        catalogus = bouwCatalogus(bron.spreadsheet);
        titel = leesInstellingen(bron.spreadsheet).titel;
    } catch (fout) {
        return { ok: false, fout: fout.message };
    } finally {
        if (bron) bron.opruimen();
    }
    var ernstig = catalogus.problemen.filter(function (pr) {
        return /niet gevonden|bestaat niet/.test(pr.probleem);
    });
    if (ernstig.length || catalogus.items.length === 0) {
        return {
            ok: false,
            fout: 'Er staan nog geen links in deze lijst die de website kan tonen. Volgde je het sjabloon?',
            details: ernstig.map(function (pr) { return pr.probleem; }).slice(0, 5)
        };
    }

    // Toevoegen. Het slot zorgt dat twee mensen niet tegelijk dezelfde code krijgen.
    var slot = LockService.getScriptLock();
    slot.waitLock(20000);
    try {
        if (leesLijsten(ss).some(function (l) { return l.code === code; })) {
            return { ok: false, fout: 'De code "' + code + '" is al in gebruik. Kies een andere.' };
        }
        var blad = ss.getSheetByName(TAB_LIJSTEN) || maakLijstenTabblad(ss);
        var datum = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
        blad.getRange(blad.getLastRow() + 1, 1, 1, LIJST_KOLOMMEN.length)
            .setValues([['ja', code, bron.naam || '', p.link, contact + ' (aangemeld ' + datum + ')']]);
    } finally {
        slot.releaseLock();
    }

    return {
        ok: true,
        code: code,
        titel: titel,
        items: catalogus.items.length,
        meldingen: catalogus.problemen.length
    };
}

function maakLijstenTabblad(ss) {
    var blad = ss.insertSheet(TAB_LIJSTEN);
    blad.getRange(1, 1, 1, LIJST_KOLOMMEN.length).setValues([LIJST_KOLOMMEN.map(function (k) { return k.kop; })]);
    LIJST_KOLOMMEN.forEach(function (k, i) {
        blad.getRange(1, i + 1).setNote(k.uitleg);
    });
    opmaakKoprij(blad, LIJST_KOLOMMEN.length);
    return blad;
}
