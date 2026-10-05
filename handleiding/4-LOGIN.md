# 4. Login met een Microsoft-account (optioneel)

Zonder login kan iedereen die het adres van de lesgeverssite kent, het overzicht zien.
Met login zien alleen lesgevers met een Ligo-account het overzicht.
**De cursistenpagina blijft altijd open**: cursisten loggen nooit in.

## Wat Ligo-IT moet doen (eenmalig, ±10 minuten)

> Dit deel kan je zo doorsturen naar IT.

Registreer een toepassing in **Microsoft Entra ID** (vroeger Azure AD):

1. **Entra-beheercentrum → Identiteit → Toepassingen → App-registraties → Nieuwe registratie**.
2. **Naam:** `Ligo video-overzicht`
3. **Ondersteunde accounttypen:** *Alleen accounts in deze organisatiemap (één tenant)*.
4. **Omleidings-URI:** platform **Single-page application (SPA)**, adres:
   `https://ligolimino.github.io/`
   (exact het adres van de lesgeverssite, met `/` op het einde).
5. **Registreren**.
6. API-machtigingen: de standaard **Microsoft Graph → User.Read (gedelegeerd)** volstaat. Meer is niet nodig.
7. Geef aan de aanvrager door:
   - **Toepassings-id (client)**
   - **Map-id (tenant)**
8. Voeg minstens één persoon van IT toe als **eigenaar** van de registratie (zodat ze niet van één persoon afhangt).

Er is **geen clientgeheim** nodig (en er mag er ook geen gebruikt worden): het is een website zonder server.
Er vervalt dus niets.

## Wat jij daarna doet

1. In `js/config.js` op GitHub (potlood-icoon om te bewerken):
   ```js
   login: {
       clientId: 'de Toepassings-id (client)',
       tenantId: 'de Map-id (tenant)'
   }
   ```
2. In de sheet, tabblad **Website-instellingen**:
   - **Login verplicht:** `ja`
   - **Toegelaten e-maildomeinen:** bv. `ligo.be` (meerdere: `ligo.be; limino.be`)
3. **🌐 Website → Website nu vernieuwen**.
4. Open de website: je wordt doorgestuurd naar de inlogpagina van Microsoft en komt daarna terug.

## Hoe het werkt (voor wie wil weten waarom het veilig is)

1. De website laat je inloggen bij **Microsoft zelf** (de website ziet je wachtwoord nooit).
2. Microsoft geeft de website een tijdelijke sleutel.
3. De website stuurt die sleutel naar het script bij de sheet.
4. Het script vraagt aan **Microsoft**: "van wie is deze sleutel?" Een valse of verlopen sleutel weigert Microsoft.
5. Eindigt het e-mailadres op een toegelaten domein, dan krijgt de website het overzicht.

Het script controleert dit **zelf**. Iemand die de website-code aanpast, komt er dus niet omheen.

## Login weer uitzetten

Zet **Login verplicht** op `nee`. Meer is niet nodig.
