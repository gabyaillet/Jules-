/* ==========================================================================
   Mélèze — appareil photo intégré (vérification des missions)
   Feuille plein écran : aperçu de la caméra ARRIÈRE, gros déclencheur, puis
   « Reprendre » / « Valider la photo ». Pas d'import depuis la galerie : la
   photo est prise sur le moment.
   Repli UNIQUEMENT si la caméra est inaccessible (navigateur sans caméra,
   page non sécurisée, accès refusé, aucune caméra) : un champ
   <input type="file" capture="environment"> ouvre l'appareil photo du
   téléphone.
   La photo est réduite à 1024 px (plus grand côté) en JPEG ~0,8 : quelques
   centaines de ko, sans métadonnées (ni position GPS).
   La caméra est coupée dès qu'elle ne sert plus : photo prise, feuille
   fermée, onglet masqué, page quittée (wallet.unmount → close()).

   Utilisation :
     Meleze.camera.open({ hint: 'Les déchets ramassés…' })
       .then((dataUrl) => { … })  // data URL JPEG, ou null si fermée sans photo
   ========================================================================== */
window.Meleze = window.Meleze || {};

Meleze.camera = (function () {
  'use strict';
  const { esc, spinner, compressImage } = Meleze.ui;

  const MAX_SIDE = 1024;
  const QUALITY = 0.8;

  const REASONS = {
    insecure: 'La caméra intégrée demande une connexion sécurisée (https).',
    unavailable: 'Ce navigateur ne donne pas accès à la caméra.',
    denied: 'L’accès à la caméra est refusé.',
    notFound: 'Aucune caméra trouvée sur cet appareil.',
    busy: 'La caméra est utilisée par une autre application.',
    generic: 'Impossible de démarrer la caméra.',
  };

  // Boutons posés sur le fond sombre de la feuille (toujours sombre, dans les deux thèmes)
  const BTN_OUTLINE = 'btn border-2 border-white bg-transparent text-white hover:bg-white hover:text-night focus-visible:outline-white';
  const BTN_MAIN = 'btn-primary focus-visible:outline-white';

  let sheet = null; // élément racine de la feuille
  let stream = null;
  let session = 0; // invalide les démarrages de caméra devenus inutiles
  let mode = 'closed'; // 'starting' | 'live' | 'review' | 'fallback' | 'error' | 'processing'
  let reason = '';
  let shot = null; // photo prise (data URL)
  let fromFile = false; // photo issue du repli <input type="file">
  let opener = null; // élément à refocaliser à la fermeture
  let resolver = null;
  let inerted = [];

  // ------------------------------------------------------------------------
  // Caméra
  // ------------------------------------------------------------------------
  function stopStream() {
    if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* rien */ } });
    stream = null;
    const video = sheet && sheet.querySelector('[data-cam-video]');
    if (video) video.srcObject = null;
  }

  /** Caméra utilisable ici ? Sinon, raison du repli. */
  function unavailableReason() {
    if (!window.isSecureContext) return 'insecure';
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') return 'unavailable';
    return null;
  }

  function startCamera() {
    const my = ++session;
    stopStream();
    shot = null;
    fromFile = false;
    const blocked = unavailableReason();
    if (blocked) { setMode('fallback', blocked); return; }
    setMode('starting');
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    }).then((s) => {
      if (my !== session || !sheet) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      const video = sheet.querySelector('[data-cam-video]');
      video.srcObject = s;
      const ready = () => { if (my === session && mode === 'starting') setMode('live'); };
      if (video.readyState >= 1 && video.videoWidth) ready();
      else video.addEventListener('loadedmetadata', ready, { once: true });
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* lecture auto : l'aperçu démarre au premier geste */ });
      s.getVideoTracks().forEach((t) => t.addEventListener('ended', () => {
        if (my === session && (mode === 'live' || mode === 'starting')) { stopStream(); setMode('error', 'busy'); }
      }));
    }, (err) => {
      if (my !== session) return;
      const name = err && err.name;
      if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') setMode('fallback', 'denied');
      else if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') setMode('fallback', 'notFound');
      else if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') setMode('error', 'busy');
      else setMode('error', 'generic');
    });
  }

  /** Déclencheur : image courante → JPEG réduit ; la caméra est coupée pendant la relecture. */
  function capture() {
    const video = sheet && sheet.querySelector('[data-cam-video]');
    const w0 = video && video.videoWidth, h0 = video && video.videoHeight;
    if (!w0 || !h0) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setMode('error', 'generic'); return; }
    ctx.drawImage(video, 0, 0, w, h);
    const url = canvas.toDataURL('image/jpeg', QUALITY);
    if (!/^data:image\/jpeg/.test(url)) { setMode('error', 'generic'); return; }
    shot = url;
    fromFile = false;
    session++;
    stopStream();
    setMode('review');
  }

  /** Repli : photo prise avec l'appareil photo du téléphone. */
  function onFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    setMode('processing');
    compressImage(file, { max: MAX_SIDE, quality: QUALITY })
      .then((url) => {
        if (!sheet) return;
        shot = url;
        fromFile = true;
        setMode('review');
      }, (err) => {
        if (!sheet) return;
        setMode('fallback', reason || 'unavailable', (err && err.message) || 'Impossible de lire cette photo.');
      });
  }

  // ------------------------------------------------------------------------
  // Affichage de la feuille
  // ------------------------------------------------------------------------
  /** Message posé sur la zone d'aperçu (chargement, erreur, explication du repli). */
  function message(html) {
    return '<div class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">' + html + '</div>';
  }

  function setMode(next, why, extraError) {
    mode = next;
    if (why) reason = why;
    if (!sheet) return;
    const video = sheet.querySelector('[data-cam-video]');
    const still = sheet.querySelector('[data-cam-still]');
    const overlay = sheet.querySelector('[data-cam-overlay]');
    const controls = sheet.querySelector('[data-cam-controls]');
    const live = sheet.querySelector('[data-cam-live]');

    video.hidden = !(next === 'live' || next === 'starting');
    still.hidden = next !== 'review';
    if (next === 'review') still.src = shot; else still.removeAttribute('src');

    let over = '';
    let ctrl = '';
    let say = '';
    let focus = '[data-cam="close"]';
    const R = 'font-display text-xl font-bold leading-snug text-white';

    if (next === 'starting') {
      over = message(spinner('h-8 w-8 text-white') + '<p class="' + R + '">Ouverture de la caméra…</p>');
      say = 'Ouverture de la caméra.';
    } else if (next === 'live') {
      ctrl = '<button type="button" data-cam="shoot" class="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-transparent transition active:scale-95 focus-visible:outline-white">' +
        '<span class="h-[3.75rem] w-[3.75rem] rounded-full bg-white" aria-hidden="true"></span><span class="sr-only">Prendre la photo</span></button>';
      say = 'Caméra prête. Cadrez puis appuyez sur le déclencheur.';
      focus = '[data-cam="shoot"]';
    } else if (next === 'review') {
      ctrl = '<div class="grid w-full max-w-md grid-cols-2 gap-3">' +
        '<button type="button" data-cam="retake" class="' + BTN_OUTLINE + '">Reprendre</button>' +
        '<button type="button" data-cam="use" class="' + BTN_MAIN + '">Valider la photo</button></div>';
      say = 'Photo prise. Validez-la ou reprenez-la.';
      focus = '[data-cam="use"]';
    } else if (next === 'processing') {
      over = message(spinner('h-8 w-8 text-white') + '<p class="' + R + '">Préparation de la photo…</p>');
      say = 'Préparation de la photo.';
    } else if (next === 'fallback') {
      over = message(
        '<p class="' + R + '">' + esc(REASONS[reason] || REASONS.unavailable) + '</p>' +
        '<p class="max-w-sm text-lg leading-snug text-white">Utilisez l’appareil photo du téléphone : la photo sera envoyée pour vérification, sans être enregistrée.</p>' +
        (extraError ? '<p class="bg-danger px-3 py-2 font-semibold text-white">' + esc(extraError) + '</p>' : ''));
      ctrl = '<label class="' + BTN_MAIN + ' w-full max-w-md cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white">' +
        'Ouvrir l’appareil photo' +
        '<input type="file" accept="image/*" capture="environment" class="sr-only" data-cam-file></label>';
      say = (REASONS[reason] || REASONS.unavailable) + ' Utilisez l’appareil photo du téléphone.';
      focus = '[data-cam-file]';
    } else if (next === 'error') {
      over = message('<p class="' + R + '">' + esc(REASONS[reason] || REASONS.generic) + '</p>');
      ctrl = '<button type="button" data-cam="retry" class="' + BTN_MAIN + ' w-full max-w-md">Réessayer</button>';
      say = REASONS[reason] || REASONS.generic;
      focus = '[data-cam="retry"]';
    }
    overlay.innerHTML = over;
    controls.innerHTML = ctrl;
    if (live) live.textContent = say;
    // La feuille est modale : le focus suit le contrôle principal de chaque étape.
    const target = sheet.querySelector(focus);
    if (target) target.focus({ preventScroll: true });
  }

  function build(hint) {
    const el = document.createElement('div');
    el.className = 'fixed inset-0 z-[60] flex flex-col bg-night text-white';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'cam-title');
    if (hint) el.setAttribute('aria-describedby', 'cam-hint');
    const W = 'mx-auto w-full max-w-3xl px-4 sm:px-8';
    el.innerHTML =
      '<div class="' + W + ' flex items-center justify-between gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">' +
        '<h2 id="cam-title" class="font-display text-2xl font-bold text-white">Prendre la photo</h2>' +
        '<button type="button" data-cam="close" class="' + BTN_OUTLINE + ' btn-sm">Fermer</button>' +
      '</div>' +
      (hint
        ? '<p id="cam-hint" class="' + W + ' pt-2 text-base leading-snug text-white"><span class="font-semibold">La photo doit montrer :</span> ' + esc(hint) + '</p>'
        : '') +
      // Aperçu : arrondi comme les photos de l'app
      '<div class="relative mx-auto my-3 min-h-0 w-[calc(100%-2rem)] max-w-3xl flex-1 overflow-hidden rounded-3xl bg-black sm:w-[calc(100%-4rem)]">' +
        '<video data-cam-video class="absolute inset-0 h-full w-full object-cover" playsinline muted autoplay aria-label="Aperçu de la caméra"></video>' +
        '<img data-cam-still class="absolute inset-0 h-full w-full object-contain" alt="Votre photo" hidden>' +
        '<div data-cam-overlay></div>' +
      '</div>' +
      '<div data-cam-controls class="' + W + ' flex min-h-[6.5rem] flex-col items-center justify-center gap-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"></div>' +
      '<p data-cam-live class="sr-only" aria-live="polite"></p>';

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cam]');
      if (!b) return;
      const what = b.dataset.cam;
      if (what === 'close') close(null);
      else if (what === 'shoot') capture();
      else if (what === 'retake') { if (fromFile) { shot = null; setMode('fallback'); } else startCamera(); }
      else if (what === 'use') { const url = shot; if (url) close(url); }
      else if (what === 'retry') startCamera();
    });
    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-cam-file]')) onFile(e.target);
    });
    return el;
  }

  // ------------------------------------------------------------------------
  // Clavier : Échap ferme, Tab reste dans la feuille
  // ------------------------------------------------------------------------
  function focusables() {
    return Array.from(sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((n) => !n.disabled && !n.closest('[hidden]') && n.getClientRects().length);
  }
  function onKey(e) {
    if (!sheet) return;
    if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0], last = list[list.length - 1];
    const inside = sheet.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
  }

  // Onglet masqué / téléphone verrouillé : caméra coupée, relancée au retour.
  document.addEventListener('visibilitychange', () => {
    if (!sheet || (mode !== 'live' && mode !== 'starting')) return;
    if (document.hidden) { session++; stopStream(); mode = 'starting'; }
    else startCamera();
  });

  // ------------------------------------------------------------------------
  // API
  // ------------------------------------------------------------------------
  /**
   * Ouvre la feuille. Une seule à la fois : une ouverture ferme la précédente.
   * @param {{hint?:string}} opts  hint : ce que la photo doit montrer
   * @returns {Promise<string|null>}
   */
  function open(opts) {
    if (sheet) close(null);
    const o = opts || {};
    opener = document.activeElement;
    sheet = build(String(o.hint || '').trim());
    // Le reste de la page devient inerte (ni clic, ni focus, ni lecteur d'écran)
    inerted = Array.from(document.body.children).filter((n) => n !== sheet && n.id !== 'toast' && !n.hasAttribute('inert') && n.tagName !== 'SCRIPT');
    inerted.forEach((n) => n.setAttribute('inert', ''));
    document.body.appendChild(sheet);
    document.documentElement.classList.add('overflow-hidden');
    document.addEventListener('keydown', onKey, true);
    const promise = new Promise((resolve) => { resolver = resolve; });
    sheet.querySelector('[data-cam="close"]').focus({ preventScroll: true });
    startCamera();
    return promise;
  }

  /** Ferme la feuille (caméra coupée) ; `result` est rendu à l'appelant. */
  function close(result) {
    session++;
    stopStream();
    mode = 'closed';
    if (!sheet) return;
    document.removeEventListener('keydown', onKey, true);
    sheet.remove();
    sheet = null;
    inerted.forEach((n) => n.removeAttribute('inert'));
    inerted = [];
    document.documentElement.classList.remove('overflow-hidden');
    const done = resolver;
    resolver = null;
    shot = null;
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    opener = null;
    if (done) done(result || null);
  }

  return { open, close, isOpen: () => !!sheet };
})();
