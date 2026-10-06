/**
 * deel.js — het venster "Deel met cursisten": link kopiëren of QR-code tonen.
 */
import { CONFIG } from './config.js';
import { el, icoon, kopieer, melding } from './hulp.js';
import { huidigeLijst } from './api.js';
import qrcode from '../lib/qrcode.mjs';

/** Het adres van de cursistenpagina voor één item. Bevat alleen een code, niet de echte link. */
export function deellink(item) {
    const basis = CONFIG.kijkAdres ? new URL(CONFIG.kijkAdres) : new URL('kijk/', window.location.href);
    basis.hash = '';
    basis.search = '';
    if (huidigeLijst()) {
        basis.searchParams.set('lijst', huidigeLijst());
    }
    basis.searchParams.set('id', item.id);
    return basis.href;
}

function qrAfbeelding(tekst) {
    const qr = qrcode(0, 'M');
    qr.addData(tekst);
    qr.make();
    // SVG: blijft scherp, ook groot geprojecteerd op het bord.
    return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}

export function toonDeelvenster(item) {
    const link = deellink(item);
    const venster = el('dialog', { class: 'venster deelvenster', 'aria-labelledby': 'deel-titel' });

    const sluit = () => venster.close();
    const kopieerKnop = el('button', {
        class: 'knop knop-hoofd',
        type: 'button',
        onclick: async () => {
            const gelukt = await kopieer(link);
            melding(gelukt ? 'Link gekopieerd. Plak hem in WhatsApp, Smartschool, ...' : 'Kopiëren lukte niet: selecteer de link en kopieer hem zelf.');
        }
    }, el('span', { html: icoon('kopieer', 'icoon klein') }), 'Kopieer link');

    const qrDoos = el('div', { class: 'qr', html: qrAfbeelding(link) });
    qrDoos.querySelector('svg')?.setAttribute('aria-label', 'QR-code voor ' + item.titel);
    qrDoos.querySelector('svg')?.setAttribute('role', 'img');

    venster.append(
        el('div', { class: 'venster-kop' },
            el('h2', { id: 'deel-titel' }, 'Deel met cursisten'),
            el('button', { class: 'knop-icoon', type: 'button', 'aria-label': 'Sluiten', onclick: sluit, html: icoon('sluit') })
        ),
        el('p', { class: 'deel-item' }, item.titel),
        el('p', { class: 'uitleg' }, 'Cursisten zien met deze link alleen deze oefening, niet het overzicht.'),
        el('div', { class: 'deel-rij' },
            el('input', { class: 'deel-link', type: 'text', readonly: true, value: link, 'aria-label': 'Deellink', onfocus: (e) => e.target.select() }),
            kopieerKnop
        ),
        qrDoos,
        el('p', { class: 'uitleg klein' }, 'Toon de QR-code op het bord: cursisten scannen hem met hun gsm.'),
        el('a', { class: 'tekstlink', href: link, target: '_blank', rel: 'noopener' }, 'Bekijk zoals een cursist ', el('span', { html: icoon('extern', 'icoon klein') }))
    );

    venster.addEventListener('close', () => venster.remove());
    venster.addEventListener('click', (e) => {
        if (e.target === venster) sluit(); // klik naast het venster
    });
    document.body.append(venster);
    venster.showModal();
}
