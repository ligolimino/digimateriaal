/**
 * kaarten.js — maakt de kaart van één item voor de lesgeverspagina.
 */
import { el, icoon, soortIcoon, speeltInPagina } from './hulp.js';

/** Vervangende afbeelding als er geen thumbnail is (of als ze niet laadt). */
export function plaatsvervanger(item) {
    return el('div', { class: 'plaatsvervanger soort-' + (item.soort || 'Website').toLowerCase() },
        el('span', { html: icoon(soortIcoon(item.soort), 'groot-icoon') }),
        el('span', { class: 'pv-naam' }, item.programma || item.soort || '')
    );
}

export function beeld(item) {
    const doos = el('div', { class: 'kaart-beeld' });
    if (item.thumb) {
        const img = el('img', { src: item.thumb, alt: '', loading: 'lazy', decoding: 'async' });
        img.addEventListener('error', () => img.replaceWith(plaatsvervanger(item)), { once: true });
        // Sommige diensten geven een standaardplaatje in plaats van een fout:
        //   ThingLink: een grijs icoon van 512×512 (echte afbeeldingen zijn 1024 breed);
        //   YouTube: een grijs vlak van 120×90 als de video verwijderd of privé is.
        img.addEventListener('load', () => {
            const b = img.naturalWidth;
            const h = img.naturalHeight;
            if ((item.programma === 'ThingLink' && b === 512 && h === 512) ||
                (item.programma === 'YouTube' && b === 120 && h === 90)) {
                img.replaceWith(plaatsvervanger(item));
            }
        }, { once: true });
        doos.append(img);
    } else {
        doos.append(plaatsvervanger(item));
    }
    if (speeltInPagina(item)) {
        doos.append(el('span', { class: 'speel-rondje', html: icoon('play') }));
    }
    return doos;
}

/**
 * @param item   het item uit de catalogus
 * @param acties { bekijk(item), deel(item) }
 */
export function maakKaart(item, acties) {
    const meta = Object.values(item.filters).slice(0, 3).join(' · ');
    const inPagina = speeltInPagina(item);

    const hoofdknop = inPagina
        ? el('button', { class: 'knop knop-hoofd', type: 'button', onclick: () => acties.bekijk(item) }, 'Bekijk')
        : el('a', {
            class: 'knop knop-hoofd',
            href: item.url,
            target: '_blank',
            rel: 'noopener',
            title: item.alleenLigo ? 'Opent met je Ligo-account' : 'Opent in een nieuw venster'
        }, item.alleenLigo ? 'Open (Ligo)' : 'Open', el('span', { html: icoon('extern', 'icoon klein') }));

    const knoppen = el('div', { class: 'kaart-knoppen' }, hoofdknop);
    if (item.deelbaar) {
        knoppen.append(el('button', {
            class: 'knop knop-deel',
            type: 'button',
            title: 'Deel met cursisten',
            'aria-label': 'Deel "' + item.titel + '" met cursisten',
            onclick: () => acties.deel(item),
            html: icoon('deel')
        }));
    }

    // De afbeelding is ook klikbaar: dat is wat de meeste mensen proberen.
    const klikbaarBeeld = inPagina
        ? el('button', { class: 'beeld-knop', type: 'button', tabindex: '-1', 'aria-hidden': 'true', onclick: () => acties.bekijk(item) }, beeld(item))
        : el('a', { class: 'beeld-knop', href: item.url, target: '_blank', rel: 'noopener', tabindex: '-1', 'aria-hidden': 'true' }, beeld(item));

    return el('article', { class: 'kaart' },
        klikbaarBeeld,
        el('div', { class: 'kaart-tekst' },
            el('div', { class: 'kaart-labels' },
                el('span', { class: 'label soort-' + (item.soort || 'Website').toLowerCase() }, item.soort || 'Link'),
                el('span', { class: 'programma' }, item.programma || '')
            ),
            el('h3', { class: 'kaart-titel' }, item.titel),
            meta ? el('p', { class: 'kaart-meta' }, meta) : null,
            item.omschrijving ? el('p', { class: 'kaart-omschrijving' }, item.omschrijving) : null
        ),
        knoppen
    );
}
