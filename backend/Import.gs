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
