/**
 * maak-code-gs.js — voegt alle bestanden uit backend/ samen tot één bestand Code.gs,
 * zodat je in Apps Script maar één bestand hoeft te plakken.
 *
 *   node tools/maak-code-gs.js
 *
 * Alleen nodig als je iets aan het backend verandert. Het resultaat komt in
 * apps-script/Code.gs.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const map = path.join(__dirname, '..', 'backend');
const doel = path.join(__dirname, '..', 'apps-script', 'Code.gs');
const volgorde = ['Api.gs', 'Instellingen.gs', 'Bronnen.gs', 'Links.gs', 'Cache.gs', 'Login.gs', 'Menu.gs', 'Import.gs', 'Lijsten.gs'];

const versie = fs.readFileSync(path.join(map, 'Api.gs'), 'utf8').match(/var VERSIE = '([^']+)'/)[1];
let inhoud = [
    '/**',
    ' * Weergavewebsite — backend (versie ' + versie + ')',
    ' *',
    ' * Dit bestand is automatisch samengevoegd uit de map backend/ (zie tools/maak-code-gs.js).',
    ' * Pas bij voorkeur de losse bestanden aan en voeg ze daarna opnieuw samen.',
    ' *',
    ' * Inhoud: ' + volgorde.join(', '),
    ' */',
    ''
].join('\n');

for (const bestand of volgorde) {
    inhoud += '\n// ' + '='.repeat(76) + '\n// ' + bestand + '\n// ' + '='.repeat(76) + '\n\n';
    inhoud += fs.readFileSync(path.join(map, bestand), 'utf8').trim() + '\n';
}

fs.mkdirSync(path.dirname(doel), { recursive: true });
fs.writeFileSync(doel, inhoud);
console.log('Geschreven: ' + doel + ' (' + Math.round(inhoud.length / 1024) + ' KB)');
