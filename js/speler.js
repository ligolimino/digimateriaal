/**
 * speler.js — speelt een item af in een container (gebruikt door beide pagina's).
 *
 * YouTube krijgt een speciale behandeling via de officiële YouTube-speler-API:
 * bij pauze en aan het einde leggen we ons eigen scherm over de video.
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

function speelYouTube(doos, item) {
    const plek = el('div', { class: 'yt-plek' });
    const afdek = el('button', { class: 'afdek', type: 'button', hidden: true });
    doos.append(plek, afdek);

    let speler = null;
    let gestopt = false;
    const videoId = item.embed.split('/embed/')[1];
    const eigenSchermknop = volledigSchermMogelijk();

    function toonAfdek(soort) {
        afdek.hidden = false;
        afdek.innerHTML = soort === 'einde'
            ? icoon('opnieuw', 'groot-icoon') + '<span>Opnieuw bekijken</span>'
            : icoon('play', 'groot-icoon') + '<span>Verder kijken</span>';
        afdek.dataset.soort = soort;
    }

    afdek.addEventListener('click', () => {
        if (!speler) return;
        if (afdek.dataset.soort === 'einde') {
            speler.seekTo(item.start || 0, true);
        }
        speler.playVideo();
        afdek.hidden = true;
    });

    laadYouTubeApi().then((gelukt) => {
        if (gestopt) return;
        if (!gelukt) {
            // Zonder API: gewone ingesloten speler (dan zonder afdekscherm).
            plek.replaceWith(iframe(item.embed + '?rel=0&iv_load_policy=3&start=' + (item.start || 0), item.titel));
            return;
        }
        speler = new window.YT.Player(plek, {
            host: 'https://www.youtube-nocookie.com',
            videoId,
            playerVars: {
                rel: 0,
                iv_load_policy: 3,
                playsinline: 1,
                start: item.start || 0,
                // Eigen knop voor volledig scherm (zodat ons afdekscherm meegaat);
                // op toestellen zonder die mogelijkheid (iPhone) de knop van YouTube.
                fs: eigenSchermknop ? 0 : 1
            },
            events: {
                onStateChange: (e) => {
                    const S = window.YT.PlayerState;
                    if (e.data === S.ENDED) toonAfdek('einde');
                    else if (e.data === S.PAUSED) toonAfdek('pauze');
                    else if (e.data === S.PLAYING) afdek.hidden = true;
                }
            }
        });
    });

    return {
        stop: () => {
            gestopt = true;
            if (speler && speler.destroy) speler.destroy();
            doos.replaceChildren();
        }
    };
}
