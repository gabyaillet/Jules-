/* ==========================================================================
   Vue : Espace Pro / Partenaire
   - Connexion simulée (rôle + structure)
   - Onglet "Scanner"       : caméra (Meleze.scanner) ou saisie du code ;
                              l'écran s'adapte au code lu (QR d'une mission
                              ou bon de récompense)
   - Onglet "Justificatifs" : photos envoyées pour les missions « photo »
                              (transport), à valider ou à refuser
   - Onglet "Créer"         : mission + contrepartie obligatoire, publiée aussitôt
   Mise en page : peu de texte, des APLATS pleins plutôt que des filets
   (noir = scanner et en-tête de fiche, gris clair = détails et formulaires,
   vert = succès, bon valable et contrepartie, rouge = alerte).
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

  // Étiquettes posées sur l'en-tête noir de la fiche : vert = à traiter, rouge = bloqué.
  // Rouge : texte couleur du fond (blanc en clair, quasi noir en sombre, où le rouge s'éclaircit)
  const STATUS = {
    inscrite: { label: 'Inscrit·e', color: 'bg-forest text-white' },
    preuve: { label: 'Justificatif à vérifier', color: 'bg-forest text-white' },
    refusee: { label: 'Justificatif refusé', color: 'bg-danger text-surface' },
    validee: { label: 'Déjà validée', color: 'bg-danger text-surface' },
  };

  // Conteneur commun : même rythme vertical que les autres pages
  const WRAP = 'mx-auto px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16';
  const LEGEND = 'float-left mb-2 w-full font-display text-3xl font-bold leading-tight tracking-[-0.03em]';
  /** Gros bouton d'action principal (valider, publier, se connecter). */
  const BIG = 'min-h-[64px] w-full text-xl';
  /** Bouton contour blanc, sur les aplats noirs ou verts. */
  const BTN_WHITE = 'btn border-2 border-white bg-transparent text-white hover:bg-white hover:text-night focus-visible:outline-white';
  /** Champ blanc dans un aplat vert ou gris (lisible dans les deux thèmes). */
  const FIELD_ON_GREEN = 'field bg-white text-night [color-scheme:light] placeholder:text-night/60 focus:border-night focus:bg-white';
  const FIELD_ON_GREY = 'field bg-surface';

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

  /** Champ de formulaire. `labelCls` : couleur du libellé sur un aplat (ex. text-white). */
  function field(id, label, control, hint, labelCls) {
    return '<div><label class="label text-lg' + (labelCls ? ' ' + labelCls : '') + '" for="' + id + '">' + label + '</label>' + control + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
  }

  /** Petit trait vert + libellé : en-tête des pages pro. */
  const kicker = (text, size) =>
    '<p class="flex min-w-0 items-center gap-2.5 font-display ' + (size || 'text-base') + ' font-bold leading-tight text-ink">' +
      '<span class="h-[3px] w-6 shrink-0 bg-accent" aria-hidden="true"></span><span class="min-w-0">' + text + '</span></p>';

  /** "En échange : …" sur une ligne (la contrepartie que recevra le participant). */
  function rewardLine(m) {
    if (!m.reward) return '';
    return '<p class="text-lg leading-snug"><span class="text-muted">En échange :</span> <span class="font-bold">' + esc(m.reward.title) + '</span></p>';
  }

  /** Succès (mission validée…) : bloc vert plein, texte blanc. */
  function flashBox(tab) {
    if (!flash || flash.tab !== tab) return '';
    return '<div id="pro-flash" tabindex="-1" class="bg-forest p-6 text-white sm:p-7">' +
      '<p class="font-display text-2xl font-bold leading-tight">' + flash.title + '</p>' +
      '<p class="mt-2 text-lg">' + flash.html + '</p>' +
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
      kicker('Espace partenaires') +
      '<h1 id="page-title" tabindex="-1" class="mt-6 text-5xl font-extrabold sm:text-6xl">Connexion <span class="mark">pro</span></h1>' +
      '<p class="mt-4 text-lg text-ink">Scannez les QR, encaissez les bons, publiez des missions.</p>' +
      // Aplat noir : l'info utile pour la démo, visible sans défiler
      '<p class="mt-8 bg-ink px-5 py-4 font-display text-lg font-bold text-surface">Démo : PIN ' + esc(demo.pin) + '</p>' +
      '<form class="mt-6 space-y-5" data-form="login" novalidate>' +
        field('email', 'E-mail professionnel', '<input class="field" id="email" name="email" type="email" autocomplete="username" required value="' + esc(demo.email) + '">') +
        field('pin', 'Code PIN', '<input class="field tracking-[0.4em]" id="pin" name="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" required placeholder="••••">') +
        field('role', 'Je suis', '<select class="field" id="role" name="role">' + ROLES.map((r) => '<option>' + esc(r) + '</option>').join('') + '</select>') +
        field('org', 'Structure', '<input class="field" id="org" name="org" required value="Téléphérique du Mont Bochor">') +
        '<button class="btn-primary ' + BIG + '">Se connecter</button>' +
      '</form>' +
      '<a href="#/" class="link mt-8">Retour au site</a>' +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Coquille connectée + onglets
  // ------------------------------------------------------------------------
  function renderShell(pro, tab, inner, pending) {
    // Onglets : trois aplats (gris clair), l'onglet actif en noir plein. Largeur
    // suivant le libellé sur mobile (« Justificatifs » + pastille), égale ensuite.
    const tabLink = (id, label, extra, aria) =>
      '<a href="#/pro/' + id + '"' + (aria ? ' aria-label="' + aria + '"' : '') + ' class="flex min-h-[56px] flex-auto items-center justify-center gap-1.5 px-3 py-2 text-center font-display text-base font-bold leading-tight transition-colors sm:flex-1 ' +
      (tab === id ? 'bg-ink text-surface' : 'bg-sunk text-ink hover:bg-line') + '"' + (tab === id ? ' aria-current="page"' : '') + '>' + label + (extra || '') + '</a>';
    const count = pending
      ? '<span class="inline-flex min-w-[1.5rem] shrink-0 items-center justify-center rounded-full bg-forest px-1.5 text-sm font-bold leading-[1.5rem] text-white">' + pending + '<span class="sr-only"> en attente</span></span>'
      : '';

    return '<div class="' + WRAP + ' max-w-2xl">' +
      // Rôle et déconnexion sur une seule ligne à 390 px
      '<div class="flex items-center justify-between gap-3">' +
        kicker(esc(pro.role), 'text-[0.95rem]') +
        '<button type="button" class="link min-h-[44px] shrink-0 text-[0.95rem]" data-action="logout">Se déconnecter</button>' +
      '</div>' +
      '<h1 id="page-title" tabindex="-1" class="mt-4 break-words text-[2.5rem] font-extrabold sm:text-5xl">' + esc(pro.org) + '</h1>' +
      '<nav class="mt-8 flex gap-1" aria-label="Outils pro">' +
        tabLink('scan', 'Scanner') + tabLink('justificatifs', 'Justificatifs', count) + tabLink('creer', 'Créer<span class="hidden sm:inline"> une mission</span>', '', 'Créer une mission') +
      '</nav>' +
      '<div class="mt-8">' + inner + '</div>' +
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
      inner = corners + '<p class="absolute inset-0 flex items-center justify-center px-12 text-center font-display text-lg font-bold leading-tight text-white">' +
        (canCamera ? 'Activez la caméra' : 'Saisissez le code') + '</p>';
    }
    return '<div class="scan-frame">' + inner + '</div>';
  }

  function renderScanner(state) {
    const canCamera = cameraAvailable();
    // Contrôles posés sur l'aplat noir du viseur : contour blanc pour lisibilité
    const control = canCamera
      ? (camera !== 'off'
        ? '<button type="button" class="' + BTN_WHITE + ' w-full" data-action="camera-stop">Arrêter la caméra</button>'
        : '<button type="button" class="btn-primary w-full focus-visible:outline-white" data-action="camera-start">Activer la caméra</button>')
      : '<p class="text-center text-base leading-snug text-white">Caméra indisponible ici (https requis). Saisissez le code.</p>';
    const error = cameraError
      ? '<p class="bg-danger px-4 py-3 font-semibold leading-snug text-surface" role="alert">' + esc(cameraError) + '</p>'
      : '';
    const demos = demoCodes(state);

    return '<section aria-labelledby="scan-h">' +
      '<h2 id="scan-h" class="sr-only">Scanner un QR code</h2>' +
      '<div class="grid gap-3 sm:grid-cols-2 sm:items-start">' +
        // Aplat noir : le viseur et son bouton
        '<div class="flex flex-col gap-4 bg-night p-5 text-white sm:p-6">' + scanFrame(canCamera) + control + error + '</div>' +

        // Aplat gris : saisie du code + QR de démo
        '<div class="min-w-0 bg-sunk p-5 sm:p-6">' +
          '<form class="flex flex-col gap-3" data-form="scan">' +
            '<label for="code" class="font-display text-xl font-bold leading-tight">Code du QR ou du bon</label>' +
            '<input class="' + FIELD_ON_GREY + ' min-w-0 font-mono text-lg uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal" id="code" name="code" placeholder="MLZ-…" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(scanned || '') + '">' +
            '<button class="btn-primary w-full">Lire</button>' +
          '</form>' +
          (demos.length
            ? '<p class="mt-7 font-display text-lg font-bold">QR de démo</p>' +
              '<div class="mt-3 flex flex-wrap gap-2">' +
                demos.map((d) => '<button type="button" class="chip" data-action="scan-demo" data-code="' + esc(d.code) + '" aria-pressed="' + (scanned === d.code) + '">' + esc(d.label) + '</button>').join('') +
              '</div>'
            : '') +
        '</div>' +
      '</div>' +

      '<div id="scan-result" tabindex="-1" class="mt-8 scroll-mt-24 space-y-3 outline-none" aria-live="polite">' + flashBox('scan') + (scanned ? renderResult(store.lookup(scanned)) : '') + '</div>' +
    '</section>';
  }

  /** Le cœur "intelligent" : l'écran s'adapte à la nature du code lu. */
  function renderResult(r) {
    if (r.kind === 'unknown') {
      return '<div class="bg-danger p-6 text-surface sm:p-7">' +
        '<p class="font-display text-2xl font-bold leading-tight">Code inconnu</p>' +
        '<p class="mt-2 break-words text-lg">« ' + esc(r.code) + ' » ne correspond à aucun QR ni bon.</p>' +
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

  /** Alerte anti-triche (aplat rouge) : ce participant a déjà validé cette mission. */
  function historyWarning(p, photo) {
    const h = history(p);
    if (!h) return '';
    return '<p class="bg-danger px-5 py-4 text-lg leading-snug text-surface">' +
      '<span class="font-bold">Déjà fait :</span> ' + historyText(h) + '.' + (photo ? ' Vérifiez la date du trajet.' : '') +
    '</p>';
  }

  /** Mission déjà validée : pas de bouton, le bon n'est émis qu'une fois. */
  function alreadyBox(p) {
    return '<div class="bg-danger p-5 text-surface sm:p-6">' +
      '<p class="font-display text-xl font-bold leading-tight">Mission déjà validée' + (p.validatedAt ? ' le ' + esc(date(p.validatedAt)) : '') + '</p>' +
      '<p class="mt-1 text-lg">Le bon n’est émis qu’une fois.</p>' +
    '</div>';
  }

  /** Photo du justificatif (carrée, sur fond noir), agrandissable d'un geste. */
  function proofPicture(p, name) {
    const img = p.proof && p.proof.image;
    if (!img) {
      return '<p class="bg-night px-5 py-8 text-center text-lg text-white">Photo indisponible : à renvoyer par le participant.</p>';
    }
    const big = zoomed.has(p.id);
    return '<button type="button" class="relative block w-full bg-night" data-action="proof-zoom" data-id="' + esc(p.id) + '">' +
      '<img src="' + esc(img) + '" alt="Justificatif envoyé par ' + esc(name) + '" class="block w-full object-contain ' + (big ? 'h-auto' : 'h-64') + '" decoding="async">' +
      '<span class="tag absolute bottom-3 right-3 bg-white">' + (big ? 'Réduire' : 'Agrandir') + '</span>' +
    '</button>';
  }

  /** Motif de refus + Valider / Refuser (dans un aplat gris). */
  function reviewControls(p) {
    const id = esc(p.id);
    return '<div class="space-y-4">' +
      '<div>' +
        '<label class="label" for="reason-' + id + '">Motif si refus</label>' +
        '<select class="' + FIELD_ON_GREY + '" id="reason-' + id + '" data-reason-for="' + id + '">' +
          REASONS.map((r) => '<option>' + esc(r) + '</option>').join('') +
        '</select>' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-3">' +
        '<button type="button" class="btn-primary" data-action="validate" data-id="' + id + '">Valider</button>' +
        '<button type="button" class="btn-secondary" data-action="refuse" data-id="' + id + '">Refuser</button>' +
      '</div>' +
    '</div>';
  }

  /** QR d'une participation : une mission, un participant, un statut. */
  function participationResult(r) {
    const p = r.participation, m = r.mission, t = typeOf(m.type);
    const isPhoto = m.proof === 'photo';
    const name = firstName(r.user);
    const justValidated = p.status === 'validee' && flash && flash.pid === p.id;
    const st = justValidated ? { label: 'Validée', color: 'bg-forest text-white' } : (STATUS[p.status] || { label: p.status, color: 'bg-surface text-ink' });
    const meta = [missionDuration(m), m.location].filter(Boolean).map(esc).join(' · ');

    let body = '';
    if (p.status === 'validee') {
      body = justValidated ? '' : alreadyBox(p);
    } else if (isPhoto) {
      const proof = p.proof || {};
      let state = 'Pas encore de photo envoyée.';
      if (p.status === 'preuve') state = 'Photo envoyée' + (proof.sentAt ? ' le ' + esc(date(proof.sentAt)) : '') + ', à vérifier.';
      if (p.status === 'refusee') {
        state = 'Refusée' + (p.refusedReason ? ' (« ' + esc(p.refusedReason) + ' »)' : '') + '. En attente d’une nouvelle photo.';
      }
      body = '<div>' +
          '<p class="font-display text-xl font-bold leading-tight">Cette mission se valide avec un justificatif photo</p>' +
          '<p class="mt-2 text-lg leading-snug">' + state + '</p>' +
          '<a href="#/pro/justificatifs" class="link mt-3">Voir les justificatifs</a>' +
        '</div>' +
        (p.status === 'preuve' ? '<div class="space-y-5">' + proofPicture(p, name) + reviewControls(p) + '</div>' : '');
    } else if (p.status === 'inscrite') {
      body = '<button type="button" class="btn-primary ' + BIG + '" data-action="validate" data-id="' + esc(p.id) + '">Valider la mission</button>';
    } else {
      body = '<p class="text-lg">Cette participation ne peut pas être validée par QR.</p>';
    }

    // En-tête en aplat noir (type, statut, titre) puis aplat gris : participant,
    // contrepartie, alerte éventuelle et action
    return '<article>' +
      '<div class="bg-ink p-6 text-surface sm:p-7">' +
        '<div class="flex flex-wrap items-center gap-2">' +
          '<span class="tag bg-surface text-ink">' + esc(t.label) + '</span>' +
          '<span class="tag ' + esc(st.color) + '">' + esc(st.label) + '</span>' +
        '</div>' +
        '<h3 class="mt-4 break-words text-3xl sm:text-4xl">' + esc(m.title) + '</h3>' +
        (meta ? '<p class="mt-2 text-lg">' + meta + '</p>' : '') +
      '</div>' +
      '<div class="space-y-6 bg-sunk p-6 sm:p-7">' +
        '<div>' +
          '<p class="flex flex-wrap items-baseline gap-x-3 gap-y-1">' +
            '<span class="break-words font-display text-2xl font-bold">' + esc(name) + '</span>' +
            '<span class="font-mono text-lg font-semibold">' + esc(p.code) + '</span>' +
          '</p>' +
          '<div class="mt-2">' + rewardLine(m) + '</div>' +
        '</div>' +
        (p.status !== 'validee' ? historyWarning(p, isPhoto && p.status === 'preuve') : '') +
        body +
      '</div>' +
    '</article>';
  }

  /** Bon de récompense : consommation unique. Aplat vert si valable, gris si déjà utilisé. */
  function voucherResult(v) {
    if (v.status === 'consomme') {
      return '<article class="bg-sunk p-6 sm:p-7">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
          '<span class="tag bg-danger text-surface">Déjà utilisé</span>' +
          '<span class="font-mono font-semibold tracking-[0.08em]">' + esc(v.code) + '</span>' +
        '</div>' +
        '<h3 class="mt-4 break-words text-3xl text-muted line-through decoration-2 sm:text-4xl">' + esc(v.title) + '</h3>' +
        '<p class="mt-2 text-lg text-muted">' + esc(v.partner) + '</p>' +
        // Désactivé mais lisible : la date d'utilisation est l'info utile
        '<button type="button" class="btn mt-6 w-full bg-surface text-muted disabled:opacity-100" disabled>Bon utilisé le ' + esc(date(v.usedAt)) + '</button>' +
      '</article>';
    }
    return '<article class="bg-forest p-6 text-white sm:p-7">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '<span class="tag bg-white">Bon valable</span>' +
        '<span class="font-mono font-semibold tracking-[0.08em]">' + esc(v.code) + '</span>' +
      '</div>' +
      '<h3 class="mt-4 break-words text-3xl text-white sm:text-4xl">' + esc(v.title) + '</h3>' +
      '<p class="mt-2 text-lg">' + esc(v.partner) + ' · reçu le ' + esc(date(v.issuedAt)) + '</p>' +
      '<button type="button" class="btn-light mt-6 ' + BIG + ' focus-visible:outline-white" data-action="consume" data-id="' + esc(v.id) + '">Consommer le bon</button>' +
    '</article>';
  }

  // ------------------------------------------------------------------------
  // Onglet Justificatifs
  // ------------------------------------------------------------------------
  function proofItem({ participation: p, mission: m }, name) {
    const t = typeOf(m.type);
    const proof = p.proof || {};
    // Photo sur fond noir, puis aplat gris : mission, participant, alerte, décision
    return '<li>' +
      proofPicture(p, name) +
      '<div class="space-y-6 bg-sunk p-6 sm:p-7">' +
        '<div>' +
          '<div class="flex flex-wrap items-center gap-x-3 gap-y-2">' +
            '<span class="tag ' + esc(t.color) + '">' + esc(t.label) + '</span>' +
            (proof.sentAt ? '<span class="font-display font-semibold">Envoyé le ' + esc(date(proof.sentAt)) + '</span>' : '') +
          '</div>' +
          '<h3 class="mt-4 break-words text-2xl sm:text-3xl">' + esc(m.title) + '</h3>' +
          '<p class="mt-2 text-lg"><span class="font-bold">' + esc(name) + '</span> · <span class="font-mono">' + esc(p.code) + '</span></p>' +
        '</div>' +
        historyWarning(p, true) +
        reviewControls(p) +
      '</div>' +
    '</li>';
  }

  function renderProofs(state) {
    const items = store.pendingProofs();
    const name = firstName(state.user);
    return '<section aria-labelledby="proofs-h">' +
      '<h2 id="proofs-h" tabindex="-1" class="text-3xl sm:text-4xl">Justificatifs à vérifier</h2>' +
      '<p class="mt-3 text-lg text-ink">Vérifiez la date et le trajet.</p>' +
      '<div class="mt-8 space-y-6">' +
        '<div aria-live="polite">' + flashBox('justificatifs') + '</div>' +
        (items.length
          ? '<ul class="space-y-8">' + items.map((x) => proofItem(x, name)).join('') + '</ul>'
          : '<p class="bg-sunk px-6 py-8 font-display text-xl font-bold">Aucun justificatif en attente.</p>') +
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
      // Bloc vert plein : boutons blancs explicites (lisibles aussi en mode sombre)
      return '<div class="bg-forest p-6 text-white sm:p-8">' +
        '<p class="font-display text-lg font-bold">Mission publiée</p>' +
        '<h2 class="mt-2 break-words text-3xl text-white sm:text-4xl">« ' + esc(created.title) + ' »</h2>' +
        '<p class="mt-3 text-lg text-white">Visible dans le catalogue.' +
          (proof ? ' Validation : ' + esc(/^[A-Z][a-zà-ÿ]/.test(proof.label) ? proof.label.charAt(0).toLowerCase() + proof.label.slice(1) : proof.label) + '.' : '') + '</p>' +
        '<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">' +
          '<a href="#/missions?focus=' + esc(created.id) + '" class="btn btn-light focus-visible:outline-white">Voir dans le catalogue' + icon('arrow', 'h-5 w-5') + '</a>' +
          '<button type="button" class="' + BTN_WHITE + '" data-action="new-mission">Créer une autre mission</button>' +
        '</div>' +
      '</div>';
    }

    const PROOF_HINTS = {
      qr: 'Le référent scanne le QR à la fin.',
      photo: 'Photo du billet, à vérifier dans Justificatifs.',
    };
    // Choix en aplats gris ; le choix coché passe en noir plein
    const OPTION = 'flex min-h-[56px] cursor-pointer gap-3 bg-sunk px-4 py-3.5 transition-colors has-[:checked]:bg-ink has-[:checked]:text-surface';
    const CHECK = 'h-5 w-5 shrink-0 accent-forest focus-visible:outline-brand';

    return '<form class="space-y-10" data-form="create">' +
      '<fieldset class="space-y-5">' +
        '<legend class="' + LEGEND + '">La mission</legend>' +
        field('title', 'Intitulé', '<input class="field" id="title" name="title" required maxlength="80" placeholder="Ex. Nettoyer les berges du Doron">') +
        field('type', 'Type', '<select class="field" id="type" name="type" required>' + TYPES.map((t) => '<option value="' + esc(t.id) + '">' + esc(t.label) + '</option>').join('') + '</select>') +
        '<div><p class="label text-lg" id="proof-l">Validation</p><div class="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="proof-l">' +
          PROOFS.map((p, i) => '<label class="' + OPTION + ' items-start">' +
            '<input type="radio" name="proof" value="' + esc(p.id) + '" required' + (i === 0 ? ' checked' : '') + ' class="mt-1 ' + CHECK + '">' +
            '<span class="min-w-0"><span class="block font-display text-lg font-bold leading-snug">' + esc(p.label) + '</span>' +
              (PROOF_HINTS[p.id] ? '<span class="mt-0.5 block leading-snug">' + PROOF_HINTS[p.id] + '</span>' : '') +
            '</span></label>').join('') +
        '</div></div>' +
        '<div><p class="label text-lg" id="seasons-l">Saison(s)</p><div class="grid grid-cols-2 gap-2" role="group" aria-labelledby="seasons-l">' +
          SEASONS.map((s) => '<label class="' + OPTION + ' items-center font-display text-lg font-bold">' +
            '<input type="checkbox" name="seasons" value="' + esc(s.id) + '" class="' + CHECK + '">' + esc(s.label) + '</label>').join('') +
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
        field('description', 'Description', '<textarea class="field min-h-[7rem]" id="description" name="description" required maxlength="400" placeholder="Ce que les participants vont faire…"></textarea>') +
      '</fieldset>' +

      // Contrepartie : aplat vert plein, champs blancs, obligatoire
      '<fieldset class="space-y-5 bg-forest p-5 text-white sm:p-7">' +
        '<legend class="' + LEGEND + ' flex flex-wrap items-center gap-3 text-white">La contrepartie <span class="tag bg-white">Obligatoire</span></legend>' +
        field('rtitle', 'Ce que vous offrez', '<input class="' + FIELD_ON_GREEN + '" id="rtitle" name="rtitle" required maxlength="80" placeholder="Ex. Une descente en luge">', '', 'text-white') +
        field('rpartner', 'Offert par', '<input class="' + FIELD_ON_GREEN + '" id="rpartner" name="rpartner" required value="' + esc(pro.org) + '">', '', 'text-white') +
        field('rcat', 'Catégorie', '<select class="' + FIELD_ON_GREEN + '" id="rcat" name="rcat">' + CATEGORIES.map((c) => '<option>' + esc(c) + '</option>').join('') + '</select>', '', 'text-white') +
        '<label class="flex cursor-pointer items-start gap-3 text-lg font-semibold leading-snug text-white">' +
          '<input type="checkbox" name="commit" required class="mt-1 h-5 w-5 shrink-0 accent-night [color-scheme:light] focus-visible:outline-white">' +
          'Je m’engage à l’offrir à chaque participant validé.</label>' +
      '</fieldset>' +

      '<button class="btn-primary ' + BIG + '">Publier la mission</button>' +
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
          html: 'Le bon <span class="font-mono font-semibold">' + esc(v.code) + '</span> est arrivé dans l’espace du participant.',
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
