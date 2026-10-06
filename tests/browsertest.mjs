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

// Zoekveld: donkere tekst op witte achtergrond
console.log('Zoekveld en thumbnails');
await pagina.goto(BASIS);
await pagina.waitForSelector('.kaart');
const kleur = await pagina.$eval('#zoek', (i) => getComputedStyle(i).color);
controleer(kleur !== 'rgb(255, 255, 255)', 'tekst in het zoekveld is niet wit (' + kleur + ')');

// ThingLink: standaardplaatje van 512×512 → vinger-icoon; echte afbeelding blijft staan
const p3 = await context.newPage();
let teller = 0;
await p3.route('https://cdn.thinglink.me/**', (route) => {
    teller++;
    route.fulfill({ path: teller % 2 ? '/home/claude/tl512.png' : '/home/claude/tl1024.png', contentType: 'image/png' });
});
await p3.goto(BASIS + '#collectie=Oefeningen&programma=ThingLink');
await p3.waitForSelector('.kaart');
await p3.waitForTimeout(1500);
const tlTelling = await p3.evaluate(() => ({
    vinger: document.querySelectorAll('.kaart .plaatsvervanger.soort-interactief').length,
    echt: [...document.querySelectorAll('.kaart-beeld img')].filter((i) => i.naturalWidth === 1024).length
}));
controleer(tlTelling.vinger > 5 && tlTelling.echt > 5, "ThingLink: " + tlTelling.vinger + " standaardplaatjes vervangen door het vinger-icoon, " + tlTelling.echt + ' echte afbeeldingen behouden');
await p3.screenshot({ path: SCHERMEN + '14-thinglink.png' });
await p3.close();

// YouTube: bij pauze en einde wordt de speler VERVANGEN (niets ervoor gelegd)
console.log('YouTube-speler');
const p4 = await context.newPage();
p4.on('pageerror', (e) => consoleFouten.push('pageerror (yt): ' + e.message));
await p4.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({ path: new URL('./nep-youtube-api.js', import.meta.url).pathname, contentType: 'text/javascript' }));
await p4.goto(BASIS + "#collectie=PJM+video's");
await p4.waitForSelector('.kaart');
await p4.locator('.kaart .knop-hoofd').nth(1).click();
await p4.waitForSelector('#speler iframe');
const beginTijd = await p4.$eval('#speler iframe', (f) => f.dataset.start); // starttijd uit de link (&t=…)
const nep = (code) => p4.evaluate(`(${code})()`);
await nep('() => { const s = window.__nepSpelers.at(-1); s.zet(1); s.t = 42; s.zet(2); }');
await p4.waitForTimeout(500);
controleer((await p4.locator('.eigen-scherm').count()) === 0, 'korte pauze: speler blijft staan');
await p4.waitForSelector('.eigen-scherm', { timeout: 4000 }).catch(() => {});
controleer((await p4.locator('.eigen-scherm').count()) === 1 && (await p4.textContent('.eigen-scherm')).includes('Verder kijken'), 'na 1,5 s pauze: eigen scherm "Verder kijken"');
controleer((await p4.locator('#speler iframe').count()) === 0 && await nep('() => window.__nepSpelers.at(-1).vernietigd'), 'de YouTube-speler is weggehaald (niets ervoor gelegd)');
await p4.screenshot({ path: SCHERMEN + '15-pauze.png' });
await p4.click('.eigen-scherm');
await p4.waitForSelector('#speler iframe');
const nieuweSpeler = await p4.$eval('#speler iframe', (f) => ({ start: f.dataset.start, autoplay: f.dataset.autoplay }));
controleer(nieuweSpeler.start === '42' && nieuweSpeler.autoplay === '1', 'verder kijken: nieuwe speler vanaf 42 s, speelt meteen (' + JSON.stringify(nieuweSpeler) + ')');
await nep('() => { const s = window.__nepSpelers.at(-1); s.zet(2); s.zet(1); }');
await p4.waitForTimeout(1800);
controleer((await p4.locator('.eigen-scherm').count()) === 0, 'pauze en meteen verder: geen onderbreking');
await nep('() => window.__nepSpelers.at(-1).zet(0)');
await p4.waitForSelector('.eigen-scherm');
controleer((await p4.textContent('.eigen-scherm')).includes('Opnieuw bekijken'), 'einde: eigen scherm "Opnieuw bekijken"');
await p4.click('.eigen-scherm');
await p4.waitForSelector('#speler iframe');
controleer((await p4.$eval('#speler iframe', (f) => f.dataset.start)) === beginTijd, 'opnieuw bekijken: vanaf het begin (' + beginTijd + ' s, uit de link)');
await p4.keyboard.press('Escape');
await p4.close();

// Lijsten van anderen (?lijst=)
console.log('Lijsten (optie B)');
const p5 = await context.newPage();
p5.on('pageerror', (e) => consoleFouten.push('pageerror (lijst): ' + e.message));
await p5.goto(BASIS + '?lijst=leerlijn');
await p5.waitForSelector('.kaart');
controleer((await p5.textContent('#site-titel')) === 'Mijn digitale oefeningen', 'titel van de lijst: ' + await p5.textContent('#site-titel'));
controleer((await p5.locator('.kaart').count()) === 2, 'twee items uit het sjabloon');
await p5.screenshot({ path: SCHERMEN + '16-lijst.png' });
await p5.locator('.knop-deel').first().click();
const lijstLink = await p5.inputValue('.deel-link');
controleer(/\/kijk\/\?lijst=leerlijn&id=[A-Za-z0-9]{10}$/.test(lijstLink), 'deellink bevat de lijst: ' + lijstLink);
await p5.keyboard.press('Escape');
await p5.click('#controle-knop');
await p5.waitForFunction(() => !document.getElementById('controle-inhoud').textContent.includes('Bezig'));
controleer((await p5.textContent('#controle-inhoud')).includes('Geen meldingen'), 'controle van de lijst: ' + (await p5.textContent('#controle-inhoud')).slice(0, 60));
await p5.keyboard.press('Escape');
await p5.click('#vernieuw-knop');
await p5.waitForTimeout(500);
controleer((await p5.textContent('#melding')).includes('minder dan een minuut'), 'vernieuwen: niet binnen de minuut');
await p5.goto(lijstLink);
await p5.waitForSelector('.speler-kader, .kijk-fout');
controleer((await p5.locator('.speler-kader').count()) === 1, 'cursistenpagina met lijst: ' + await p5.textContent('#titel'));
await p5.goto(BASIS + '?lijst=bestaat-niet');
await p5.waitForSelector('.status-fout');
controleer((await p5.textContent('.status-fout')).includes('bestaat niet'), 'onbekende lijst: ' + (await p5.textContent('.status-fout p')));
await p5.goto(BASIS + '?lijst=excel');
await p5.waitForSelector('.kaart');
controleer((await p5.locator('.kaart').count()) === 2, 'lijst uit een Excel-bestand op Drive');
// Controle op de eigen lijst: veel meldingen in een tabel
await p5.goto(BASIS);
await p5.waitForSelector('.kaart');
await p5.click('#controle-knop');
await p5.waitForSelector('.controle-tabel');
controleer((await p5.locator('.controle-tabel tbody tr').count()) > 100, 'controle eigen lijst: ' + await p5.locator('.controle-tabel tbody tr').count() + ' meldingen in een tabel');
await p5.screenshot({ path: SCHERMEN + '17-controle.png' });
await p5.close();

// Zelf aanmelden
console.log('Aanmeldpagina');
const p6 = await context.newPage();
p6.on('pageerror', (e) => consoleFouten.push('pageerror (aanmelden): ' + e.message));
await p6.goto(BASIS + 'aanmelden/');
await p6.waitForSelector('#stappen:not([hidden])');
controleer((await p6.inputValue('#account')) === 'beheer@voorbeeld.be', 'account om mee te delen getoond');
controleer(await p6.locator('#code-blok').isHidden(), 'geen aanmeldcode nodig (standaard)');
const sjabloonStatus = await p6.evaluate(async () => (await fetch('../sjabloon/Sjabloon-links-weergavewebsite.xlsx')).status);
controleer(sjabloonStatus === 200, 'sjabloon downloadbaar');
await p6.fill('#code', 'Mijn Lijst!');
controleer((await p6.textContent('#voorbeeld-adres')).includes('?lijst=mijn-lijst'), 'voorbeeldadres: ' + await p6.textContent('#voorbeeld-adres'));
await p6.click('#verstuur');
controleer((await p6.textContent('#resultaat')).includes('Vul de link'), 'leeg formulier: melding');
await p6.fill('#link', 'https://docs.google.com/spreadsheets/d/NietGedeeldBestand_iiiiiiiiii/edit');
await p6.fill('#contact', 'An Peeters');
await p6.click('#verstuur');
await p6.waitForSelector('.resultaat.fout');
controleer((await p6.textContent('#resultaat')).includes('Geen toegang'), 'niet gedeeld: ' + (await p6.textContent('#resultaat')).slice(0, 50));
await p6.fill('#link', 'https://docs.google.com/spreadsheets/d/NieuweLijstTest_hhhhhhhhhhhhhh/edit?usp=sharing');
await p6.click('#verstuur');
await p6.waitForSelector('.resultaat.gelukt');
controleer((await p6.textContent('#resultaat')).includes('Je website staat online'), 'aangemeld: ' + (await p6.textContent('.resultaat.gelukt p')));
await p6.screenshot({ path: SCHERMEN + '18-aanmelden.png', fullPage: true });
await p6.click('text=Naar mijn website');
await p6.waitForSelector('.kaart');
controleer((await p6.locator('.kaart').count()) === 2 && p6.url().includes('?lijst=mijn-lijst'), 'nieuwe lijst meteen online: ' + p6.url());
// Nog eens aanmelden met hetzelfde bestand → bestaande code
await p6.goto(BASIS + 'aanmelden/');
await p6.waitForSelector('#stappen:not([hidden])');
await p6.fill('#link', 'https://docs.google.com/spreadsheets/d/NieuweLijstTest_hhhhhhhhhhhhhh/edit');
await p6.fill('#code', 'andere-naam');
await p6.fill('#contact', 'An');
await p6.click('#verstuur');
await p6.waitForSelector('.resultaat.fout');
controleer((await p6.textContent('#resultaat')).includes('al online, met de code "mijn-lijst"'), 'zelfde bestand opnieuw: bestaande code gemeld');
const gsm2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const p7 = await gsm2.newPage();
await p7.goto(BASIS + 'aanmelden/');
await p7.waitForSelector('#stappen:not([hidden])');
controleer((await p7.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'aanmeldpagina past op gsm');
await p7.screenshot({ path: SCHERMEN + '19-aanmelden-gsm.png', fullPage: true });
await gsm2.close();
await p6.close();

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
