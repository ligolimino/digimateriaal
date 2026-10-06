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
