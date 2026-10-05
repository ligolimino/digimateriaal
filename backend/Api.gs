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
 *
 * Elk antwoord is JSON met { ok: true, ... } of { ok: false, fout: "..." }.
 */

var VERSIE = '1.0';

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
        var instellingen = leesInstellingen(SpreadsheetApp.getActive());

        if (actie === 'info') {
            return alsJson({
                ok: true,
                titel: instellingen.titel,
                ondertitel: instellingen.ondertitel,
                loginVerplicht: instellingen.loginVerplicht,
                versie: VERSIE
            });
        }

        if (actie === 'catalogus') {
            var gebruiker = null;
            if (instellingen.loginVerplicht) {
                var login = controleerLogin(p.token, instellingen);
                if (!login.ok) {
                    return alsJson({ ok: false, fout: login.fout, loginNodig: true });
                }
                gebruiker = login.email;
            }
            var catalogus = haalCatalogus();
            catalogus.ok = true;
            catalogus.titel = instellingen.titel;
            catalogus.ondertitel = instellingen.ondertitel;
            catalogus.gebruiker = gebruiker;
            return alsJson(catalogus);
        }

        if (actie === 'item') {
            return alsJson(zoekDeelbaarItem(String(p.id || '')));
        }

        return alsJson({ ok: false, fout: 'Onbekende actie: ' + actie });
    } catch (fout) {
        return alsJson({ ok: false, fout: 'Er liep iets mis: ' + fout.message });
    }
}

/**
 * Zoekt één item voor de cursistenpagina.
 * Geeft alleen gegevens terug als het item op "vrij te delen" staat:
 * zo kan niemand met een zelfverzonnen of oude deellink iets anders openen.
 */
function zoekDeelbaarItem(id) {
    if (!/^[A-Za-z0-9]{6,20}$/.test(id)) {
        return { ok: false, fout: 'Deze link is niet geldig.' };
    }
    var catalogus = haalCatalogus();
    var item = catalogus.items.filter(function (i) {
        return i.id === id && i.deelbaar;
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

function alsJson(object) {
    return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}
