/**
 * hulp.js — kleine hulpfuncties die op meerdere pagina's gebruikt worden.
 */

/**
 * Maakt een HTML-element. Tekst wordt altijd als TEKST ingevoegd (textContent),
 * nooit als HTML: zo kan een titel in de sheet nooit code in de pagina smokkelen.
 *
 *   el('a', { class: 'knop', href: '#' }, 'Klik hier')
 */
export function el(tag, eigenschappen = {}, ...kinderen) {
    const element = document.createElement(tag);
    for (const [naam, waarde] of Object.entries(eigenschappen)) {
        if (waarde === null || waarde === undefined || waarde === false) {
            continue;
        }
        if (naam === 'class') {
            element.className = waarde;
        } else if (naam.startsWith('on') && typeof waarde === 'function') {
            element.addEventListener(naam.slice(2), waarde);
        } else if (naam === 'html') {
            element.innerHTML = waarde; // alleen voor onze eigen iconen, nooit voor gegevens
        } else {
            element.setAttribute(naam, waarde === true ? '' : waarde);
        }
    }
    for (const kind of kinderen.flat()) {
        if (kind !== null && kind !== undefined && kind !== false) {
            element.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
        }
    }
    return element;
}

/** Iconen als SVG (geen externe bestanden of lettertypes nodig). */
const pad = {
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9v6l5-3z" fill="currentColor"/>',
    audio: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    interactief: '<path d="M9 4v8.5l-2.2-1.6a1.6 1.6 0 0 0-2.2 2.3L9 19h8l1.5-6.2a1.6 1.6 0 0 0-1.2-2L12 10V4a1.5 1.5 0 0 0-3 0z"/>',
    document: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    deel: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
    kopieer: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    sluit: '<path d="M6 6l12 12M18 6L6 18"/>',
    scherm: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    zoek: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    extern: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    opnieuw: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
    filter: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>',
    afbeelding: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'
};

export function icoon(naam, klasse = 'icoon') {
    return '<svg class="' + klasse + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (pad[naam] || '') + '</svg>';
}

/** Het icoon dat bij een soort link hoort. */
export function soortIcoon(soort) {
    return { Video: 'video', Audio: 'audio', Interactief: 'interactief', Afbeelding: 'afbeelding', Document: 'document' }[soort] || 'website';
}

/** Kopieert tekst naar het klembord; werkt ook in oudere browsers. */
export async function kopieer(tekst) {
    try {
        await navigator.clipboard.writeText(tekst);
        return true;
    } catch (fout) {
        const veld = el('textarea', { style: 'position:fixed;opacity:0' }, tekst);
        document.body.append(veld);
        veld.select();
        const gelukt = document.execCommand('copy');
        veld.remove();
        return gelukt;
    }
}

/** Een korte melding onderaan het scherm. */
export function melding(tekst) {
    let doos = document.getElementById('melding');
    if (!doos) {
        doos = el('div', { id: 'melding', role: 'status', 'aria-live': 'polite' });
        document.body.append(doos);
    }
    doos.textContent = tekst;
    doos.classList.add('zichtbaar');
    clearTimeout(melding.timer);
    melding.timer = setTimeout(() => doos.classList.remove('zichtbaar'), 3000);
}

/** Wacht met uitvoeren tot de gebruiker even stopt met typen. */
export function vertraag(functie, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => functie(...args), ms);
    };
}

/** Kan dit item in de pagina afgespeeld worden, of opent het in een nieuw venster? */
export function speeltInPagina(item) {
    return ['youtube', 'youtube-lijst', 'vimeo', 'soundcloud', 'genially', 'afbeelding'].includes(item.type);
}
