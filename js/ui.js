/* ==========================================================================
   Mélèze — utilitaires d'interface partagés (icônes, QR simulé, toasts…)
   ========================================================================== */
window.Meleze = window.Meleze || {};

Meleze.ui = (function () {
  'use strict';

  /** Échappe le texte injecté dans du HTML (indispensable pour les saisies pro). */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // --- Icônes : SVG inline en trait, ~150 octets chacune, aucune requête -----
  // Seulement les icônes fonctionnelles : accordéon, thème, statut des toasts
  // et flèche des appels à l'action principaux. Pas d'icônes décoratives.
  const PATHS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    arrow: '<path d="M5 12h14M13 5l7 7-7 7"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  };

  function icon(name, cls) {
    return '<svg class="' + (cls || 'h-5 w-5') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || '') + '</svg>';
  }

  // --- QR code simulé ---------------------------------------------------------
  // Motif déterministe (même code → même dessin) avec les 3 repères d'un vrai QR.
  // Il n'est pas lisible par une caméra : en V2, remplacer par un encodeur QR
  // (ex. "qrcode-generator", ~20 ko) sans changer la signature de la fonction.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) { // mulberry32
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function qr(code, opts) {
    const o = Object.assign({ size: 'w-40', muted: false }, opts);
    const N = 25;
    const rand = rng(hash(code));
    const finders = [[0, 0], [N - 7, 0], [0, N - 7]];
    const inFinder = (x, y) => finders.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
    let d = '';
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!inFinder(x, y) && rand() > 0.52) d += 'M' + x + ' ' + y + 'h1v1h-1z';
      }
    }
    // Repères : carré 7×7, anneau blanc, cœur 3×3 (via fill-rule evenodd)
    finders.forEach(([x, y]) => {
      d += 'M' + x + ' ' + y + 'h7v7h-7zM' + (x + 1) + ' ' + (y + 1) + 'v5h5v-5z';
      d += 'M' + (x + 2) + ' ' + (y + 2) + 'h3v3h-3z';
    });
    return '<svg class="' + o.size + ' ' + (o.muted ? 'text-muted opacity-40' : 'text-night') + '" viewBox="-2 -2 ' + (N + 4) + ' ' + (N + 4) +
      '" role="img" aria-label="QR code ' + esc(code) + '" shape-rendering="crispEdges">' +
      '<rect x="-2" y="-2" width="' + (N + 4) + '" height="' + (N + 4) + '" fill="#FFFFFF"/>' +
      '<path fill="currentColor" fill-rule="evenodd" d="' + d + '"/></svg>';
  }

  // --- Formatage -------------------------------------------------------------
  function duration(min) {
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + ' min';
    return h + ' h' + (m ? ' ' + String(m).padStart(2, '0') : '');
  }
  function date(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }
  const typeOf = (id) => Meleze.data.TYPES.find((t) => t.id === id) || { label: id, color: 'bg-sunk' };
  const seasonLabel = (id) => (Meleze.data.SEASONS.find((s) => s.id === id) || { label: id }).label;

  /** Saison courante d'après la date, pour mettre en avant les bonnes missions. */
  function currentSeason(d) {
    const m = (d || new Date()).getMonth() + 1;
    if (m >= 3 && m <= 5) return 'printemps';
    if (m >= 6 && m <= 8) return 'ete';
    if (m >= 9 && m <= 11) return 'automne';
    return 'hiver';
  }

  // --- Toast accessible (annoncé par les lecteurs d'écran) -------------------
  let toastTimer;
  function toast(message, tone) {
    const host = document.getElementById('toast');
    if (!host) return;
    const error = tone === 'error';
    host.innerHTML = '<div class="pointer-events-auto mx-auto flex w-fit max-w-md items-center gap-3 bg-night py-3 pl-3 pr-5 text-white shadow-lg ring-1 ring-white/10">' +
      '<span class="flex h-7 w-7 shrink-0 items-center justify-center text-night ' + (error ? 'bg-coral' : 'bg-lime-400') + '">' +
      icon(error ? 'alert' : 'check', 'h-4 w-4') + '</span>' +
      '<span class="font-display text-[0.95rem] font-semibold leading-snug">' + esc(message) + '</span></div>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { host.innerHTML = ''; }, 3800);
  }

  // --- Photos responsives -------------------------------------------------------
  // Unsplash sert automatiquement de l'AVIF/WebP compressé (auto=format, q=60)
  // à la largeur demandée : le téléphone ne télécharge que ce qu'il affiche.
  const WIDTHS = [480, 800, 1200, 1800];
  const isLocal = (src) => /^(https?:|\/|\.|img\/)/.test(src);
  const unsplash = (id, w) => 'https://images.unsplash.com/photo-' + id + '?auto=format&fit=crop&q=60&w=' + w;

  /** Entrée de la photothèque à partir d'une clé ("lake") ou d'une mission. */
  function photoOf(keyOrMission) {
    const P = Meleze.photos;
    if (keyOrMission && typeof keyOrMission === 'object') {
      return P[keyOrMission.photo] || P[P.byType[keyOrMission.type]] || P.range;
    }
    return P[keyOrMission] || P.range;
  }

  /**
   * <img> responsive. À placer dans un conteneur `.ph` (qui donne la taille
   * et un dégradé de repli si l'image ne charge pas).
   * @param {string|object} key  clé de la photothèque ou mission
   * @param {{sizes?:string, eager?:boolean, alt?:string}} opts
   */
  function photo(key, opts) {
    const o = Object.assign({ sizes: '100vw', eager: false }, opts);
    const p = photoOf(key);
    const alt = o.alt != null ? o.alt : p.alt;
    const src = isLocal(p.src) ? p.src : unsplash(p.src, 800);
    const srcset = isLocal(p.src) ? '' : ' srcset="' + WIDTHS.map((w) => unsplash(p.src, w) + ' ' + w + 'w').join(', ') + '" sizes="' + o.sizes + '"';
    return '<img src="' + src + '"' + srcset + ' alt="' + esc(alt) + '" ' +
      (o.eager ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async">';
  }

  return { esc, icon, qr, duration, date, typeOf, seasonLabel, currentSeason, toast, photo };
})();
