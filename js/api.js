/**
 * api.js — praat met het backend (het Apps Script bij de Google Sheet).
 * De rest van de website weet niet hoe of waar de gegevens opgehaald worden:
 * als het backend ooit verandert, moet alleen dit bestand mee veranderen.
 */
import { CONFIG } from './config.js';

export class ApiFout extends Error {
    constructor(bericht, loginNodig = false) {
        super(bericht);
        this.loginNodig = loginNodig;
    }
}

function controleerConfig() {
    if (!CONFIG.backendUrl) {
        throw new ApiFout('Deze website is nog niet gekoppeld aan een Google Sheet: vul "backendUrl" in, in js/config.js.');
    }
}

async function vraag(parameters, postGegevens = null) {
    controleerConfig();
    const adres = new URL(CONFIG.backendUrl);
    Object.entries(parameters).forEach(([k, v]) => adres.searchParams.set(k, v));

    let antwoord;
    try {
        antwoord = await fetch(adres, postGegevens
            ? {
                method: 'POST',
                // text/plain i.p.v. application/json: zo stuurt de browser geen extra
                // "preflight"-verzoek, dat Apps Script niet ondersteunt.
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(postGegevens)
            }
            : undefined);
    } catch (fout) {
        throw new ApiFout('Geen verbinding met de gegevens. Controleer je internetverbinding en probeer opnieuw.');
    }
    if (!antwoord.ok) {
        throw new ApiFout('De gegevens konden niet geladen worden (fout ' + antwoord.status + ').');
    }
    const gegevens = await antwoord.json();
    if (!gegevens.ok) {
        throw new ApiFout(gegevens.fout || 'Onbekende fout.', Boolean(gegevens.loginNodig));
    }
    return gegevens;
}

export function haalInfo() {
    return vraag({ actie: 'info' });
}

export function haalCatalogus(token = null) {
    return token ? vraag({}, { actie: 'catalogus', token }) : vraag({ actie: 'catalogus' });
}

export function haalItem(id) {
    return vraag({ actie: 'item', id });
}

// ---------------------------------------------------------------------------
// Een kopie van de catalogus in de browser, zodat de pagina meteen iets toont.
// Daarna wordt altijd de nieuwste versie opgehaald.
// ---------------------------------------------------------------------------

const BEWAARSLEUTEL = 'weergave-catalogus:' + CONFIG.backendUrl;

/** Met login bewaren we alleen tot het tabblad sluit (sessionStorage), anders langer (localStorage). */
function opslag(metLogin) {
    try {
        return metLogin ? window.sessionStorage : window.localStorage;
    } catch (fout) {
        return null; // bv. privévenster met geblokkeerde opslag
    }
}

export function leesBewaardeCatalogus(metLogin) {
    try {
        const tekst = opslag(metLogin)?.getItem(BEWAARSLEUTEL);
        return tekst ? JSON.parse(tekst) : null;
    } catch (fout) {
        return null;
    }
}

export function bewaarCatalogus(catalogus, metLogin) {
    try {
        opslag(metLogin)?.setItem(BEWAARSLEUTEL, JSON.stringify(catalogus));
    } catch (fout) {
        // Opslag vol of niet toegelaten: geen probleem, dan laden we gewoon telkens opnieuw.
    }
}
