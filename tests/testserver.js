/**
 * testserver.js — draait de website lokaal, met het echte backend (via googlemock)
 * op de echte overzichtslijst. Zo kan je alles testen zonder Google.
 *
 *   node tests/testserver.js        → http://localhost:8123/
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { NepSpreadsheet, laadBackend } = require('./googlemock');

const POORT = Number(process.env.POORT || 8123);
const SITE = path.join(__dirname, '..');

// --- De sheet: echte lijst + tabblad Website + een paar rijen "vrij te delen" ---
const bladen = JSON.parse(fs.readFileSync(path.join(__dirname, 'lijst.json'), 'utf8'));
function voegKolomToe(naam, koprij, kop, waarde) {
    const b = bladen.find((x) => x.naam === naam);
    b.tonen.forEach((rij, i) => {
        const r = i + 1;
        rij.push(r === koprij ? kop : r > koprij ? waarde(r) : '');
        b.links[i].push('');
        b.formules[i].push('');
    });
}
voegKolomToe('Oefeningen', 4, 'Vrij te delen', (r) => (r % 3 === 0 ? 'ja' : ''));
// Een rij met een afbeelding (om de beeldweergave te testen), vrij te delen.
(function () {
    const oef = bladen.find((x) => x.naam === 'Oefeningen');
    const breedte = oef.tonen[3].length;
    const rij = new Array(breedte).fill('');
    rij[0] = 'Testafbeelding bakker';
    rij[7] = 'http://127.0.0.1:' + POORT + '/testbeeld.png';
    rij[breedte - 1] = 'ja';
    oef.tonen.push(rij);
    oef.links.push(new Array(breedte).fill(''));
    oef.formules.push(new Array(breedte).fill(''));
})();
voegKolomToe('PJM', 1, 'Video vrij te delen', () => 'ja');
voegKolomToe('Audio', 5, 'Vrij te delen', (r) => (r % 2 === 0 ? 'ja' : ''));
voegKolomToe('Linken losse blz VLL', 1, 'Vrij te delen', () => 'ja');

const ss = new NepSpreadsheet(bladen);
ss.voegBladToe({
    naam: 'Website',
    verborgen: false,
    tonen: fs.readFileSync(path.join(__dirname, '..', 'handleiding', 'website-tabblad-ligo.tsv'), 'utf8').trim().split('\n').map((r) => r.split('\t'))
});
const backend = laadBackend(ss);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
    const adres = new URL(req.url, 'http://localhost');

    // Het nep-backend (zoals …/exec van Apps Script)
    if (adres.pathname === '/exec') {
        const antwoord = (uitvoer) => {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(uitvoer.tekst);
        };
        if (req.method === 'POST') {
            let lichaam = '';
            req.on('data', (d) => { lichaam += d; });
            req.on('end', () => antwoord(backend.doPost({ postData: { contents: lichaam } })));
        } else {
            antwoord(backend.doGet({ parameter: Object.fromEntries(adres.searchParams) }));
        }
        return;
    }

    if (adres.pathname === '/testbeeld.png' && process.env.TESTBEELD) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        fs.createReadStream(process.env.TESTBEELD).pipe(res);
        return;
    }

    // config.js met het adres van het nep-backend
    if (adres.pathname === '/js/config.js') {
        res.writeHead(200, { 'Content-Type': TYPES['.js'] });
        res.end(fs.readFileSync(path.join(SITE, 'js', 'config.js'), 'utf8')
            .replace("backendUrl: ''", "backendUrl: 'http://localhost:" + POORT + "/exec'"));
        return;
    }

    let bestand = path.join(SITE, decodeURIComponent(adres.pathname));
    if (adres.pathname.startsWith('/tests/')) {
        res.writeHead(403);
        res.end();
        return;
    }
    if (!bestand.startsWith(SITE)) {
        res.writeHead(403);
        res.end();
        return;
    }
    if (fs.existsSync(bestand) && fs.statSync(bestand).isDirectory()) {
        bestand = path.join(bestand, 'index.html');
    }
    if (!fs.existsSync(bestand)) {
        res.writeHead(404);
        res.end('Niet gevonden');
        return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(bestand)] || 'application/octet-stream' });
    fs.createReadStream(bestand).pipe(res);
}).listen(POORT, () => console.log('Testserver op http://localhost:' + POORT + '/'));
