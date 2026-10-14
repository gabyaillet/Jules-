/* ==========================================================================
   Vue : Mon espace (missions et bons du touriste)
   Peu de texte, de grands blocs pleins : une carte par mission en cours
   (photo + titre, puis un bloc gris : ce que la photo doit montrer et UNE
   action, « Prendre la photo »), puis les bons (blocs verts). La photo est
   prise avec l'appareil photo intégré (js/camera.js) et vérifiée par le
   serveur (IA) : « Vérification… », puis bon émis, ou explication + reprise.
   Pas de prénom, pas de compte : tout est lié à ce navigateur.
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

  // ------------------------------------------------------------------------
  // Missions en cours
  // ------------------------------------------------------------------------
  const BTN_LINK = 'min-h-[44px] font-display text-base font-semibold text-ink underline decoration-2 underline-offset-4 hover:text-brand-ink disabled:opacity-50';

  /** Ce que la photo doit montrer : la consigne écrite par le partenaire. */
  function hintBlock(m) {
    return '<p class="font-display text-base font-semibold text-ink">La photo doit montrer :</p>' +
      '<p class="mt-1 text-lg font-semibold leading-snug text-ink">' + esc(m.photoHint || 'La mission réalisée.') + '</p>';
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
          '<p class="flex items-center gap-3 font-display text-xl font-bold">' + spinner() + 'Vérification…</p>' +
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
        '</div>';
    }
    return '<div id="check-' + esc(p.id) + '" tabindex="-1" class="mt-5 outline-none empty:hidden" aria-live="polite">' + inner + '</div>';
  }

  /** Carte "mission en cours" : photo + type + titre, puis la consigne et l'action. */
  function activeCard(p, m) {
    const c = lastVerdict(p);
    const left = Math.max(0, MAX_ATTEMPTS - (Number(p.attempts) || 0));
    const verifying = c && c.phase === 'verifying';
    const id = esc(p.id);
    const header = m
      ? '<div class="flex items-center gap-4">' +
          '<div class="ph ph-sm aspect-square w-20 shrink-0 sm:w-24">' + photo(m, { sizes: '100px', alt: '' }) + '</div>' +
          '<div class="min-w-0 flex-1">' +
            '<span class="tag tag-sign ' + esc(typeOf(m.type).color) + '">' + esc(typeOf(m.type).label) + '</span>' +
            '<h3 class="mt-2 text-2xl leading-[1.05] sm:text-[1.75rem]">' + esc(m.title) + '</h3>' +
          '</div>' +
        '</div>'
      : '<h3 class="text-2xl leading-[1.05] sm:text-[1.75rem]">Mission retirée</h3>';

    let body;
    if (!m) {
      body = '<p class="text-lg leading-snug text-ink">Le partenaire a retiré cette mission : elle ne peut plus être validée.</p>';
    } else {
      let actions;
      if (verifying) {
        actions = ''; // pas de second envoi pendant la vérification
      } else if (c && c.phase === 'error' && c.photo) {
        actions = '<div class="flex flex-col gap-3 sm:flex-row">' +
            '<button type="button" class="btn-primary min-h-[60px] w-full text-lg sm:w-auto" data-action="resend" data-id="' + id + '">Réessayer l’envoi</button>' +
            '<button type="button" class="btn-secondary min-h-[60px] w-full text-lg sm:w-auto" data-action="photo" data-id="' + id + '">Reprendre la photo</button>' +
          '</div>';
      } else if (left > 0) {
        actions = '<button type="button" class="btn-primary min-h-[60px] w-full text-lg sm:w-auto" data-action="photo" data-id="' + id + '">' +
          (c && c.phase === 'invalid' ? 'Reprendre la photo' : 'Prendre la photo') + '</button>';
      } else {
        actions = '<p class="font-display text-lg font-bold text-ink">Vous avez utilisé vos ' + MAX_ATTEMPTS + ' essais pour cette mission.</p>';
      }
      body = hintBlock(m) +
        checkArea(p, c) +
        (actions ? '<div class="mt-5">' + actions + '</div>' : '') +
        (left > 0 && !verifying
          ? '<p class="mt-3 text-base text-ink">' + (left === MAX_ATTEMPTS ? left + ' essais possibles' : 'Encore ' + left + ' essai' + s(left)) + '</p>'
          : '');
    }

    return '<li class="flex flex-col" id="participation-' + id + '">' +
      header +
      '<div class="mt-5 bg-sunk p-6">' + body + '</div>' +
      (verifying ? '' : '<div class="mt-2"><button type="button" class="' + BTN_LINK + '" data-action="cancel" data-id="' + id + '"' + (busy.has('cancel:' + p.id) ? ' disabled' : '') + '>Annuler ma participation</button></div>') +
    '</li>';
  }

  /** Mission tout juste validée (cette visite) : succès en vert plein + accès au bon. */
  function successCard(p, m, c) {
    const v = store.state.vouchers.find((x) => x.id === c.voucherId || x.participationId === p.id);
    const id = esc(p.id);
    return '<li class="flex flex-col" id="participation-' + id + '">' +
      '<div id="check-' + id + '" tabindex="-1" class="bg-forest p-6 text-white outline-none sm:p-7" aria-live="polite">' +
        '<p class="font-display text-base font-semibold">' + esc(m ? m.title : 'Mission') + '</p>' +
        '<p class="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.02em]">Mission validée !</p>' +
        (c.reason ? '<p class="mt-2 text-lg leading-snug">' + esc(c.reason) + '</p>' : '') +
        (v
          ? '<p class="mt-5 text-lg">Votre cadeau : <span class="font-bold">' + esc(v.title) + '</span>, offert par ' + esc(v.partner) + '.</p>' +
            '<button type="button" class="btn-light mt-6 w-full focus-visible:outline-white sm:w-auto" data-action="show-voucher" data-id="' + esc(v.id) + '">Voir mon bon ' + icon('arrow', 'h-5 w-5') + '</button>'
          : '<p class="mt-5 text-lg">Votre bon arrive dans « Mes bons ».</p>') +
      '</div>' +
    '</li>';
  }

  // ------------------------------------------------------------------------
  // Bons
  // ------------------------------------------------------------------------
  /** Bon valable : bloc vert plein, code lisible, « Utiliser mon bon » devant le partenaire. */
  function voucherCard(v) {
    const id = esc(v.id);
    if (v.usedAt) {
      // Bon utilisé : aplat vert « Bon utilisé » + date et heure (preuve pour le partenaire)
      return '<li id="voucher-' + id + '" tabindex="-1" class="flex flex-col bg-sunk p-6 outline-none">' +
        '<div class="bg-forest px-5 py-4 text-white">' +
          '<p class="font-display text-2xl font-bold leading-tight">Bon utilisé</p>' +
          '<p class="mt-1 font-display text-lg font-semibold">le ' + esc(dateTime(v.usedAt)) + '</p>' +
        '</div>' +
        '<p class="mt-5 font-display text-base font-semibold text-ink">' + esc(v.partner) + '</p>' +
        '<h3 class="mt-2 text-2xl leading-[1.05] tracking-[-0.025em] text-ink">' + esc(v.title) + '</h3>' +
        '<p class="mt-4 font-mono text-lg font-bold tracking-[0.12em] text-muted">' + esc(v.code) + '</p>' +
      '</li>';
    }
    const working = busy.has('use:' + v.id);
    return '<li id="voucher-' + id + '" tabindex="-1" class="flex flex-col bg-forest p-6 text-white outline-none">' +
      '<p class="font-display text-base font-semibold">' + esc(v.partner) + '</p>' +
      '<h3 class="mt-3 text-[1.75rem] leading-[1.05] tracking-[-0.025em]">' + esc(v.title) + '</h3>' +
      '<p class="mt-auto pt-7 font-mono text-2xl font-bold tracking-[0.14em]"><span class="sr-only">Code du bon : </span>' + esc(v.code) + '</p>' +
      '<button type="button" class="btn-light mt-5 w-full focus-visible:outline-white" data-action="use" data-id="' + id + '"' + (working ? ' disabled aria-busy="true"' : '') + '>' +
        (working ? spinner('h-5 w-5') + 'Validation…' : 'Utiliser mon bon') + '</button>' +
      '<p class="mt-3 text-base">À faire devant le partenaire.</p>' +
    '</li>';
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
    const head = '<h1 id="page-title" tabindex="-1" class="text-5xl font-extrabold sm:text-6xl lg:text-7xl">Mon <span class="mark">espace</span></h1>';
    const waiting = waitingPage(state);
    if (waiting) {
      return '<div class="mx-auto max-w-app px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16">' + head +
        '<div class="mt-8" aria-live="polite">' + waiting + '</div></div>';
    }

    const get = (p) => store.getMission(p.missionId);
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
    const H2 = 'text-[2.5rem] sm:text-5xl';

    let intro = 'Prêt·e pour une première mission ?';
    if (validated.length) intro = 'Merci pour votre aide !';
    else if (ongoing.length || vouchers.length) intro = 'Vos missions et vos bons, au même endroit.';

    // Deux repères chiffrés, en blocs pleins (noir, vert)
    const TILE = 'flex min-w-0 flex-col justify-between gap-3 p-5 sm:p-6';
    const NUM = 'font-display text-[2.25rem] font-bold leading-none tracking-[-0.04em] sm:text-5xl';
    const CAP = 'font-display text-base font-semibold leading-snug sm:text-lg';
    const stats = validated.length || vouchers.length
      ? '<ul class="mt-8 grid max-w-2xl grid-cols-2 gap-3">' +
          '<li class="' + TILE + ' bg-ink text-surface">' +
            '<p class="' + NUM + ' whitespace-nowrap">' + (minutes ? esc(duration(minutes)) : validated.length) + '</p>' +
            '<p class="' + CAP + '">' + (minutes ? 'pour la montagne' : 'mission' + s(validated.length) + ' validée' + s(validated.length)) + '</p></li>' +
          '<li class="' + TILE + ' bg-forest text-white">' +
            '<p class="' + NUM + '">' + activeCount + '</p>' +
            '<p class="' + CAP + '">bon' + s(activeCount) + ' à utiliser</p></li>' +
        '</ul>'
      : '';

    const offline = state.status === 'offline'
      ? '<p class="mt-6 bg-ink px-5 py-3 font-display text-base font-semibold text-surface">Hors connexion : dernières données enregistrées sur cet appareil.</p>'
      : '';

    return '<div class="mx-auto max-w-app px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16">' +
      head +
      '<p class="mt-4 max-w-xl font-display text-xl font-semibold leading-snug tracking-[-0.01em] text-ink sm:text-2xl">' + intro + '</p>' +
      offline +
      stats +

      '<div class="mt-14 space-y-16 lg:mt-20 lg:space-y-20">' +
        // ---- Missions en cours : la photo à prendre ---------------------------------------
        '<section aria-labelledby="ongoing">' +
          '<h2 id="ongoing" class="' + H2 + '">Mes missions</h2>' +
          (ongoing.length
            ? '<ul class="mt-7 grid gap-14 lg:grid-cols-2 lg:gap-x-8">' +
                ongoing.map((p) => (checks[p.id] && checks[p.id].phase === 'valid' ? successCard(p, get(p), checks[p.id]) : activeCard(p, get(p)))).join('') +
              '</ul>'
            : '<div class="mt-7 bg-sunk p-6 sm:p-8">' +
                '<p class="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-ink">Aucune mission en cours.</p>' +
                '<a href="#/missions" class="btn mt-6 min-h-[56px] bg-ink text-lg text-surface hover:bg-ink/85">Trouver une mission ' + icon('arrow', 'h-5 w-5') + '</a>' +
              '</div>') +
        '</section>' +

        // ---- Bons : valables d'abord, puis utilisés -----------------------------------------
        '<section aria-labelledby="rewards">' +
          '<h2 id="rewards" class="' + H2 + '">Mes bons</h2>' +
          (vouchers.length
            ? '<p class="mt-3 font-display text-xl font-semibold leading-snug text-ink">Montrez le bon au partenaire, puis utilisez-le devant lui.</p>' +
              '<ul class="mt-7 grid gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">' + vouchers.map(voucherCard).join('') + '</ul>'
            : '<p class="mt-7 bg-sunk p-6 font-display text-xl font-semibold leading-snug text-ink sm:p-8">Vos bons arriveront ici après une mission validée.</p>') +
        '</section>' +

        // ---- Historique (tuiles grises) ----------------------------------------------------
        (validated.length
          ? '<section aria-labelledby="validated">' +
              '<h2 id="validated" class="text-[1.75rem] sm:text-3xl">Missions validées</h2>' +
              '<ul class="mt-5 space-y-2">' +
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
          ? '<section aria-labelledby="data-h" class="bg-sunk p-6 sm:p-8">' +
              '<h2 id="data-h" class="text-[1.75rem] sm:text-3xl">Vos données</h2>' +
              '<p class="mt-3 max-w-xl text-lg leading-snug text-ink">Sans compte ni e-mail : vos missions et vos bons sont liés à ce navigateur. ' +
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
        toast('Mission validée ! Votre bon est arrivé.');
      } else {
        checks[pid] = { phase: 'invalid', reason: res.reason || 'La photo ne montre pas ce qui est demandé. Reprenez-la.' };
      }
    }, (err) => {
      if (err && err.code === 'already_validated') {
        delete checks[pid]; // déjà validée (autre onglet) : le rechargement l'affiche
        toast(err.message);
      } else {
        // La photo reste en mémoire : « Réessayer l’envoi » sans la reprendre
        checks[pid] = { phase: 'error', photo: shot, message: (err && err.message) || 'Réessayez dans un instant.' };
      }
    }).then(() => {
      focusAfter = '#check-' + CSS.escape(pid);
      app.rerender();
    });
  }

  const actions = {
    retry() { store.refresh(); },

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
      if (!confirm('Annuler votre participation à cette mission ?')) return;
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
      if (!confirm('À faire devant le partenaire : une fois utilisé, ce bon ne pourra plus servir.')) return;
      busy.add('use:' + id);
      app.rerender();
      store.useVoucher(id)
        .then(() => { toast('Bon utilisé. Merci !'); focusAfter = '#voucher-' + CSS.escape(id); },
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
      if (!confirm('Supprimer vos missions, vos vérifications et vos bons ? C’est définitif.')) return;
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

  function mounted(root) {
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
    Object.keys(checks).forEach((k) => { if (checks[k].phase === 'valid' || checks[k].phase === 'invalid') delete checks[k]; });
    focusAfter = null;
  }

  return { title: 'Mon espace', render, actions, mounted, unmount };
})();
