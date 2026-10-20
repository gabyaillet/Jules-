/* ==========================================================================
   Mélèze — utilitaires d'interface partagés (icônes, photos, toasts, états…)
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
  // Seulement des icônes qui portent un sens : accordéon, thème, statut des
  // toasts, flèche des appels à l'action ; sur téléphone (concept « Cartes »),
  // durée, lieu, cadeau et appareil photo à côté de leur texte.
  const PATHS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    arrow: '<path d="M5 12h14M13 5l7 7-7 7"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3.5"/>',
  };

  function icon(name, cls) {
    return '<svg class="' + (cls || 'h-5 w-5') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || '') + '</svg>';
  }

  // --- Photo de vérification (repli sans caméra intégrée, voir js/camera.js) ---
  /**
   * Réduit et ré-encode une photo en JPEG avant l'envoi : ~100-250 ko au lieu
   * de plusieurs Mo, et le ré-encodage supprime les métadonnées EXIF (dont la
   * position GPS) de la photo d'origine.
   * @param {File|Blob} file
   * @param {{max?:number, quality?:number}} opts  max : plus grand côté en px
   * @returns {Promise<string>} data URL "data:image/jpeg;base64,…"
   */
  function compressImage(file, opts) {
    const o = Object.assign({ max: 1024, quality: 0.8 }, opts);
    const notImage = () => new Error('Ce fichier n’est pas une image.');
    if (!file || (file.type && !/^image\//i.test(file.type))) return Promise.reject(notImage());

    // Décodage : createImageBitmap si possible (orientation EXIF appliquée),
    // sinon <img> chargé via une URL d'objet (ou FileReader en dernier recours).
    function viaImage() {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = window.URL && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
        const done = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
        img.onload = () => { done(); resolve(img); };
        img.onerror = () => { done(); reject(notImage()); };
        if (objectUrl) { img.src = objectUrl; return; }
        const reader = new FileReader();
        reader.onerror = () => reject(notImage());
        reader.onload = () => { img.src = reader.result; };
        reader.readAsDataURL(file);
      });
    }
    const decode = typeof window.createImageBitmap === 'function'
      ? window.createImageBitmap(file, { imageOrientation: 'from-image' }).catch(viaImage)
      : viaImage();

    return decode.then((src) => {
      try {
        const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
        if (!w0 || !h0) throw notImage();
        const scale = Math.min(1, o.max / Math.max(w0, h0));
        const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Impossible de préparer la photo sur cet appareil.');
        ctx.fillStyle = '#FFFFFF'; // les PNG transparents ne deviennent pas noirs en JPEG
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(src, 0, 0, w, h);
        const url = canvas.toDataURL('image/jpeg', o.quality);
        if (!/^data:image\//.test(url)) throw new Error('Impossible de préparer la photo sur cet appareil.');
        return url;
      } finally {
        if (typeof src.close === 'function') src.close(); // libère l'ImageBitmap
      }
    });
  }

  // --- Formatage -------------------------------------------------------------
  /**
   * Durée en minutes → "45 min", "1 h 30" ; 0 ou vide → "" (durée variable).
   * Espaces insécables : le chiffre et l'unité ne sont jamais séparés à la ligne.
   */
  function duration(min) {
    const total = Math.max(0, Math.round(Number(min) || 0));
    if (!total) return '';
    const h = Math.floor(total / 60), m = total % 60;
    if (!h) return m + '\u00a0min';
    return h + '\u00a0h' + (m ? '\u00a0' + String(m).padStart(2, '0') : '');
  }
  /** Durée affichée d'une mission : libellé libre (ex. "Le temps du trajet") sinon minutes. */
  const missionDuration = (m) => (m && m.durationLabel) || duration(m && m.duration);

  /** "AAAA-MM-JJ" (date seule) ou horodatage ISO du serveur → objet Date (null si illisible). */
  function toDate(iso) {
    if (!iso) return null;
    const s = String(iso);
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s);
    return isNaN(d.getTime()) ? null : d;
  }
  /** "14 octobre" */
  function date(iso) {
    const d = toDate(iso);
    return d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
  }
  /** "14 octobre 2026 à 10:32" (heure locale) : preuve qu'un bon vient d'être utilisé. */
  function dateTime(iso) {
    const d = toDate(iso);
    if (!d) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' à ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  const typeOf = (id) => Meleze.data.TYPES.find((t) => t.id === id) || { label: id, num: '', color: 'bg-ink text-surface' };
  const seasonLabel = (id) => (Meleze.data.SEASONS.find((s) => s.id === id) || { label: id }).label;

  /** Saison courante d'après la date, pour mettre en avant les bonnes missions. */
  function currentSeason(d) {
    const m = (d || new Date()).getMonth() + 1;
    if (m >= 3 && m <= 5) return 'printemps';
    if (m >= 6 && m <= 8) return 'ete';
    if (m >= 9 && m <= 11) return 'automne';
    return 'hiver';
  }

  // --- États d'une page (chargement, erreur, bientôt disponible) --------------
  /** Petit cercle qui tourne (immobile si « moins d'animations »). */
  function spinner(cls) {
    return '<span class="' + (cls || 'h-6 w-6') + ' inline-block shrink-0 animate-spin rounded-full border-[3px] border-current border-r-transparent" aria-hidden="true"></span>';
  }

  /**
   * Bloc gris plein : un titre, une phrase, éventuellement un bouton.
   * `title` et `text` sont échappés ; `extra` est du HTML déjà sûr.
   * @param {{title:string, text?:string, extra?:string, busy?:boolean, cls?:string}} o
   */
  function notice(o) {
    return '<div class="bg-sunk p-6 sm:p-8 ' + (o.cls || '') + '"' + (o.busy ? ' role="status"' : '') + '>' +
      '<p class="flex items-center gap-3 font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-ink">' +
        (o.busy ? spinner() : '') + '<span>' + esc(o.title) + '</span></p>' +
      (o.text ? '<p class="mt-2 max-w-xl text-lg leading-snug text-ink">' + esc(o.text) + '</p>' : '') +
      (o.extra || '') +
    '</div>';
  }

  /** « Bientôt disponible » : serveur pas encore branché (js/config.js vide). */
  function soon(text) {
    return notice({ title: 'Bientôt disponible', text: text || 'Les premières missions arrivent très bientôt.' });
  }

  // --- Toast accessible (annoncé par les lecteurs d'écran) -------------------
  let toastTimer;
  function toast(message, tone) {
    const host = document.getElementById('toast');
    if (!host) return;
    const error = tone === 'error';
    host.innerHTML = '<div class="pointer-events-auto mx-auto flex w-fit max-w-md items-center gap-3 bg-night py-3 pl-3 pr-5 text-white shadow-lg ring-1 ring-white/10">' +
      '<span class="flex h-7 w-7 shrink-0 items-center justify-center ' + (error ? 'bg-danger text-surface' : 'bg-forest text-white') + '">' +
      icon(error ? 'alert' : 'check', 'h-4 w-4') + '</span>' +
      '<span class="font-display text-[0.95rem] font-semibold leading-snug">' + esc(message) + '</span></div>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { host.innerHTML = ''; }, error ? 6000 : 3800); // erreurs : le temps de lire
  }

  // --- Photos responsives -------------------------------------------------------
  // Unsplash sert automatiquement de l'AVIF/WebP compressé (auto=format, q=60)
  // à la largeur demandée : le téléphone ne télécharge que ce qu'il affiche.
  const WIDTHS = [480, 800, 1200, 1800, 2400];
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
   * URL d'une photo de la photothèque (pour un fond CSS : mot rempli par une photo…).
   * Une photo locale est rendue en URL absolue : dans une variable CSS
   * (--ph-sm…), une URL relative serait résolue depuis dist/styles.css.
   * @param {string|object} key  clé de la photothèque ou mission
   * @param {number} w  largeur demandée (Unsplash)
   */
  function photoUrl(key, w) {
    const p = photoOf(key);
    if (!isLocal(p.src)) return unsplash(p.src, w || 1200);
    try { return new URL(p.src, document.baseURI).href; } catch (e) { return p.src; }
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

  return {
    esc, icon, compressImage, duration, missionDuration, date, dateTime, typeOf, seasonLabel, currentSeason,
    toast, photo, photoUrl, spinner, notice, soon,
  };
})();
