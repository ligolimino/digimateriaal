// Nabootsing van de YouTube-speler-API voor de browsertest (de echte is in de testomgeving niet bereikbaar).
window.YT = {
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    Player: class {
        constructor(el, opts) {
            this.opts = opts;
            this.state = 5;
            this.t = opts.playerVars.start || 0;
            const f = document.createElement('iframe');
            f.dataset.start = String(this.t);
            f.dataset.autoplay = String(opts.playerVars.autoplay);
            el.replaceWith(f);
            this.f = f;
            (window.__nepSpelers = window.__nepSpelers || []).push(this);
            setTimeout(() => opts.events.onReady && opts.events.onReady({ target: this }), 10);
        }
        zet(s) { this.state = s; this.opts.events.onStateChange({ data: s, target: this }); }
        playVideo() { this.zet(1); }
        getPlayerState() { return this.state; }
        getCurrentTime() { return this.t; }
        destroy() { this.f.remove(); this.vernietigd = true; }
    }
};
if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();
