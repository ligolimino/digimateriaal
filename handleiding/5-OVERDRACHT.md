# 5. Overdracht — wat staat waar, en wat als het stopt?

Dit document is bedoeld voor wie de website overneemt.

## Wat staat waar

| Onderdeel | Waar | Eigenaar | Wat doet het |
|---|---|---|---|
| Google Sheet | Google Drive | Ligo-Google-account | De gegevens. Hier worden links bijgehouden (of: een kopie van een Excel-bestand, zie handleiding 7). |
| Script (backend) | In de sheet: *Extensies → Apps Script* | idem | Geeft de gegevens door aan de website. |
| Website (frontend) | GitHub: repo `ligolimino.github.io` | Ligo-GitHub-account | De pagina's voor lesgevers en cursisten. |
| Login (optioneel) | Microsoft Entra ID van Ligo | Ligo-IT | Laat lesgevers inloggen. |

**Niets hangt af van een persoonlijk account.** Er zijn geen betalende diensten, geen wachtwoorden of sleutels
die vervallen, en geen geplande taken die aan een persoon gekoppeld zijn.

## Checklist bij overdracht

- [ ] De nieuwe beheerder heeft toegang tot het **Ligo-Google-account** (of is mede-eigenaar van de sheet).
- [ ] De nieuwe beheerder heeft toegang tot het **Ligo-GitHub-account**.
- [ ] De nieuwe beheerder heeft [2-BEHEER.md](2-BEHEER.md) gelezen.
- [ ] Bij login: Ligo-IT weet dat de app-registratie *Ligo video-overzicht* gebruikt wordt.
- [ ] De **URL van het script** (eindigt op `/exec`) staat in `js/config.js`, dus die gaat niet verloren.

## Wat als…

| Situatie | Wat te doen |
|---|---|
| **De website toont een foutmelding** | Open de script-URL met `?actie=info` erachter. Zie je een fout, open dan de sheet en voer **🌐 Website → Controle uitvoeren** uit. |
| **De eigenaar van de sheet verandert** | Het script draait onder het account dat het *implementeerde*. Laat de nieuwe eigenaar een **nieuwe implementatie** maken (1-INSTALLATIE.md, stap 5) en zet de nieuwe URL in `config.js`. |
| **De sheet wordt gekopieerd** | Een kopie krijgt een kopie van het script, maar een **eigen** web-app-URL. Implementeer de kopie opnieuw en pas `config.js` aan. |
| **GitHub Pages zou ooit stoppen** | De website bestaat uit gewone HTML/CSS/JS-bestanden zonder bouwstap. Ze werken op elke webserver (bv. de Ligo-website, Netlify, Cloudflare Pages). Alleen het adres in `config.js` (`kijkAdres`) moet eventueel mee. |
| **Google Apps Script zou ooit stoppen** | Dan moet alleen het backend vervangen worden. De website verwacht een webadres dat dezelfde JSON teruggeeft (zie `backend/Api.gs` bovenaan). |
| **YouTube verandert iets** | De speler gebruikt de officiële YouTube-speler-API. Lukt die niet, dan valt de site automatisch terug op een gewone ingesloten video. |
| **De bibliotheek voor de login moet bijgewerkt worden** | `lib/msal-browser.min.js` vervangen door een nieuwere versie van [@azure/msal-browser](https://www.npmjs.com/package/@azure/msal-browser) (bestand `lib/msal-browser.min.js` uit het pakket). |

## Zoekmachines

- `index.html` en `kijk/index.html` bevatten `<meta name="robots" content="noindex, nofollow">`.
- `robots.txt` vraagt zoekmachines om de andere bestanden (handleidingen, code) niet te bezoeken.
- Dit is een **verzoek** aan zoekmachines, geen beveiliging. Wie het adres kent, kan de pagina's openen.
  Echte afscherming van het overzicht = de login ([4-LOGIN.md](4-LOGIN.md)).
- De **repo op github.com** zelf is publiek en kan wel in zoekmachines verschijnen. Daarom staan er geen gegevens in, alleen code.

## Gebruikte externe onderdelen

| Onderdeel | Waarvoor | Licentie | Waar |
|---|---|---|---|
| MSAL Browser 4.30 (Microsoft) | Login | MIT | `lib/msal-browser.min.js` |
| qrcode-generator 2.0 (Kazuhiko Arase) | QR-code in het deelvenster | MIT | `lib/qrcode.mjs` |
| Atkinson Hyperlegible (Braille Institute) | Goed leesbaar lettertype | SIL OFL | Google Fonts (valt terug op het systeemlettertype) |
| YouTube-speler-API | Afdekscherm bij pauze/einde | — | Geladen van youtube.com |

Beide bibliotheken staan **in de repo zelf**: als hun website verdwijnt, blijft de site werken.
