# 6. Uitleg bij de code

Dit document legt uit **waarom** de code zo in elkaar zit. Het is bedoeld voor wie de code wil aanpassen,
of wil leren hoe een kleine webtoepassing opgebouwd wordt.

## Het grote plaatje

```
┌──────────────────────┐        ┌──────────────────────────┐        ┌───────────────────────────┐
│   Google Sheet       │        │  Backend (Apps Script)   │  JSON  │  Frontend (GitHub Pages)  │
│   = de gegevens      │ ─────▶ │  leest, kuist op, filtert│ ─────▶ │  toont, zoekt, filtert    │
│   (privé)            │        │  controleert login/delen │        │  index.html  /  kijk/     │
└──────────────────────┘        └──────────────────────────┘        └───────────────────────────┘
                                            ▲                                   │
                                            └──────── fetch(…/exec?actie=…) ────┘
```

Drie lagen, elk met **één taak**:

| Laag | Taak | Weet niets van… |
|---|---|---|
| Sheet | gegevens bewaren | websites |
| Backend | gegevens omzetten naar een nette lijst, beslissen wat iemand mag zien | HTML, opmaak |
| Frontend | tonen en laten zoeken | waar de gegevens vandaan komen |

Dat heet **scheiding van verantwoordelijkheden** (*separation of concerns*). Het voordeel: je kan één laag vervangen
zonder de andere aan te raken. Een ander backend (bv. een database) vraagt geen nieuwe website,
zolang het dezelfde JSON teruggeeft.

## Vergelijking met de oude pagina's

| Oud | Nieuw | Waarom |
|---|---|---|
| Gegevens in de HTML | Gegevens uit de sheet, via het backend | Eén bron van waarheid; aanvullen zonder code |
| 9 bijna-identieke bestanden | 1 lesgeverspagina, 1 cursistenpagina, gedeelde modules | Een fout herstel je op één plek |
| CSS en JS in de HTML | `css/`, `js/` apart | Overzicht, herbruikbaar, de browser bewaart ze |
| `onclick="…"` in de HTML | `addEventListener` in JS | HTML = structuur, JS = gedrag |
| `innerHTML` met titels | `textContent` (zie `el()` in `hulp.js`) | Een titel kan nooit code in de pagina smokkelen (XSS) |
| Deellink `?v=<YouTube-ID>` op de overzichtspagina | `kijk/?id=<code>`, aparte pagina, backend controleert | Cursisten kunnen niet in het overzicht; niemand kan willekeurige video's tonen |
| Zoeken en filteren werken elkaar tegen | Eén `toestand`-object, één `toon()`-functie | Elke klik past de toestand aan en tekent alles opnieuw |
| YouTube-ID = laatste 11 tekens van de link | Reguliere expressie die de ID zoekt | 106 links met `&t=…` of `?list=…` werkten niet |

## Backend (`backend/*.gs`)

| Bestand | Doet |
|---|---|
| `Api.gs` | De voordeur: `doGet`/`doPost` → `verwerk(actie)` → JSON |
| `Instellingen.gs` | Leest de tabbladen *Website* en *Website-instellingen* |
| `Bronnen.gs` | Leest elke bron en maakt er items van; houdt meldingen bij voor *Controle* |
| `Links.gs` | Herkent soort link, maakt insluit- en thumbnailadressen (geen Google-diensten: los testbaar) |
| `Cache.gs` | Bewaart de catalogus gecomprimeerd in stukken van 90 KB |
| `Login.gs` | Vraagt aan Microsoft van wie een toegangssleutel is |
| `Menu.gs` | Het menu in de sheet, `onEdit` om de cache te legen |
| `Import.gs` | Een Excel-bestand inladen: omzetten via Drive, tabbladen vervangen, verslag |

Een paar keuzes uitgelicht:

- **Kolommen op kopnaam, niet op letter.** `normaliseerKop()` maakt van `"  Video-url "` → `"video-url"`.
  Zo breekt niets als iemand een kolom invoegt.
- **Alles in één keer lezen.** `getDisplayValues()` op een heel bereik is veel sneller dan cel per cel:
  elke aanroep naar Google kost tijd.
- **Een stabiele code per link.** `maakItemId()` berekent een SHA-256-hash van de link. Dezelfde link geeft
  altijd dezelfde code, en uit de code kan je de link niet terugrekenen. Er hoeft niets in de sheet geschreven te worden.
- **Lege velden weglaten.** Bij 4.000 items scheelt dat honderden kilobytes.
- **Fouten als gegevens.** Het backend stopt niet bij een rare rij, maar noteert ze in `problemen`
  en gaat door. Die lijst wordt het tabblad *Controle*.

## Frontend (`js/*.js`)

| Bestand | Doet | Gebruikt door |
|---|---|---|
| `config.js` | Adres van het backend, login-instellingen | alles |
| `api.js` | Praat met het backend; bewaart een kopie in de browser | beide pagina's |
| `catalogus.js` | Zoeken, filteren, sorteren: **pure functies**, geen HTML | lesgevers |
| `hulp.js` | `el()` om veilig HTML te maken, iconen, kopiëren, meldingen | beide |
| `kaarten.js` | Eén kaart tekenen | beide |
| `speler.js` | Afspelen, met afdekscherm voor YouTube | beide |
| `deel.js` | Deelvenster met link en QR-code | lesgevers |
| `auth.js` | Microsoft-login (MSAL), alleen geladen als nodig | lesgevers |
| `lesgevers.js` | Brengt alles samen op de lesgeverspagina | `index.html` |
| `kijk.js` | Brengt alles samen op de cursistenpagina | `kijk/index.html` |

### Toestand en tekenen

```js
let toestand = { collectie: '', zoek: '', soort: '', programma: '', filters: {}, sorteer: 'lijst' };

function toon() {
    resultaten = filterEnSorteer(items, toestand);   // logica
    toonCollecties(); toonFilters(); ...             // weergave
}

// elke gebeurtenis: toestand aanpassen → toon()
select.onchange = (e) => { toestand.filters.Thema = e.target.value; toon(); };
```

Dit patroon (*state → render*) is hetzelfde idee als in React of Vue, maar dan zonder framework.

### Pure functies testen

`catalogus.js` gebruikt geen `document`. Daarom kan `tests/frontend.test.mjs` die functies gewoon in Node.js
uitvoeren. **Logica scheiden van weergave maakt testen eenvoudig.**

### Een nabootsing (mock) om het backend te testen

Apps Script draait alleen bij Google. `tests/googlemock.js` maakt nep-versies van `SpreadsheetApp`,
`CacheService`, enz., en laadt de `.gs`-bestanden in een gedeelde omgeving (`vm.createContext`),
net zoals Google ze laadt. Zo testen we het echte backend op de echte lijst.

## Webconcepten die je hier ziet

| Begrip | Waar | In één zin |
|---|---|---|
| **ES-modules** | `import`/`export` in `js/` | Elk bestand is een module met eigen variabelen; `type="module"` in de HTML |
| **fetch + JSON** | `api.js` | De browser vraagt gegevens op zonder de pagina te herladen |
| **CORS / preflight** | `api.js` (`text/plain`) | Een POST met `application/json` vraagt eerst toestemming (OPTIONS); Apps Script kent dat niet, `text/plain` niet |
| **XSS** | `hulp.js` (`el()`) | Tekst nooit als HTML invoegen als ze van buitenaf komt |
| **Cache** | `Cache.gs`, `api.js` | Bewaren wat duur is om te berekenen; zorgen dat het vervalt |
| **Hash** | `maakItemId()` | Eenrichtingsfunctie: van link naar code, niet terug |
| **OAuth 2 / OpenID Connect** | `auth.js`, `Login.gs` | Inloggen bij een derde (Microsoft), die een sleutel geeft die anderen kunnen controleren |
| **IntersectionObserver** | `lesgevers.js` | Kaarten bijladen als je naar onderen scrolt |
| **`<dialog>`** | spelervenster, deelvenster | Ingebouwd venster met Esc-toets en focusbeheer |
| **Responsief ontwerp** | `stijl.css` (`@media`) | Dezelfde pagina op gsm, tablet en computer |

## Iets aanpassen

| Ik wil… | Bestand |
|---|---|
| kleuren of lettertype veranderen | `css/stijl.css`, bovenaan (`:root`) |
| een nieuw programma herkennen (bv. Wordwall-thumbnail) | `backend/Links.gs` → daarna `node tools/maak-code-gs.js` en opnieuw implementeren |
| de tekst "Wat zoek je vandaag?" veranderen | `index.html` |
| het aantal kaarten per keer veranderen | `js/lesgevers.js`, `PER_KEER` |

Na elke aanpassing aan het backend: tests uitvoeren (zie `tests/LEESMIJ.md`).
