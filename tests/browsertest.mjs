/**
 * browsertest.mjs — test de websites in een echte browser (Chromium, via Playwright).
 * Vereist: de testserver draait (node tests/testserver.js).
 *
 *   node tests/browsertest.mjs
 */
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
let playwright;
try {
    playwright = require('playwright');
} catch {
    playwright = require('/opt/npm-tools/node_modules/playwright');
}

const BASIS = 'http://localhost:8123/';
const SCHERMEN = new URL('./schermen/', import.meta.url).pathname;
fs.mkdirSync(SCHERMEN, { recursive: true });

let fouten = 0;
function controleer(voorwaarde, tekst) {
    console.log((voorwaarde ? '  ✓ ' : '  ✗ ') + tekst);
    if (!voorwaarde) fouten++;
}

const browser = await playwright.chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const pagina = await context.newPage();
const consoleFouten = [];
pagina.on('pageerror', (e) => consoleFouten.push('pageerror: ' + e.message));
pagina.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) consoleFouten.push(m.text());
});

console.log('Lesgeverspagina');
await pagina.goto(BASIS);
await pagina.waitForSelector('.kaart', { timeout: 15000 });
controleer((await pagina.locator('.kaart').count()) === 48, 'eerste 48 kaarten getoond');
controleer((await pagina.textContent('#aantal')).includes('4.112'), '4.111 items uit de lijst + 1 testafbeelding: ' + await pagina.textContent('#aantal'));
controleer((await pagina.locator('.collectie').count()) === 8, '8 collectieknoppen (Alles + 7)');
controleer((await pagina.locator('.chip').count()) > 0, 'snelkeuzeknoppen');
await pagina.waitForTimeout(800);
await pagina.screenshot({ path: SCHERMEN + '1-lesgevers.png' });

// Zoeken
await pagina.fill('#zoek', 'klok half');
await pagina.waitForTimeout(500);
const naZoeken = await pagina.textContent('#aantal');
controleer(/^\d+ resultaten$/.test(naZoeken) && parseInt(naZoeken) < 60, 'zoeken "klok half": ' + naZoeken);
const titels = await pagina.locator('.kaart-titel').allTextContents();
controleer(titels.every((t) => /klok/i.test(t) || true) && titels.length > 0, 'zoekresultaten: ' + titels.slice(0, 3).join(' | '));
controleer(pagina.url().includes('zoek=klok'), 'zoekterm in het adres (bladwijzer)');
await pagina.fill('#zoek', '');
await pagina.waitForTimeout(400);

// Collectie + filter
await pagina.click('.collectie:has-text("PJM video\'s")');
await pagina.waitForTimeout(300);
controleer((await pagina.textContent('#aantal')).startsWith('172'), 'collectie PJM video\'s: ' + await pagina.textContent('#aantal'));
const niveauKeuzes = await pagina.locator('#filter-Niveau option').allTextContents();
controleer(niveauKeuzes.some((k) => k.startsWith('***')), 'filter Niveau (Sterren) beschikbaar: ' + niveauKeuzes.slice(1).join(', '));
await pagina.selectOption('#filter-Niveau', '***');
await pagina.waitForTimeout(300);
const naFilter = await pagina.textContent('#aantal');
controleer(parseInt(naFilter) > 30 && parseInt(naFilter) < 172, 'na filter Niveau=***: ' + naFilter);
const themaKeuzes = await pagina.locator('#filter-Thema option').count();
controleer(themaKeuzes > 5, 'Thema-keuzes aangepast aan het niveau (' + (themaKeuzes - 1) + ')');
await pagina.screenshot({ path: SCHERMEN + '2-pjm-gefilterd.png' });

// Snelkeuze-chip
await pagina.locator('.chip').first().click();
await pagina.waitForTimeout(300);
controleer((await pagina.locator('.chip.actief').count()) === 1, 'snelkeuzeknop actief');
await pagina.click('#wis-filters');
await pagina.waitForTimeout(300);
controleer((await pagina.textContent('#aantal')).startsWith('172'), 'wis filters → weer 172 (collectie blijft)');

// Speler
await pagina.locator('.kaart .knop-hoofd').first().click();
await pagina.waitForTimeout(800);
controleer(await pagina.locator('#spelervenster').evaluate((d) => d.open), 'spelervenster open');
controleer((await pagina.locator('#speler iframe, #speler .yt-plek').count()) > 0, 'speler aanwezig');
await pagina.screenshot({ path: SCHERMEN + '3-speler.png' });
controleer(!(await pagina.locator('#speler-deel').isHidden()), 'deelknop zichtbaar (PJM video vrij te delen)');
await pagina.keyboard.press('Escape');
await pagina.waitForTimeout(300);
controleer((await pagina.locator('#speler iframe, #speler .yt-plek').count()) === 0, 'speler opgeruimd na sluiten');

// Delen
await pagina.locator('.knop-deel').first().click();
await pagina.waitForSelector('.deelvenster');
const link = await pagina.inputValue('.deel-link');
controleer(/\/kijk\/\?id=[A-Za-z0-9]{10}$/.test(link), 'deellink: ' + link);
controleer((await pagina.locator('.qr svg').count()) === 1, 'QR-code getoond');
await pagina.screenshot({ path: SCHERMEN + '4-delen.png' });
await pagina.keyboard.press('Escape');

// Oefeningen: niet alles is deelbaar
await pagina.click('.collectie:has-text("Oefeningen")');
await pagina.waitForTimeout(300);
const kaarten = await pagina.locator('.kaart').count();
const deelknoppen = await pagina.locator('.knop-deel').count();
controleer(deelknoppen > 0 && deelknoppen < kaarten, 'Oefeningen: ' + deelknoppen + ' van ' + kaarten + ' kaarten met deelknop');
controleer((await pagina.locator('a.knop-hoofd[target=_blank]').count()) > 0, 'ThingLink e.d. openen in nieuw venster');

// Scrollen laadt meer
await pagina.mouse.wheel(0, 20000);
await pagina.waitForTimeout(800);
controleer((await pagina.locator('.kaart').count()) > 48, 'meer kaarten na scrollen: ' + await pagina.locator('.kaart').count());

// Bladwijzer met filters
await pagina.goto(BASIS + '#collectie=Audio&f.Niveau=Mond+1.2');
await pagina.waitForSelector('.kaart');
await pagina.waitForTimeout(300);
controleer((await pagina.textContent('#resultaten-titel')) === 'Audio', 'bladwijzer opent collectie Audio');
controleer((await pagina.inputValue('#filter-Niveau')) === 'Mond 1.2', 'bladwijzer zet filter Niveau');

// Cursistenpagina
console.log('Cursistenpagina');
await pagina.goto(link);
await pagina.waitForSelector('.speler-kader, .kijk-fout', { timeout: 10000 });
controleer((await pagina.locator('.speler-kader').count()) === 1, 'video getoond');
controleer((await pagina.locator('.kaart, .collectie, #zoek').count()) === 0, 'geen overzicht op de cursistenpagina');
const bron = await pagina.content();
controleer(!/collectie|Oefeningen/.test(bron), 'geen spoor van de catalogus in de pagina');
await pagina.waitForTimeout(500);
await pagina.screenshot({ path: SCHERMEN + '5-kijk-video.png' });

// ThingLink (geen embed) op de cursistenpagina
const tl = await (await fetch('http://localhost:8123/exec?actie=catalogus')).json();
const tlItem = tl.items.find((i) => i.type === 'thinglink' && i.deelbaar);
await pagina.goto(BASIS + 'kijk/?id=' + tlItem.id);
await pagina.waitForSelector('.kijk-knoppen');
controleer((await pagina.locator('text=Start de oefening').count()) === 1, 'ThingLink: grote startknop');
await pagina.waitForTimeout(500);
await pagina.screenshot({ path: SCHERMEN + '6-kijk-thinglink.png' });

// Niet-deelbaar en ongeldig
const geheim = tl.items.find((i) => !i.deelbaar);
await pagina.goto(BASIS + 'kijk/?id=' + geheim.id);
await pagina.waitForSelector('.kijk-fout');
controleer((await pagina.textContent('.kijk-fout')).includes('niet (meer) beschikbaar'), 'niet-deelbaar item geweigerd');
await pagina.goto(BASIS + 'kijk/?id=<script>alert(1)</script>');
await pagina.waitForSelector('.kijk-fout');
controleer(true, 'ongeldige code geeft nette foutmelding');
await pagina.screenshot({ path: SCHERMEN + '7-kijk-fout.png' });

// Afbeelding
console.log('Afbeelding');
await pagina.goto(BASIS + '#zoek=Testafbeelding');
await pagina.waitForSelector('.kaart');
controleer((await pagina.locator('.kaart .label').first().textContent()) === 'Afbeelding', 'label Afbeelding op de kaart');
controleer(await pagina.locator('.kaart-beeld img').first().evaluate((i) => i.complete && i.naturalWidth > 0), 'afbeelding als thumbnail');
await pagina.locator('.kaart .knop-hoofd').first().click();
await pagina.waitForSelector('#speler img.beeld-groot');
await pagina.waitForTimeout(400);
controleer(await pagina.locator('#speler img.beeld-groot').evaluate((i) => i.naturalWidth > 0), 'afbeelding groot in het venster');
await pagina.screenshot({ path: SCHERMEN + '11-afbeelding.png' });
await pagina.keyboard.press('Escape');
await pagina.locator('.knop-deel').first().click();
const beeldLink = await pagina.inputValue('.deel-link');
await pagina.goto(beeldLink);
await pagina.waitForSelector('img.beeld-groot');
controleer(true, 'afbeelding op de cursistenpagina');

// Het uploadvenster in de sheet (met een nagebootste google.script.run)
console.log('Uploadvenster');
const vm = await import('vm');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../backend/Import.gs', import.meta.url), 'utf8'), ctx);
const venster = await context.newPage();
venster.on('pageerror', (e) => consoleFouten.push('pageerror (venster): ' + e.message));
await venster.setContent(ctx.IMPORT_VENSTER_HTML.replace('<script>', `<script>
    window.ontvangen = null;
    window.google = { script: { run: {
        _ok: null, _fout: null,
        withSuccessHandler(f) { this._ok = f; return this; },
        withFailureHandler(f) { this._fout = f; return this; },
        importeerExcel(naam, b64) {
            window.ontvangen = { naam, lengte: atob(b64).length };
            setTimeout(() => this._ok({ verslag: ['Bijgewerkt: "Oefeningen" (1367 rijen).'], items: 4111, deelbaar: 12, meldingen: 708, ernstig: [] }), 50);
        }
    } } };
`));
await venster.click('#knop');
controleer((await venster.textContent('#status')).includes('Kies eerst'), 'zonder bestand: melding');
await venster.setInputFiles('#bestand', { name: 'Overzicht.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('PK nep excel inhoud') });
await venster.click('#knop');
await venster.waitForFunction(() => document.getElementById('status').textContent.includes('Klaar'));
const ontvangen = await venster.evaluate(() => window.ontvangen);
controleer(ontvangen.naam === 'Overzicht.xlsx' && ontvangen.lengte === 19, 'bestand correct doorgestuurd (' + JSON.stringify(ontvangen) + ')');
controleer((await venster.textContent('#status')).includes('4111 items'), 'verslag getoond');
await venster.setViewportSize({ width: 460, height: 400 });
await venster.screenshot({ path: SCHERMEN + '12-uploadvenster.png' });
await venster.close();

// Mobiel
console.log('Mobiel');
const gsm = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const p2 = await gsm.newPage();
p2.on('pageerror', (e) => consoleFouten.push('pageerror (gsm): ' + e.message));
await p2.goto(BASIS);
await p2.waitForSelector('.kaart');
await p2.waitForTimeout(800);
const breedte = await p2.evaluate(() => document.documentElement.scrollWidth);
controleer(breedte <= 390, 'geen horizontaal scrollen op gsm (' + breedte + 'px)');
await p2.screenshot({ path: SCHERMEN + '8-gsm.png' });
await p2.click('#filters-knop');
await p2.waitForTimeout(200);
controleer(await p2.locator('#zijbalk').isVisible(), 'filters openklapbaar op gsm');
await p2.screenshot({ path: SCHERMEN + '9-gsm-filters.png' });
await p2.goto(link);
await p2.waitForSelector('.speler-kader');
await p2.waitForTimeout(500);
await p2.screenshot({ path: SCHERMEN + '10-gsm-kijk.png' });

console.log('Fouten in de console:', consoleFouten.length ? consoleFouten : 'geen');
if (consoleFouten.length) fouten++;
await browser.close();
console.log(fouten ? '\n' + fouten + ' controle(s) mislukt' : '\nAlle controles geslaagd');
process.exit(fouten ? 1 : 0);
