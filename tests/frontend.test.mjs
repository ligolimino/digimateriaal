/**
 * Tests voor de zoek- en filterlogica van de website (js/catalogus.js).
 * Uitvoeren:  node --test tests/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normaliseer, bereidVoor, legeToestand, filterEnSorteer, opties,
    zichtbareFilters, toestandNaarAdres, adresNaarToestand
} from '../js/catalogus.js';

const items = bereidVoor([
    { titel: 'De klok: half uur', collectie: 'Oefeningen', soort: 'Video', programma: 'YouTube', filters: { Thema: 'Klok', Niveau: 'Mond 1.1' } },
    { titel: 'Café bestellen', collectie: 'Oefeningen', soort: 'Interactief', programma: 'ThingLink', filters: { Thema: 'Eten en drinken' } },
    { titel: 'Thema 10 - Kinderen', collectie: 'PJM', soort: 'Video', programma: 'YouTube', filters: { Thema: 'Thema 10', Niveau: '*' } },
    { titel: 'Thema 2 - School', collectie: 'PJM', soort: 'Video', programma: 'YouTube', filters: { Thema: 'Thema 2', Niveau: '**' } }
]);

test('zoeken: zonder accenten en hoofdletters, alle woorden', () => {
    assert.equal(normaliseer('Café'), 'cafe');
    const t = { ...legeToestand(), zoek: 'cafe' };
    assert.deepEqual(filterEnSorteer(items, t).map((i) => i.titel), ['Café bestellen']);
    const t2 = { ...legeToestand(), zoek: 'KLOK half' };
    assert.equal(filterEnSorteer(items, t2).length, 1);
    const t3 = { ...legeToestand(), zoek: 'klok café' };
    assert.equal(filterEnSorteer(items, t3).length, 0, 'beide woorden moeten voorkomen');
});

test('zoeken en filteren werken samen', () => {
    const t = { ...legeToestand(), zoek: 'thema', collectie: 'PJM', filters: { Niveau: '**' } };
    assert.deepEqual(filterEnSorteer(items, t).map((i) => i.titel), ['Thema 2 - School']);
});

test('sorteren is natuurlijk: Thema 2 vóór Thema 10', () => {
    const t = { ...legeToestand(), collectie: 'PJM', sorteer: 'az' };
    assert.deepEqual(filterEnSorteer(items, t).map((i) => i.titel), ['Thema 2 - School', 'Thema 10 - Kinderen']);
});

test('keuzelijsten tonen alleen wat bij de andere filters past', () => {
    const t = { ...legeToestand(), soort: 'Interactief' };
    assert.deepEqual(opties(items, t, 'Thema').map((o) => o.waarde), ['Eten en drinken']);
    // De eigen keuze telt niet mee: je kan altijd een ander thema kiezen.
    const t2 = { ...legeToestand(), filters: { Thema: 'Klok' } };
    assert.equal(opties(items, t2, 'Thema').length, 4);
});

test('filters die in een collectie niet voorkomen, worden niet getoond', () => {
    assert.deepEqual(zichtbareFilters(items, ['Thema', 'Niveau', 'Kern'], 'PJM'), ['Thema', 'Niveau']);
});

test('toestand in het adres en terug', () => {
    const t = { ...legeToestand(), collectie: "PJM video's", zoek: 'klok & co', filters: { Niveau: '***' }, sorteer: 'za' };
    const terug = adresNaarToestand(toestandNaarAdres(t));
    assert.deepEqual(terug, t);
    assert.equal(toestandNaarAdres(legeToestand()), '');
});
