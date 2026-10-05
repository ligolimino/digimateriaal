/**
 * Login.gs — controleert of een lesgever echt ingelogd is met een toegelaten Microsoft-account.
 *
 * Alleen nodig als in "Website-instellingen" staat: Login verplicht = ja.
 *
 * Hoe het werkt:
 *   1. De website laat de lesgever inloggen bij Microsoft (met de bibliotheek MSAL).
 *   2. Microsoft geeft de website een toegangssleutel (access token).
 *   3. De website stuurt die sleutel mee bij het opvragen van de catalogus.
 *   4. Dit script vraagt aan Microsoft zelf: "van wie is deze sleutel?" (Microsoft Graph /me).
 *      Een valse of verlopen sleutel wordt door Microsoft geweigerd.
 *   5. Het e-mailadres moet eindigen op een toegelaten domein (bv. ligo.be).
 *
 * Er wordt nergens een wachtwoord of geheime sleutel bewaard.
 */

function controleerLogin(token, instellingen) {
    if (!token) {
        return { ok: false, fout: 'Je bent niet ingelogd.' };
    }

    // Een goedgekeurde sleutel onthouden we 10 minuten, zodat we Microsoft niet bij elke klik bevragen.
    var cache = CacheService.getScriptCache();
    var cacheSleutel = 'login_' + Utilities.base64EncodeWebSafe(
        Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
    ).slice(0, 40);
    var onthouden = cache.get(cacheSleutel);
    if (onthouden) {
        return { ok: true, email: onthouden };
    }

    var antwoord = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true
    });
    if (antwoord.getResponseCode() !== 200) {
        return { ok: false, fout: 'Je login is verlopen of ongeldig. Log opnieuw in.' };
    }

    var gegevens = JSON.parse(antwoord.getContentText());
    var email = String(gegevens.mail || gegevens.userPrincipalName || '').toLowerCase();
    var domein = email.split('@')[1] || '';

    if (instellingen.domeinen.length === 0) {
        return { ok: false, fout: 'Er zijn nog geen toegelaten e-maildomeinen ingesteld (tabblad Website-instellingen).' };
    }
    if (instellingen.domeinen.indexOf(domein) === -1) {
        return { ok: false, fout: 'Het account ' + email + ' heeft geen toegang tot deze website.' };
    }

    cache.put(cacheSleutel, email, 600);
    return { ok: true, email: email };
}
