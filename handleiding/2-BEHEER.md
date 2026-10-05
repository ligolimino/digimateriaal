# 2. Beheer — voor wie de sheet bijhoudt

Je hoeft **niets aan de website** te doen. Alles gebeurt in de Google Sheet.

## Dagelijks werk

| Ik wil… | Zo doe je het |
|---|---|
| een oefening toevoegen | Voeg een rij toe in het juiste tabblad, zoals je altijd deed. |
| een oefening verbergen | Typ `nee` in de kolom **Op website**. |
| een oefening deelbaar maken met cursisten | Typ `ja` in de kolom **Vrij te delen**. Alleen als ze auteursrechtenvrij is! |
| een link verbeteren | Pas de link aan. Let op: de deellink naar die oefening verandert dan mee (zie verder). |
| controleren of alles klopt | **🌐 Website → Controle uitvoeren** en kijk in het tabblad **Controle**. |

### Wanneer staat een wijziging online?

Meestal **meteen**: bij elke wijziging in de sheet maakt het script zijn geheugen leeg.
Zie je het niet? Kies **🌐 Website → Website nu vernieuwen** en vernieuw de website.
Ten laatste na het aantal minuten in *Website-instellingen → Vernieuwen na (minuten)* staat alles online.

## Hoe de website een link leest

- Heeft de cel een **hyperlink** (blauwe, aanklikbare tekst), dan telt die hyperlink.
- Anders telt de **tekst** in de cel, als dat een link is.
- YouTube-links mogen in elke vorm: `youtu.be/…`, `watch?v=…&t=6s`, `…?list=…`, een `embed`-link.
  De website haalt er zelf de video uit.
- **Canva**: de website maakt van een bewerkingslink (`/edit`) altijd een kijklink (`/view`).
  Niemand kan via de website jullie ontwerpen bewerken.
- **SharePoint**: werkt alleen voor wie met een Ligo-account is aangemeld. Daarom komt er nooit een deelknop.

| Soort link | Op de website |
|---|---|
| YouTube, Vimeo, SoundCloud, Genially | speelt af in de pagina |
| Afbeelding (link die eindigt op .jpg, .png, .gif, .webp) | groot in de pagina, met thumbnail |
| Google Drive-bestand | thumbnail (als het gedeeld is met "iedereen met de link"), opent in een nieuw venster |
| ThingLink, Quizlet, Kahoot, SharePoint, Canva, andere | opent in een nieuw venster |

**Afbeeldingen op SharePoint** (zoals de onthoudbladen) krijgen het label *Afbeelding*. De thumbnail verschijnt
alleen in een browser die al aangemeld is bij SharePoint; anders zie je een groen plaatsvervangend vlak.
Ze kunnen nooit gedeeld worden met cursisten (die hebben geen Ligo-account). Wil je een afbeelding delen,
zet ze dan op een plek met een openbare link.

> **Is de bron een Excel-bestand?** Dan gelden andere regels: zie [7-EXCEL-ALS-BRON.md](7-EXCEL-ALS-BRON.md).

## Het tabblad "Website"

Elke rij is een **bron**: één linkkolom uit één tabblad. Elke link wordt een kaart op de website.

| Kolom | Betekenis |
|---|---|
| **Actief** | `ja` / `nee` — staat deze bron op de website? |
| **Collectie** | De naam van de knop op de website, bv. *PJM video's*. |
| **Tabblad** | De naam van het tabblad met de gegevens (keuzelijst). |
| **Koprij** | Het rijnummer met de kolomkoppen (bv. `1` of `4`). |
| **Titelkolom** | De kop van de kolom met de titel. |
| **Linkkolom** | De kop van de kolom met de link. |
| **Insluitkolom** | *(optioneel)* Een kolom met een insluitcode (`<iframe…>`) die voorrang krijgt om af te spelen. Gebruikt bij Audio. |
| **Omschrijvingkolom** | *(optioneel)* Korte omschrijving op de kaart. |
| **Filters** | Koppen van kolommen die een keuzelijst worden, gescheiden door `;`. |
| **Op-website-kolom** | Kop van de kolom waarin `nee` een rij verbergt. |
| **Vrij-te-delen-kolom** | Kop van de kolom waarin `ja` de deelknop toont. Leeg = nooit delen. |

**Kolommen worden aangeduid met hun kop, niet met hun letter.** Je mag dus kolommen invoegen, verplaatsen of verbergen.
Verander je de **kop** van een kolom, pas dan ook het tabblad Website aan.

### Filters

```
Thema; Niveau; Vaardigheid
```
maakt drie keuzelijsten. Met `=` toon je een kolom onder een andere naam:

```
Thema; Sterren=Niveau
```
toont de kolom *Sterren* als filter *Niveau*. Zo delen PJM (sterren) en Oefeningen (mond 1.1, ...) één filter *Niveau*.

"school" en "School" worden automatisch één keuze.

## Het tabblad "Website-instellingen"

| Instelling | Uitleg |
|---|---|
| Titel van de website | Bovenaan de website en in het tabblad van de browser. |
| Ondertitel | Klein onder de titel. |
| Login verplicht | `ja` = lesgevers loggen in met hun Microsoft-account. Zie [4-LOGIN.md](4-LOGIN.md). |
| Toegelaten e-maildomeinen | Bij login: bv. `ligo.be; limino.be`. |
| Vernieuwen na (minuten) | Hoe lang het script de gegevens onthoudt (1 tot 360). |

## Deellinks

- Een deellink ziet eruit als `https://ligolimino.github.io/kijk/?id=ALFKQO61pv`.
- De code wordt berekend uit de link van de oefening. Ze blijft dezelfde, ook als de rij verschuift
  of de collectie een andere naam krijgt.
- Verander je de **link** van een oefening, dan werkt een oude deellink niet meer. De cursist ziet dan een
  vriendelijke melding.
- Zet je *Vrij te delen* terug op leeg of `nee`, dan werkt de deellink **meteen** niet meer.
- Cursisten zien op de deelpagina **alleen die ene oefening**: geen overzicht, geen menu, geen andere links.

## Problemen oplossen

| Wat je ziet | Oplossing |
|---|---|
| Een oefening staat niet op de website | Controle uitvoeren: staat de rij in het tabblad Controle? Staat er `nee` in *Op website*? |
| *"Kolom … niet gevonden"* in Controle | De kop in het tabblad Website komt niet overeen met de kop in het tabblad. Let op spaties. |
| De website zegt *"nog niet gekoppeld"* | `backendUrl` in `js/config.js` is leeg. |
| De website zegt *"Er liep iets mis"* | Open de URL van het script met `?actie=info` erachter: de foutmelding staat erin. |
| Een video speelt niet af | Staat de video op YouTube nog op *openbaar* of *verborgen*? *Privé* video's kunnen niet ingesloten worden. Sommige eigenaars verbieden insluiten. |
