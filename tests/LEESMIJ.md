# Tests

Alles kan getest worden **zonder Google**: `googlemock.js` bootst de Google-diensten na
(SpreadsheetApp, CacheService, Utilities, ...), op basis van een export van de echte sheet.

## Eenmalig: de sheet exporteren

```bash
# In Google Sheets: Bestand → Downloaden → Microsoft Excel (.xlsx)
pip install openpyxl
python3 tests/xlsx_naar_json.py Overzichtslijst.xlsx tests/lijst.json
```

> ⚠️ `tests/lijst.json` bevat **alle gegevens** van de sheet. Zet dit bestand **nooit** op GitHub
> (het staat in `.gitignore`).

## Tests uitvoeren (Node.js 18 of nieuwer)

```bash
node --test tests/backend.test.js tests/frontend.test.mjs
```

| Bestand | Test |
|---|---|
| `backend.test.js` | Links herkennen, de volledige catalogus op de echte lijst, deelregels, cache, login, menu |
| `frontend.test.mjs` | Zoeken, filteren, sorteren, toestand in het adres |
| `browsertest.mjs` | De echte pagina's in een browser (Playwright) |

## De website lokaal bekijken

```bash
node tests/testserver.js          # http://localhost:8123/
node tests/browsertest.mjs        # in een tweede venster; schermafbeeldingen in tests/schermen/
```

De testserver gebruikt het echte backend op `tests/lijst.json` en zet een aantal rijen op "vrij te delen".
Thumbnails en YouTube-video's laden alleen als je computer internet heeft.
