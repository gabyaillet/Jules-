/* ==========================================================================
   Vue : Mon espace (missions et bons du touriste)
   Peu de texte, de grands blocs pleins : une carte par mission en cours
   (photo + titre, puis un bloc gris : ce que la photo doit montrer et UNE
   action, « Prendre la photo »), puis les bons (blocs verts). La photo est
   prise avec l'appareil photo intégré (js/camera.js) et vérifiée par le
   serveur (IA) : « Vérification… », puis bon émis, ou explication + reprise.
   Pas de prénom, pas de compte à créer : tout est lié à ce navigateur. Le
   touriste peut ajouter son e-mail (« Gardez vos bons ») pour retrouver ses
   bons sur un autre téléphone (« Retrouver mes bons »), avec un code à 6
   chiffres reçu par e-mail.
   Téléphone (< 768 px, concept « Cartes ») : la mission en cours devient un
   bloc quasi noir (vignette, pancarte, consigne en gras, gros bouton vert
   « Prendre la photo ») et chaque bon un bloc vert « à détacher » (code et
   « Utiliser mon bon » côte à côte). Même HTML, styles dans src/input.css.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.wallet = (function () {
  'use strict';
  const { esc, icon, photo, duration, date, dateTime, typeOf, toast, spinner, notice, soon } = Meleze.ui;
  const store = Meleze.store;
  const MAX_ATTEMPTS = Meleze.data.MAX_ATTEMPTS;
  const s = (n) => (n > 1 ? 's' : '');

  /**
   * Vérifications de cette visite, par participation :
   *   { phase: 'verifying' | 'invalid' | 'error' | 'valid', photo?, reason?, message?, voucherId? }
   * La photo n'est gardée qu'en mémoire (pour « Réessayer l’envoi »), jamais enregistrée.
   */
  const checks = {};
  const busy = new Set(); // actions en cours (annuler, utiliser un bon, supprimer) : pas de double envoi
  let focusAfter = null; // sélecteur à focaliser après le prochain rendu
  /**
   * Panneau e-mail ouvert, ou null :
   *   { mode: 'save' (ajouter son e-mail) | 'recover' (retrouver ses bons),
   *     step: 'email' | 'code', email, code, busy, error }
   */
  let mail = null;

  // ------------------------------------------------------------------------
  // Missions en cours
  // ------------------------------------------------------------------------
  const BTN_LINK = 'min-h-[44px] font-display text-base font-semibold text-ink underline decoration-2 underline-offset-4 hover:text-brand-ink disabled:opacity-50';
  /** Bouton contour blanc, sur les aplats verts. */
  const BTN_WHITE = 'btn border-2 border-white bg-transparent text-white hover:bg-white hover:text-night focus-visible:outline-white';

  /** Ce que la photo doit montrer : la consigne écrite par le partenaire. */
  function hintBlock(m) {
    return '<p class="c-need-k font-display text-base font-semibold text-ink">La photo doit montrer :</p>' +
      '<p class="c-need-v mt-1 text-lg font-semibold leading-snug text-ink">' + esc(m.photoHint || 'La mission réalisée.') + '</p>';
  }

  /** Résultat de la dernière vérification (cette visite, sinon celui enregistré par le serveur). */
  function lastVerdict(p) {
    const c = checks[p.id];
    if (c) return c;
    const lc = p.lastCheck;
    if (lc && lc.valid === false && typeof lc.reason === 'string' && lc.reason.trim()) {
      return { phase: 'invalid', reason: lc.reason };
    }
    return null;
  }

  /** Zone de résultat (focalisée après chaque étape : les lecteurs d'écran la lisent). */
  function checkArea(p, c) {
    let inner = '';
    if (c && c.phase === 'verifying') {
      inner = '<div class="flex items-center gap-4 bg-ink p-5 text-surface">' +
          (c.photo ? '<img src="' + esc(c.photo) + '" alt="" class="h-16 w-16 shrink-0 rounded-2xl object-cover">' : '') +
          '<div><p class="flex items-center gap-3 font-display text-xl font-bold">' + spinner() + 'Vérification…</p>' +
          '<p class="mt-1 text-sm text-surface/75">Cela peut prendre jusqu’à une minute.</p></div>' +
        '</div>';
    } else if (c && c.phase === 'invalid') {
      inner = '<div class="bg-danger p-5 text-surface">' +
          '<p class="font-display text-xl font-bold">Photo non validée</p>' +
          '<p class="mt-1 text-lg leading-snug">' + esc(c.reason || 'Elle ne montre pas ce qui est demandé.') + '</p>' +
        '</div>';
    } else if (c && c.phase === 'error') {
      inner = '<div class="bg-ink p-5 text-surface">' +
          '<p class="font-display text-xl font-bold">Envoi impossible</p>' +
          '<p class="mt-1 text-lg leading-snug">' + esc(c.message || 'Réessayez dans un instant.') + '</p>' +
          // Code technique discret : à transmettre à l'équipe pour un diagnostic rapide.
          (c.tech ? '<p class="mt-2 text-sm text-surface/75">Code technique : ' + esc(c.tech) + '</p>' : '') +
        '</div>';
    }
    return '<div id="check-' + esc(p.id) + '" tabindex="-1" class="c-check mt-5 outline-none empty:hidden" aria-live="polite">' + inner + '</div>';
  }

  /**
   * Carte "mission en cours" : photo + type + titre, puis la consigne et l'action.
   * `m` : mission active, ou retirée (active === false), ou null si inconnue.
   */
  function activeCard(p, m) {
    const c = lastVerdict(p);
    const left = Math.max(0, MAX_ATTEMPTS - (Number(p.attempts) || 0));
    const verifying = c && c.phase === 'verifying';
    const retired = !m || m.active === false;
    const id = esc(p.id);
    const header = m
      ? '<div class="c-shoot-head flex items-center gap-4">' +
          '<div class="c-shoot-ph ph ph-sm aspect-square w-20 shrink-0 sm:w-24">' + photo(m, { sizes: '100px', alt: '' }) + '</div>' +
          '<div class="min-w-0 flex-1">' +
            '<span class="c-sign tag tag-sign ' + esc(typeOf(m.type).color) + '">' + esc(typeOf(m.type).label) + '</span>' +
            '<h3 class="c-shoot-title mt-2 text-2xl leading-[1.05] sm:text-[1.75rem]">' + esc(m.title) + '</h3>' +
            (retired ? '<span class="c-retired tag mt-2 bg-sunk text-ink">Mission retirée</span>' : '') +
          '</div>' +
        '</div>'
      : '<h3 class="c-shoot-title text-2xl leading-[1.05] sm:text-[1.75rem]">Mission retirée</h3>';

    let body;
    if (retired) {
      body = '<p class="text-lg leading-snug text-ink">Le partenaire a retiré cette mission : elle ne peut plus être validée.</p>';
    } else {
      let actions;
      if (verifying) {
        actions = ''; // pas de second envoi pendant la vérification
      } else if (c && c.phase === 'error' && c.photo) {
        actions = '<div class="flex flex-col gap-3 sm:flex-row">' +
            '<button type="button" class="btn-primary min-h-[60px] w-full text-lg sm:w-auto" data-action="resend" data-id="' + id + '">Réessayer l’envoi</button>' +
            '<button type="button" class="btn-secondary min-h-[60px] w-full text-lg sm:w-auto" data-action="photo" data-id="' + id + '">' + icon('camera', 'md:hidden') + 'Reprendre la photo</button>' +
          '</div>';
      } else if (left > 0) {
        actions = '<button type="button" class="btn-primary min-h-[60px] w-full text-lg sm:w-auto" data-action="photo" data-id="' + id + '">' +
          icon('camera', 'md:hidden') + (c && (c.phase === 'invalid' || c.phase === 'error') ? 'Reprendre la photo' : 'Prendre la photo') + '</button>';
      } else {
        actions = '<p class="font-display text-lg font-bold text-ink">Vous avez utilisé vos ' + MAX_ATTEMPTS + ' essais pour cette mission.</p>';
      }
      body = hintBlock(m) +
        checkArea(p, c) +
        (actions ? '<div class="c-shoot-actions mt-5">' + actions + '</div>' : '') +
        // Téléphone : rappel sous le bouton, comme sur la maquette
        (left > 0 && !verifying ? '<p class="c-shoot-note md:hidden">Une IA la vérifie en quelques secondes</p>' : '') +
        (left > 0 && !verifying
          ? '<p class="c-tries mt-3 text-base text-ink">' + (left === MAX_ATTEMPTS ? left + ' essais possibles' : 'Encore ' + left + ' essai' + s(left)) + '</p>'
          : '');
    }

    return '<li class="c-shoot flex flex-col" id="participation-' + id + '">' +
      header +
      '<div class="c-shoot-body mt-5 bg-sunk p-6">' + body + '</div>' +
      (verifying ? '' : '<div class="c-shoot-cancel mt-2"><button type="button" class="' + BTN_LINK + '" data-action="cancel" data-id="' + id + '"' + (busy.has('cancel:' + p.id) ? ' disabled' : '') + '>Annuler ma participation</button></div>') +
    '</li>';
  }

  /** Mission tout juste validée (cette visite) : succès en vert plein + accès au bon. */
  function successCard(p, m, c) {
    const v = store.state.vouchers.find((x) => x.id === c.voucherId || x.participationId === p.id);
    const id = esc(p.id);
    return '<li class="flex flex-col" id="participation-' + id + '">' +
      '<div id="check-' + id + '" tabindex="-1" class="c-win bg-forest p-6 text-white outline-none sm:p-7" aria-live="polite">' +
        '<p class="c-win-k font-display text-base font-semibold">' + esc(m ? m.title : 'Mission') + '</p>' +
        '<p class="c-win-h mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.02em]">' +
          '<span class="c-win-ok md:hidden" aria-hidden="true">' + icon('check') + '</span>Mission validée !</p>' +
        (c.reason ? '<p class="mt-2 text-lg leading-snug">' + esc(c.reason) + '</p>' : '') +
        (v
          ? '<p class="mt-5 text-lg">Votre cadeau : <span class="font-bold">' + esc(v.title) + '</span>, offert par ' + esc(v.partner) + '.</p>'
          : '<p class="mt-5 text-lg">Votre bon arrive dans « Mes bons ».</p>') +
        '<div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap empty:hidden">' +
          (v ? '<button type="button" class="btn-light w-full focus-visible:outline-white sm:w-auto" data-action="show-voucher" data-id="' + esc(v.id) + '">Voir mon bon ' + icon('arrow', 'h-5 w-5') + '</button>' : '') +
          // Juste après le gain : proposer de garder ses bons avec un e-mail (facultatif)
          (!store.state.email && !mail
            ? '<button type="button" class="' + BTN_WHITE + ' w-full sm:w-auto" data-action="mail-open" data-mode="save">Gardez vos bons : ajoutez votre e-mail</button>'
            : '') +
        '</div>' +
      '</div>' +
    '</li>';
  }

  // ------------------------------------------------------------------------
  // Bons
  // ------------------------------------------------------------------------
  /**
   * Bon valable : bloc vert plein, code lisible, « Utiliser mon bon » devant le partenaire.
   * `live` : données confirmées par le serveur pendant cette visite. Sinon (copie
   * locale, modifiable sur le téléphone), ni bouton « Utiliser », ni bloc
   * « Bon utilisé » présenté comme une preuve.
   */
  /** Téléphone : petit libellé « Code » au-dessus du code (le lecteur d'écran lit « Code du bon : »). */
  const CODE_K = '<span class="c-vch-codek md:hidden" aria-hidden="true">Code</span>';

  function voucherCard(v, state) {
    const id = esc(v.id);
    const live = state.confirmed;
    if (!live) {
      const loading = state.status === 'loading' || state.status === 'idle';
      return '<li id="voucher-' + id + '" tabindex="-1" class="c-vch c-vch-off flex flex-col bg-sunk p-6 text-ink outline-none">' +
        '<p class="c-vch-partner font-display text-base font-semibold">' + esc(v.partner) + '</p>' +
        '<h3 class="c-vch-title mt-3 text-[1.75rem] leading-[1.05] tracking-[-0.025em]">' + esc(v.title) + '</h3>' +
        '<p class="c-vch-code mt-auto pt-7 font-mono text-2xl font-bold tracking-[0.14em] text-muted"><span class="sr-only">Code du bon : </span>' + CODE_K + esc(v.code) + '</p>' +
        '<p class="c-vch-state mt-4 flex items-center gap-3 font-display text-base font-semibold">' +
          (loading ? spinner('h-5 w-5') + 'Vérification du bon…'
            : (v.usedAt ? 'Utilisé le ' + esc(dateTime(v.usedAt)) + '. ' : '') + 'Connexion nécessaire pour vérifier ce bon.') +
        '</p>' +
      '</li>';
    }
    if (v.usedAt) {
      // Bon utilisé : aplat vert « Bon utilisé » + date et heure (preuve pour le partenaire)
      return '<li id="voucher-' + id + '" tabindex="-1" class="c-vch c-vch-off flex flex-col bg-sunk p-6 outline-none">' +
        '<div class="c-vch-stamp bg-forest px-5 py-4 text-white">' +
          '<p class="font-display text-2xl font-bold leading-tight">Bon utilisé</p>' +
          '<p class="mt-1 font-display text-lg font-semibold">le ' + esc(dateTime(v.usedAt)) + '</p>' +
        '</div>' +
        '<p class="c-vch-partner mt-5 font-display text-base font-semibold text-ink">' + esc(v.partner) + '</p>' +
        '<h3 class="c-vch-title mt-2 text-2xl leading-[1.05] tracking-[-0.025em] text-ink">' + esc(v.title) + '</h3>' +
        '<p class="c-vch-code mt-4 font-mono text-lg font-bold tracking-[0.12em] text-muted">' + CODE_K + esc(v.code) + '</p>' +
      '</li>';
    }
    const working = busy.has('use:' + v.id);
    return '<li id="voucher-' + id + '" tabindex="-1" class="c-vch flex flex-col bg-forest p-6 text-white outline-none">' +
      // Téléphone : « Bon cadeau » + « À utiliser », puis le titre, le partenaire et un filet pointillé
      '<p class="c-vch-k md:hidden" aria-hidden="true"><span>' + icon('gift') + 'Bon cadeau</span><span class="c-vch-pill">À utiliser</span></p>' +
      '<p class="c-vch-partner font-display text-base font-semibold">' + esc(v.partner) + '</p>' +
      '<h3 class="c-vch-title mt-3 text-[1.75rem] leading-[1.05] tracking-[-0.025em]">' + esc(v.title) + '</h3>' +
      '<div class="c-vch-cut md:hidden" aria-hidden="true"></div>' +
      '<p class="c-vch-code mt-auto pt-7 font-mono text-2xl font-bold tracking-[0.14em]"><span class="sr-only">Code du bon : </span>' + CODE_K + esc(v.code) + '</p>' +
      '<button type="button" class="c-vch-use btn-light mt-5 w-full focus-visible:outline-white" data-action="use" data-id="' + id + '"' + (working ? ' disabled aria-busy="true"' : '') + '>' +
        (working ? spinner('h-5 w-5') + 'Validation…' : 'Utiliser mon bon') + '</button>' +
      '<p class="c-vch-note mt-3 text-base">À faire devant le partenaire.</p>' +
    '</li>';
  }

  // ------------------------------------------------------------------------
  // E-mail (facultatif) : garder ses bons, les retrouver sur un autre téléphone
  // ------------------------------------------------------------------------
  const LOST_WARNING = 'Les missions et les bons non sauvegardés de cet appareil seront perdus.';

  /** Panneau ouvert : adresse, puis code reçu. */
  function mailPanel(state) {
    const save = mail.mode === 'save';
    const title = save ? 'Gardez vos bons' : 'Retrouver mes bons';
    const err = mail.error
      ? '<p id="mail-err" class="bg-danger px-4 py-3 font-semibold leading-snug text-surface" role="alert">' + esc(mail.error) + '</p>'
      : '';
    const invalid = mail.error ? ' aria-invalid="true"' : '';
    const working = mail.busy ? ' disabled aria-busy="true"' : '';
    let body;
    if (mail.step === 'email') {
      body = '<p class="mt-2 max-w-xl text-lg leading-snug text-ink">' +
          (save ? 'Ajoutez votre e-mail : vous retrouverez vos bons sur un autre téléphone.' : 'Recevez un code sur l’e-mail de vos bons.') + '</p>' +
        (!save && store.hasUnsavedData()
          ? '<p class="mt-4 bg-ink px-4 py-3 font-display text-base font-semibold leading-snug text-surface">' + esc(LOST_WARNING) + '</p>'
          : '') +
        '<form class="mt-6 max-w-md space-y-4" data-form="mail-send" novalidate>' +
          '<div><label class="label text-lg" for="mail-email">Votre e-mail</label>' +
            '<input class="field bg-surface" id="mail-email" name="email" type="email" inputmode="email" autocomplete="email" required maxlength="254" data-keep="email" value="' + esc(mail.email) + '"' +
            invalid + (mail.error ? ' aria-describedby="mail-err"' : '') + '></div>' +
          err +
          '<div class="flex flex-col gap-3 sm:flex-row">' +
            '<button class="btn-primary"' + working + '>' + (mail.busy ? spinner('h-5 w-5') + 'Envoi…' : 'Recevoir un code') + '</button>' +
            '<button type="button" class="btn-secondary" data-action="mail-close">Annuler</button>' +
          '</div>' +
        '</form>';
    } else {
      body = '<p class="mt-4 max-w-xl bg-surface px-5 py-4 text-lg leading-snug text-ink" role="status">Code envoyé à <span class="break-words font-bold">' + esc(mail.email) + '</span>. Pensez aux courriers indésirables.</p>' +
        '<form class="mt-6 max-w-md space-y-4" data-form="mail-verify" novalidate>' +
          '<div><label class="label text-lg" for="mail-code">Code reçu par e-mail</label>' +
            '<input class="field bg-surface font-mono text-2xl tracking-[0.3em]" id="mail-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required data-keep="code" value="' + esc(mail.code) + '"' +
            ' aria-describedby="mail-code-hint' + (mail.error ? ' mail-err' : '') + '"' + invalid + '>' +
            '<p class="hint" id="mail-code-hint">6 chiffres</p></div>' +
          err +
          '<button class="btn-primary w-full sm:w-auto"' + working + '>' + (mail.busy ? spinner('h-5 w-5') + 'Vérification…' : 'Valider') + '</button>' +
        '</form>' +
        '<div class="mt-4 flex flex-wrap gap-x-6 gap-y-1">' +
          '<button type="button" class="' + BTN_LINK + '" data-action="mail-resend"' + (mail.busy ? ' disabled' : '') + '>Renvoyer le code</button>' +
          '<button type="button" class="' + BTN_LINK + '" data-action="mail-change">Changer d’adresse</button>' +
          '<button type="button" class="' + BTN_LINK + '" data-action="mail-close">Annuler</button>' +
        '</div>';
    }
    return '<section id="mail-panel" class="c-mail mt-8 bg-sunk p-6 sm:p-8" aria-labelledby="mail-h">' +
      '<h2 id="mail-h" tabindex="-1" class="text-[1.75rem] outline-none sm:text-3xl">' + title + '</h2>' + body +
    '</section>';
  }

  /** Les deux liens : ajouter son e-mail (s'il y a un compte), retrouver ses bons. */
  function accountLinks(state, cls) {
    return '<div class="' + cls + ' flex flex-wrap gap-x-6 gap-y-1">' +
      (state.hasAccount ? '<button type="button" class="' + BTN_LINK + '" data-action="mail-open" data-mode="save">Gardez vos bons : ajoutez votre e-mail</button>' : '') +
      '<button type="button" class="' + BTN_LINK + '" data-action="mail-open" data-mode="recover">Retrouver mes bons</button>' +
    '</div>';
  }

  /** Les liens sont proposés quand aucun panneau n'est ouvert et qu'aucun e-mail n'est enregistré. */
  const showLinks = (state) => !state.email && !(mail && !(mail.mode === 'save' && state.email));

  /**
   * Sous l'intro : panneau e-mail ouvert, adresse qui garde les bons, ou les deux liens.
   * Téléphone : les liens sont sous « Mes bons » (voir render), ici réservés à l'ordinateur.
   */
  function accountBlock(state) {
    if (mail && !(mail.mode === 'save' && state.email)) return mailPanel(state);
    if (state.email) {
      return '<p id="mail-saved" tabindex="-1" class="c-saved mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-lg text-ink outline-none">' +
        '<span class="tag bg-forest text-white">Bons sauvegardés</span>' +
        '<span class="min-w-0 break-words font-semibold">' + esc(state.email) + '</span></p>';
    }
    return accountLinks(state, 'c-desk mt-4');
  }

  // ------------------------------------------------------------------------
  // Page
  // ------------------------------------------------------------------------
  function waitingPage(state) {
    if (!state.configured) return soon('Votre espace ouvrira avec les premières missions.');
    if (!state.known && (state.status === 'loading' || state.status === 'idle')) return notice({ title: 'Chargement…', busy: true });
    if (!state.known) {
      return notice({
        title: 'Données indisponibles',
        text: state.error || 'Vérifiez votre connexion.',
        extra: '<button type="button" class="btn mt-6 min-h-[56px] bg-ink text-surface hover:bg-ink/85" data-action="retry">Réessayer</button>',
      });
    }
    return '';
  }

  function render(state) {
    const head = '<h1 id="page-title" tabindex="-1" class="c-h1 text-5xl font-extrabold sm:text-6xl lg:text-7xl">Mon <span class="mark">espace</span></h1>';
    const waiting = waitingPage(state);
    if (waiting) {
      return '<div class="c-page mx-auto max-w-app px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16">' + head +
        '<div class="mt-8" aria-live="polite">' + waiting + '</div></div>';
    }

    const get = (p) => store.missionInfo(p.missionId); // retirées comprises
    // En cours : inscrites, plus celles validées pendant cette visite (message de succès)
    const ongoing = state.participations.filter((p) => p.status === 'inscrite' || (checks[p.id] && checks[p.id].phase === 'valid'));
    const validated = state.participations
      .filter((p) => p.status === 'validee')
      .sort((a, b) => String(b.validatedAt || '').localeCompare(String(a.validatedAt || '')));
    const minutes = validated.reduce((sum, p) => sum + ((get(p) && Number(get(p).duration)) || 0), 0);
    const vouchers = state.vouchers.slice().sort((a, b) =>
      (a.usedAt ? 1 : 0) - (b.usedAt ? 1 : 0) ||
      String(b.usedAt || b.createdAt || '').localeCompare(String(a.usedAt || a.createdAt || '')));
    const activeCount = vouchers.filter((v) => !v.usedAt).length;
    // Téléphone : « Mission(s) en cours » ; « Mes missions » dès qu'une mission vient d'être validée
    const fresh = ongoing.filter((p) => checks[p.id] && checks[p.id].phase === 'valid').length;
    const phoneLabel = fresh ? 'Mes missions' : 'Mission' + s(ongoing.length) + ' en cours';
    const H2 = 'text-[2.5rem] sm:text-5xl';

    let intro = 'Prêt·e pour une première mission ?';
    if (validated.length) intro = 'Merci pour votre aide !';
    else if (ongoing.length || vouchers.length) intro = 'Vos missions et vos bons, au même endroit.';

    // Deux repères chiffrés, en blocs pleins (noir, vert)
    const TILE = 'flex min-w-0 flex-col justify-between gap-3 p-5 sm:p-6';
    const NUM = 'font-display text-[2.25rem] font-bold leading-none tracking-[-0.04em] sm:text-5xl';
    const CAP = 'font-display text-base font-semibold leading-snug sm:text-lg';
    const stats = validated.length || vouchers.length
      ? '<ul class="c-desk mt-8 grid max-w-2xl grid-cols-2 gap-3">' +
          '<li class="' + TILE + ' bg-ink text-surface">' +
            '<p class="' + NUM + ' whitespace-nowrap">' + (minutes ? esc(duration(minutes)) : validated.length) + '</p>' +
            '<p class="' + CAP + '">' + (minutes ? 'pour la montagne' : 'mission' + s(validated.length) + ' validée' + s(validated.length)) + '</p></li>' +
          '<li class="' + TILE + ' bg-forest text-white">' +
            '<p class="' + NUM + '">' + activeCount + '</p>' +
            '<p class="' + CAP + '">bon' + s(activeCount) + ' à utiliser</p></li>' +
        '</ul>'
      : '';

    // Données de la copie locale (chargement échoué) : toujours signalé.
    const offline = state.status === 'offline' || state.status === 'error'
      ? '<p class="c-banner mt-6 bg-ink px-5 py-3 font-display text-base font-semibold text-surface" role="status">' +
          (state.status === 'offline' ? 'Hors connexion' : 'Serveur injoignable') + ' : dernières données enregistrées sur cet appareil.</p>'
      : '';

    // Téléphone : ni phrase d'accueil ni repères chiffrés (classe c-desk) : la mission en cours
    // et les bons viennent tout de suite sous le titre, comme sur la maquette « Cartes ».
    return '<div class="c-page mx-auto max-w-app px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16">' +
      head +
      '<p class="c-desk mt-4 max-w-xl font-display text-xl font-semibold leading-snug tracking-[-0.01em] text-ink sm:text-2xl">' + intro + '</p>' +
      accountBlock(state) +
      offline +
      stats +

      '<div class="c-secs mt-14 space-y-16 lg:mt-20 lg:space-y-20">' +
        // ---- Missions en cours : la photo à prendre ---------------------------------------
        '<section aria-labelledby="ongoing">' +
          '<h2 id="ongoing" class="c-label ' + H2 + '"><span class="c-desk">Mes missions</span><span class="md:hidden">' + phoneLabel + '</span></h2>' +
          (ongoing.length
            ? '<ul class="mt-7 grid gap-14 lg:grid-cols-2 lg:gap-x-8">' +
                ongoing.map((p) => (checks[p.id] && checks[p.id].phase === 'valid' ? successCard(p, get(p), checks[p.id]) : activeCard(p, get(p)))).join('') +
              '</ul>'
            : '<div class="c-empty mt-7 bg-sunk p-6 sm:p-8">' +
                '<p class="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-ink">Aucune mission en cours.</p>' +
                '<a href="#/missions" class="btn mt-6 min-h-[56px] bg-ink text-lg text-surface hover:bg-ink/85">Trouver une mission ' + icon('arrow', 'h-5 w-5') + '</a>' +
              '</div>') +
        '</section>' +

        // ---- Bons : valables d'abord, puis utilisés -----------------------------------------
        '<section aria-labelledby="rewards">' +
          '<h2 id="rewards" class="c-label ' + H2 + '">Mes bons</h2>' +
          (vouchers.length
            ? '<p class="c-desk mt-3 font-display text-xl font-semibold leading-snug text-ink">Montrez le bon au partenaire, puis utilisez-le devant lui.</p>' +
              '<ul class="mt-7 grid gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">' + vouchers.map((v) => voucherCard(v, state)).join('') + '</ul>'
            : '<p class="c-empty mt-7 bg-sunk p-6 font-display text-xl font-semibold leading-snug text-ink sm:p-8">Vos bons arriveront ici après une mission validée.</p>') +
          // Téléphone : garder ses bons / les retrouver, juste sous les bons
          (showLinks(state) ? accountLinks(state, 'c-account md:hidden') : '') +
        '</section>' +

        // ---- Historique (tuiles grises) ----------------------------------------------------
        (validated.length
          ? '<section aria-labelledby="validated">' +
              '<h2 id="validated" class="c-label text-[1.75rem] sm:text-3xl">Missions validées</h2>' +
              // Téléphone : les repères chiffrés (c-desk) sont masqués ; le temps donné reste affiché ici
              (minutes ? '<p class="c-given md:hidden">Déjà <strong>' + esc(duration(minutes)) + '</strong> pour la montagne. Merci&nbsp;!</p>' : '') +
              '<ul class="c-history mt-5 space-y-2">' +
                validated.map((p) =>
                  '<li class="flex flex-col gap-0.5 bg-sunk px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">' +
                    '<span class="font-display text-lg font-semibold leading-snug text-ink">' + esc(get(p) ? get(p).title : 'Mission retirée') + '</span>' +
                    '<span class="shrink-0 text-muted">' + (p.validatedAt ? 'Validée le ' + esc(date(p.validatedAt)) : 'Validée') + '</span>' +
                  '</li>').join('') +
              '</ul>' +
            '</section>'
          : '') +

        // ---- Données : liées à ce navigateur, effaçables d'un geste -------------------------
        (state.hasAccount || state.participations.length || state.vouchers.length
          ? '<section aria-labelledby="data-h" class="c-data bg-sunk p-6 sm:p-8">' +
              '<h2 id="data-h" class="text-[1.75rem] sm:text-3xl">Vos données</h2>' +
              '<p class="mt-3 max-w-xl text-lg leading-snug text-ink">' +
                (state.email ? 'Vos missions et vos bons sont liés à votre e-mail. ' : 'Sans compte ni e-mail : vos missions et vos bons sont liés à ce navigateur. ') +
                '<a class="underline decoration-accent decoration-2 underline-offset-4 hover:text-brand-ink" href="#/mentions-legales">En savoir plus</a></p>' +
              '<button type="button" class="btn-secondary mt-6" data-action="delete-data"' + (busy.has('delete') ? ' disabled aria-busy="true"' : '') + '>Supprimer mes données</button>' +
            '</section>'
          : '') +
      '</div>' +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Vérification de la photo
  // ------------------------------------------------------------------------
  /** Envoie la photo au serveur ; une seule vérification à la fois par mission. */
  function submit(pid, shot, app) {
    if (checks[pid] && checks[pid].phase === 'verifying') return;
    checks[pid] = { phase: 'verifying', photo: shot };
    focusAfter = '#check-' + CSS.escape(pid);
    app.rerender();
    store.verifyPhoto(pid, shot).then((res) => {
      if (res.valid) {
        checks[pid] = { phase: 'valid', reason: res.reason, voucherId: res.voucher && res.voucher.id };
        toast('Mission validée ! Votre bon est arrivé.');
      } else {
        checks[pid] = { phase: 'invalid', reason: res.reason || 'La photo ne montre pas ce qui est demandé. Reprenez-la.' };
      }
    }, (err) => {
      const code = err && err.code;
      if (code === 'already_validated' || code === 'mission_inactive') {
        delete checks[pid]; // validée ailleurs, ou mission retirée : le rechargement l'affiche
        toast(err.message, code === 'mission_inactive' ? 'error' : undefined);
      } else {
        // Panne passagère : la photo reste en mémoire pour « Réessayer l’envoi ».
        // Photo illisible, plus d'essai… : il faut la reprendre (ou rien à faire).
        const keep = !err || err.retry || code === 'offline';
        const tech = [code, err && err.status ? 'HTTP ' + err.status : ''].filter(Boolean).join(' · ');
        checks[pid] = { phase: 'error', photo: keep ? shot : null, message: (err && err.message) || 'Réessayez dans un instant.', tech };
      }
    }).then(() => {
      focusAfter = '#check-' + CSS.escape(pid);
      app.rerender();
    });
  }

  /** Envoi du code (ajout d'adresse ou « Retrouver mes bons »). */
  function mailSend(app, email) {
    if (!mail || mail.busy) return;
    mail.email = String(email || '').trim();
    mail.busy = true;
    mail.error = null;
    app.rerender();
    const send = mail.mode === 'save' ? store.saveEmailSend : store.recoverSend;
    const current = mail;
    send(mail.email).then((e) => {
      if (mail !== current) return;
      mail.email = e;
      mail.code = '';
      mail.step = 'code';
      focusAfter = '#mail-code';
      toast('Code envoyé. Vérifiez vos e-mails.');
    }, (err) => {
      if (mail !== current) return;
      mail.error = (err && err.message) || Meleze.api.MESSAGES.sendCode;
      focusAfter = mail.step === 'code' ? '#mail-code' : '#mail-email';
    }).then(() => { current.busy = false; app.rerender(); });
  }

  const actions = {
    retry() { store.refresh(); },

    'mail-open'(el, app) {
      if (navigator.onLine === false) { toast(Meleze.api.MESSAGES.offline, 'error'); return; }
      mail = { mode: el.dataset.mode === 'recover' ? 'recover' : 'save', step: 'email', email: '', code: '', busy: false, error: null };
      focusAfter = '#mail-h';
      app.rerender();
    },
    'mail-close'(el, app) {
      mail = null;
      focusAfter = '#page-title';
      app.rerender();
    },
    'mail-change'(el, app) {
      if (!mail) return;
      Object.assign(mail, { step: 'email', code: '', error: null });
      focusAfter = '#mail-email';
      app.rerender();
    },
    'mail-resend'(el, app) { if (mail) mailSend(app, mail.email); },

    photo(el, app) {
      const pid = el.dataset.id;
      const p = store.getParticipation(pid);
      const m = p && store.getMission(p.missionId);
      if (!p || !m || (checks[pid] && checks[pid].phase === 'verifying') || Meleze.camera.isOpen()) return;
      if (navigator.onLine === false) { toast(Meleze.api.MESSAGES.offline, 'error'); return; }
      Meleze.camera.open({ hint: m.photoHint }).then((shot) => {
        if (shot && store.getParticipation(pid)) submit(pid, shot, app);
      });
    },

    resend(el, app) {
      const c = checks[el.dataset.id];
      if (c && c.phase === 'error' && c.photo) submit(el.dataset.id, c.photo, app);
    },

    cancel(el, app) {
      const id = el.dataset.id;
      if (busy.has('cancel:' + id)) return;
      if (!confirm('Annuler votre participation à cette mission ?')) return;
      busy.add('cancel:' + id);
      app.rerender();
      store.cancel(id)
        .then(() => { delete checks[id]; toast('Participation annulée.'); focusAfter = '#page-title'; },
          (err) => toast((err && err.message) || 'Annulation impossible.', 'error'))
        .then(() => { busy.delete('cancel:' + id); app.rerender(); });
    },

    use(el, app) {
      const id = el.dataset.id;
      if (busy.has('use:' + id)) return;
      if (!confirm('À faire devant le partenaire : une fois utilisé, ce bon ne pourra plus servir.')) return;
      busy.add('use:' + id);
      app.rerender();
      store.useVoucher(id)
        .then(() => { toast('Bon utilisé. Merci !'); focusAfter = '#voucher-' + CSS.escape(id); },
          (err) => toast((err && err.message) || 'Ce bon ne peut pas être utilisé.', 'error'))
        .then(() => { busy.delete('use:' + id); app.rerender(); });
    },

    'show-voucher'(el) {
      const target = document.getElementById('voucher-' + el.dataset.id);
      if (!target) return;
      target.scrollIntoView({ block: 'center' });
      target.focus({ preventScroll: true });
    },

    'delete-data'(el, app) {
      if (busy.has('delete')) return;
      const keepsEmail = store.state.email
        ? ' Votre e-mail reste enregistré : pour le supprimer, écrivez à l’éditeur (mentions légales).'
        : '';
      if (!confirm('Supprimer vos missions, vos vérifications et vos bons ? C’est définitif.' + keepsEmail)) return;
      busy.add('delete');
      app.rerender();
      store.deleteMyData()
        .then(() => {
          Object.keys(checks).forEach((k) => delete checks[k]);
          toast('Vos données ont été supprimées.');
          focusAfter = '#page-title';
        }, (err) => toast((err && err.message) || 'Suppression impossible. Réessayez.', 'error'))
        .then(() => { busy.delete('delete'); app.rerender(); });
    },
  };

  /** Formulaires du panneau e-mail. */
  const forms = {
    'mail-send'(form, app) {
      mailSend(app, new FormData(form).get('email'));
    },
    'mail-verify'(form, app) {
      if (!mail || mail.busy) return;
      mail.code = String(new FormData(form).get('code') || '').replace(/\s+/g, '');
      const recover = mail.mode === 'recover';
      // Changer de compte abandonne les missions et bons de ce navigateur : jamais sans prévenir.
      if (recover && store.hasUnsavedData() && !confirm(LOST_WARNING + ' Continuer ?')) return;
      mail.busy = true;
      mail.error = null;
      app.rerender();
      const current = mail;
      (recover ? store.recoverVerify : store.saveEmailVerify)(mail.email, mail.code).then(() => {
        if (mail !== current) return;
        mail = null;
        Object.keys(checks).forEach((k) => delete checks[k]);
        toast(recover ? 'Vos bons sont de retour.' : 'C’est fait : vos bons sont gardés avec votre e-mail.');
        focusAfter = recover ? '#page-title' : '#mail-saved';
      }, (err) => {
        if (mail !== current) return;
        mail.error = (err && err.message) || Meleze.api.MESSAGES.badCode;
        focusAfter = '#mail-code';
      }).then(() => { current.busy = false; app.rerender(); });
    },
  };

  function mounted(root) {
    // Saisie conservée si l'écran se redessine (chargement en arrière-plan…)
    root.querySelectorAll('#mail-panel [data-keep]').forEach((input) => {
      input.addEventListener('input', () => { if (mail) mail[input.dataset.keep] = input.value; });
    });
    if (!focusAfter) return;
    const el = root.querySelector(focusAfter);
    focusAfter = null;
    if (el) {
      el.focus({ preventScroll: true });
      const r = el.getBoundingClientRect();
      if (r.top < 64 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' });
    }
  }

  /** Page quittée : caméra coupée, messages de succès oubliés (les bons restent). */
  function unmount() {
    if (Meleze.camera) Meleze.camera.close(null);
    if (mail && !mail.busy) mail = null;
    Object.keys(checks).forEach((k) => { if (checks[k].phase === 'valid' || checks[k].phase === 'invalid') delete checks[k]; });
    focusAfter = null;
  }

  return { title: 'Mon espace', render, actions, forms, mounted, unmount };
})();
