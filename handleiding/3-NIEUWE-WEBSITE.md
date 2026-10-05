# 3. Een nieuwe weergavewebsite op basis van een andere sheet

Het script is een **sjabloon**: het werkt met elke Google Sheet met links.
Programmeren is niet nodig.

## In het kort

1. **Script**: plak `apps-script/Code.gs` in de nieuwe sheet (*Extensies → Apps Script*). Zie [1-INSTALLATIE.md](1-INSTALLATIE.md), stap 1.
2. **Instellingen**: kies **🌐 Website → 1. Instellingen-tabbladen aanmaken**. Het script stelt per tabblad een bron voor.
   Kijk het tabblad **Website** na en vul **Website-instellingen** in (titel!).
3. **Kolommen**: kies **🌐 Website → 2. Kolommen … toevoegen**.
4. **Controle**: kies **🌐 Website → Controle uitvoeren**.
5. **Publiceren**: *Implementeren → Nieuwe implementatie → Web-app*. Kopieer de URL.
6. **Website**: maak een nieuwe repo op GitHub (zie hieronder), upload alle bestanden van deze repo,
   en vul in `js/config.js` de URL van stap 5 in.

## Een nieuwe repo op GitHub

1. Op github.com: **New repository** (onder het Ligo-account of de Ligo-organisatie).
2. Naam bv. `e-learnings`. Zet hem op **Public** (vereist voor gratis GitHub Pages).
3. Upload alle bestanden van deze repo (zonder testgegevens).
4. **Settings → Pages → Branch: main / root → Save**.
5. De website komt op `https://ligolimino.github.io/e-learnings/`.
   De cursistenpagina op `https://ligolimino.github.io/e-learnings/kijk/`.

> Er staat geen enkel gegeven in de repo: alleen code. Dat hij publiek is, is dus geen probleem.

## Wat het script zelf herkent

- De **koprij**: de eerste rij (van de eerste tien) met een titelkop (*Titel, Naam, Wat, ...*) én een linkkop (*URL, Link, ...*).
- De **linkkolom**: bij voorkeur *URL*, anders een zichtbare kolom met "url" of "link" in de kop.
  Zonder linkkolom: de hyperlink achter de titel.
- **Filters**: kolommen als *Thema, Niveau, Vaardigheid, Programma, Type, Soort, Kern, Boekje, Sterren, Module, Categorie*.

Een tabblad met meerdere linkkolommen (zoals PJM: video, Canva, onthoudblad)? Kopieer de rij in het tabblad Website
en verander per kopie de **Collectie** en de **Linkkolom**.

## Tips voor een sheet die goed werkt

- Eén rij = één oefening. Eén kolom = één soort gegeven.
- Geef elke kolom een duidelijke, **unieke** kop.
- Zet geen lege rijen of titels tussen de koprij en de gegevens.
- Zet in een linkkolom alleen links (geen uitleg: daarvoor is er een omschrijvingskolom).
