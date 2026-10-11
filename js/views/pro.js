/* ==========================================================================
   Vue : Espace Pro / Partenaire
   - Connexion simulée (rôle + structure)
   - Onglet "Scanner"       : caméra (Meleze.scanner) ou saisie du code ;
                              l'écran s'adapte au code lu (QR d'une mission
                              ou bon de récompense)
   - Onglet "Justificatifs" : photos envoyées pour les missions « photo »
                              (transport), à valider ou à refuser
   - Onglet "Créer"         : mission + contrepartie obligatoire, publiée aussitôt
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.pro = (function () {
  'use strict';
  const { esc, icon, qr, duration, missionDuration, date, typeOf, toast } = Meleze.ui;
  const store = Meleze.store;

  const ROLES = ['Commerçant partenaire', 'Référent de mission', 'Office de tourisme'];
  const CATEGORIES = ['Expérience', 'Produit local', 'Gourmandise', 'Équipement'];
  const DURATIONS = [30, 45, 60, 90, 120, 150, 180];
  const TABS = ['scan', 'justificatifs', 'creer'];

  /** Motifs proposés au pro quand il refuse un justificatif (affichés au touriste). */
  const REASONS = [
    'Justificatif illisible ou non conforme',
    'Date ou trajet non visible',
    'Ni transport en commun ni covoiturage',
  ];

  /** Noms courts des missions de démo, pour les puces "QR · …". */
  const SHORT = { 'm-transport': 'Transport', 'm-marche': 'Marché', 'm-sentiers': 'Sentiers' };

  const STATUS = {
    inscrite: { label: 'Inscrit·e', color: 'bg-sunk' },
    preuve: { label: 'Justificatif à vérifier', color: 'bg-lime-200' },
    refusee: { label: 'Justificatif refusé', color: 'bg-coral' },
    validee: { label: 'Déjà validée', color: 'bg-coral' },
  };

  // Conteneur commun : même rythme vertical que les autres pages
  const WRAP = 'mx-auto px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16';
  const LEGEND = 'float-left mb-1 w-full font-display text-2xl font-bold tracking-[-0.02em]';

  // État local de l'écran
  let scanned = null; // dernier code lu (caméra, saisie ou puce de démo)
  let flash = null; // { tab, pid, title, html } : succès après une validation (html déjà échappé)
  let created = null; // dernière mission créée (écran de confirmation)
  let camera = 'off'; // 'off' | 'starting' | 'on'
  let cameraError = null; // message français renvoyé par Meleze.scanner
  let currentTab = 'scan';
  let focusAfter = null; // sélecteur (ou liste, par ordre de préférence) à focaliser après le prochain rendu
  let reveal = false; // après une lecture : faire défiler jusqu'au résultat
  let appRef = null; // routeur, pour redessiner sur un événement de la page
  const zoomed = new Set(); // justificatifs affichés en grand

  const CAPTION = {
    starting: 'Autorisez l’accès à la caméra…',
    on: 'Placez le QR dans le cadre',
  };

  // ------------------------------------------------------------------------
  // Utilitaires
  // ------------------------------------------------------------------------
  const tabOf = (sub) => (TABS.includes(sub) ? sub : 'scan');
  const firstName = (user) => (user && user.firstName) || 'Participant';

  /**
   * Normalise un code lu ou saisi : majuscules, espaces retirés, et extraction
   * d'un code Mélèze (MLZ-P-XXXX / MLZ-B-XXXX) même tapé sans tirets ou
   * contenu dans un texte plus long.
   */
  function normalize(raw) {
    const s = String(raw == null ? '' : raw).trim().toUpperCase().slice(0, 200);
    const m = s.replace(/\s+/g, '').match(/MLZ-?([PB])-?([A-Z0-9]{4})(?![A-Z0-9])/);
    return m ? 'MLZ-' + m[1] + '-' + m[2] : s;
  }

  function shortName(m) {
    if (SHORT[m.id]) return SHORT[m.id];
    const t = String(m.title || '');
    return t.length > 24 ? t.slice(0, 22).trim() + '…' : t;
  }

  function field(id, label, control, hint) {
    return '<div><label class="label" for="' + id + '">' + label + '</label>' + control + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
  }

  /** Bloc "En échange" dans la couleur du type de mission. */
  function rewardBlock(m) {
    if (!m.reward) return '';
    return '<div class="mt-4 px-4 py-3 text-night ' + esc(typeOf(m.type).color) + '">' +
      '<p class="text-sm text-night/60">En échange</p>' +
      '<p class="font-display font-bold leading-snug">' + esc(m.reward.title) + '</p>' +
      (m.reward.partner ? '<p class="text-sm text-night/70">' + esc(m.reward.partner) + '</p>' : '') +
    '</div>';
  }

  function flashBox(tab) {
    if (!flash || flash.tab !== tab) return '';
    return '<div id="pro-flash" tabindex="-1" class="bg-lime-300 px-5 py-4 text-night">' +
      '<p class="font-display font-bold">' + flash.title + '</p>' +
      '<p class="mt-1 text-night/75">' + flash.html + '</p>' +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Caméra
  // ------------------------------------------------------------------------
  const scanner = () => Meleze.scanner;
  const cameraAvailable = () => !!(scanner() && scanner().available());

  function stopCamera() {
    camera = 'off';
    if (scanner()) scanner().stop();
  }

  /**
   * Après une lecture (caméra, puce de démo ou saisie) : le résultat s'affiche
   * sous le scanner, hors de l'écran sur mobile. On y fait défiler la page et
   * on place le focus sur l'action principale (ou sur le résultat lui-même).
   */
  function showResult() {
    reveal = true;
    focusAfter = ['#scan-result [data-action="validate"]', '#scan-result [data-action="consume"]', '#scan-result'];
  }

  /** QR lu par la caméra : la caméra est déjà coupée par le scanner. */
  function onDetected(text, app) {
    camera = 'off';
    cameraError = null;
    flash = null;
    scanned = normalize(text) || null;
    showResult();
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { /* facultatif */ }
    toast('QR code lu');
    app.rerender();
  }

  /**
   * Onglet du navigateur masqué, téléphone verrouillé ou page restaurée depuis
   * le cache (retour arrière) : le scanner a coupé la caméra, l'écran repasse
   * sur « Activer la caméra » au lieu de rester sur une image noire.
   */
  function cameraLost() {
    if (camera === 'off' || (scanner() && scanner().isActive() && !document.hidden)) return;
    stopCamera();
    if (appRef) appRef.rerender();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) cameraLost(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) cameraLost(); });

  /**
   * (Re)branche la caméra sur le <video> du rendu courant. Appelée après
   * chaque rendu tant que la caméra est allumée : le scanner réutilise alors
   * le flux existant, sans redemander l'autorisation.
   */
  function startCamera(root, app) {
    const sc = scanner();
    const video = root.querySelector('#scan-video');
    if (!sc || !video) return;
    sc.start(video, (text) => onDetected(text, app)).then((running) => {
      if (!running || camera !== 'starting') return;
      camera = 'on';
      const caption = root.querySelector('[data-scan-caption]');
      if (caption) caption.textContent = CAPTION.on;
    }, (err) => {
      if (camera === 'off') return; // arrêtée entre-temps : rien à signaler
      stopCamera();
      cameraError = (err && err.message) || 'Impossible de démarrer la caméra. Saisissez le code à la main.';
      focusAfter = '[data-action="camera-start"]';
      app.rerender();
    });
  }

  // ------------------------------------------------------------------------
  // Connexion
  // ------------------------------------------------------------------------
  function renderLogin() {
    const demo = Meleze.data.proDemo;
    return '<div class="' + WRAP + ' max-w-md">' +
      '<span class="tag">Espace partenaires</span>' +
      '<h1 id="page-title" tabindex="-1" class="mt-4 text-5xl font-extrabold sm:text-6xl">Connexion <span class="mark">pro</span></h1>' +
      '<p class="mt-4 text-lg text-muted">Commerçants, référents de mission, Office de tourisme : scannez les QR des missions, vérifiez les justificatifs, encaissez les bons et publiez de nouvelles missions.</p>' +
      '<form class="card mt-8 space-y-5 p-5 sm:p-7" data-form="login" novalidate>' +
        field('email', 'E-mail professionnel', '<input class="field" id="email" name="email" type="email" autocomplete="username" required value="' + esc(demo.email) + '">') +
        field('pin', 'Code PIN', '<input class="field tracking-[0.4em]" id="pin" name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" required placeholder="••••">') +
        field('role', 'Je suis', '<select class="field" id="role" name="role">' + ROLES.map((r) => '<option>' + esc(r) + '</option>').join('') + '</select>') +
        field('org', 'Structure', '<input class="field" id="org" name="org" required value="Téléphérique du Mont Bochor">') +
        '<p class="bg-lime-200 px-4 py-3 text-[0.95rem] text-night">Pour la démo : ' + esc(demo.email) + ', PIN <strong>' + esc(demo.pin) + '</strong></p>' +
        '<button class="btn-primary w-full">Se connecter</button>' +
      '</form>' +
      '<a href="#/" class="link mt-8">Retour au site</a>' +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Coquille connectée + onglets
  // ------------------------------------------------------------------------
  function renderShell(pro, tab, inner, pending) {
    const tabLink = (id, label, extra) =>
      '<a href="#/pro/' + id + '" class="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-center font-display text-[0.95rem] font-semibold leading-tight transition-colors ' +
      (tab === id ? 'bg-ink text-surface' : 'text-muted hover:text-ink') + '"' + (tab === id ? ' aria-current="page"' : '') + '>' + label + (extra || '') + '</a>';
    const count = pending
      ? '<span class="inline-flex min-w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-lime-400 px-1.5 text-xs font-bold leading-[1.375rem] text-night">' + pending + '<span class="sr-only"> en attente</span></span>'
      : '';

    return '<div class="' + WRAP + ' max-w-2xl">' +
      '<div class="flex items-center justify-between gap-4">' +
        '<p class="min-w-0 text-sm text-muted">' + esc(pro.role) + '</p>' +
        '<button type="button" class="link min-h-[44px] shrink-0 text-[0.95rem]" data-action="logout">Se déconnecter</button>' +
      '</div>' +
      '<h1 id="page-title" tabindex="-1" class="mt-3 break-words text-4xl font-extrabold sm:text-5xl">' + esc(pro.org) + '</h1>' +
      '<nav class="mt-8 flex gap-1 bg-sunk p-1" aria-label="Outils pro">' +
        tabLink('scan', 'Scanner') + tabLink('justificatifs', 'Justificatifs', count) + tabLink('creer', 'Créer une mission') +
      '</nav>' +
      '<div class="mt-10">' + inner + '</div>' +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Onglet Scanner
  // ------------------------------------------------------------------------
  /** Codes de démonstration : on "présente" un QR sans caméra. */
  function demoCodes(state) {
    const parts = state.participations
      .map((p) => ({ p, m: store.getMission(p.missionId) }))
      .filter((x) => x.m);
    const label = (x) => (x.m.proof === 'photo' ? 'Code · ' : 'QR · ') + shortName(x.m);
    return parts.filter((x) => x.p.status !== 'validee').map((x) => ({ code: x.p.code, label: label(x) }))
      .concat(parts.filter((x) => x.p.status === 'validee').map((x) => ({ code: x.p.code, label: label(x) + ' (déjà validée)' })))
      .concat(state.vouchers.map((v) => ({
        code: v.code,
        label: 'Bon ' + String(v.code).slice(-4) + (v.status === 'consomme' ? ' (déjà utilisé)' : ''),
      })));
  }

  function scanFrame(canCamera) {
    const corners =
      '<span class="scan-corner left-5 top-5 border-l-[3px] border-t-[3px]"></span>' +
      '<span class="scan-corner right-5 top-5 border-r-[3px] border-t-[3px]"></span>' +
      '<span class="scan-corner bottom-5 left-5 border-b-[3px] border-l-[3px]"></span>' +
      '<span class="scan-corner bottom-5 right-5 border-b-[3px] border-r-[3px]"></span>';
    let inner;
    if (camera !== 'off') {
      inner = '<video id="scan-video" class="absolute inset-0 h-full w-full object-cover" playsinline muted autoplay aria-label="Image de la caméra"></video>' +
        corners + '<span class="scan-line"></span>' +
        '<p class="absolute inset-x-0 bottom-9 flex justify-center px-4">' +
          '<span class="bg-night/70 px-2.5 py-1 text-center text-sm text-white" data-scan-caption>' + CAPTION[camera] + '</span>' +
        '</p>';
    } else if (scanned) {
      inner = corners + '<div class="absolute inset-0 flex items-center justify-center p-14">' + qr(scanned, { size: 'w-full' }) + '</div>';
    } else {
      inner = corners + '<p class="absolute inset-0 flex items-center justify-center px-12 text-center text-sm text-white/75">' +
        (canCamera ? 'Activez la caméra pour lire un QR code' : 'Saisissez le code du QR') + '</p>';
    }
    return '<div class="scan-frame">' + inner + '</div>';
  }

  function renderScanner(state) {
    const canCamera = cameraAvailable();
    const control = canCamera
      ? (camera !== 'off'
        ? '<button type="button" class="btn-secondary mt-4 w-full" data-action="camera-stop">Arrêter la caméra</button>'
        : '<button type="button" class="btn-primary mt-4 w-full" data-action="camera-start">Activer la caméra</button>')
      : '<p class="mt-4 bg-sunk px-4 py-3 text-sm leading-snug text-muted">Caméra indisponible ici : il faut une connexion sécurisée (https) et un navigateur récent. Saisissez le code ou utilisez les QR de démo.</p>';
    const error = cameraError
      ? '<p class="mt-3 border-l-4 border-danger bg-sunk px-4 py-3 text-sm leading-snug" role="alert">' + esc(cameraError) + '</p>'
      : '';
    const demos = demoCodes(state);

    return '<section aria-labelledby="scan-h">' +
      '<h2 id="scan-h" class="sr-only">Scanner un QR code</h2>' +
      '<div class="grid gap-8 sm:grid-cols-[15rem_1fr] sm:items-start">' +
        '<div class="mx-auto w-full max-w-[18rem]">' + scanFrame(canCamera) + control + error + '</div>' +

        '<div class="min-w-0">' +
          '<form class="flex flex-col gap-3" data-form="scan">' +
            '<label for="code" class="label">Code du QR ou du bon</label>' +
            '<input class="field min-w-0 font-mono uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal" id="code" name="code" placeholder="MLZ-…" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(scanned || '') + '">' +
            '<button class="btn-primary w-full">Lire</button>' +
          '</form>' +
          (demos.length
            ? '<p class="mt-6 text-sm text-muted">Pour la démo, présentez un de ces QR :</p>' +
              '<div class="mt-3 flex flex-wrap gap-2">' +
                demos.map((d) => '<button type="button" class="chip" data-action="scan-demo" data-code="' + esc(d.code) + '" aria-pressed="' + (scanned === d.code) + '">' + esc(d.label) + '</button>').join('') +
              '</div>'
            : '') +
        '</div>' +
      '</div>' +

      '<div id="scan-result" tabindex="-1" class="mt-10 scroll-mt-24 space-y-6 outline-none" aria-live="polite">' + flashBox('scan') + (scanned ? renderResult(store.lookup(scanned)) : '') + '</div>' +
    '</section>';
  }

  /** Le cœur "intelligent" : l'écran s'adapte à la nature du code lu. */
  function renderResult(r) {
    if (r.kind === 'unknown') {
      return '<div class="border-l-4 border-danger bg-sunk px-5 py-4">' +
        '<p class="font-display font-bold">Code inconnu</p>' +
        '<p class="mt-1 text-muted">« ' + esc(r.code) + ' » ne correspond à aucune participation ni à aucun bon.</p>' +
      '</div>';
    }
    if (r.kind === 'participation') return participationResult(r);
    return voucherResult(r.voucher);
  }

  /**
   * Anti-triche : validations précédentes de la même mission pour ce participant
   * (ex. le même billet renvoyé pour obtenir un deuxième bon).
   * @returns {{count:number, last:string}|null}
   */
  function history(p) {
    const done = store.state.participations
      .filter((x) => x !== p && x.missionId === p.missionId && x.status === 'validee')
      .map((x) => String(x.validatedAt || ''))
      .sort();
    return done.length ? { count: done.length, last: done[done.length - 1] } : null;
  }
  const historyText = (h) =>
    (h.count > 1 ? h.count + ' validations précédentes' : '1 validation précédente') +
    (h.last ? ', la dernière le ' + esc(date(h.last)) : '');

  /** Encadré d'alerte pour un justificatif photo : vérifier qu'il est nouveau. */
  function historyWarning(p) {
    const h = history(p);
    if (!h) return '';
    return '<p class="mt-4 border-l-4 border-danger bg-sunk px-4 py-3 text-[0.95rem] leading-snug">' +
      '<span class="font-semibold">Déjà fait :</span> ' + historyText(h) + ' pour ce participant. Vérifiez que le justificatif est bien nouveau (date du trajet).' +
    '</p>';
  }

  /** Mission déjà validée : pas de bouton, le bon n'est émis qu'une fois. */
  function alreadyBox(p, isPhoto) {
    return '<div class="mt-6 border-l-4 border-danger bg-sunk px-5 py-4">' +
      '<p class="font-display font-bold">Mission déjà validée' + (p.validatedAt ? ' le ' + esc(date(p.validatedAt)) : '') + '</p>' +
      '<p class="mt-1 text-muted">' + (isPhoto ? 'Ce justificatif a déjà été accepté' : 'Ce QR a déjà servi') + ' : le bon n’est émis qu’une seule fois.</p>' +
    '</div>';
  }

  /** Photo du justificatif (carrée, sur fond gris), agrandissable d'un geste. */
  function proofPicture(p, name) {
    const img = p.proof && p.proof.image;
    if (!img) {
      return '<p class="bg-sunk px-5 py-8 text-center text-muted">Photo indisponible : le participant devra la renvoyer.</p>';
    }
    const big = zoomed.has(p.id);
    return '<button type="button" class="relative block w-full bg-sunk" data-action="proof-zoom" data-id="' + esc(p.id) + '">' +
      '<img src="' + esc(img) + '" alt="Justificatif envoyé par ' + esc(name) + '" class="block w-full object-contain ' + (big ? 'h-auto' : 'h-64') + '" decoding="async">' +
      '<span class="tag absolute bottom-3 right-3 bg-white">' + (big ? 'Réduire' : 'Agrandir') + '</span>' +
    '</button>';
  }

  /** Motif de refus + Valider / Refuser. */
  function reviewControls(p) {
    const id = esc(p.id);
    return '<div class="mt-5">' +
        '<label class="label text-[0.95rem]" for="reason-' + id + '">Motif en cas de refus</label>' +
        '<select class="field" id="reason-' + id + '" data-reason-for="' + id + '">' +
          REASONS.map((r) => '<option>' + esc(r) + '</option>').join('') +
        '</select>' +
      '</div>' +
      '<div class="mt-4 grid grid-cols-2 gap-3">' +
        '<button type="button" class="btn-primary" data-action="validate" data-id="' + id + '">Valider</button>' +
        '<button type="button" class="btn-secondary" data-action="refuse" data-id="' + id + '">Refuser</button>' +
      '</div>';
  }

  /** QR d'une participation : une mission, un participant, un statut. */
  function participationResult(r) {
    const p = r.participation, m = r.mission, t = typeOf(m.type);
    const isPhoto = m.proof === 'photo';
    const name = firstName(r.user);
    const justValidated = p.status === 'validee' && flash && flash.pid === p.id;
    const st = justValidated ? { label: 'Validée', color: 'bg-lime-300' } : (STATUS[p.status] || { label: p.status, color: 'bg-sunk' });
    const meta = [missionDuration(m), m.location].filter(Boolean).map(esc).join(' · ');
    const row = (k, v) => '<dt class="text-muted">' + k + '</dt><dd class="min-w-0 break-words">' + v + '</dd>';
    const past = history(p);

    let body = '';
    if (p.status === 'validee') {
      body = justValidated ? '' : alreadyBox(p, isPhoto);
    } else if (isPhoto) {
      const proof = p.proof || {};
      let state = 'Le participant n’a pas encore envoyé de photo (billet, réservation de covoiturage…).';
      if (p.status === 'preuve') state = 'Photo envoyée' + (proof.sentAt ? ' le ' + esc(date(proof.sentAt)) : '') + ', à vérifier ci-dessous.';
      if (p.status === 'refusee') {
        state = 'Justificatif refusé' + (p.refusedAt ? ' le ' + esc(date(p.refusedAt)) : '') +
          (p.refusedReason ? ' (« ' + esc(p.refusedReason) + ' »)' : '') + '. En attente d’une nouvelle photo.';
      }
      body = '<div class="mt-6 bg-sunk px-5 py-4">' +
          '<p class="font-display font-bold">Cette mission se valide avec un justificatif photo</p>' +
          '<p class="mt-1 text-[0.95rem] text-muted">' + state + '</p>' +
          '<a href="#/pro/justificatifs" class="link mt-3">Voir les justificatifs</a>' +
        '</div>' +
        (p.status === 'preuve' ? '<div class="mt-5">' + proofPicture(p, name) + '</div>' + reviewControls(p) : '');
    } else if (p.status === 'inscrite') {
      body = '<button type="button" class="btn-primary mt-6 w-full" data-action="validate" data-id="' + esc(p.id) + '">Valider la mission</button>' +
        '<p class="mt-3 text-center text-sm text-muted">Le bon part aussitôt dans l’espace du participant.</p>';
    } else {
      body = '<p class="mt-6 bg-sunk px-5 py-4 text-muted">Cette participation ne peut pas être validée par QR.</p>';
    }

    return '<article class="card p-5 sm:p-6">' +
      '<div class="flex flex-wrap items-center gap-2">' +
        '<span class="tag ' + esc(t.color) + '">' + esc(t.label) + '</span>' +
        '<span class="tag ' + esc(st.color) + '">' + esc(st.label) + '</span>' +
      '</div>' +
      '<h3 class="mt-3 text-2xl sm:text-3xl">' + esc(m.title) + '</h3>' +
      (meta ? '<p class="mt-1.5 text-sm text-muted">' + meta + '</p>' : '') +
      '<dl class="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[0.95rem]">' +
        row('Participant', '<span class="font-semibold">' + esc(name) + '</span>') +
        row('Code', '<span class="font-mono font-semibold">' + esc(p.code) + '</span>') +
        (p.date ? row('Inscription', esc(date(p.date))) : '') +
        (p.validatedAt ? row('Validée le', esc(date(p.validatedAt))) : '') +
        (past ? row('Historique', historyText(past)) : '') +
      '</dl>' +
      rewardBlock(m) +
      (isPhoto && p.status === 'preuve' ? historyWarning(p) : '') +
      body +
    '</article>';
  }

  /** Bon de récompense : consommation unique. */
  function voucherResult(v) {
    const used = v.status === 'consomme';
    return '<div class="p-5 sm:p-6 ' + (used ? 'bg-sunk' : 'card') + '">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '<span class="tag ' + (used ? 'bg-coral' : 'bg-lime-300') + '">' + (used ? 'Déjà utilisé' : 'Bon valable') + '</span>' +
        '<span class="font-mono text-sm font-semibold">' + esc(v.code) + '</span>' +
      '</div>' +
      '<h3 class="mt-4 text-2xl ' + (used ? 'text-muted line-through decoration-1' : '') + '">' + esc(v.title) + '</h3>' +
      '<p class="mt-1 text-muted">' + esc(v.partner) + ' · reçu le ' + esc(date(v.issuedAt)) + '</p>' +
      (used
        ? '<button type="button" class="btn mt-6 w-full bg-card text-muted" disabled>Bon utilisé le ' + esc(date(v.usedAt)) + '</button>'
        : '<button type="button" class="btn-primary mt-6 w-full" data-action="consume" data-id="' + esc(v.id) + '">Consommer le bon</button>') +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Onglet Justificatifs
  // ------------------------------------------------------------------------
  function proofItem({ participation: p, mission: m }, name) {
    const t = typeOf(m.type);
    const proof = p.proof || {};
    return '<li class="card">' +
      proofPicture(p, name) +
      '<div class="p-5 sm:p-6">' +
        '<div class="flex flex-wrap items-center gap-x-3 gap-y-2">' +
          '<span class="tag ' + esc(t.color) + '">' + esc(t.label) + '</span>' +
          (proof.sentAt ? '<span class="text-sm text-muted">Envoyé le ' + esc(date(proof.sentAt)) + '</span>' : '') +
        '</div>' +
        '<h3 class="mt-3 text-xl sm:text-2xl">' + esc(m.title) + '</h3>' +
        '<p class="mt-1.5 text-[0.95rem]"><span class="font-semibold">' + esc(name) + '</span> · <span class="font-mono text-sm">' + esc(p.code) + '</span></p>' +
        (m.reward ? '<p class="mt-1 text-[0.95rem] text-muted">En échange : ' + esc(m.reward.title) + '</p>' : '') +
        historyWarning(p) +
        reviewControls(p) +
      '</div>' +
    '</li>';
  }

  function renderProofs(state) {
    const items = store.pendingProofs();
    const name = firstName(state.user);
    return '<section aria-labelledby="proofs-h">' +
      '<h2 id="proofs-h" tabindex="-1" class="text-3xl sm:text-4xl">Justificatifs à vérifier</h2>' +
      '<p class="mt-3 text-muted">Billet de train ou de car, réservation de covoiturage, photo à deux dans la voiture : vérifiez que la date et le trajet sont lisibles. Une fois validé, le bon part aussitôt dans l’espace du participant.</p>' +
      '<div class="mt-8 space-y-6">' +
        '<div aria-live="polite">' + flashBox('justificatifs') + '</div>' +
        (items.length
          ? '<ul class="space-y-6">' + items.map((x) => proofItem(x, name)).join('') + '</ul>'
          : '<p class="bg-sunk px-5 py-6 text-muted">Aucun justificatif en attente.</p>') +
      '</div>' +
    '</section>';
  }

  // ------------------------------------------------------------------------
  // Onglet Création de mission
  // ------------------------------------------------------------------------
  function renderCreate(pro) {
    const { SEASONS, TYPES, PROOFS } = Meleze.data;
    if (created) {
      const proof = PROOFS.find((x) => x.id === created.proof);
      // Bloc lime : boutons en noir explicite (lisibles aussi en mode sombre)
      return '<div class="bg-lime-300 p-6 text-night sm:p-8">' +
        '<p class="font-display font-bold">Mission publiée</p>' +
        '<h2 class="mt-2 text-3xl text-night sm:text-4xl">« ' + esc(created.title) + ' »</h2>' +
        '<p class="mt-3 max-w-xl text-night/75">Elle est visible dès maintenant dans le catalogue, avec sa contrepartie : ' + esc(created.reward.title) + '.' +
          (proof ? ' Validation : ' + esc(proof.label.charAt(0).toLowerCase() + proof.label.slice(1)) + '.' : '') + '</p>' +
        '<div class="mt-8 flex flex-wrap items-center gap-3">' +
          '<a href="#/missions?focus=' + esc(created.id) + '" class="btn bg-night text-white hover:opacity-85">Voir dans le catalogue' + icon('arrow', 'h-5 w-5') + '</a>' +
          '<button type="button" class="btn border-2 border-night bg-transparent text-night hover:bg-night hover:text-white" data-action="new-mission">Créer une autre mission</button>' +
        '</div>' +
      '</div>';
    }

    const PROOF_HINTS = {
      qr: 'Le référent scanne le QR du participant à la fin de la mission.',
      photo: 'Le participant envoie une photo (billet, réservation…), vérifiée dans l’onglet Justificatifs.',
    };
    const OPTION = 'flex min-h-[52px] cursor-pointer items-start gap-3 border-2 border-transparent bg-sunk px-4 py-3 transition-colors has-[:checked]:border-night has-[:checked]:bg-lime-200 has-[:checked]:text-night';

    return '<form class="space-y-6" data-form="create">' +
      '<fieldset class="card space-y-5 p-5 sm:p-7">' +
        '<legend class="' + LEGEND + '">La mission</legend>' +
        field('title', 'Intitulé', '<input class="field" id="title" name="title" required maxlength="80" placeholder="Ex. Nettoyer les berges du Doron">') +
        field('type', 'Type', '<select class="field" id="type" name="type" required>' + TYPES.map((t) => '<option value="' + esc(t.id) + '">' + esc(t.label) + '</option>').join('') + '</select>') +
        '<div><p class="label" id="proof-l">Validation</p><div class="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="proof-l">' +
          PROOFS.map((p, i) => '<label class="' + OPTION + '">' +
            '<input type="radio" name="proof" value="' + esc(p.id) + '" required' + (i === 0 ? ' checked' : '') + ' class="mt-0.5 h-5 w-5 shrink-0 accent-[#121614]">' +
            '<span class="min-w-0"><span class="block font-semibold leading-snug">' + esc(p.label) + '</span>' +
              (PROOF_HINTS[p.id] ? '<span class="mt-0.5 block text-sm leading-snug opacity-75">' + PROOF_HINTS[p.id] + '</span>' : '') +
            '</span></label>').join('') +
        '</div></div>' +
        '<div><p class="label" id="seasons-l">Saison(s)</p><div class="grid grid-cols-2 gap-2" role="group" aria-labelledby="seasons-l">' +
          SEASONS.map((s) => '<label class="flex min-h-[52px] cursor-pointer items-center gap-3 border-2 border-transparent bg-sunk px-4 font-semibold transition-colors has-[:checked]:border-night has-[:checked]:bg-lime-200 has-[:checked]:text-night">' +
            '<input type="checkbox" name="seasons" value="' + esc(s.id) + '" class="h-5 w-5 shrink-0 accent-[#121614]">' + esc(s.label) + '</label>').join('') +
        '</div></div>' +
        '<div class="grid grid-cols-2 gap-4">' +
          field('duration', 'Durée', '<select class="field" id="duration" name="duration">' +
            DURATIONS.map((d) => '<option value="' + d + '"' + (d === 90 ? ' selected' : '') + '>' + duration(d) + '</option>').join('') +
            '<option value="0">Le temps du trajet / variable</option>' +
          '</select>') +
          field('spots', 'Places', '<input class="field" id="spots" name="spots" type="number" min="1" max="500" value="10" inputmode="numeric">', 'Vide : sans limite') +
        '</div>' +
        field('location', 'Lieu de rendez-vous', '<input class="field" id="location" name="location" required placeholder="Ex. Pont de la Pêche">') +
        field('schedule', 'Quand ?', '<input class="field" id="schedule" name="schedule" placeholder="Ex. Samedi, 9h30">') +
        field('description', 'Description', '<textarea class="field min-h-[7rem]" id="description" name="description" required maxlength="400" placeholder="Ce que les participants vont faire, ce qu’il faut prévoir…"></textarea>') +
      '</fieldset>' +

      // Contrepartie : bloc mis en avant, champs obligatoires
      '<fieldset class="space-y-5 bg-tint p-5 sm:p-7 [&_.field]:bg-card">' +
        '<legend class="' + LEGEND + ' flex flex-wrap items-center gap-3">La contrepartie <span class="tag bg-lime-400">Obligatoire</span></legend>' +
        '<p class="text-muted">Chaque mission offre quelque chose en échange : c’est le principe de Mélèze.</p>' +
        field('rtitle', 'Ce que vous offrez', '<input class="field" id="rtitle" name="rtitle" required maxlength="80" placeholder="Ex. Une descente en luge">') +
        field('rpartner', 'Offert par', '<input class="field" id="rpartner" name="rpartner" required value="' + esc(pro.org) + '">') +
        field('rcat', 'Catégorie', '<select class="field" id="rcat" name="rcat">' + CATEGORIES.map((c) => '<option>' + esc(c) + '</option>').join('') + '</select>') +
        '<label class="flex cursor-pointer items-start gap-3"><input type="checkbox" name="commit" required class="mt-1 h-5 w-5 shrink-0 accent-[#121614]">Je m’engage à offrir cette contrepartie à chaque participant dont la mission est validée.</label>' +
      '</fieldset>' +

      '<button class="btn-primary w-full">Publier la mission</button>' +
    '</form>';
  }

  // ------------------------------------------------------------------------
  function render(state, params, sub) {
    const pro = store.pro;
    if (!pro) return renderLogin();
    const tab = tabOf(sub);
    currentTab = tab;
    const inner = tab === 'creer' ? renderCreate(pro) : tab === 'justificatifs' ? renderProofs(state) : renderScanner(state);
    return renderShell(pro, tab, inner, store.pendingProofs().length);
  }

  /** Après chaque rendu : caméra (re)branchée sur le nouveau <video>, focus éventuel. */
  function mounted(root, params, sub, app) {
    appRef = app;
    if (camera !== 'off') {
      if (store.pro && tabOf(sub) === 'scan') startCamera(root, app);
      else stopCamera(); // jamais de caméra allumée hors de l'onglet Scanner
    }
    const target = reveal && root.querySelector('#scan-result');
    reveal = false;
    if (target) target.scrollIntoView({ block: 'start' });
    if (focusAfter) {
      const list = [].concat(focusAfter);
      focusAfter = null;
      const el = list.map((sel) => root.querySelector(sel)).find(Boolean);
      if (el) {
        // Pas de saut de page si l'élément est déjà (au moins en partie) à l'écran
        const r = el.getBoundingClientRect();
        el.focus({ preventScroll: !!target || (r.bottom > 0 && r.top < window.innerHeight) });
      }
    }
  }

  /** Changement de page (ou d'onglet) : on coupe la caméra. */
  function unmount() {
    stopCamera();
    cameraError = null;
    flash = null;
    reveal = false;
  }

  const actions = {
    logout(el, app) {
      stopCamera();
      store.logout();
      scanned = flash = created = cameraError = null;
      app.go('#/');
    },
    'camera-start'(el, app) {
      if (!cameraAvailable()) {
        cameraError = 'La caméra n’est pas disponible sur cet appareil. Saisissez le code à la main.';
        app.rerender();
        return;
      }
      camera = 'starting';
      cameraError = null;
      scanned = null;
      flash = null;
      focusAfter = '[data-action="camera-stop"]';
      app.rerender(); // mounted() démarre la caméra sur le nouveau <video>
    },
    'camera-stop'(el, app) {
      stopCamera();
      focusAfter = '[data-action="camera-start"]';
      app.rerender();
    },
    'scan-demo'(el, app) {
      stopCamera();
      cameraError = null;
      scanned = normalize(el.dataset.code) || null;
      flash = null;
      showResult();
      app.rerender();
    },
    validate(el, app) {
      if (el.disabled) return; // double clic : une seule validation, un seul message
      el.disabled = true;
      const id = el.dataset.id;
      const v = store.validate(id);
      if (v) {
        flash = {
          tab: currentTab,
          pid: id,
          title: 'Mission validée',
          html: 'Le bon <span class="font-mono">' + esc(v.code) + '</span> (' + esc(v.title) + ') est arrivé dans l’espace du participant.',
        };
        focusAfter = '#pro-flash';
        toast('Mission validée');
      } else {
        toast('Cette mission ne peut pas être validée (déjà validée ?).', 'error');
      }
      app.rerender();
    },
    refuse(el, app) {
      if (el.disabled) return;
      el.disabled = true;
      const id = el.dataset.id;
      const select = document.querySelector('[data-reason-for="' + CSS.escape(id) + '"]');
      const p = store.refuse(id, select ? select.value : '');
      if (p) {
        flash = null;
        zoomed.delete(id);
        focusAfter = currentTab === 'justificatifs' ? '#proofs-h' : null;
        toast('Justificatif refusé. Le participant peut en envoyer un autre.');
      } else {
        toast('Ce justificatif n’est plus en attente.', 'error');
      }
      app.rerender();
    },
    'proof-zoom'(el, app) {
      const id = el.dataset.id;
      if (zoomed.has(id)) zoomed.delete(id); else zoomed.add(id);
      app.rerender();
    },
    consume(el, app) {
      if (el.disabled) return;
      el.disabled = true;
      const v = store.consume(el.dataset.id);
      if (v) {
        flash = null;
        focusAfter = '#scan-result';
        toast('Bon consommé. Bonne journée !');
      } else {
        toast('Ce bon a déjà été utilisé.', 'error');
      }
      app.rerender();
    },
    'new-mission'(el, app) { created = null; app.rerender(); },
  };

  const forms = {
    login(form, app) {
      const f = new FormData(form);
      const demo = Meleze.data.proDemo;
      if (String(f.get('pin')) !== demo.pin) {
        toast('Code PIN incorrect (pour la démo : ' + demo.pin + ')', 'error');
        form.pin.focus();
        return;
      }
      if (!String(f.get('org')).trim()) { form.org.focus(); return; }
      store.login({ email: String(f.get('email')), role: String(f.get('role')), org: String(f.get('org')).trim() });
      toast('Vous êtes connecté·e');
      app.go('#/pro/scan');
    },
    scan(form, app) {
      stopCamera();
      cameraError = null;
      scanned = normalize(new FormData(form).get('code')) || null;
      flash = null;
      if (scanned) showResult();
      app.rerender();
    },
    create(form, app) {
      const f = new FormData(form);
      const seasons = f.getAll('seasons');
      if (!seasons.length) {
        toast('Choisissez au moins une saison.', 'error');
        form.querySelector('[name="seasons"]').focus();
        return;
      }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const t = (k) => String(f.get(k) || '').trim();
      const type = t('type');
      const minutes = Math.max(0, Number(f.get('duration')) || 0);
      const spots = Math.round(Number(t('spots')));
      const input = {
        title: t('title'),
        type,
        proof: f.get('proof') === 'photo' ? 'photo' : 'qr',
        seasons,
        duration: minutes,
        spots: t('spots') && spots > 0 ? spots : null,
        location: t('location'),
        schedule: t('schedule'),
        description: t('description'),
        host: store.pro.org,
        reward: { title: t('rtitle'), partner: t('rpartner'), category: t('rcat') },
      };
      if (!minutes) input.durationLabel = type === 'mobilite' ? 'Le temps du trajet' : 'Durée variable';
      created = store.addMission(input);
      toast('Mission publiée dans le catalogue');
      // Même hash → nouveau rendu complet : retour en haut, sur la confirmation
      app.go('#/pro/creer');
    },
  };

  return { title: 'Espace pro', render, actions, forms, mounted, unmount };
})();
