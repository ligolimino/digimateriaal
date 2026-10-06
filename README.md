# Weergavewebsite voor een Google Sheet met links

Een overzichtelijke website voor **lesgevers** om video's, audio en oefeningen snel terug te vinden,
en een aparte **cursistenpagina** om één oefening te delen, zonder reclame-suggesties en zonder toegang tot het overzicht.

De **Google Sheet blijft de enige plek** waar links bijgehouden worden. Wat je in de sheet aanvult,
staat meteen op de website. Wordt het overzicht in **Excel** bijgehouden, dan laad je af en toe de nieuwste
versie in (zie handleiding 7).

| Pagina | Adres | Voor wie |
|---|---|---|
| Overzicht | `https://ligolimino.github.io/digimateriaal/` | lesgevers (optioneel met Microsoft-login) |
| Lijst van een collega | `https://ligolimino.github.io/digimateriaal/?lijst=…` | zie handleiding 9 |
| Eén oefening | `https://nederlandsoefenen.github.io/nt2/?id=…` | cursisten (via de deelknop of QR-code) |

## Handleidingen

1. [Installatie — stap voor stap](handleiding/1-INSTALLATIE.md)
2. [Beheer — voor wie de sheet bijhoudt](handleiding/2-BEHEER.md)
3. [Een nieuwe weergavewebsite op basis van een andere sheet](handleiding/3-NIEUWE-WEBSITE.md)
4. [Login met een Microsoft-account (optioneel)](handleiding/4-LOGIN.md)
5. [Overdracht — wat staat waar, en wat als het stopt?](handleiding/5-OVERDRACHT.md)
6. [Uitleg bij de code](handleiding/6-CODE-UITLEG.md)
7. [Een Excel-bestand als bron](handleiding/7-EXCEL-ALS-BRON.md)
8. [De cursistenpagina op een apart adres](handleiding/8-APARTE-CURSISTENSITE.md)
9. [Eén website, meerdere lijsten](handleiding/9-CENTRALE-LIJSTEN.md) — de eenvoudigste weg voor collega's

## Mappen

```
index.html          lesgeverspagina
kijk/index.html     cursistenpagina (bevat geen overzicht)
aanmelden/          aanmeldpagina: collega's zetten zelf een lijst online (handleiding 9)
css/stijl.css       opmaak van beide pagina's
js/                 de code van de website (ES-modules, geen bouwstap)
  config.js         ← het enige bestand dat je per website invult
lib/                externe bibliotheken (login, QR-code), lokaal bewaard
apps-script/        Code.gs + appsscript.json: plak dit in Apps Script bij de sheet
backend/            dezelfde backendcode, in losse bestanden (om te lezen en aan te passen)
handleiding/        de handleidingen
tests/              tests en testserver (zonder gegevens)
tools/              maak-code-gs.js: voegt backend/ samen tot apps-script/Code.gs
sjabloon/           Sjabloon-links-weergavewebsite.xlsx: de ideale brondata (handleiding 9)
cursistensite/      index.html + robots.txt voor een cursistenpagina op een apart adres (handleiding 8)
robots.txt          houdt zoekmachines weg van alles behalve de twee pagina's (die hebben zelf noindex)
```
