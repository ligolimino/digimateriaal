/**
 * kijk.js — de cursistenpagina: toont één gedeelde oefening.
 */
import { haalItem } from './api.js';
import { el, icoon } from './hulp.js';
import { speelAf, volledigSchermMogelijk, zetVolledigScherm } from './speler.js';
import { beeld } from './kaarten.js';

const titel = document.getElementById('titel');
const inhoud = document.getElementById('inhoud');

function toonFout(tekst) {
    document.title = 'Oefening';
    titel.textContent = 'Oeps';
    inhoud.replaceChildren(el('div', { class: 'kijk-fout' },
        el('p', { class: 'kijk-fout-icoon', 'aria-hidden': 'true' }, '🙁'),
        el('p', {}, tekst),
        el('p', { class: 'klein' }, 'Vraag je lesgever om een nieuwe link.')
    ));
}

async function start() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        toonFout('Deze link is niet volledig.');
        return;
    }

    let item;
    try {
        item = (await haalItem(id)).item;
    } catch (fout) {
        toonFout(fout.message);
        return;
    }

    document.title = item.titel;
    titel.textContent = item.titel;

    // Afspelen in de pagina: video, audio, e-learning en Canva.
    if (item.embed) {
        const kader = el('div', { class: 'speler-kader kader-' + item.type });
        const doos = el('div');
        kader.append(doos);
        inhoud.replaceChildren(kader);
        speelAf(doos, item);

        const knoppen = el('div', { class: 'kijk-knoppen' });
        if (volledigSchermMogelijk() && item.type !== 'soundcloud') {
            knoppen.append(el('button', {
                type: 'button',
                class: 'knop knop-groot knop-licht',
                onclick: () => zetVolledigScherm(kader)
            }, el('span', { html: icoon('scherm') }), 'Groot scherm'));
        }
        // Canva of Genially lukt soms niet ingesloten: dan kan de cursist het apart openen.
        if (item.url) {
            knoppen.append(el('a', { class: 'knop knop-groot knop-licht', href: item.url, target: '_blank', rel: 'noopener' },
                el('span', { html: icoon('extern') }), 'Open apart'));
        }
        if (knoppen.children.length) inhoud.append(knoppen);
        return;
    }

    // Anders: een grote afbeelding en een grote knop.
    inhoud.replaceChildren(
        el('a', { class: 'kijk-beeld', href: item.url, target: '_blank', rel: 'noopener', 'aria-hidden': 'true', tabindex: '-1' }, beeld(item)),
        el('div', { class: 'kijk-knoppen' },
            el('a', { class: 'knop knop-groot knop-hoofd', href: item.url, target: '_blank', rel: 'noopener' },
                el('span', { html: icoon('play') }), 'Start de oefening'))
    );
}

start();
