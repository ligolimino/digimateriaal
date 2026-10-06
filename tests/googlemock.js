/**
 * googlemock.js — een nabootsing van de Google-diensten die het backend gebruikt,
 * zodat we de .gs-bestanden in Node.js kunnen testen met de echte overzichtslijst.
 *
 * Alleen wat het backend nodig heeft, is nagebootst.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const zlib = require('zlib');

/** Een tabblad op basis van de JSON uit xlsx_naar_json.py. */
class NepBlad {
    constructor(gegevens) {
        this.naam = gegevens.naam;
        this.verborgen = gegevens.verborgen;
        this.verborgenKolommen = gegevens.verborgenKolommen || [];
        this.tonen = gegevens.tonen;
        this.links = gegevens.links || gegevens.tonen.map((r) => r.map(() => ''));
        this.formules = gegevens.formules || gegevens.tonen.map((r) => r.map(() => ''));
    }
    getName() { return this.naam; }
    isSheetHidden() { return this.verborgen; }
    isColumnHiddenByUser(k) { return this.verborgenKolommen.includes(k); }
    getLastRow() { return this.tonen.length; }
    getLastColumn() { return this.tonen.reduce((m, r) => Math.max(m, r.length), 0); }
    getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); }
    getRange(rij, kol, aantalRijen = 1, aantalKol = 1) { return new NepBereik(this, rij, kol, aantalRijen, aantalKol); }
    getMaxColumns() { return Math.max(this.getLastColumn(), 26); }
    getMaxRows() { return Math.max(this.getLastRow(), 1000); }
    insertColumnAfter() { return this; }
    clear() { this.tonen = []; this.links = []; this.formules = []; return this; }
    insertRowsAfter() { return this; }
    insertColumnsAfter() { return this; }
    showColumns() { this.verborgenKolommen = []; return this; }
    hideColumns(k) { this.verborgenKolommen.push(k); return this; }
    getFrozenRows() { return this.vastgezet || 0; }
    setFrozenRows(n) { this.vastgezet = n; return this; }
    /** Schrijft één cel (en maakt het raster groter als nodig). */
    _zet(r, k, waarde) {
        for (const raster of [this.tonen, this.links, this.formules]) {
            while (raster.length < r) raster.push([]);
            raster.forEach((rij) => { while (rij.length < k) rij.push(''); });
        }
        this.tonen[r - 1][k - 1] = waarde === null || waarde === undefined ? '' : String(waarde);
    }
}
// Opmaakfuncties doen in de test niets, maar moeten wel bestaan en "this" teruggeven.
['setFrozenRows', 'autoResizeColumns', 'setColumnWidth', 'setColumnWidths'].forEach((m) => {
    NepBlad.prototype[m] = function () { return this; };
});

class NepBereik {
    constructor(blad, rij, kol, nr, nk) {
        Object.assign(this, { blad, rij, kol, nr, nk });
    }
    _lees(raster, maak) {
        const uit = [];
        for (let r = 0; r < this.nr; r++) {
            const lijn = [];
            for (let k = 0; k < this.nk; k++) {
                const rijData = raster[this.rij - 1 + r] || [];
                lijn.push(maak(rijData[this.kol - 1 + k], this.rij + r, this.kol + k));
            }
            uit.push(lijn);
        }
        return uit;
    }
    setValues(waarden) {
        waarden.forEach((rij, r) => rij.forEach((w, k) => this.blad._zet(this.rij + r, this.kol + k, w)));
        return this;
    }
    setValue(w) { this.blad._zet(this.rij, this.kol, w); return this; }
    clearDataValidations() { return this; }
    setRichTextValues(raster) {
        raster.forEach((rij, r) => rij.forEach((rt, k) => {
            const R = this.rij + r;
            const K = this.kol + k;
            this.blad._zet(R, K, rt.getText());
            this.blad.links[R - 1][K - 1] = rt.getLinkUrl() || '';
            this.blad.formules[R - 1][K - 1] = '';
        }));
        return this;
    }
    setDataValidation(v) { this.blad.validaties = (this.blad.validaties || []).concat([{ kol: this.kol, v }]); return this; }
    getDisplayValues() { return this._lees(this.blad.tonen, (v) => (v === undefined ? '' : String(v))); }
    getValues() { return this.getDisplayValues(); }
    getFormulas() { return this._lees(this.blad.formules, (v) => v || ''); }
    getRichTextValues() {
        return this._lees(this.blad.links, (link, r, k) => {
            const tekst = (this.blad.tonen[r - 1] || [])[k - 1] || '';
            return {
                getText: () => tekst,
                getLinkUrl: () => link || null,
                getRuns: () => [{ getLinkUrl: () => link || null }]
            };
        });
    }
}

['setNote', 'setFontWeight', 'setBackground', 'setFontColor', 'setFontSize'].forEach((m) => {
    NepBereik.prototype[m] = function () { return this; };
});

class NepSpreadsheet {
    constructor(bladen) { this.bladen = bladen.map((b) => new NepBlad(b)); this.meldingen = []; }
    insertSheet(naam, index) {
        const blad = new NepBlad({ naam, verborgen: false, tonen: [] });
        if (index === 0) this.bladen.unshift(blad); else this.bladen.push(blad);
        return blad;
    }
    toast(t) { this.meldingen.push(t); }
    setActiveSheet() {}
    getSheetByName(naam) { return this.bladen.find((b) => b.naam === naam) || null; }
    getSheets() { return this.bladen; }
    voegBladToe(gegevens) { this.bladen.unshift(new NepBlad(gegevens)); }
}

/** Een eenvoudige cache in het geheugen, met dezelfde regels als die van Google (max 100 KB per waarde). */
class NepCache {
    constructor() { this.data = new Map(); this.schrijfacties = 0; }
    get(k) { return this.data.has(k) ? this.data.get(k) : null; }
    put(k, v) {
        if (String(v).length > 100 * 1024) {
            throw new Error('Cache-waarde te groot: ' + k + ' (' + String(v).length + ' tekens)');
        }
        this.schrijfacties++;
        this.data.set(k, String(v));
    }
    putAll(obj, s) { Object.keys(obj).forEach((k) => this.put(k, obj[k], s)); }
    getAll(keys) { const o = {}; keys.forEach((k) => { if (this.data.has(k)) o[k] = this.data.get(k); }); return o; }
    remove(k) { this.data.delete(k); }
}

function maakBlob(bytes) {
    const buf = Buffer.from(bytes);
    return {
        getBytes: () => Array.from(buf).map((b) => (b > 127 ? b - 256 : b)),
        getDataAsString: () => buf.toString('utf8'),
        _buf: buf
    };
}

const naarBuffer = (bytes) => Buffer.from(bytes.map((b) => (b < 0 ? b + 256 : b)));

function maakUtilities() {
    return {
        DigestAlgorithm: { SHA_256: 'sha256' },
        Charset: { UTF_8: 'utf8' },
        computeDigest(alg, tekst) {
            return Array.from(crypto.createHash(alg).update(String(tekst), 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b));
        },
        base64EncodeWebSafe(bytes) { return naarBuffer(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'); },
        base64Encode(bytes) { return naarBuffer(bytes).toString('base64'); },
        base64Decode(tekst) { return Array.from(Buffer.from(tekst, 'base64')).map((b) => (b > 127 ? b - 256 : b)); },
        newBlob(inhoud) {
            return maakBlob(typeof inhoud === 'string' ? Buffer.from(inhoud, 'utf8') : naarBuffer(inhoud));
        },
        gzip(blob) { return maakBlob(zlib.gzipSync(blob._buf)); },
        ungzip(blob) { return maakBlob(zlib.gunzipSync(blob._buf)); },
        formatDate: (d) => d.toISOString()
    };
}

/**
 * Laadt alle .gs-bestanden in één gedeelde omgeving (zoals Google dat doet)
 * en geeft die omgeving terug, met de nep-diensten erin.
 */
function laadBackend(spreadsheet, extra = {}) {
    const cache = new NepCache();
    const bestanden = new Map();   // nep-Google Drive: id → spreadsheet
    const prullenbak = [];
    const context = {
        MimeType: { MICROSOFT_EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        // "Omzetten" van Excel = de spreadsheet die de test klaarzette (extra.omzetting).
        Drive: extra.zonderDrive ? undefined : {
            Files: {
                create: (meta, blob) => {
                    const id = 'tijdelijk-' + (bestanden.size + 1);
                    bestanden.set(id, extra.omzetting(blob));
                    return { id };
                }
            }
        },
        // Nep-Google Drive: tijdelijke omgezette bestanden + bestanden die de test klaarzet (extra.drive).
        DriveApp: {
            getFileById: (id) => {
                const bestand = (extra.drive || {})[id];
                if (!bestand && !bestanden.has(id)) {
                    throw new Error('Bestand niet gevonden of geen toegang: ' + id);
                }
                return {
                    setTrashed: (j) => { if (j) prullenbak.push(id); },
                    getMimeType: () => bestand.mime,
                    getName: () => bestand.naam || id,
                    getBlob: () => ({ bestandId: id })
                };
            }
        },
        console,
        SpreadsheetApp: {
            getActive: () => spreadsheet,
            openById: (id) => bestanden.get(id) || ((extra.drive || {})[id] || {}).ss,
            newRichTextValue: () => {
                const w = { tekst: '', link: null };
                const b = {
                    setText: (t) => { w.tekst = t; return b; },
                    setLinkUrl: (l) => { w.link = l; return b; },
                    build: () => ({ getText: () => w.tekst, getLinkUrl: () => w.link, getRuns: () => [{ getLinkUrl: () => w.link }] })
                };
                return b;
            },
            getUi: () => ({
                ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL' },
                alert: (titel, tekst) => spreadsheet.meldingen.push(tekst),
                createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addSubMenu: () => m, addToUi: () => m }; return m; },
                Button: { OK: 'OK', CANCEL: 'CANCEL' },
                prompt: () => {
                    const tekst = (extra.antwoorden || []).shift();
                    return { getSelectedButton: () => (tekst === undefined ? 'CANCEL' : 'OK'), getResponseText: () => tekst || '' };
                }
            }),
            newDataValidation: () => {
                const b = { requireValueInList: (l) => { b.lijst = l; return b; }, setAllowInvalid: () => b, build: () => ({ lijst: b.lijst }) };
                return b;
            }
        },
        Utilities: maakUtilities(),
        CacheService: { getScriptCache: () => cache },
        LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
        ContentService: {
            MimeType: { JSON: 'json' },
            createTextOutput: (tekst) => ({ tekst, setMimeType() { return this; } })
        },
        UrlFetchApp: extra.UrlFetchApp || { fetch: () => { throw new Error('Geen netwerk in tests'); } },
        Session: { getScriptTimeZone: () => 'Europe/Brussels', getEffectiveUser: () => ({ getEmail: () => 'beheer@voorbeeld.be' }) }
    };
    vm.createContext(context);
    const map = path.join(__dirname, '..', 'backend');
    fs.readdirSync(map).filter((f) => f.endsWith('.gs')).sort().forEach((f) => {
        vm.runInContext(fs.readFileSync(path.join(map, f), 'utf8'), context, { filename: f });
    });
    context.__cache = cache;
    context.__prullenbak = prullenbak;
    return context;
}

module.exports = { NepSpreadsheet, laadBackend };
