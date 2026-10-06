/**
 * speler.js — speelt een item af in een container (gebruikt door beide pagina's).
 *
 * YouTube krijgt een speciale behandeling via de officiële YouTube-speler-API:
 * bij pauze en aan het einde vervangen we de speler door ons eigen scherm (zie speelYouTube).
 * Zo zien cursisten niet de "meer video's"-suggesties van YouTube.
 * (Reclame kunnen we niet tegenhouden: die hangt af van de eigenaar van de video.)
 */
import { el, icoon } from './hulp.js';

let ytApiBelofte = null;

/** Laadt de YouTube-speler-API één keer. Lukt dat niet binnen 8 seconden, dan gaan we verder zonder. */
function laadYouTubeApi() {
    if (window.YT && window.YT.Player) {
        return Promise.resolve(true);
    }
    if (!ytApiBelofte) {
        ytApiBelofte = new Promise((klaar) => {
            const vorige = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (vorige) vorige();
                klaar(true);
            };
            const s = document.createElement('script');
            s.src = 'https://www.youtube.com/iframe_api';
            s.onerror = () => klaar(false);
            document.head.append(s);
            setTimeout(() => klaar(false), 8000);
        });
    }
    return ytApiBelofte;
}

/** Kan deze browser een gewoon element op volledig scherm zetten? (iPhone kan dat niet.) */
export function volledigSchermMogelijk() {
    return Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}

export function zetVolledigScherm(element) {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
        (element.requestFullscreen || element.webkitRequestFullscreen).call(element);
    }
}

function iframe(src, titel, klasse = '') {
    return el('iframe', {
        src,
        title: titel,
        class: klasse,
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: true,
        referrerpolicy: 'strict-origin-when-cross-origin'
    });
}

/**
 * Toont het item in `doos`. Geeft een object terug met stop(), om de speler op te ruimen.
 */
export function speelAf(doos, item) {
    doos.replaceChildren();
    doos.className = 'speler speler-' + item.type;

    if (item.type === 'youtube') {
        return speelYouTube(doos, item);
    }
    if (item.type === 'afbeelding') {
        doos.append(el('img', { class: 'beeld-groot', src: item.embed, alt: item.titel }));
        return { stop: () => doos.replaceChildren() };
    }

    // Afspeellijsten, Vimeo, SoundCloud, Genially, Canva: een gewone ingesloten pagina.
    const src = item.type === 'youtube-lijst' ? item.embed + '&rel=0&iv_load_policy=3' : item.embed;
    doos.append(iframe(src, item.titel));
    return { stop: () => doos.replaceChildren() };
}

/**
 * YouTube, binnen de regels van YouTube.
 *
 * YouTube verbiedt om iets VÓÓR de ingesloten speler te leggen ("Required Minimum Functionality",
 * Overlays and frames). Daarom leggen we bij pauze en aan het einde niets over de video,
 * maar halen we de speler WEG en tonen we in de plaats ons eigen scherm.
 * We onthouden waar de video was; "Verder kijken" maakt een nieuwe speler die daar verder gaat.
 *
 * Bij pauze wachten we even: wie de video kort stopt of met het tijdsbalkje schuift,
 * merkt er niets van.
 */
const WACHT_BIJ_PAUZE = 1500; // milliseconden

function speelYouTube(doos, item) {
    let speler = null;
    let gestopt = false;
    let pauzeTimer = null;
    const videoId = item.embed.split('/embed/')[1];
    const eigenSchermknop = volledigSchermMogelijk();

    function ruimSpelerOp() {
        clearTimeout(pauzeTimer);
        if (speler && speler.destroy) {
            speler.destroy();
        }
        speler = null;
    }

    /** Ons eigen scherm, IN DE PLAATS VAN de speler (niet erover). */
    function toonEigenScherm(soort, verderVanaf) {
        ruimSpelerOp();
        const knop = el('button', { class: 'eigen-scherm', type: 'button' });
        knop.innerHTML = soort === 'einde'
            ? icoon('opnieuw', 'groot-icoon') + '<span>Opnieuw bekijken</span>'
            : icoon('play', 'groot-icoon') + '<span>Verder kijken</span>';
        knop.addEventListener('click', () => maakSpeler(soort === 'einde' ? (item.start || 0) : verderVanaf, true));
        doos.replaceChildren(knop);
        knop.focus();
    }

    function maakSpeler(vanaf, meteenAfspelen) {
        const plek = el('div', { class: 'yt-plek' });
        doos.replaceChildren(plek);
        speler = new window.YT.Player(plek, {
            host: 'https://www.youtube-nocookie.com',
            videoId,
            playerVars: {
                rel: 0,
                iv_load_policy: 3,
                playsinline: 1,
                start: Math.floor(vanaf || 0),
                autoplay: meteenAfspelen ? 1 : 0,
                // Eigen knop voor volledig scherm (zodat ons scherm na pauze ook op volledig scherm blijft);
                // op toestellen zonder die mogelijkheid (iPhone) de knop van YouTube.
                fs: eigenSchermknop ? 0 : 1
            },
            events: {
                onReady: (e) => {
                    if (meteenAfspelen) e.target.playVideo();
                },
                onStateChange: (e) => {
                    const S = window.YT.PlayerState;
                    clearTimeout(pauzeTimer);
                    if (e.data === S.ENDED) {
                        toonEigenScherm('einde');
                    } else if (e.data === S.PAUSED) {
                        const speelt = e.target;
                        pauzeTimer = setTimeout(() => {
                            if (!gestopt && speelt.getPlayerState() === S.PAUSED) {
                                toonEigenScherm('pauze', speelt.getCurrentTime());
                            }
                        }, WACHT_BIJ_PAUZE);
                    }
                }
            }
        });
    }

    laadYouTubeApi().then((gelukt) => {
        if (gestopt) return;
        if (!gelukt) {
            // Zonder de API van YouTube: gewone ingesloten speler (dan zonder eigen scherm).
            doos.replaceChildren(iframe(item.embed + '?rel=0&iv_load_policy=3&start=' + (item.start || 0), item.titel));
            return;
        }
        maakSpeler(item.start || 0, false);
    });

    return {
        stop: () => {
            gestopt = true;
            ruimSpelerOp();
            doos.replaceChildren();
        }
    };
}
