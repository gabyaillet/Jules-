/* ==========================================================================
   Mélèze — utilitaires d'interface partagés (icônes, QR codes, photos, toasts…)
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

  // --- QR code réel ------------------------------------------------------------
  // Encodeur « qrcode-generator » (js/vendor/qrcode.min.js, global `qrcode`),
  // niveau de correction M. Rendu en SVG : un seul <path> (modules noirs
  // regroupés par lignes), marge blanche de 4 modules pour la lecture caméra.
  const qrCache = new Map(); // code → { n, d } (les vues se re-rendent souvent)

  function qrMatrix(code) {
    if (qrCache.has(code)) return qrCache.get(code);
    const q = window.qrcode(0, 'M'); // 0 = version (taille) automatique
    q.addData(code);
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!q.isDark(y, x)) continue;
        let run = 1;
        while (x + run < n && q.isDark(y, x + run)) run++;
        d += 'M' + x + ' ' + y + 'h' + run + 'v1h-' + run + 'z';
        x += run - 1;
      }
    }
    const out = { n, d };
    if (qrCache.size > 50) qrCache.clear();
    qrCache.set(code, out);
    return out;
  }

  /**
   * QR code lisible par une caméra.
   * @param {string} code
   * @param {{size?:string, muted?:boolean}} opts  size : classes de largeur (ex. "w-44")
   */
  function qr(code, opts) {
    const o = Object.assign({ size: 'w-40', muted: false }, opts);
    const text = String(code == null ? '' : code);
    const tone = o.muted ? 'text-muted opacity-40' : 'text-night';
    let m = null;
    if (typeof window.qrcode === 'function') {
      try { m = qrMatrix(text); } catch (e) { m = null; }
    }
    if (!m) {
      // Repli (encodeur absent) : un carré blanc avec le code en clair.
      return '<div class="' + o.size + ' ' + tone + ' flex aspect-square items-center justify-center bg-white p-2 text-center font-mono text-xs font-semibold" role="img" aria-label="QR code ' + esc(text) + '">' + esc(text) + '</div>';
    }
    const Q = 4; // marge (quiet zone) en modules
    const box = m.n + Q * 2;
    return '<svg class="' + o.size + ' ' + tone + '" viewBox="' + (-Q) + ' ' + (-Q) + ' ' + box + ' ' + box +
      '" role="img" aria-label="QR code ' + esc(text) + '" shape-rendering="crispEdges">' +
      '<rect x="' + (-Q) + '" y="' + (-Q) + '" width="' + box + '" height="' + box + '" fill="#FFFFFF"/>' +
      '<path fill="currentColor" d="' + m.d + '"/></svg>';
  }

  // --- Photos envoyées par le touriste (justificatifs) -------------------------
  /**
   * Réduit et ré-encode une photo en JPEG avant de la stocker : ~100-300 ko au
   * lieu de plusieurs Mo, et le ré-encodage supprime les métadonnées EXIF
   * (dont la position GPS) de la photo d'origine.
   * @param {File|Blob} file
   * @param {{max?:number, quality?:number}} opts  max : plus grand côté en px
   * @returns {Promise<string>} data URL "data:image/jpeg;base64,…"
   */
  function compressImage(file, opts) {
    const o = Object.assign({ max: 1280, quality: 0.72 }, opts);
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

  function date(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
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

  return { esc, icon, qr, compressImage, duration, missionDuration, date, typeOf, seasonLabel, currentSeason, toast, photo, photoUrl };
})();
