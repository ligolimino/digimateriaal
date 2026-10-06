# 8. De cursistenpagina op een apart adres

Standaard staat de cursistenpagina op `https://ligolimino.github.io/kijk/`.
Ze kan ook op een **apart adres** staan, bv. `https://nederlandsoefenen.github.io/nt2/`.
Cursisten zien dan nergens de naam of het adres van de lesgeverssite.

## Instellen

1. **In de repo van het aparte adres** (bv. `nederlandsoefenen/nt2`):
   upload de twee bestanden uit de map `cursistensite/`: **`index.html`** en **`robots.txt`**.
   Ze vervangen de oude `index.html`.
2. **In de repo van de lesgeverssite**: open `js/config.js` (potlood-icoon) en vul in:
   ```js
   kijkAdres: 'https://nederlandsoefenen.github.io/nt2/',
   ```
   **Commit changes**. Vanaf nu maakt de deelknop links naar dat adres.

De pagina in `cursistensite/` bevat zelf geen code: ze laadt de opmaak en de code van de lesgeverssite.
Zo moet je niets dubbel bijhouden.

> Verandert ooit het adres van de lesgeverssite? Pas dan in `cursistensite/index.html` de twee adressen
> `https://ligolimino.github.io/…` aan.

## Oude deellinks (`…/nt2/?v=…`)

Links van de vorige cursistenpagina blijven werken, maar het script controleert ze:

| De video… | Instelling *Oude deellinks (?v=) voor alle video's* = **nee** (standaard) | = **ja** |
|---|---|---|
| staat in de lijst en is **vrij te delen** | ✅ speelt af | ✅ speelt af |
| staat in de lijst, **niet** vrij te delen | ❌ "niet (meer) beschikbaar" | ✅ speelt af |
| staat **niet** in de lijst | ❌ | ❌ |

Zet de instelling tijdelijk op `ja` als er nog veel oude links in omloop zijn (bv. in WhatsApp-groepen),
en terug op `nee` zodra iedereen de nieuwe links gebruikt.

> De instelling staat in het tabblad *Website-instellingen*. Ontbreekt de regel (omdat het tabblad met een
> oudere versie van het script werd aangemaakt), typ ze er dan onderaan bij:
> kolom A `Oude deellinks (?v=) voor alle video's`, kolom B `ja` of `nee`.

## Zelfstandigheid

Ook het account van het aparte adres (bv. *nederlandsoefenen*) moet op een **Ligo-account** staan,
met minstens twee mensen die erbij kunnen. Zie [5-OVERDRACHT.md](5-OVERDRACHT.md).
