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
