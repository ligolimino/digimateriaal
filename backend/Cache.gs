/**
 * Cache.gs — bewaart de catalogus even, zodat niet elke bezoeker de hele sheet laat inlezen.
 *
 * Hoe het werkt:
 *   - De eerste bezoeker laat de catalogus opbouwen (enkele seconden).
 *   - Het resultaat gaat gecomprimeerd in de cache van Google, voor "Vernieuwen na (minuten)".
 *   - Volgende bezoekers krijgen het resultaat meteen.
 *   - Wie iets wijzigt in DEZE sheet, leegt automatisch de cache (zie onEdit in Menu.gs).
 *     Voor lijsten van anderen (zie Lijsten.gs) kan dat niet: daar telt "Vernieuwen na (minuten)"
 *     van die lijst, of de knop "Gegevens vernieuwen" op de website.
 *
 * Elke lijst heeft zijn eigen plek in de cache. Een cache-waarde mag maximaal 100 KB zijn:
 * daarom knippen we de gegevens in stukken. Elke versie krijgt een eigen nummer, zodat
 * niemand ooit stukken van twee verschillende versies door elkaar leest.
 */

var CACHE_STUKGROOTTE = 90000;

function cacheSleutel(lijst) {
    return 'cat_' + (lijst || 'eigen');
}

/**
 * Geeft de volledige catalogus van een lijst terug ('' = deze sheet):
 *   { collecties, filters, items, problemen, instellingen, gemaakt }
 * Uit de cache als dat kan, anders opnieuw opgebouwd.
 */
function haalCatalogus(lijst) {
    var sleutel = cacheSleutel(lijst);
    var uitCache = leesUitCache(sleutel);
    if (uitCache) {
        return uitCache;
    }

    // Vermijd dat tien bezoekers tegelijk de sheet inlezen: één doet het, de rest wacht.
    var slot = LockService.getScriptLock();
    var gekregen = slot.tryLock(30000);
    try {
        uitCache = leesUitCache(sleutel);
        if (uitCache) {
            return uitCache;
        }
        var catalogus = bouwVoorLijst(lijst);
        schrijfInCache(sleutel, catalogus, catalogus.instellingen.cacheMinuten * 60);
        return catalogus;
    } finally {
        if (gekregen) {
            slot.releaseLock();
        }
    }
}

/** Bouwt de catalogus van een lijst op, met de instellingen van die lijst erbij. */
function bouwVoorLijst(lijst) {
    var bron = openLijst(lijst);
    try {
        var instellingen = leesInstellingen(bron.spreadsheet);
        var catalogus = bouwCatalogus(bron.spreadsheet);
        catalogus.instellingen = {
            titel: instellingen.titel,
            ondertitel: instellingen.ondertitel,
            loginVerplicht: instellingen.loginVerplicht,
            domeinen: instellingen.domeinen,
            cacheMinuten: instellingen.cacheMinuten,
            oudeLinks: instellingen.oudeLinks
        };
        catalogus.gemaakt = new Date().toISOString();
        return catalogus;
    } finally {
        bron.opruimen();
    }
}

function schrijfInCache(sleutel, object, seconden) {
    var cache = CacheService.getScriptCache();
    var gezipt = Utilities.gzip(Utilities.newBlob(JSON.stringify(object), 'application/json'));
    var tekst = Utilities.base64Encode(gezipt.getBytes());
    var versie = String(new Date().getTime());

    var stukken = {};
    var aantal = Math.ceil(tekst.length / CACHE_STUKGROOTTE);
    for (var i = 0; i < aantal; i++) {
        stukken[sleutel + '_' + versie + '_' + i] = tekst.slice(i * CACHE_STUKGROOTTE, (i + 1) * CACHE_STUKGROOTTE);
    }
    // Eerst de stukken, dan pas de index: zo leest niemand een half geschreven catalogus.
    cache.putAll(stukken, seconden);
    cache.put(sleutel + '_index', JSON.stringify({ aantal: aantal, versie: versie, gemaakt: object.gemaakt }), seconden);
}

function leesUitCache(sleutel) {
    var cache = CacheService.getScriptCache();
    var index = cache.get(sleutel + '_index');
    if (!index) {
        return null;
    }
    var info = JSON.parse(index);
    var sleutels = [];
    for (var i = 0; i < info.aantal; i++) {
        sleutels.push(sleutel + '_' + info.versie + '_' + i);
    }
    var stukken = cache.getAll(sleutels);
    var tekst = '';
    for (var j = 0; j < sleutels.length; j++) {
        if (!stukken[sleutels[j]]) {
            return null; // een stuk is al verlopen: opnieuw opbouwen
        }
        tekst += stukken[sleutels[j]];
    }
    var blob = Utilities.newBlob(Utilities.base64Decode(tekst), 'application/x-gzip');
    return JSON.parse(Utilities.ungzip(blob).getDataAsString());
}

/** Leegt de cache van een lijst ('' = deze sheet): de volgende bezoeker ziet meteen de nieuwste versie. */
function leegCache(lijst) {
    CacheService.getScriptCache().remove(cacheSleutel(lijst) + '_index');
}

/**
 * Voor de knop "Gegevens vernieuwen" op de website: leegt de cache, maar alleen als de
 * gegevens ouder zijn dan `minSeconden`. Zo kan niemand het script laten overuren door
 * honderd keer op de knop te drukken.
 */
function vernieuwIndienOud(lijst, minSeconden) {
    var index = CacheService.getScriptCache().get(cacheSleutel(lijst) + '_index');
    if (index) {
        var leeftijd = (new Date().getTime() - new Date(JSON.parse(index).gemaakt).getTime()) / 1000;
        if (leeftijd < minSeconden) {
            return false;
        }
    }
    leegCache(lijst);
    return true;
}
