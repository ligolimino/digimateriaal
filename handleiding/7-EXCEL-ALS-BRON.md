# 7. Een Excel-bestand als bron

Voor overzichten die in **Excel** (bv. op SharePoint) bijgehouden worden.
Jullie blijven in Excel werken. Een Google Sheet dient alleen als **kopie** om de website te voeden.
Af en toe laad je de nieuwste Excel-versie in.

```
Excel op SharePoint  ──(af en toe inladen)──▶  Google Sheet (kopie)  ──▶  website
   hier werk je                                  hier werk je NOOIT
```

> **Goed om weten:** nieuwe items staan pas op de website na het inladen, niet meteen.

## De gouden regel

**Alles wat je beslist, staat in het Excel-bestand.** Dus ook de kolommen **Op website** en **Vrij te delen**.
De Google-kopie wordt bij elk inladen overschreven: wat je daar aanpast, gaat verloren.

Alleen de tabbladen **Website** en **Website-instellingen** staan in de Google Sheet. Die worden nooit overschreven.

---

## Eenmalig: opzetten

### In het Excel-bestand

1. Voeg op elk tabblad met links **achteraan** twee kolommen toe, in de koprij:
   - **Op website** — leeg = op de website, `nee` = verborgen;
   - **Vrij te delen** — leeg = geen deelknop, `ja` = auteursrechtenvrij, mag gedeeld worden.
2. Tip: maak er een keuzelijst van (*Gegevens → Gegevensvalidatie → Lijst → `ja;nee`*).
3. Bewaar het bestand.

### In Google

1. Maak met het **Ligo-Google-account** een nieuwe, lege Google Sheet. Geef ze een duidelijke naam,
   bv. *KOPIE – Overzicht e-learnings (niet bewerken)*.
2. **Extensies → Apps Script** → plak `apps-script/Code.gs` (zie [1-INSTALLATIE.md](1-INSTALLATIE.md), stap 1).
3. **De dienst Drive API aanzetten** (nodig om Excel om te zetten):
   in de Apps Script-editor, links bij **Services**, klik op **+** → kies **Drive API** → **Toevoegen**.
4. Ga terug naar de sheet, vernieuw de pagina (F5).
5. **🌐 Website → Excel-bestand inladen** → kies het Excel-bestand → **Inladen**.
   De eerste keer vraagt Google toestemming (zie stap 2 van de installatie). Google vraagt toegang tot
   je Drive: het script maakt er een tijdelijk bestand en gooit het daarna weer weg.
6. **🌐 Website → 1. Instellingen-tabbladen aanmaken**. Het script doet een voorstel; kijk het na.
7. **🌐 Website → Controle uitvoeren**.
8. Publiceer en zet de website online: stap 5 tot 7 van [1-INSTALLATIE.md](1-INSTALLATIE.md).

> Gebruik **niet** het menu-item *"2. Kolommen … toevoegen"*: die kolommen horen in het Excel-bestand.

---

## Telkens: bijwerken

1. Bewaar het Excel-bestand op je computer (bij SharePoint: **Bestand → Een kopie opslaan → Een kopie downloaden**,
   of in de bibliotheek: **⋯ → Downloaden**).
2. Open de Google-kopie.
3. **🌐 Website → Excel-bestand inladen** → kies het bestand → **Inladen**.
4. Lees het verslag. Staat er **LET OP**, voer dan **Controle uitvoeren** uit en kijk wat er mis is
   (meestal: een kolom kreeg in Excel een andere naam).

Klaar. De website toont meteen de nieuwe versie.

### Wat het inladen doet

| | |
|---|---|
| Tabbladen met gegevens | volledig vervangen door die uit het Excel-bestand |
| Nieuw tabblad in Excel | komt erbij (verschijnt pas op de website als je het toevoegt in het tabblad *Website*) |
| Tabblad niet meer in Excel | blijft ongewijzigd staan en wordt gemeld |
| *Website*, *Website-instellingen*, *Controle* | nooit aangeraakt |
| Hyperlinks | overgenomen |
| Verborgen kolommen | blijven verborgen |
| Formules | **niet** overgenomen: de kopie bevat de *uitkomst* (de getoonde waarde) |
| Opmaak (kleuren, ...) | niet overgenomen (niet nodig voor de website) |

In *Website-instellingen* staat bij **Laatste Excel-import** welk bestand wanneer ingeladen werd.

---

## Problemen

| Melding | Oplossing |
|---|---|
| *De dienst "Drive API" staat niet aan* | Zie "Eenmalig", stap 3. |
| *Kies een Excel-bestand (.xlsx)* | Je koos een ander soort bestand. Bewaar in Excel als **.xlsx**. |
| *Kolom … niet gevonden* | Een kolom kreeg in Excel een andere kop. Pas het tabblad *Website* aan, of zet de kop terug. |
| *Tabblad … bestaat niet* | Een tabblad kreeg in Excel een andere naam. Pas het tabblad *Website* aan. |
| Het inladen duurt lang | Bij duizenden rijen kan het een minuut duren. Sluit het venster niet. |
| Een deellink werkt niet meer | De link van die oefening is in Excel veranderd, of *Vrij te delen* staat niet meer op `ja`. |
