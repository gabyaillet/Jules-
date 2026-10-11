/* ==========================================================================
   Mélèze — lecteur de QR codes par la caméra (espace pro)
   - Détection native (BarcodeDetector) quand le navigateur la propose ;
   - sinon jsQR (js/vendor/jsQR.min.js, ~130 ko), chargé seulement au premier
     scan : les touristes ne le téléchargent jamais.
   La caméra est coupée dès qu'un code est lu, ou via stop().
   ========================================================================== */
window.Meleze = window.Meleze || {};

Meleze.scanner = (function () {
  'use strict';

  const JSQR_SRC = 'js/vendor/jsQR.min.js';
  const INTERVAL = 200; // ms entre deux analyses d'image
  const MAX_WIDTH = 640; // l'image analysée par jsQR est réduite à cette largeur

  let session = 0; // incrémenté à chaque start/stop : invalide les démarrages en cours
  let pending = null; // promesse du démarrage en cours
  let stream = null;
  let video = null; // élément <video> qui affiche le flux
  let onCodeCb = null;
  let timer = null;
  let detect = null; // (video) => Promise<string|null>
  let busy = false;
  let canvas = null;
  let ctx = null;
  let jsqrPromise = null;

  const MESSAGES = {
    insecure: 'La caméra nécessite une connexion sécurisée (https). Saisissez le code à la main.',
    unavailable: 'La caméra n’est pas disponible sur cet appareil. Saisissez le code à la main.',
    denied: 'Accès à la caméra refusé. Autorisez-la dans les réglages du navigateur, ou saisissez le code à la main.',
    notFound: 'Aucune caméra trouvée sur cet appareil. Saisissez le code à la main.',
    busy: 'La caméra est déjà utilisée par une autre application.',
    decoder: 'Lecture des QR codes indisponible. Saisissez le code à la main.',
    generic: 'Impossible de démarrer la caméra. Saisissez le code à la main.',
  };

  function available() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && !!window.isSecureContext;
  }

  function isActive() {
    return !!(stream && stream.getVideoTracks().some((t) => t.readyState === 'live'));
  }

  /** Traduit les erreurs de getUserMedia en message français. */
  function friendlyError(err) {
    const name = err && err.name;
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return new Error(MESSAGES.denied);
    if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return new Error(MESSAGES.notFound);
    if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return new Error(MESSAGES.busy);
    if (err && err.message && Object.values(MESSAGES).includes(err.message)) return err;
    return new Error(MESSAGES.generic);
  }

  // --- Décodeurs -------------------------------------------------------------
  /** Charge jsQR une seule fois (balise <script> injectée, promesse mise en cache). */
  function loadJsQR() {
    if (typeof window.jsQR === 'function') return Promise.resolve(window.jsQR);
    if (jsqrPromise) return jsqrPromise;
    jsqrPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSQR_SRC;
      s.async = true;
      s.onload = () => (typeof window.jsQR === 'function' ? resolve(window.jsQR) : reject(new Error(MESSAGES.decoder)));
      s.onerror = () => reject(new Error(MESSAGES.decoder));
      document.head.appendChild(s);
    }).catch((e) => { jsqrPromise = null; throw e; }); // un nouvel essai reste possible
    return jsqrPromise;
  }

  /** Détecteur natif, seulement s'il sait lire les QR codes sur cet appareil. */
  function nativeDetector() {
    if (!('BarcodeDetector' in window)) return Promise.resolve(null);
    const formats = typeof window.BarcodeDetector.getSupportedFormats === 'function'
      ? window.BarcodeDetector.getSupportedFormats()
      : Promise.resolve(['qr_code']);
    return formats
      .then((list) => {
        if (!list || !list.includes('qr_code')) return null;
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return (el) => detector.detect(el).then((codes) => {
          const hit = (codes || []).find((c) => c && c.rawValue);
          return hit ? hit.rawValue : null;
        });
      })
      .catch(() => null);
  }

  /** Décodage jsQR d'une image de la vidéo, réduite à MAX_WIDTH px de large. */
  function jsqrDetector(jsQR) {
    return (el) => {
      const vw = el.videoWidth, vh = el.videoHeight;
      if (!vw || !vh) return Promise.resolve(null);
      const w = Math.min(MAX_WIDTH, vw), h = Math.round((vh * w) / vw);
      if (!canvas) {
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d', { willReadFrequently: true });
      }
      if (!ctx) return Promise.resolve(null);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ctx.drawImage(el, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const res = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
      return Promise.resolve(res && res.data ? res.data : null);
    };
  }

  // --- Boucle d'analyse ----------------------------------------------------------
  function schedule(token) {
    clearTimeout(timer);
    timer = setTimeout(() => tick(token), INTERVAL);
  }

  function tick(token) {
    if (token !== session || !detect) return;
    const el = video;
    // HAVE_CURRENT_DATA (2) : une image est disponible
    if (busy || !el || el.readyState < 2) { schedule(token); return; }
    busy = true;
    let p;
    try { p = detect(el); } catch (e) { p = Promise.reject(e); }
    p.then((text) => {
      busy = false;
      if (token !== session) return;
      if (text && String(text).trim()) {
        const cb = onCodeCb;
        stop();
        if (cb) cb(String(text));
        return;
      }
      schedule(token);
    }, () => {
      busy = false;
      if (token !== session) return;
      // Le détecteur natif a échoué sur cet appareil : bascule sur jsQR.
      loadJsQR().then((jsQR) => {
        if (token !== session) return;
        detect = jsqrDetector(jsQR);
        schedule(token);
      }, () => { if (token === session) schedule(token); });
    });
  }

  /** Branche le flux sur un élément <video> (inline, muet, sans plein écran iOS). */
  function attach(el) {
    if (video && video !== el) {
      try { video.pause(); video.srcObject = null; } catch (e) { /* élément déjà retiré */ }
    }
    video = el;
    el.muted = true;
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('muted', '');
    if (el.srcObject !== stream) el.srcObject = stream;
    const played = el.play();
    return played && typeof played.catch === 'function' ? played.catch(() => {}) : Promise.resolve();
  }

  // --- API publique --------------------------------------------------------------
  /**
   * Allume la caméra arrière dans `videoEl` et appelle `onCode(texte)` au premier
   * QR code lu (la caméra est alors coupée). Si la caméra tourne déjà, le flux est
   * simplement rebranché sur ce nouvel élément (cas d'un nouveau rendu de la vue).
   * @returns {Promise<boolean>} true si la caméra tourne, false si stop() a été
   *          appelé entre-temps ; rejetée avec un message français sinon.
   */
  function start(videoEl, onCode) {
    if (!videoEl) return Promise.reject(new Error(MESSAGES.generic));
    onCodeCb = onCode;

    // Démarrage déjà en cours : il se branchera sur ce nouvel élément.
    if (pending) {
      if (stream) attach(videoEl); else video = videoEl;
      return pending;
    }
    // Caméra déjà allumée : on rebranche simplement le flux.
    if (isActive()) return attach(videoEl).then(() => true);

    if (!window.isSecureContext) return Promise.reject(new Error(MESSAGES.insecure));
    if (!available()) return Promise.reject(new Error(MESSAGES.unavailable));

    stop();
    video = videoEl;
    const token = ++session;
    const p = nativeDetector()
      .then((native) => {
        // jsQR se télécharge pendant que l'utilisateur répond à la demande d'accès
        const decoder = native ? Promise.resolve(native) : loadJsQR().then(jsqrDetector);
        decoder.catch(() => {}); // évite un rejet non suivi si la caméra échoue avant
        return navigator.mediaDevices
          .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
          .catch((err) => { throw friendlyError(err); })
          .then((s) => {
            if (token !== session) { s.getTracks().forEach((t) => t.stop()); return false; }
            stream = s;
            return decoder.then((fn) => {
              if (token !== session) return false;
              detect = fn;
              return attach(video).then(() => {
                if (token !== session) return false;
                schedule(token);
                return true;
              });
            });
          });
      })
      .catch((err) => {
        if (token !== session) return false; // stop() appelé entre-temps : pas d'erreur à afficher
        stop();
        throw friendlyError(err);
      })
      .finally(() => { if (pending === p) pending = null; });
    pending = p;
    return p;
  }

  /** Coupe la caméra et l'analyse. Sans effet si elle est déjà coupée. */
  function stop() {
    session++;
    pending = null;
    clearTimeout(timer);
    timer = null;
    busy = false;
    detect = null;
    if (stream) {
      stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* déjà arrêtée */ } });
      stream = null;
    }
    if (video) {
      try { video.pause(); video.srcObject = null; } catch (e) { /* élément déjà retiré */ }
      video = null;
    }
  }

  // On ne laisse jamais la caméra allumée quand la page est quittée.
  window.addEventListener('pagehide', stop);

  return { available, start, stop, isActive };
})();
