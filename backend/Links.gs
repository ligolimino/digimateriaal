/**
 * Links.gs — herkent wat voor link iets is en hoe de website hem moet tonen.
 *
 * Eén functie doet het echte werk: analyseerLink(url).
 * Ze krijgt een link uit de sheet en geeft een object terug:
 *
 *   {
 *       url:       de opgekuiste link,
 *       type:      'youtube' | 'youtube-lijst' | 'vimeo' | 'soundcloud' | 'genially' | 'afbeelding'
 *                  | 'canva' | 'thinglink' | 'drive' | 'sharepoint' | 'link',
 *       soort:     label voor de lesgever: 'Video', 'Audio', 'Interactief', 'Afbeelding', 'Document', 'Website',
 *       programma: naam van het programma ('YouTube', 'ThingLink', 'Quizlet', ...),
 *       embed:     adres om in de pagina af te spelen (of null als de link in een nieuw venster opent),
 *       thumb:     adres van een voorbeeldafbeelding (of null),
 *       start:     starttijd in seconden (alleen YouTube, anders 0),
 *       alleenLigo: true als de link alleen met een Ligo-account werkt (SharePoint)
 *   }
 *
 * Deze functies gebruiken GEEN Google-diensten: daardoor kan je ze ook gewoon
 * in Node.js testen (zie de map tests/).
 */

/** Herkenbare programma's op basis van de domeinnaam. */
var PROGRAMMAS = [
    { domein: 'thinglink.com', naam: 'ThingLink', soort: 'Interactief' },
    { domein: 'quizlet.com', naam: 'Quizlet', soort: 'Interactief' },
    { domein: 'kahoot.it', naam: 'Kahoot', soort: 'Interactief' },
    { domein: 'learningapps.org', naam: 'LearningApps', soort: 'Interactief' },
    { domein: 'wordwall.net', naam: 'Wordwall', soort: 'Interactief' },
    { domein: 'educaplay.com', naam: 'Educaplay', soort: 'Interactief' },
    { domein: 'bookwidgets.com', naam: 'BookWidgets', soort: 'Interactief' },
    { domein: 'genially.com', naam: 'Genially', soort: 'Interactief' },
    { domein: 'canva.com', naam: 'Canva', soort: 'Interactief' },
    { domein: 'docs.google.com/forms', naam: 'Google Forms', soort: 'Interactief' },
    { domein: 'forms.gle', naam: 'Google Forms', soort: 'Interactief' },
    { domein: 'forms.office.com', naam: 'Microsoft Forms', soort: 'Interactief' },
    { domein: 'sharepoint.com', naam: 'SharePoint', soort: 'Document' },
    { domein: 'computermeester.be', naam: 'Computermeester', soort: 'Interactief' },
    { domein: 'nedbox.be', naam: 'Nedbox', soort: 'Website' },
    { domein: 'jimdofree.com', naam: 'Website', soort: 'Website' },
    { domein: 'sites.google.com', naam: 'Website', soort: 'Website' },
    { domein: 'bit.ly', naam: 'Link', soort: 'Website' }
];

/**
 * Maakt een link schoon: spaties weg, typfouten als 'hhttps' rechtzetten,
 * een src uit een <iframe>-code halen, rommel aan het einde weghalen.
 * Geeft '' terug als er geen bruikbare link in staat.
 */
function maakLinkSchoon(ruw) {
    if (ruw === null || ruw === undefined) {
        return '';
    }
    var tekst = String(ruw).trim();

    // Insluitcode geplakt in plaats van een link? Neem dan de src.
    var iframe = tekst.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
    if (iframe) {
        tekst = iframe[1];
    }

    // Veelvoorkomende typfouten.
    tekst = tekst.replace(/^h+ttps?:\/\//i, function (begin) {
        return begin.toLowerCase().indexOf('https') !== -1 ? 'https://' : 'http://';
    });
    if (/^\/\//.test(tekst)) {
        tekst = 'https:' + tekst;
    }
    if (/^www\./i.test(tekst)) {
        tekst = 'https://' + tekst;
    }
    if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(tekst)) {
        return '';
    }

    // Alles na een spatie is geen deel van de link meer.
    tekst = tekst.split(/\s/)[0];
    // Losse leestekens of vreemde tekens aan het einde weghalen.
    tekst = tekst.replace(/[#.,;)\]µ]+$/, '');
    return tekst;
}

/** Haalt de 11 tekens lange YouTube-video-ID uit een link, of null. */
function youtubeId(url) {
    var m = url.match(
        /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/i
    );
    return m ? m[1] : null;
}

/** Haalt de ID van een YouTube-afspeellijst uit een link, of null. */
function youtubeLijstId(url) {
    var m = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
}

/** Starttijd uit ?t=90, ?t=1m30s of ?start=90, in seconden. */
function youtubeStart(url) {
    var m = url.match(/[?&#](?:t|start)=(\d+h)?(\d+m)?(\d+)?s?(?:&|$)/);
    if (!m) {
        return 0;
    }
    var uren = m[1] ? parseInt(m[1], 10) : 0;
    var minuten = m[2] ? parseInt(m[2], 10) : 0;
    var seconden = m[3] ? parseInt(m[3], 10) : 0;
    return uren * 3600 + minuten * 60 + seconden;
}

/** Zoekt het programma op basis van de domeinnaam. */
function zoekProgramma(url) {
    var zonderProtocol = url.replace(/^https?:\/\/(www\.)?/i, '').toLowerCase();
    for (var i = 0; i < PROGRAMMAS.length; i++) {
        var p = PROGRAMMAS[i];
        // Domein moet aan het begin staan of na een punt (sub.domein.com).
        var host = zonderProtocol.split('/')[0];
        if (p.domein.indexOf('/') !== -1) {
            if (zonderProtocol.indexOf(p.domein) === 0) {
                return p;
            }
        } else if (host === p.domein || host.slice(-(p.domein.length + 1)) === '.' + p.domein) {
            return p;
        }
    }
    var domein = zonderProtocol.split('/')[0];
    return { domein: domein, naam: domein, soort: 'Website' };
}

/**
 * De hoofdfunctie: analyseert een (ruwe) link.
 * Geeft null terug als er geen bruikbare link is.
 */
function analyseerLink(ruw) {
    var url = maakLinkSchoon(ruw);
    if (!url) {
        return null;
    }

    var resultaat = {
        url: url,
        type: 'link',
        soort: 'Website',
        programma: '',
        embed: null,
        thumb: null,
        start: 0,
        alleenLigo: false
    };

    // --- YouTube ------------------------------------------------------------
    if (/(youtube(-nocookie)?\.com|youtu\.be)\//i.test(url)) {
        var id = youtubeId(url);
        var lijst = youtubeLijstId(url);
        resultaat.programma = 'YouTube';
        resultaat.soort = 'Video';
        if (id) {
            resultaat.type = 'youtube';
            resultaat.embed = 'https://www.youtube-nocookie.com/embed/' + id;
            // mqdefault is 16:9 (zonder zwarte balken), net als de kaarten op de website.
            resultaat.thumb = 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
            resultaat.start = youtubeStart(url);
            resultaat.videoId = id;
        } else if (lijst) {
            resultaat.type = 'youtube-lijst';
            resultaat.embed = 'https://www.youtube-nocookie.com/embed/videoseries?list=' + lijst;
        }
        // Een YouTube-kanaal of iets anders: gewoon een link.
        return resultaat;
    }

    // --- Vimeo --------------------------------------------------------------
    var vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (vimeo) {
        resultaat.type = 'vimeo';
        resultaat.programma = 'Vimeo';
        resultaat.soort = 'Video';
        resultaat.embed = 'https://player.vimeo.com/video/' + vimeo[1];
        // Geen thumbnail: daarvoor zou het script Vimeo moeten bevragen. De website toont een plaatsvervanger.
        return resultaat;
    }

    // --- SoundCloud ---------------------------------------------------------
    if (/soundcloud\.com\//i.test(url)) {
        resultaat.type = 'soundcloud';
        resultaat.programma = 'SoundCloud';
        resultaat.soort = 'Audio';
        if (/w\.soundcloud\.com\/player/i.test(url)) {
            resultaat.embed = verbeterSoundcloud(url);
        } else {
            resultaat.embed = verbeterSoundcloud('https://w.soundcloud.com/player/?url=' + encodeURIComponent(url));
        }
        return resultaat;
    }

    // --- Google Drive: thumbnail via Google (werkt als het bestand gedeeld is met "iedereen met de link")
    var drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([A-Za-z0-9_-]{20,})/i);
    if (drive) {
        resultaat.type = 'drive';
        resultaat.programma = 'Google Drive';
        resultaat.soort = 'Document';
        resultaat.thumb = 'https://drive.google.com/thumbnail?id=' + drive[1] + '&sz=w640';
        return resultaat;
    }

    // --- Afbeeldingen: een link die rechtstreeks naar een beeldbestand wijst ---
    var isBeeld = /\.(jpe?g|png|gif|webp|svg|bmp)(?:[?#]|$)/i.test(url);
    if (isBeeld && !/sharepoint\.com/i.test(url)) {
        resultaat.type = 'afbeelding';
        resultaat.soort = 'Afbeelding';
        resultaat.programma = zoekProgramma(url).naam;
        resultaat.embed = url;
        resultaat.thumb = url;
        return resultaat;
    }

    var programma = zoekProgramma(url);
    resultaat.programma = programma.naam;
    resultaat.soort = programma.soort;

    // --- ThingLink ----------------------------------------------------------
    if (programma.naam === 'ThingLink') {
        resultaat.type = 'thinglink';
        var tl = url.match(/thinglink\.com\/(?:card|scene|video|view\/scene|channelcard|channel)\/(\d{10,})/i);
        if (tl) {
            resultaat.thumb = 'https://cdn.thinglink.me/api/image/' + tl[1] + '/1024/10/scaletowidth';
        }
        return resultaat;
    }

    // --- Genially: kan in de pagina getoond worden --------------------------
    if (programma.naam === 'Genially' && /view\.genially\.com\//i.test(url)) {
        resultaat.type = 'genially';
        resultaat.embed = url;
        return resultaat;
    }

    // --- Canva: nooit de bewerkingslink doorgeven ---------------------------
    if (programma.naam === 'Canva') {
        resultaat.type = 'canva';
        var canva = url.match(/canva\.com\/design\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)/i);
        if (canva) {
            // /edit wordt /view: wie de link krijgt, kan het ontwerp bekijken, niet bewerken.
            resultaat.url = 'https://www.canva.com/design/' + canva[1] + '/' + canva[2] + '/view';
            resultaat.embed = resultaat.url + '?embed';
        }
        return resultaat;
    }

    // --- SharePoint: werkt alleen met een Ligo-account ----------------------
    if (programma.naam === 'SharePoint') {
        resultaat.type = 'sharepoint';
        resultaat.alleenLigo = true;
        if (isBeeld) {
            // Een afbeelding op SharePoint (bv. een onthoudblad). De thumbnail lukt alleen
            // in een browser die al aangemeld is bij SharePoint; anders toont de website een plaatsvervanger.
            resultaat.soort = 'Afbeelding';
            resultaat.thumb = url;
        }
        return resultaat;
    }

    return resultaat;
}

/**
 * Zet de instellingen van een SoundCloud-speler altijd goed:
 * geen gerelateerde fragmenten, geen reacties, geen gebruikersnaam, niet automatisch starten.
 * Bestaande waarden in de link worden overschreven.
 */
function verbeterSoundcloud(src) {
    var gewenst = {
        auto_play: 'false',
        hide_related: 'true',
        show_comments: 'false',
        show_user: 'false',
        show_reposts: 'false',
        show_teaser: 'false',
        visual: 'false',
        color: '%23056181'
    };
    var delen = src.split('?');
    var basis = delen[0];
    var parameters = (delen.slice(1).join('?') || '').split('&').filter(function (p) {
        var naam = p.split('=')[0];
        return p && !Object.prototype.hasOwnProperty.call(gewenst, naam);
    });
    Object.keys(gewenst).forEach(function (naam) {
        parameters.push(naam + '=' + gewenst[naam]);
    });
    return basis + '?' + parameters.join('&');
}

/** Een korte, stabiele vergelijkingsvorm van een link (om dubbels te vinden). */
function linkSleutel(analyse) {
    if (!analyse) {
        return '';
    }
    if (analyse.videoId) {
        return 'yt:' + analyse.videoId;
    }
    return analyse.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '');
}
