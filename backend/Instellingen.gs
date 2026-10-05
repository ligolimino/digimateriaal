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
    { sleutel: 'cacheMinuten', naam: 'Vernieuwen na (minuten)', waarde: '5', uitleg: 'Na een wijziging in de sheet staat ze ten laatste zo lang later online' }
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
    resultaat.domeinen = String(resultaat.domeinen).split(/[;,\s]+/).map(function (d) {
        return d.trim().toLowerCase().replace(/^@/, '');
    }).filter(Boolean);
    var minuten = parseInt(resultaat.cacheMinuten, 10);
    resultaat.cacheMinuten = isNaN(minuten) ? 5 : Math.max(1, Math.min(minuten, 360));
    return resultaat;
}
