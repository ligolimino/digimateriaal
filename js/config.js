/**
 * config.js — DE ENIGE PLAATS WAAR JE IETS MOET INVULLEN.
 *
 * Bij een nieuwe weergavewebsite pas je alleen dit bestand aan.
 * Al de rest (titel, collecties, filters) komt uit de Google Sheet.
 */

export const CONFIG = {
    // Het webadres van de Apps Script-implementatie (eindigt op /exec).
    // Zie de installatiehandleiding, stap 3.
    backendUrl: 'https://script.google.com/macros/s/AKfycbwBGqk7MSOLsIZXzlymxUEq9Z50X_mSXb2G97-E3VxUEE9feKzpYdsdpqIHyFjBFuFP/exec',

    // Waar staat de cursistenpagina? Laat leeg voor de standaard: de map "kijk/" naast deze pagina.
    // Alleen invullen als de cursistenpagina op een ander adres staat, bv. 'https://ligolimino.github.io/kijk/'.
    kijkAdres: 'https://nederlandsoefenen.github.io/nt2/',

    // Microsoft-login (optioneel). Alleen nodig als in de sheet "Login verplicht = ja" staat.
    // Deze twee codes krijg je van Ligo-IT na de app-registratie (zie handleiding "Login").
    login: {
        clientId: '',   // "Toepassings-id (client)" — geen geheim, mag gewoon hier staan
        tenantId: ''    // "Map-id (tenant)" van Ligo
    }
};
