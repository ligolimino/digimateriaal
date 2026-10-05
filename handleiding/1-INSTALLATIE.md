# 1. Installatie — stap voor stap

Deze handleiding zet de website op voor de **Overzichtslijst online oefeningen, audio en video**.
Wordt het overzicht in Excel bijgehouden? Volg dan [7-EXCEL-ALS-BRON.md](7-EXCEL-ALS-BRON.md).
Voor een andere sheet volg je dezelfde stappen (zie ook [3-NIEUWE-WEBSITE.md](3-NIEUWE-WEBSITE.md)).

Reken op ongeveer **30 minuten**. Je hebt nodig:

- het Ligo-Google-account dat eigenaar is van de sheet;
- het Ligo-GitHub-account met toegang tot de repo `ligolimino.github.io`.

> **Hoe het in elkaar zit, in één zin:** de Google Sheet blijft de enige plek waar je links bijhoudt.
> Een klein script bij de sheet (het *backend*) geeft de gegevens door aan de website op GitHub (de *frontend*).

---

## Stap 1 — Het script in de sheet plakken

1. Open de Google Sheet **met het Ligo-account**.
2. Kies in het menu **Extensies → Apps Script**. Er opent een nieuw tabblad met een code-editor.
3. Links staat een bestand `Code.gs` met een paar regels voorbeeldcode. Selecteer alles (Ctrl+A) en verwijder het.
4. Open uit deze map het bestand **`apps-script/Code.gs`**, kopieer de volledige inhoud en plak die in de editor.
5. Geef het project bovenaan een naam, bv. **Website video-overzicht**.
6. Klik op het **diskette-icoon** (Opslaan).

## Stap 2 — De instellingen-tabbladen aanmaken

1. Ga terug naar het tabblad met de sheet en **vernieuw de pagina** (F5).
   Na enkele seconden verschijnt een nieuw menu **🌐 Website**.
2. Kies **🌐 Website → 1. Instellingen-tabbladen aanmaken**.
3. De eerste keer vraagt Google toestemming:
   - **Doorgaan** → kies het Ligo-account;
   - je ziet *"Google heeft deze app niet geverifieerd"*: dat is normaal voor een eigen script.
     Klik op **Geavanceerd** → **Ga naar Website video-overzicht (onveilig)** → **Toestaan**.
   - Kies daarna het menu-item opnieuw.
4. Er zijn twee nieuwe tabbladen:
   - **Website**: welke tabbladen en kolommen op de website komen;
   - **Website-instellingen**: titel, login, ...

### Het tabblad "Website" invullen voor de Ligo-lijst

Het script doet zelf een voorstel (één rij per tabblad). Voor de Ligo-lijst is er een **volledige versie**,
met PJM opgesplitst in video's, Canva en onthoudbladen:

1. Open `handleiding/website-tabblad-ligo.tsv` met Kladblok (of een andere teksteditor).
2. Selecteer alles en kopieer.
3. Klik in de sheet op tabblad **Website** in cel **A1** en plak (Ctrl+V). De kolommen worden vanzelf verdeeld.

| Collectie | Tabblad | Koprij | Titelkolom | Linkkolom |
|---|---|---|---|---|
| Oefeningen | Oefeningen | 4 | Titel | URL |
| PJM video's | PJM | 1 | Naam | Video-url |
| PJM Canva | PJM | 1 | Naam | URL canva met audio |
| PJM onthoudbladen | PJM | 1 | Naam | Onthoudblad |
| Audio | Audio | 5 | Titel | URL |
| VLL losse bladzijden | Linken losse blz VLL | 1 | Wat | URL |
| Offline documenten | Offline documenten (onder const | 4 | Titel | Titel |

> ⚠️ **Tabbladnaam "Offline documenten…":** in Excel werd die naam afgekapt op 31 tekens.
> Klik in de kolom *Tabblad* op die cel en kies de juiste naam uit de keuzelijst.

## Stap 3 — De kolommen "Op website" en "Vrij te delen" toevoegen

1. Kies **🌐 Website → 2. Kolommen "Op website" en "Vrij te delen" toevoegen**.
2. Het script voegt de kolommen **achteraan** elk tabblad toe, zodat bestaande formules niet verschuiven.
   Bij PJM komen er twee deelkolommen: *Video vrij te delen* en *Canva vrij te delen*.
3. Wat ze betekenen:
   - **Op website** — leeg = staat op de website. Typ `nee` om een rij te verbergen.
   - **Vrij te delen** — leeg = géén deelknop. Typ `ja` als de oefening auteursrechtenvrij is.
4. Je mag de kolommen **Vrij te delen** verbergen (rechtsklik op de kolomletter → *Kolom verbergen*).

## Stap 4 — Controle uitvoeren

Kies **🌐 Website → Controle uitvoeren**. Het tabblad **Controle** toont:

- hoeveel items op de website komen;
- rijen met een probleem: lege of ongeldige links, dubbele links, ontbrekende kolommen.

Staat er bovenaan *"Kolom … niet gevonden"* of *"Tabblad … bestaat niet"*, verbeter dan het tabblad **Website**.

## Stap 5 — Het script publiceren als web-app

1. Ga terug naar de Apps Script-editor.
2. Klik rechtsboven op **Implementeren → Nieuwe implementatie**.
3. Klik op het **tandwiel** naast "Type selecteren" → **Web-app**.
4. Vul in:
   - **Beschrijving:** `Website`
   - **Uitvoeren als:** **Ik** (het Ligo-account)
   - **Wie heeft toegang:** **Iedereen**
5. Klik op **Implementeren** (en geef toestemming als dat gevraagd wordt).
6. Kopieer de **URL van de web-app**. Die eindigt op `/exec`.

> Test: plak die URL in je browser en zet er `?actie=info` achter. Je ziet dan iets als
> `{"ok":true,"titel":"Digitale oefeningen",...}`.

> **"Iedereen" betekent niet dat de sheet openbaar wordt.** Iedereen kan het script *vragen* om gegevens.
> Het script geeft alleen door wat de website nodig heeft. De sheet zelf blijft privé.
> Wil je dat alleen lesgevers het overzicht kunnen opvragen, zet dan de login aan (zie [4-LOGIN.md](4-LOGIN.md)).

## Stap 6 — De website op GitHub zetten

1. Open in de map `js/` het bestand **`config.js`** met Kladblok.
2. Plak de URL uit stap 5 tussen de aanhalingstekens:
   ```js
   backendUrl: 'https://script.google.com/macros/s/AKfy…/exec',
   ```
3. Ga met het Ligo-account naar de repo **ligolimino.github.io** op github.com.
4. Zet de oude pagina's eerst opzij: maak een map `oud/` en verplaats ze daarheen,
   of verwijder ze als de nieuwe site werkt (zie de opmerking hieronder).
5. Klik op **Add file → Upload files** en sleep **alle bestanden en mappen** uit de zip erin
   (`index.html`, `kijk/`, `css/`, `js/`, `lib/`, `handleiding/`, `backend/`, `apps-script/`, `tests/`, `tools/`,
   `README.md`, `robots.txt`, `.nojekyll`). `index.html` moet bovenaan in de repo staan, niet in een submap.
   > Alles in de repo is publiek leesbaar. Er staan **geen gegevens** in, alleen code en handleidingen.
   > Zet er dus nooit een export van de sheet in (zoals `tests/lijst.json`, zie `tests/LEESMIJ.md`).
6. Onderaan: **Commit changes**.
7. Na 1 à 2 minuten staat de website op **https://ligolimino.github.io/**.
   De cursistenpagina staat op **https://ligolimino.github.io/kijk/**.

> **Oude pagina's verwijderen:** de oude bestanden (`overig.html`, `audio.html`, ...) bevatten alle links,
> ook de geheime SoundCloud-links, en zijn door iedereen te lezen. Verwijder ze zodra de nieuwe site werkt.
> Let op: in de *geschiedenis* van een publieke repo blijven oude versies zichtbaar. Wil je dat volledig weg,
> maak dan een nieuwe repo aan en zet daar alleen de nieuwe bestanden in.

## Stap 7 — Testen

- [ ] De website toont de collecties en kaarten.
- [ ] Zoeken en filteren werken.
- [ ] Een YouTube-video speelt af. **Pauzeer** de video: er verschijnt een blauw scherm "Verder kijken"
      in plaats van de YouTube-suggesties.
- [ ] De thumbnails van YouTube en ThingLink verschijnen.
- [ ] Zet in de sheet bij één video `ja` in *Vrij te delen*, klik op **🌐 Website → Website nu vernieuwen**,
      vernieuw de website: de oranje deelknop verschijnt. Open de deellink in een privévenster.

---

## Later iets aan het script veranderen?

Plak de nieuwe code in de editor en **behoud het webadres** zo:

**Implementeren → Implementaties beheren → potlood-icoon → Versie: Nieuwe versie → Implementeren.**

> Kies **niet** "Nieuwe implementatie": dan krijg je een nieuw webadres en moet `config.js` ook aangepast worden.
