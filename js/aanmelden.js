/**
 * aanmelden.js — de aanmeldpagina: een collega zet zelf een lijst online.
 *
 * Het backend controleert alles (toegang, sjabloon, code). Deze pagina vult alleen
 * het formulier in en toont het resultaat.
 */
import { haalAanmeldInfo, meldAan } from './api.js';
import { el, kopieer, melding } from './hulp.js';

const $ = (id) => document.getElementById(id);

/** Zelfde regel als in het backend (normaliseerLijstCode): kleine letters, cijfers, koppeltekens. */
function maakCode(tekst) {
    return String(tekst || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/** Het adres van de lesgeverssite voor een lijst (de map boven deze pagina). */
function adresVoor(code) {
    const adres = new URL('../', window.location.href);
    adres.search = '';
    adres.hash = '';
    adres.searchParams.set('lijst', code);
    return adres.href;
}

function toonStatus(soort, tekst) {
    const status = $('status');
    status.className = 'status' + (soort ? ' status-' + soort : '');
    status.replaceChildren(tekst ? el('p', {}, tekst) : '');
}

async function start() {
    toonStatus('laden', 'Even geduld…');
    let info;
    try {
        info = await haalAanmeldInfo();
    } catch (fout) {
        toonStatus('fout', fout.message);
        return;
    }
    if (!info.toegelaten) {
        toonStatus('fout', 'Zelf aanmelden staat uit. Vraag de beheerder van de website om je lijst toe te voegen.');
        return;
    }
    toonStatus('', '');
    $('stappen').hidden = false;
    $('account').value = info.account;
    $('code-blok').hidden = !info.codeNodig;

    $('kopieer-account').addEventListener('click', async () => {
        melding(await kopieer(info.account) ? 'Account gekopieerd.' : 'Kopiëren lukte niet: selecteer het adres en kopieer het zelf.');
    });

    $('code').addEventListener('input', () => {
        const code = maakCode($('code').value);
        $('voorbeeld-adres').textContent = 'Je website komt op: ' + (code ? adresVoor(code) : '…');
    });

    $('formulier').addEventListener('submit', verstuur);
}

async function verstuur(e) {
    e.preventDefault();
    const knop = $('verstuur');
    const resultaat = $('resultaat');
    const gegevens = {
        link: $('link').value.trim(),
        code: $('code').value.trim(),
        contact: $('contact').value.trim(),
        aanmeldcode: $('aanmeldcode').value
    };
    if (!gegevens.link || !gegevens.code || !gegevens.contact) {
        resultaat.className = 'resultaat fout';
        resultaat.replaceChildren(el('p', {}, 'Vul de link, de korte naam en je naam in.'));
        return;
    }

    knop.disabled = true;
    knop.textContent = 'Bezig… (dit kan tot een halve minuut duren)';
    resultaat.className = 'resultaat';
    resultaat.replaceChildren();
    try {
        const r = await meldAan(gegevens);
        const adres = adresVoor(r.code);
        resultaat.className = 'resultaat gelukt';
        resultaat.replaceChildren(
            el('h3', {}, 'Je website staat online!'),
            el('p', {}, (r.titel ? '"' + r.titel + '" — ' : '') + r.items + ' links' +
                (r.meldingen ? ', ' + r.meldingen + ' meldingen (zie "Controle van deze lijst" onderaan je website).' : '.')),
            el('div', { class: 'deel-rij' },
                el('input', { class: 'deel-link', type: 'text', readonly: true, value: adres, 'aria-label': 'Adres van je website' }),
                el('button', {
                    type: 'button', class: 'knop knop-licht',
                    onclick: async () => melding(await kopieer(adres) ? 'Adres gekopieerd.' : 'Kopiëren lukte niet.')
                }, 'Kopieer')
            ),
            el('p', { class: 'hulptekst' }, 'Bewaar dit adres en geef het aan je collega\'s. Wijzigingen in je lijst verschijnen vanzelf ' +
                '(of meteen via "Gegevens vernieuwen" onderaan je website).'),
            el('a', { class: 'knop knop-hoofd', href: adres }, 'Naar mijn website')
        );
        $('formulier').hidden = true;
    } catch (fout) {
        resultaat.className = 'resultaat fout';
        resultaat.replaceChildren(el('p', {}, fout.message));
        if (fout.details && fout.details.length) {
            resultaat.append(el('ul', {}, fout.details.map((d) => el('li', {}, d))));
        }
        if (fout.code) {
            resultaat.append(el('p', {}, el('a', { href: adresVoor(fout.code) }, 'Naar de bestaande website')));
        }
    } finally {
        knop.disabled = false;
        knop.textContent = 'Website aanmaken';
    }
}

start();
