# 9. Eén website, meerdere lijsten

De eenvoudigste manier om een eigen overzicht online te krijgen. Bedoeld voor bv. opleidingsverantwoordelijken:
zij komen **nooit** in Apps Script of GitHub. Ze vullen een sjabloon in en zetten hun website **zelf** online
via de aanmeldpagina.

```
Lijst van een collega (Google Sheet of Excel op Drive)
        │  gedeeld met het Ligo-account (lezen)
        ▼
Het centrale script (in de sheet van digimateriaal) ──▶ https://ligolimino.github.io/digimateriaal/?lijst=leerlijn-alfa
```

Elke lijst krijgt een eigen adres, met eigen titel, collecties, filters en deellinks.
Ook de cursistenpagina en de QR-codes werken per lijst.

---

## Voor wie een lijst wil (de eigenaar)

Alles gebeurt op de **aanmeldpagina**: `https://ligolimino.github.io/digimateriaal/aanmelden/`
(ook bereikbaar via de link *Zelf een lijst online zetten* onderaan de website).

1. **Download het sjabloon** (knop op de pagina).
2. **Vul het tabblad Links in.** Het tabblad *Uitleg* zegt wat in elke kolom hoort.
   Pas in *Website-instellingen* de **titel** aan. Zet het bestand op Google Drive:
   - werk je in Google: open het met Google Spreadsheets → **Bestand → Opslaan als Google Spreadsheets**;
   - werk je liever in Excel: laat het een Excel-bestand op Google Drive.
3. **Deel** het bestand als **Lezer** met het account dat de pagina toont.
4. Plak de **link**, kies een **korte naam** voor het adres, vul je **naam** in en klik op **Website aanmaken**.

Het script controleert alles meteen. Lukt het, dan zie je het adres van je website. Lukt het niet,
dan zegt de pagina waarom (bv. "Geen toegang": het bestand is nog niet gedeeld).

### Een wijziging online zetten

| Soort lijst | Wanneer staat een wijziging online? |
|---|---|
| Google Sheet | Vanzelf, na het aantal minuten in *Website-instellingen → Vernieuwen na (minuten)*. Sneller: onderaan de website op **Gegevens vernieuwen** klikken. |
| Excel-bestand op Google Drive | Upload in Drive een **nieuwe versie van hetzelfde bestand**: rechtsklik op het bestand → **Bestandsinformatie → Versies beheren → Nieuwe versie uploaden**. Daarna eventueel **Gegevens vernieuwen**. |

> Upload bij een Excel-lijst **geen nieuw bestand** (dan verandert de link): altijd *een nieuwe versie* van hetzelfde bestand.

### Zelf controleren

Onderaan de website staat **Controle van deze lijst**: daar zie je welke rijen een probleem hebben
(lege link, dubbele link, ontbrekende kolom, ...). Zo kan je zelf je lijst verbeteren, zonder het script te openen.

---

## Voor de beheerder

### Eenmalig

1. Zorg dat de nieuwste `apps-script/Code.gs` in de centrale sheet staat (zie [1-INSTALLATIE.md](1-INSTALLATIE.md)).
2. Voor Excel-lijsten: zet in Apps Script de dienst **Drive API** aan (*Services → + → Drive API → Toevoegen*).
3. Vul in *Website-instellingen* het **Adres van de website** in: `https://ligolimino.github.io/digimateriaal/`.
   (Ontbreekt die regel, typ ze er dan onderaan bij.)

### Zelf aanmelden: aan of uit, met of zonder code

In *Website-instellingen*:

| Instelling | Uitleg |
|---|---|
| **Aanmelden via de website** | `ja` (standaard) = de aanmeldpagina werkt. `nee` = alleen de beheerder kan lijsten toevoegen. |
| **Aanmeldcode** | Een wachtwoord dat je alleen aan de opleidingsverantwoordelijken geeft. Leeg = geen code nodig. |

> **Aanbevolen: stel een aanmeldcode in.** Zonder code kan in principe iedereen die de aanmeldpagina vindt,
> een lijst toevoegen (al moet die lijst dan wel eerst gedeeld zijn met het Ligo-account).
> Ontbreken de regels in je tabblad, typ ze er dan onderaan bij.

De aanmeldpagina toont het e-mailadres van het Ligo-account (anders weet niemand met wie te delen).

Nieuwe lijsten komen vanzelf in het tabblad **Lijsten**, met in *Contactpersoon* de naam en de datum van aanmelding.
Je kan ze daar nakijken, en een lijst offline halen met *Actief* = `nee`.

### Zelf een lijst toevoegen (zonder aanmeldpagina)

1. Kijk of de eigenaar het bestand gedeeld heeft met het Ligo-account (het staat dan in Drive bij *Gedeeld met mij*).
2. **🌐 Website → Lijsten van anderen → Lijst toevoegen…**
3. Plak de link. Het script opent de lijst meteen en controleert ze.
4. Geef een korte **code** (bv. `leerlijn-alfa`). Kleine letters, cijfers en koppeltekens.

### Andere menu-items

| Menu-item | Doet |
|---|---|
| **Controle van een lijst…** | Schrijft de controle van een lijst in het tabblad *Controle* van de centrale sheet. |
| **Alle lijsten vernieuwen** | Alle lijsten tonen meteen de nieuwste gegevens. |

---

## Goed om weten

- **Veiligheid**: alleen lijsten in het tabblad *Lijsten* kunnen getoond worden. Niemand kan via het adres
  een willekeurige sheet laten inlezen.
- **Login** en **Vrij te delen** werken per lijst, met de instellingen uit de sheet van die lijst.
- **Oude deellinks** (`?v=…`) werken alleen voor de eigen lijst van de centrale sheet.
- Wordt het Ligo-account verwijderd uit het delen van een lijst, dan toont de website een duidelijke melding
  ("Geen toegang tot deze lijst").
- Een Excel-lijst wordt bij elk vernieuwen omgezet. Dat duurt enkele seconden langer dan een Google Sheet.
