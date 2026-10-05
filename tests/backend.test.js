/**
 * Tests voor het backend, met de echte overzichtslijst.
 * Uitvoeren:  node --test tests/
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { NepSpreadsheet, laadBackend } = require('./googlemock');

const LIJST = path.join(__dirname, 'lijst.json');
const WEBSITE_TSV = path.join(__dirname, '..', 'handleiding', 'website-tabblad-ligo.tsv');

function leesTsv(bestand) {
    return fs.readFileSync(bestand, 'utf8').trim().split('\n').map((r) => r.split('\t'));
}

/** Een spreadsheet met de echte lijst + het tabblad "Website" zoals voorgesteld voor Ligo. */
function maakLigoSheet(aanpassen) {
    const bladen = JSON.parse(fs.readFileSync(LIJST, 'utf8'));
    if (aanpassen) {
        aanpassen(bladen);
    }
    const ss = new NepSpreadsheet(bladen);
    ss.voegBladToe({ naam: 'Website', verborgen: false, tonen: leesTsv(WEBSITE_TSV) });
    return ss;
}

/** Voegt een kolom toe aan een tabblad (zoals het menu "Kolommen toevoegen" doet). */
function voegKolomToe(blad, koprij, kop, waardePerRij) {
    blad.tonen.forEach((rij, i) => {
        const r = i + 1;
        rij.push(r === koprij ? kop : r > koprij ? waardePerRij(r, rij) : '');
        blad.links[i].push('');
        blad.formules[i].push('');
    });
}

// ---------------------------------------------------------------------------
// Links herkennen
// ---------------------------------------------------------------------------

test('YouTube-ID wordt correct gevonden, ook met &t= of ?list= erachter', () => {
    const be = laadBackend(new NepSpreadsheet([]));
    const gevallen = {
        'https://www.youtube.com/watch?v=k9p3Gt7G0o8&t=6s': 'k9p3Gt7G0o8',
        'https://youtu.be/sHak0nIUsIQ?list=PLJPfnZKDZxzb8T43tphlYrha2LyxNbl07': 'sHak0nIUsIQ',
        'https://www.youtube.com/watch?v=NQRpChgYDDE&feature=youtu.be': 'NQRpChgYDDE',
        'https://www.youtube-nocookie.com/embed/oEDsDnXPORc?autoplay=0': 'oEDsDnXPORc',
        'https://youtube.com/shorts/abcdefghijk': 'abcdefghijk',
        'https://www.youtube.com/watch?feature=share&v=-Quj5nKXwLU': '-Quj5nKXwLU'
    };
    for (const [url, id] of Object.entries(gevallen)) {
        const a = be.analyseerLink(url);
        assert.equal(a.type, 'youtube', url);
        assert.equal(a.videoId, id, url);
        assert.equal(a.embed, 'https://www.youtube-nocookie.com/embed/' + id);
    }
    assert.equal(be.analyseerLink('https://www.youtube.com/watch?v=k9p3Gt7G0o8&t=1m30s').start, 90);
});

test('Andere soorten links', () => {
    const be = laadBackend(new NepSpreadsheet([]));
    const lijst = be.analyseerLink('https://youtube.com/playlist?list=PLJPfnZKDZxzYwg93ZlVRRZMbqM_Ey09_6');
    assert.equal(lijst.type, 'youtube-lijst');

    const tl = be.analyseerLink('https://www.thinglink.com/card/1585930999357767681µ');
    assert.equal(tl.type, 'thinglink');
    assert.equal(tl.url, 'https://www.thinglink.com/card/1585930999357767681');
    assert.match(tl.thumb, /cdn\.thinglink\.me\/api\/image\/1585930999357767681\//);

    const canva = be.analyseerLink('https://www.canva.com/design/DAF95mlqoNA/cN-3gVqPZo2I6fEAVGLwjA/edit?utm_content=x');
    assert.equal(canva.type, 'canva');
    assert.equal(canva.url, 'https://www.canva.com/design/DAF95mlqoNA/cN-3gVqPZo2I6fEAVGLwjA/view', 'nooit de bewerkingslink');

    const sp = be.analyseerLink('https://limino.sharepoint.com/sites/x/y.png');
    assert.equal(sp.alleenLigo, true);

    assert.equal(be.analyseerLink('hhttps://www.youtube-nocookie.com/embed/4wUFOYvOv2w?x=1').videoId, '4wUFOYvOv2w');
    assert.equal(be.analyseerLink('<iframe width="90%" src="https://player.vimeo.com/video/12345"></iframe>').type, 'vimeo');
    assert.equal(be.analyseerLink('S'), null);
    assert.equal(be.analyseerLink(''), null);
    assert.equal(be.analyseerLink('https://quizlet.com/123/flashcards').programma, 'Quizlet');
    assert.equal(be.analyseerLink('https://create.kahoot.it/details/abc').programma, 'Kahoot');

    const sc = be.verbeterSoundcloud('https://w.soundcloud.com/player/?url=x&hide_related=false&visual=true&auto_play=true');
    assert.match(sc, /hide_related=true/);
    assert.doesNotMatch(sc, /hide_related=false|visual=true|auto_play=true/);
});

// ---------------------------------------------------------------------------
// De hele catalogus met de echte lijst
// ---------------------------------------------------------------------------

test('Catalogus met de echte overzichtslijst', () => {
    const be = laadBackend(maakLigoSheet());
    const start = Date.now();
    const cat = be.bouwCatalogus(be.SpreadsheetApp.getActive());
    const duur = Date.now() - start;

    console.log('\n  Collecties:');
    cat.collecties.forEach((c) => console.log('   -', c.naam.padEnd(22), c.aantal));
    console.log('  Filters:', cat.filters.join(', '));
    console.log('  Items:', cat.items.length, '| meldingen:', cat.problemen.length, '| opgebouwd in', duur, 'ms');

    const telling = {};
    cat.problemen.forEach((p) => {
        const soort = p.probleem.replace(/rij \d+/, 'rij …').replace(/".*?"/g, '"…"');
        telling[soort] = (telling[soort] || 0) + 1;
    });
    console.log('  Soorten meldingen:');
    Object.entries(telling).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log('   ', String(n).padStart(4), s));

    // Er mogen geen fouten in de instellingen zitten (ontbrekende kolommen of tabbladen).
    const instelFouten = cat.problemen.filter((p) => /niet gevonden|bestaat niet/.test(p.probleem));
    assert.equal(instelFouten.length, 0, JSON.stringify(instelFouten));

    // Elke collectie heeft items.
    cat.collecties.forEach((c) => assert.ok(c.aantal > 0, c.naam + ' is leeg'));

    // Geen enkele YouTube-video met een kapotte ID (het oude probleem).
    const yt = cat.items.filter((i) => i.type === 'youtube');
    assert.ok(yt.length > 1000, 'verwacht veel YouTube-video\'s, kreeg ' + yt.length);
    yt.forEach((i) => assert.match(i.embed, /\/embed\/[A-Za-z0-9_-]{11}$/));

    // De oorspronkelijke link van video's gaat niet mee naar de website.
    yt.forEach((i) => assert.equal(i.url, undefined));

    // Elke ID is uniek binnen een collectie (dubbele links krijgen dezelfde code, dat mag).
    cat.items.forEach((i) => assert.match(i.id, /^[A-Za-z0-9]{10}$/));

    // Nog niets is vrij te delen: die kolom bestaat nog niet in de sheet.
    assert.equal(cat.items.filter((i) => i.deelbaar).length, 0);

    // Canva-links zijn nooit bewerkingslinks.
    cat.items.filter((i) => i.type === 'canva').forEach((i) => assert.doesNotMatch(i.url, /\/edit/));

    // Audio: de verbeterde insluitcode wordt gebruikt.
    const audio = cat.items.filter((i) => i.collectie === 'Audio' && i.type === 'soundcloud');
    assert.ok(audio.length > 600);
    assert.ok(audio.some((i) => /api\.soundcloud\.com/.test(i.embed)), 'insluitcode met geheime link gebruikt');

    // De filterwaarden zijn opgekuist: "school" en "School" worden één keuze.
    const themas = new Set(cat.items.filter((i) => i.collectie === 'Oefeningen').map((i) => i.filters.Thema).filter(Boolean));
    assert.ok(themas.has('School'));
    assert.ok(!themas.has('school'));

    // Sla de catalogus op voor de browsertests.
    fs.writeFileSync(path.join(__dirname, 'catalogus-test.json'), JSON.stringify(cat));
});

test('Op website = nee verbergt een rij; Vrij te delen = ja geeft een deelknop', () => {
    const ss = maakLigoSheet((bladen) => {
        const oef = bladen.find((b) => b.naam === 'Oefeningen');
        const blad = { tonen: oef.tonen, links: oef.links, formules: oef.formules };
        // Rij 5 verbergen, rijen 6 t.e.m. 20 vrij te delen.
        voegKolomToe(blad, 4, 'Op website', (r) => (r === 5 ? 'nee' : ''));
        voegKolomToe(blad, 4, 'Vrij te delen', (r) => (r >= 6 && r <= 20 ? 'ja' : ''));
    });
    const be = laadBackend(ss);
    const cat = be.bouwCatalogus(ss);
    const oef = cat.items.filter((i) => i.collectie === 'Oefeningen');
    assert.ok(!oef.some((i) => i.bron === 'Oefeningen – rij 5'), 'rij 5 is verborgen');
    const deelbaar = oef.filter((i) => i.deelbaar);
    assert.ok(deelbaar.length >= 13 && deelbaar.length <= 15, 'aantal deelbaar: ' + deelbaar.length);
});

test('API: info, catalogus, item, cache', () => {
    const ss = maakLigoSheet((bladen) => {
        const oef = bladen.find((b) => b.naam === 'Oefeningen');
        voegKolomToe(oef, 4, 'Vrij te delen', (r) => (r >= 6 && r <= 12 ? 'ja' : ''));
    });
    const be = laadBackend(ss);
    const json = (uitvoer) => JSON.parse(uitvoer.tekst);

    const info = json(be.doGet({ parameter: {} }));
    assert.equal(info.ok, true);
    assert.equal(info.titel, 'Digitale oefeningen');
    assert.equal(info.loginVerplicht, false);

    const cat = json(be.doGet({ parameter: { actie: 'catalogus' } }));
    assert.equal(cat.ok, true);
    assert.equal(cat.problemen, undefined, 'meldingen gaan niet naar de website');
    const schrijfVoor = be.__cache.schrijfacties;
    assert.ok(be.__cache.get('catalogus_index'), 'catalogus in de cache');

    // Tweede keer: uit de cache, er wordt niets opnieuw geschreven.
    const cat2 = json(be.doGet({ parameter: { actie: 'catalogus' } }));
    assert.equal(cat2.items.length, cat.items.length);
    assert.equal(be.__cache.schrijfacties, schrijfVoor);

    // Grootte van het antwoord
    const kb = Math.round(JSON.stringify(cat).length / 1024);
    const zlib = require('zlib');
    const gzKb = Math.round(zlib.gzipSync(JSON.stringify(cat)).length / 1024);
    console.log('  Catalogus: ' + kb + ' KB, gecomprimeerd ' + gzKb + ' KB, ' + be.__cache.data.size + ' cache-sleutels');

    // Een deelbaar item ophalen.
    const deelbaar = cat.items.find((i) => i.deelbaar);
    assert.ok(deelbaar, 'er is een deelbaar item');
    const item = json(be.doGet({ parameter: { actie: 'item', id: deelbaar.id } }));
    assert.equal(item.ok, true);
    assert.equal(item.item.titel, deelbaar.titel);
    assert.equal(item.item.collectie, undefined, 'cursist ziet geen collectie');
    assert.equal(item.item.bron, undefined, 'cursist ziet geen bronrij');

    // Een niet-deelbaar item mag NIET opvraagbaar zijn.
    const nietDeelbaar = cat.items.find((i) => !i.deelbaar);
    const geweigerd = json(be.doGet({ parameter: { actie: 'item', id: nietDeelbaar.id } }));
    assert.equal(geweigerd.ok, false);

    // Rommel als ID
    assert.equal(json(be.doGet({ parameter: { actie: 'item', id: '<script>' } })).ok, false);

    // Na een wijziging (onEdit) is de cache leeg.
    be.onEdit();
    assert.equal(be.__cache.get('catalogus_index'), null);
});

test('API: login verplicht', () => {
    const ss = maakLigoSheet();
    ss.voegBladToe({
        naam: 'Website-instellingen', verborgen: false, tonen: [
            ['Instelling', 'Waarde'],
            ['Login verplicht', 'ja'],
            ['Toegelaten e-maildomeinen', 'ligo.be; @limino.be']
        ]
    });
    const be = laadBackend(ss, {
        UrlFetchApp: {
            fetch: (url, opties) => {
                const token = opties.headers.Authorization.replace('Bearer ', '');
                const gebruikers = { goed: 'an@ligo.be', ander: 'bob@gmail.com' };
                if (!gebruikers[token]) {
                    return { getResponseCode: () => 401, getContentText: () => '{}' };
                }
                return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ mail: gebruikers[token] }) };
            }
        }
    });
    const json = (uitvoer) => JSON.parse(uitvoer.tekst);
    const post = (o) => json(be.doPost({ postData: { contents: JSON.stringify(o) } }));

    assert.equal(json(be.doGet({ parameter: {} })).loginVerplicht, true);
    assert.equal(json(be.doGet({ parameter: { actie: 'catalogus' } })).loginNodig, true, 'GET zonder login geweigerd');
    assert.equal(post({ actie: 'catalogus' }).ok, false);
    assert.equal(post({ actie: 'catalogus', token: 'vals' }).ok, false);
    assert.match(post({ actie: 'catalogus', token: 'ander' }).fout, /geen toegang/);
    const goed = post({ actie: 'catalogus', token: 'goed' });
    assert.equal(goed.ok, true);
    assert.equal(goed.gebruiker, 'an@ligo.be');
});

test('Menu: voorstel voor het tabblad Website', () => {
    const bladen = JSON.parse(fs.readFileSync(LIJST, 'utf8'));
    const be = laadBackend(new NepSpreadsheet(bladen));
    const voorstel = be.raadBronnen(be.SpreadsheetApp.getActive());
    console.log('\n  Voorstel:');
    voorstel.forEach((b) => console.log('   ', [b.tabblad, b.koprij, b.titel, b.link, b.filters].join(' | ')));
    const per = Object.fromEntries(voorstel.map((b) => [b.tabblad, b]));
    assert.equal(per.Oefeningen.koprij, 4);
    assert.equal(per.Oefeningen.link, 'URL');
    assert.equal(per.Audio.koprij, 5);
    assert.equal(per.PJM.link, 'Video-url');
    assert.equal(per['Linken losse blz VLL'].titel, 'Wat');
    assert.equal(per.HELP, undefined);
});

test('Menu: instellingen aanmaken, kolommen toevoegen, controle — op de echte lijst', () => {
    const bladen = JSON.parse(fs.readFileSync(LIJST, 'utf8'));
    const ss = new NepSpreadsheet(bladen);
    const be = laadBackend(ss);

    be.onOpen();
    be.menuInstellingenAanmaken();
    const website = ss.getSheetByName('Website');
    assert.ok(website, 'tabblad Website aangemaakt');
    assert.ok(ss.getSheetByName('Website-instellingen'), 'tabblad Website-instellingen aangemaakt');
    assert.equal(website.tonen[0][0], 'Actief');
    assert.equal(website.tonen.length, 6, 'koprij + 5 voorgestelde bronnen');
    // Nog eens uitvoeren verandert niets.
    be.menuInstellingenAanmaken();
    assert.equal(ss.getSheetByName('Website').tonen.length, 6);

    // Met het voorstel werkt de catalogus meteen.
    const cat1 = be.bouwCatalogus(ss);
    assert.ok(cat1.items.length > 3000, 'items met voorstel: ' + cat1.items.length);

    be.menuKolommenToevoegen();
    const oef = ss.getSheetByName('Oefeningen');
    const koppen = oef.tonen[3];
    assert.ok(koppen.includes('Op website') && koppen.includes('Vrij te delen'), 'kolommen toegevoegd in koprij 4');
    const aantalKolommen = oef.getLastColumn();
    be.menuKolommenToevoegen();
    assert.equal(oef.getLastColumn(), aantalKolommen, 'tweede keer: niets dubbel toegevoegd');

    // Bestaande kolommen zijn niet verschoven: kolom H is nog steeds URL.
    assert.equal(koppen[7], 'URL');

    // Rij 10 op "ja" zetten → deelbaar.
    const kVrij = koppen.indexOf('Vrij te delen') + 1;
    oef._zet(10, kVrij, 'ja');
    const cat2 = be.bouwCatalogus(ss);
    assert.ok(cat2.items.some((i) => i.deelbaar && i.bron === 'Oefeningen – rij 10'));

    be.menuControle();
    const controle = ss.getSheetByName('Controle');
    assert.ok(controle.tonen.length > 100, 'controlerapport geschreven: ' + controle.tonen.length + ' rijen');
    assert.match(controle.tonen[1][0], /Items op de website/);
    console.log('  ' + controle.tonen[1][0]);
});

test('Afbeeldingen en Google Drive', () => {
    const be = laadBackend(new NepSpreadsheet([]));
    const png = be.analyseerLink('https://www.example.org/prenten/bakker.png');
    assert.equal(png.type, 'afbeelding');
    assert.equal(png.soort, 'Afbeelding');
    assert.equal(png.thumb, png.url);
    assert.equal(png.embed, png.url);
    assert.equal(be.analyseerLink('https://site.be/foto.JPG?w=800').type, 'afbeelding');

    const sp = be.analyseerLink('https://limino.sharepoint.com/sites/x/Onthoudblad%201.1.png');
    assert.equal(sp.type, 'sharepoint', 'SharePoint blijft SharePoint (alleen Ligo)');
    assert.equal(sp.soort, 'Afbeelding');
    assert.equal(sp.alleenLigo, true);
    assert.equal(sp.embed, null);

    const drive = be.analyseerLink('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing');
    assert.equal(drive.type, 'drive');
    assert.match(drive.thumb, /drive\.google\.com\/thumbnail\?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345/);

    // De onthoudbladen in de echte lijst krijgen het label Afbeelding.
    const ss = maakLigoSheet();
    const cat = laadBackend(ss).bouwCatalogus(ss);
    const ob = cat.items.filter((i) => i.collectie === 'PJM onthoudbladen');
    assert.ok(ob.filter((i) => i.soort === 'Afbeelding').length > 150, 'onthoudbladen als afbeelding herkend');
    assert.ok(ob.every((i) => !i.deelbaar));
});

test('Excel-bestand inladen: gegevens vervangen, instellingen behouden', () => {
    // Het "Excel-bestand": de echte lijst, met in Oefeningen een kolom Vrij te delen.
    function excelVersie(aanpassen) {
        const bladen = JSON.parse(fs.readFileSync(LIJST, 'utf8'));
        voegKolomToe(bladen.find((b) => b.naam === 'Oefeningen'), 4, 'Vrij te delen', (r) => (r >= 6 && r <= 9 ? 'ja' : ''));
        if (aanpassen) aanpassen(bladen);
        return bladen;
    }
    let volgendeExcel = excelVersie();

    // De Google-kopie vóór het inladen: verouderde gegevens + instellingen + een eigen tabblad.
    const oud = JSON.parse(fs.readFileSync(LIJST, 'utf8')).filter((b) => b.naam === 'Oefeningen');
    oud[0].tonen = oud[0].tonen.slice(0, 50);
    oud[0].links = oud[0].links.slice(0, 50);
    oud[0].formules = oud[0].formules.slice(0, 50);
    const doel = new NepSpreadsheet([...oud, { naam: 'Notities', verborgen: false, tonen: [['Mijn notitie']] }]);
    doel.voegBladToe({ naam: 'Website-instellingen', verborgen: false, tonen: [['Instelling', 'Waarde'], ['Titel van de website', 'Test']] });
    doel.voegBladToe({ naam: 'Website', verborgen: false, tonen: leesTsv(WEBSITE_TSV) });
    const websiteVoor = JSON.stringify(doel.getSheetByName('Website').tonen);

    const be = laadBackend(doel, { omzetting: () => new NepSpreadsheet(volgendeExcel) });
    const r = be.importeerExcel('Overzicht oefeningen.xlsx', Buffer.from('nep').toString('base64'));

    console.log('\n  Verslag:\n   ' + r.verslag.join('\n   '));
    console.log('  Items:', r.items, '| deelbaar:', r.deelbaar, '| meldingen:', r.meldingen, '| ernstig:', r.ernstig.length);

    // Hetzelfde resultaat als wanneer de gegevens rechtstreeks in Google stonden.
    const referentieSheet = new NepSpreadsheet(excelVersie());
    referentieSheet.voegBladToe({ naam: 'Website', verborgen: false, tonen: leesTsv(WEBSITE_TSV) });
    const referentie = laadBackend(referentieSheet).bouwCatalogus(referentieSheet);
    const naImport = be.bouwCatalogus(doel);
    assert.equal(r.items, referentie.items.length, 'zelfde aantal items als zonder Excel-omweg');
    assert.deepEqual(naImport.items.map((i) => i.id).join(','), referentie.items.map((i) => i.id).join(','), 'zelfde items, zelfde deelcodes');
    // Rijen 6-9 op 'ja', maar rij 7 is SharePoint (nooit deelbaar) → 3.
    assert.equal(r.deelbaar, referentie.items.filter((i) => i.deelbaar).length);
    assert.equal(r.deelbaar, 3);
    assert.equal(r.ernstig.length, 0);

    // Instellingen ongewijzigd, eigen tabblad ongewijzigd en gemeld.
    assert.equal(JSON.stringify(doel.getSheetByName('Website').tonen), websiteVoor);
    assert.equal(doel.getSheetByName('Notities').tonen[0][0], 'Mijn notitie');
    assert.ok(r.verslag.some((v) => /Niet in het Excel-bestand.*Notities/.test(v)));

    // Gegevens volledig vervangen, zonder formules, met verborgen kolommen.
    const oef = doel.getSheetByName('Oefeningen');
    assert.equal(oef.getLastRow(), 1367);
    assert.ok(oef.formules.every((rij) => rij.every((f) => !f)), 'geen formules in de kopie');
    assert.ok(oef.verborgenKolommen.includes(10), 'verborgen kolom J blijft verborgen');
    assert.ok(doel.getSheetByName('PJM'), 'nieuw tabblad PJM aangemaakt');

    // Tijdelijk bestand opgeruimd, import genoteerd.
    assert.equal(be.__prullenbak.length, 1);
    const inst = doel.getSheetByName('Website-instellingen').tonen;
    assert.ok(inst.some((rij) => rij[0] === 'Laatste Excel-import' && /Overzicht oefeningen\.xlsx/.test(rij[1])));

    // Een nieuwe Excel-versie: een rij verborgen → ook weg op de website.
    volgendeExcel = excelVersie((bladen) => {
        voegKolomToe(bladen.find((b) => b.naam === 'Oefeningen'), 4, 'Op website', (rij) => (rij === 6 ? 'nee' : ''));
    });
    const r2 = be.importeerExcel('Overzicht oefeningen.xlsx', 'bmVw');
    assert.equal(r2.items, r.items - 1);
    assert.equal(doel.getSheetByName('Website-instellingen').tonen.filter((rij) => rij[0] === 'Laatste Excel-import').length, 1, 'notitie bijgewerkt, niet dubbel');
});

test('Excel-bestand inladen: duidelijke fouten', () => {
    const be = laadBackend(new NepSpreadsheet([]), { zonderDrive: true });
    assert.throws(() => be.importeerExcel('lijst.pdf', ''), /Excel-bestand/);
    assert.throws(() => be.importeerExcel('lijst.xlsx', ''), /Drive API/);
});
