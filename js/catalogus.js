/**
 * catalogus.js — zoeken, filteren en sorteren. Alleen logica, geen HTML.
 *
 * Omdat hier niets met de pagina gebeurt, kan je deze functies los testen
 * (zie tests/frontend.test.mjs). Dat is het voordeel van logica en weergave scheiden.
 *
 * De "toestand" (state) van de lesgeverspagina is één object:
 *   {
 *       collectie: '',            // '' = alle collecties
 *       zoek: '',                 // zoektekst
 *       soort: '',                // Video, Audio, Interactief, ...
 *       programma: '',            // YouTube, ThingLink, ...
 *       filters: { Thema: 'School', Niveau: 'mond 1.1' },
 *       sorteer: 'lijst'          // 'lijst' | 'az' | 'za'
 *   }
 */

/** Kleine letters en zonder accenten: "Café" en "cafe" vinden elkaar. */
export function normaliseer(tekst) {
    return String(tekst || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();
}

/** Bereidt de items één keer voor: zoektekst en volgnummer. */
export function bereidVoor(items) {
    items.forEach((item, index) => {
        item.filters = item.filters || {};
        item.volgnummer = index;
        item.zoektekst = normaliseer([
            item.titel,
            item.omschrijving,
            item.collectie,
            item.programma,
            item.soort,
            ...Object.values(item.filters)
        ].join(' '));
    });
    return items;
}

export function legeToestand() {
    return { collectie: '', zoek: '', soort: '', programma: '', filters: {}, sorteer: 'lijst' };
}

/**
 * Past item voldoet aan de toestand?
 * Met `behalve` kan je één criterium negeren: handig om te berekenen welke keuzes
 * een keuzelijst nog moet tonen (zie opties()).
 */
export function voldoet(item, toestand, behalve = null) {
    return maakTest(toestand, behalve)(item);
}

/**
 * Maakt één keer een testfunctie voor een toestand. Die is snel genoeg om
 * duizenden keren per toetsaanslag uit te voeren: de zoekwoorden en filters
 * worden vooraf klaargezet, niet bij elk item opnieuw.
 */
export function maakTest(toestand, behalve = null) {
    const collectie = behalve !== 'collectie' && toestand.collectie;
    const soort = behalve !== 'soort' && toestand.soort;
    const programma = behalve !== 'programma' && toestand.programma;
    const filters = Object.entries(toestand.filters).filter(([label, waarde]) => waarde && label !== behalve);
    // Elk woord moet ergens voorkomen: "klok half" vindt "De klok: half uur".
    const woorden = behalve !== 'zoek' && toestand.zoek
        ? normaliseer(toestand.zoek).split(/\s+/).filter(Boolean)
        : [];

    return (item) => {
        if (collectie && item.collectie !== collectie) return false;
        if (soort && item.soort !== soort) return false;
        if (programma && item.programma !== programma) return false;
        for (const [label, waarde] of filters) {
            if (item.filters[label] !== waarde) return false;
        }
        for (const woord of woorden) {
            if (!item.zoektekst.includes(woord)) return false;
        }
        return true;
    };
}

/** Natuurlijke sortering: "Thema 2" vóór "Thema 10". */
const vergelijk = new Intl.Collator('nl', { numeric: true, sensitivity: 'base' }).compare;

export function filterEnSorteer(items, toestand) {
    const resultaat = items.filter(maakTest(toestand));
    if (toestand.sorteer === 'az') {
        resultaat.sort((a, b) => vergelijk(a.titel, b.titel));
    } else if (toestand.sorteer === 'za') {
        resultaat.sort((a, b) => vergelijk(b.titel, a.titel));
    }
    return resultaat; // 'lijst' = volgorde van de sheet
}

/**
 * De keuzes voor één keuzelijst, met aantallen.
 * We negeren daarbij de huidige keuze in die lijst zelf, maar houden rekening met alle
 * andere filters: zo toont "Thema" alleen thema's die bij het gekozen niveau voorkomen.
 */
export function opties(items, toestand, veld) {
    const tellingen = new Map();
    const test = maakTest(toestand, veld);
    for (const item of items) {
        if (!test(item)) {
            continue;
        }
        const waarde = ['collectie', 'soort', 'programma'].includes(veld) ? item[veld] : item.filters[veld];
        if (waarde) {
            tellingen.set(waarde, (tellingen.get(waarde) || 0) + 1);
        }
    }
    return [...tellingen.entries()]
        .map(([waarde, aantal]) => ({ waarde, aantal }))
        .sort((a, b) => vergelijk(a.waarde, b.waarde));
}

/** Welke filterlabels hebben zin voor de gekozen collectie? */
export function zichtbareFilters(items, alleLabels, collectie) {
    const binnen = collectie ? items.filter((i) => i.collectie === collectie) : items;
    return alleLabels.filter((label) => binnen.some((i) => i.filters[label]));
}

/** De meest gebruikte waarden van een filter (voor de snelkeuzeknoppen bovenaan). */
export function populairsteWaarden(items, toestand, label, aantal = 8) {
    return opties(items, { ...toestand, filters: { ...toestand.filters, [label]: '' } }, label)
        .sort((a, b) => b.aantal - a.aantal)
        .slice(0, aantal)
        .map((o) => o.waarde);
}

// ---------------------------------------------------------------------------
// De toestand bewaren in het adres (na #), zodat lesgevers een zoekopdracht
// kunnen bewaren als bladwijzer en de terugknop van de browser werkt.
// ---------------------------------------------------------------------------

export function toestandNaarAdres(toestand) {
    const p = new URLSearchParams();
    if (toestand.collectie) p.set('collectie', toestand.collectie);
    if (toestand.zoek) p.set('zoek', toestand.zoek);
    if (toestand.soort) p.set('soort', toestand.soort);
    if (toestand.programma) p.set('programma', toestand.programma);
    for (const [label, waarde] of Object.entries(toestand.filters)) {
        if (waarde) p.set('f.' + label, waarde);
    }
    if (toestand.sorteer !== 'lijst') p.set('sorteer', toestand.sorteer);
    const tekst = p.toString();
    return tekst ? '#' + tekst : '';
}

export function adresNaarToestand(hash) {
    const toestand = legeToestand();
    const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    for (const [sleutel, waarde] of p.entries()) {
        if (sleutel.startsWith('f.')) {
            toestand.filters[sleutel.slice(2)] = waarde;
        } else if (['collectie', 'zoek', 'soort', 'programma'].includes(sleutel)) {
            toestand[sleutel] = waarde;
        } else if (sleutel === 'sorteer' && ['az', 'za'].includes(waarde)) {
            toestand.sorteer = waarde;
        }
    }
    return toestand;
}
