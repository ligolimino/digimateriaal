/**
 * auth.js — optionele login met een Microsoft-account (Ligo).
 *
 * Gebruikt de officiële bibliotheek van Microsoft (MSAL), die in de map lib/ staat.
 * We laden ze pas als login echt nodig is, zodat de site zonder login sneller is.
 *
 * Werkwijze ("redirect"): de lesgever gaat even naar de inlogpagina van Microsoft
 * en komt daarna terug op deze pagina, met een toegangssleutel.
 */
import { CONFIG } from './config.js';

const BEREIK = ['User.Read']; // alleen: "wie ben jij?" — meer niet
let app = null;

function laadScript(bron) {
    return new Promise((klaar, mislukt) => {
        const s = document.createElement('script');
        s.src = bron;
        s.onload = klaar;
        s.onerror = () => mislukt(new Error('Kon ' + bron + ' niet laden.'));
        document.head.appendChild(s);
    });
}

export function loginIngesteld() {
    return Boolean(CONFIG.login && CONFIG.login.clientId);
}

/** Start MSAL en verwerkt de terugkeer van de inlogpagina van Microsoft. */
export async function startLogin() {
    if (!loginIngesteld()) {
        throw new Error('De sheet vraagt een login, maar in js/config.js is nog geen clientId ingevuld.');
    }
    if (!window.msal) {
        await laadScript(new URL('../lib/msal-browser.min.js', import.meta.url).href);
    }
    app = new window.msal.PublicClientApplication({
        auth: {
            clientId: CONFIG.login.clientId,
            authority: 'https://login.microsoftonline.com/' + (CONFIG.login.tenantId || 'organizations'),
            redirectUri: window.location.origin + window.location.pathname
        },
        cache: { cacheLocation: 'sessionStorage' }
    });
    await app.initialize();
    const resultaat = await app.handleRedirectPromise();
    if (resultaat && resultaat.account) {
        app.setActiveAccount(resultaat.account);
    }
}

function account() {
    return app.getActiveAccount() || app.getAllAccounts()[0] || null;
}

/**
 * Geeft een geldige toegangssleutel terug.
 * Is de lesgever nog niet ingelogd, dan gaat de pagina naar Microsoft (en komt daarna terug).
 */
export async function haalToken() {
    const acc = account();
    if (!acc) {
        await app.loginRedirect({ scopes: BEREIK });
        return new Promise(() => {}); // de pagina wordt verlaten
    }
    try {
        const r = await app.acquireTokenSilent({ scopes: BEREIK, account: acc });
        return r.accessToken;
    } catch (fout) {
        await app.acquireTokenRedirect({ scopes: BEREIK, account: acc });
        return new Promise(() => {});
    }
}

export function gebruikersnaam() {
    const acc = app && account();
    return acc ? acc.username : '';
}

export function uitloggen() {
    if (app) {
        app.logoutRedirect({ account: account() });
    }
}
