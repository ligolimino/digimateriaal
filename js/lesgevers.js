/**
 * lesgevers.js — de hoofdpagina voor lesgevers.
 *
 * Opbouw:
 *   1. start()         gegevens ophalen (eventueel na login)
 *   2. gebruik()       een catalogus in gebruik nemen
 *   3. toon()          alles tekenen op basis van de toestand (zoekterm, filters, ...)
 *   4. controle        meldingen tonen en gegevens vernieuwen (voor wie de lijst bijhoudt)
 *   5. gebeurtenissen  klikken en typen passen de toestand aan en roepen toon() aan
 *
 * Er is één toestand en één functie die tekent: zo kunnen zoeken en filteren
 * elkaar nooit meer tegenwerken, zoals in de oude pagina's.
 */
import { haalInfo, haalCatalogus, haalControle, vernieuw, leesBewaardeCatalogus, bewaarCatalogus } from './api.js';
import { startLogin, haalToken, gebruikersnaam, uitloggen } from './auth.js';
import {
    bereidVoor, filterEnSorteer, opties, zichtbareFilters, populairsteWaarden,
    toestandNaarAdres, adresNaarToestand
} from './catalogus.js';
import { el, icoon, melding, vertraag, speeltInPagina } from './hulp.js';
import { maakKaart } from './kaarten.js';
import { speelAf, volledigSchermMogelijk, zetVolledigScherm } from './speler.js';
import { toonDeelvenster } from './deel.js';

const PER_KEER = 48;          // zoveel kaarten tegelijk; de rest bij het scrollen
const $ = (id) => document.getElementById(id);

let catalogus = null;
let items = [];
let toestand = adresNaarToestand(window.location.hash);
let resultaten = [];
let getoond = 0;
let huidigeSpeler = null;
let token = null; // toegangssleutel bij login (anders null)

// ---------------------------------------------------------------------------
// 1. Starten
// ---------------------------------------------------------------------------

async function start() {
    koppelGebeurtenissen();
    toonStatus('laden', 'De oefeningen worden geladen…');

    // Info en catalogus tegelijk opvragen: dat spaart een wachtbeurt.
    const infoBelofte = haalInfo();
    const catalogusBelofte = haalCatalogus().catch((fout) => fout);

    let info;
    try {
        info = await infoBelofte;
    } catch (fout) {
        toonStatus('fout', fout.message);
        return;
    }
    zetTitel(info.titel, info.ondertitel);

    // Een bewaarde kopie meteen tonen (alleen zonder login), de nieuwe volgt.
    const bewaard = info.loginVerplicht ? null : leesBewaardeCatalogus(false);
    if (bewaard) {
        gebruik(bewaard);
    }

    let vers;
    try {
        if (info.loginVerplicht) {
            await startLogin();
            token = await haalToken();
            toonGebruiker();
            vers = await haalCatalogus(token);
        } else {
            vers = await catalogusBelofte;
            if (vers instanceof Error) throw vers;
        }
    } catch (fout) {
        if (bewaard) {
            melding('De nieuwste versie kon niet geladen worden. Je ziet de vorige versie.');
        } else {
            toonStatus('fout', fout.message);
        }
        return;
    }

    if (!bewaard || bewaard.gemaakt !== vers.gemaakt) {
        gebruik(vers);
    }
    bewaarCatalogus(vers, info.loginVerplicht);
}

function zetTitel(titel, ondertitel) {
    $('site-titel').textContent = titel;
    $('site-ondertitel').textContent = ondertitel || '';
    document.title = titel;
}

function toonGebruiker() {
    const naam = gebruikersnaam();
    if (naam) {
        $('gebruiker-naam').textContent = naam;
        $('gebruiker').hidden = false;
    }
}

/** Een (nieuwe) catalogus in gebruik nemen. */
function gebruik(nieuweCatalogus) {
    catalogus = nieuweCatalogus;
    items = bereidVoor(nieuweCatalogus.items);
    if (nieuweCatalogus.titel) {
        zetTitel(nieuweCatalogus.titel, nieuweCatalogus.ondertitel);
    }
    // Een collectie uit een oude bladwijzer die niet meer bestaat: negeren.
    if (toestand.collectie && !catalogus.collecties.some((c) => c.naam === toestand.collectie)) {
        toestand.collectie = '';
    }
    $('zoek').value = toestand.zoek;
    $('sorteer').value = toestand.sorteer;
    toonStatus('', '');
    toon();
}

// ---------------------------------------------------------------------------
// 2. Tekenen
// ---------------------------------------------------------------------------

function toon() {
    if (!catalogus) return;
    resultaten = filterEnSorteer(items, toestand);
    toonCollecties();
    toonSnelkeuze();
    toonFilters();
    toonResultaatKop();
    getoond = 0;
    $('kaarten').replaceChildren();
    toonMeer();
    history.replaceState(null, '', toestandNaarAdres(toestand) || window.location.pathname + window.location.search);
}

function toonCollecties() {
    const knop = (naam, label, aantal) => el('button', {
        type: 'button',
        class: 'collectie' + (toestand.collectie === naam ? ' actief' : ''),
        'aria-pressed': String(toestand.collectie === naam),
        onclick: () => {
            toestand.collectie = naam;
            // Filters die in de nieuwe collectie niet bestaan, wissen.
            const geldig = zichtbareFilters(items, catalogus.filters, naam);
            Object.keys(toestand.filters).forEach((l) => {
                if (!geldig.includes(l)) delete toestand.filters[l];
            });
            toon();
        }
    }, label, el('span', { class: 'teller' }, aantal.toLocaleString('nl-BE')));

    // Maar één collectie? Dan zijn de knoppen overbodig.
    $('collecties').hidden = catalogus.collecties.length <= 1;
    $('collecties').replaceChildren(
        knop('', 'Alles', items.length),
        ...catalogus.collecties.map((c) => knop(c.naam, c.naam, c.aantal))
    );
}

/** De knoppen in de hero: de meest gebruikte thema's (of de eerste filter) van de huidige keuze. */
function toonSnelkeuze() {
    const labels = zichtbareFilters(items, catalogus.filters, toestand.collectie);
    const label = labels.includes('Thema') ? 'Thema' : labels[0];
    const doos = $('snelkeuze');
    if (!label) {
        doos.replaceChildren();
        return;
    }
    const waarden = populairsteWaarden(items, toestand, label, 8);
    const actief = toestand.filters[label];
    if (actief && !waarden.includes(actief)) waarden.unshift(actief);
    doos.replaceChildren(...waarden.map((w) => el('button', {
        type: 'button',
        class: 'chip' + (actief === w ? ' actief' : ''),
        'aria-pressed': String(actief === w),
        onclick: () => {
            toestand.filters[label] = actief === w ? '' : w;
            toon();
        }
    }, w)));
}

function toonFilters() {
    const velden = [
        { veld: 'soort', label: 'Soort materiaal', alle: 'Alle soorten' },
        { veld: 'programma', label: 'Programma', alle: 'Alle programma\'s' },
        ...zichtbareFilters(items, catalogus.filters, toestand.collectie)
            .map((l) => ({ veld: l, label: l, alle: 'Alle' }))
    ];

    const blokken = velden.map(({ veld, label, alle }) => {
        const isEigen = ['soort', 'programma'].includes(veld);
        const huidig = isEigen ? toestand[veld] : (toestand.filters[veld] || '');
        const keuzes = opties(items, toestand, veld);
        const id = 'filter-' + veld.replace(/\W+/g, '-');
        const select = el('select', {
            id,
            onchange: (e) => {
                if (isEigen) toestand[veld] = e.target.value;
                else toestand.filters[veld] = e.target.value;
                toon();
            }
        },
        el('option', { value: '' }, alle),
        keuzes.map((k) => el('option', { value: k.waarde, selected: k.waarde === huidig }, k.waarde + ' (' + k.aantal + ')')));
        // Een gekozen waarde die nu 0 resultaten heeft, blijft zichtbaar zodat je ze kan wissen.
        if (huidig && !keuzes.some((k) => k.waarde === huidig)) {
            select.append(el('option', { value: huidig, selected: true }, huidig + ' (0)'));
        }
        return el('div', { class: 'filter' + (huidig ? ' gekozen' : '') }, el('label', { for: id }, label), select);
    });
    $('filters').replaceChildren(...blokken);

    const aantalActief = ['soort', 'programma'].filter((v) => toestand[v]).length +
        Object.values(toestand.filters).filter(Boolean).length;
    $('filters-knop').textContent = aantalActief ? 'Filters (' + aantalActief + ')' : 'Filters';
}

function toonResultaatKop() {
    const n = resultaten.length;
    $('aantal').textContent = n.toLocaleString('nl-BE') + (n === 1 ? ' resultaat' : ' resultaten');
    $('resultaten-titel').textContent = toestand.zoek
        ? 'Zoekresultaten voor "' + toestand.zoek + '"'
        : (toestand.collectie || 'Alle oefeningen');
    if (n === 0) {
        toonStatus('leeg', 'Niets gevonden. Probeer een ander woord of wis de filters.');
    } else {
        toonStatus('', '');
    }
}

/** Voegt de volgende reeks kaarten toe. */
function toonMeer() {
    const volgende = resultaten.slice(getoond, getoond + PER_KEER);
    const acties = { bekijk: openSpeler, deel: toonDeelvenster };
    $('kaarten').append(...volgende.map((item) => maakKaart(item, acties)));
    getoond += volgende.length;

    const meer = $('meer');
    meer.replaceChildren();
    if (getoond < resultaten.length) {
        meer.append(el('button', { type: 'button', class: 'knop knop-licht', onclick: toonMeer },
            'Toon meer (' + (resultaten.length - getoond).toLocaleString('nl-BE') + ' over)'));
    }
}

function toonStatus(soort, tekst) {
    const status = $('status');
    status.className = 'status' + (soort ? ' status-' + soort : '');
    status.replaceChildren();
    if (!tekst) return;
    status.append(el('p', {}, tekst));
    if (soort === 'fout') {
        status.append(el('button', { type: 'button', class: 'knop knop-hoofd', onclick: () => window.location.reload() }, 'Opnieuw proberen'));
    }
    if (soort === 'leeg') {
        status.append(el('button', { type: 'button', class: 'knop knop-licht', onclick: wisAlles }, 'Wis zoekterm en filters'));
    }
}

function wisAlles() {
    toestand = { ...toestand, zoek: '', soort: '', programma: '', filters: {} };
    $('zoek').value = '';
    toon();
}

// ---------------------------------------------------------------------------
// 3. De speler
// ---------------------------------------------------------------------------

function openSpeler(item) {
    if (!speeltInPagina(item)) {
        window.open(item.url, '_blank', 'noopener');
        return;
    }
    const venster = $('spelervenster');
    $('speler-titel').textContent = item.titel;
    $('speler-kader').className = 'speler-kader kader-' + item.type;
    $('speler-scherm').hidden = !volledigSchermMogelijk() || item.type === 'soundcloud';
    $('speler-deel').hidden = !item.deelbaar;
    $('speler-deel').onclick = () => toonDeelvenster(item);
    const open = $('speler-open');
    open.hidden = !item.url;
    if (item.url) open.href = item.url;

    venster.showModal();
    huidigeSpeler = speelAf($('speler'), item);
}

function sluitSpeler() {
    if (huidigeSpeler) {
        huidigeSpeler.stop();
        huidigeSpeler = null;
    }
}

// ---------------------------------------------------------------------------
// 4. Voor wie de lijst bijhoudt: controle en vernieuwen
// ---------------------------------------------------------------------------

async function toonControle() {
    const venster = $('controlevenster');
    const inhoud = $('controle-inhoud');
    inhoud.replaceChildren(el('p', { class: 'uitleg' }, 'Bezig met controleren…'));
    venster.showModal();
    try {
        const c = await haalControle(token);
        const gemaakt = new Date(c.gemaakt).toLocaleString('nl-BE');
        const kop = el('p', { class: 'uitleg' },
            c.items + ' items op de website. ' +
            (c.problemen.length ? c.problemen.length + ' meldingen:' : 'Geen meldingen: alles in orde!') +
            ' (gegevens van ' + gemaakt + ')');
        if (!c.problemen.length) {
            inhoud.replaceChildren(kop);
            return;
        }
        const tabel = el('table', { class: 'controle-tabel' },
            el('thead', {}, el('tr', {}, ['Tabblad', 'Rij', 'Titel', 'Melding'].map((t) => el('th', {}, t)))),
            el('tbody', {}, c.problemen.map((p) => el('tr', {},
                el('td', {}, p.tabblad || ''),
                el('td', {}, String(p.rij || '')),
                el('td', {}, p.titel || ''),
                el('td', {}, p.probleem)
            )))
        );
        inhoud.replaceChildren(kop, el('div', { class: 'tabel-doos' }, tabel));
    } catch (fout) {
        inhoud.replaceChildren(el('p', { class: 'status-fout' }, fout.message));
    }
}

async function vernieuwGegevens() {
    try {
        const r = await vernieuw();
        if (!r.vernieuwd) {
            melding('De gegevens zijn minder dan een minuut oud. Probeer zo dadelijk opnieuw.');
            return;
        }
        melding('De nieuwste gegevens worden opgehaald…');
        gebruik(await haalCatalogus(token));
    } catch (fout) {
        melding(fout.message);
    }
}

// ---------------------------------------------------------------------------
// 5. Gebeurtenissen
// ---------------------------------------------------------------------------

function koppelGebeurtenissen() {
    $('zoek').addEventListener('input', vertraag((e) => {
        toestand.zoek = e.target.value.trim();
        toon();
    }, 200));

    $('sorteer').addEventListener('change', (e) => {
        toestand.sorteer = e.target.value;
        toon();
    });

    $('wis-filters').addEventListener('click', wisAlles);

    $('filters-knop').addEventListener('click', () => {
        const open = $('zijbalk').classList.toggle('open');
        $('filters-knop').setAttribute('aria-expanded', String(open));
    });

    $('uitloggen').addEventListener('click', uitloggen);

    // Controle en vernieuwen
    $('controle-knop').addEventListener('click', toonControle);
    $('vernieuw-knop').addEventListener('click', vernieuwGegevens);
    $('controle-sluit').innerHTML = icoon('sluit');
    $('controle-sluit').addEventListener('click', () => $('controlevenster').close());

    // Speler
    $('speler-sluit').innerHTML = icoon('sluit');
    $('speler-sluit').addEventListener('click', () => $('spelervenster').close());
    $('spelervenster').addEventListener('close', sluitSpeler);
    $('spelervenster').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
    });
    $('speler-scherm').addEventListener('click', () => zetVolledigScherm($('speler-kader')));

    // Automatisch meer kaarten laden als je onderaan komt.
    if ('IntersectionObserver' in window) {
        new IntersectionObserver((waarnemingen) => {
            if (waarnemingen.some((w) => w.isIntersecting) && getoond < resultaten.length) {
                toonMeer();
            }
        }, { rootMargin: '600px' }).observe($('meer'));
    }

    // Terugknop of een bladwijzer met een andere zoekopdracht.
    window.addEventListener('hashchange', () => {
        toestand = adresNaarToestand(window.location.hash);
        $('zoek').value = toestand.zoek;
        $('sorteer').value = toestand.sorteer;
        toon();
    });
}

start();
