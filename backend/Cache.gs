/**
 * Cache.gs — bewaart de catalogus even, zodat niet elke bezoeker de hele sheet laat inlezen.
 *
 * Hoe het werkt:
 *   - De eerste bezoeker laat de catalogus opbouwen (enkele seconden).
 *   - Het resultaat gaat gecomprimeerd in de cache van Google, voor "Vernieuwen na (minuten)".
 *   - Volgende bezoekers krijgen het resultaat meteen.
 *   - Wie iets wijzigt in de sheet, leegt automatisch de cache (zie onEdit in Menu.gs).
 *
 * Een cache-waarde mag maximaal 100 KB zijn. Daarom knippen we de gegevens in stukken.
 */

var CACHE_INDEX = 'catalogus_index';
var CACHE_DEEL = 'catalogus_deel_';
var CACHE_STUKGROOTTE = 90000;

/** Geeft de catalogus terug: uit de cache als dat kan, anders opnieuw opgebouwd. */
function haalCatalogus() {
    var uitCache = leesUitCache();
    if (uitCache) {
        return uitCache;
    }

    // Vermijd dat tien bezoekers tegelijk de sheet inlezen: één doet het, de rest wacht.
    var slot = LockService.getScriptLock();
    var gekregen = slot.tryLock(30000);
    try {
        uitCache = leesUitCache();
        if (uitCache) {
            return uitCache;
        }
        var spreadsheet = SpreadsheetApp.getActive();
        var instellingen = leesInstellingen(spreadsheet);
        var catalogus = bouwCatalogus(spreadsheet);
        delete catalogus.problemen; // die zijn alleen voor het tabblad Controle
        catalogus.gemaakt = new Date().toISOString();
        schrijfInCache(catalogus, instellingen.cacheMinuten * 60);
        return catalogus;
    } finally {
        if (gekregen) {
            slot.releaseLock();
        }
    }
}

function schrijfInCache(object, seconden) {
    var cache = CacheService.getScriptCache();
    var gezipt = Utilities.gzip(Utilities.newBlob(JSON.stringify(object), 'application/json'));
    var tekst = Utilities.base64Encode(gezipt.getBytes());

    var stukken = {};
    var aantal = Math.ceil(tekst.length / CACHE_STUKGROOTTE);
    for (var i = 0; i < aantal; i++) {
        stukken[CACHE_DEEL + i] = tekst.slice(i * CACHE_STUKGROOTTE, (i + 1) * CACHE_STUKGROOTTE);
    }
    // Eerst de stukken, dan pas de index: zo leest niemand een half geschreven catalogus.
    cache.putAll(stukken, seconden);
    cache.put(CACHE_INDEX, JSON.stringify({ aantal: aantal }), seconden);
}

function leesUitCache() {
    var cache = CacheService.getScriptCache();
    var index = cache.get(CACHE_INDEX);
    if (!index) {
        return null;
    }
    var aantal = JSON.parse(index).aantal;
    var sleutels = [];
    for (var i = 0; i < aantal; i++) {
        sleutels.push(CACHE_DEEL + i);
    }
    var stukken = cache.getAll(sleutels);
    var tekst = '';
    for (var j = 0; j < aantal; j++) {
        if (!stukken[CACHE_DEEL + j]) {
            return null; // een stuk is al verlopen: opnieuw opbouwen
        }
        tekst += stukken[CACHE_DEEL + j];
    }
    var blob = Utilities.newBlob(Utilities.base64Decode(tekst), 'application/x-gzip');
    return JSON.parse(Utilities.ungzip(blob).getDataAsString());
}

/** Leegt de cache: de volgende bezoeker ziet meteen de nieuwste versie van de sheet. */
function leegCache() {
    CacheService.getScriptCache().remove(CACHE_INDEX);
}
