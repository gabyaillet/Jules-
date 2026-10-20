/* ==========================================================================
   Vue : Catalogue des missions (filtres Saison + Type)
   Fiche courte : photo, type, titre, UNE ligne (durée · lieu), contrepartie
   dans un bloc vert plein, gros bouton noir. Le reste (quand, photo attendue,
   organisateur, places, saisons) est replié dans « Plus d’infos ».
   Les missions viennent du serveur (store) ; « Je participe » inscrit le
   touriste (compte anonyme créé à ce moment-là, jamais avant).
   Téléphone (< 768 px, concept « Cartes ») : une seule rangée de filtres,
   cartes empilées (contrepartie en ligne « cadeau ») et le bouton de chaque
   carte devient une pilule verte fixe en bas de l'écran : seule celle de la
   mission à l'écran est affichée (IntersectionObserver, voir mountDock). Les
   autres restent dans la page (masquées comme .sr-only) : clavier et lecteurs
   d'écran atteignent le bouton de chaque mission.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.catalogue = (function () {
  'use strict';
  const { esc, icon, photo, missionDuration, date, typeOf, seasonLabel, toast, spinner, notice, soon } = Meleze.ui;
  const store = Meleze.store;

  /** Conteneur commun : même largeur et mêmes marges que les autres pages. */
  const WRAP = 'mx-auto max-w-app px-5 sm:px-8';
  /** Pastille posée sur la photo (type) : texte seul, jamais inclinée. */
  const PILL = 'rounded-none px-3.5 py-1.5 font-display text-base font-bold leading-snug'; // pancarte carrée

  // Filtres conservés pendant la navigation (pas besoin de les persister)
  const filters = { season: 'all', type: 'all' };
  /** Téléphone (< 768 px, concept « Cartes ») : une seule rangée de filtres, pilule fixe… */
  const phone = () => window.matchMedia('(max-width: 767px)').matches;
  let joining = null; // mission en cours d'inscription (un seul envoi à la fois)

  const CHIP = 'chip min-h-[48px] border-transparent bg-sunk px-5 text-base';
  /** `cls` : classe en plus (ex. c-desk : filtre « tout » propre à l'ordinateur). */
  function chip(group, value, label, active, cls) {
    return '<button type="button" class="' + CHIP + (cls ? ' ' + cls : '') + '" data-action="filter" data-group="' + group + '" data-value="' + esc(value) + '" aria-pressed="' + active + '">' + label + '</button>';
  }

  /**
   * Rangée de filtres défilant horizontalement, jusqu'au bord de l'écran sur mobile.
   * Téléphone : les deux rangées n'en font qu'une (types puis saisons), voir .c-filters-in.
   */
  function chipRow(label, chips, cls) {
    return '<div class="flex gap-2 overflow-x-auto px-5 py-1 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ' + cls + '" role="group" aria-label="' + label + '">' + chips + '</div>';
  }

  /** Grille de définitions (dans « Plus d’infos ») : libellé à gauche, valeur à droite. */
  function facts(rows) {
    return '<dl class="grid grid-cols-[6.5rem_1fr] items-baseline gap-x-4 gap-y-3">' +
      rows.filter(Boolean).map((r) => '<dt class="text-base text-muted">' + r[0] + '</dt><dd class="min-w-0 font-semibold text-ink">' + r[1] + '</dd>').join('') +
    '</dl>';
  }

  /** Libellé du bouton quand le touriste participe déjà (lien vers « Mon espace »). */
  const ACTIVE_LABEL = {
    inscrite: 'Inscrit·e : prendre la photo',
    validee: 'Mission validée : voir mon bon',
  };

  /** « Nouveau » pendant deux semaines après la publication. */
  const isNew = (m) => {
    const t = Date.parse(m.createdAt || '');
    return !isNaN(t) && Date.now() - t < 14 * 24 * 3600 * 1000;
  };

  /**
   * Fiche mission. `current` : sur téléphone, c'est la mission à l'écran ; son bouton est
   * affiché en pilule fixe en bas (les autres sont masqués à l'écran mais restent atteignables au
   * clavier et par les lecteurs d'écran). Ordinateur : bouton dans la fiche.
   */
  function card(state, m, focusId, current) {
    const t = typeOf(m.type);
    const p = store.participationFor(m.id);
    // Gros bouton pilule : noir pour participer, gris plein si déjà inscrit·e.
    // Téléphone : pilule verte (noire si déjà inscrit·e) avec la vignette de la mission.
    const BIG = 'btn c-cta min-h-[52px] w-full text-base';
    const thumb = '<span class="c-thumb md:hidden" aria-hidden="true">' + photo(m, { sizes: '48px', alt: '' }) + '</span>';
    // Nom accessible complet : la pilule fixe dit de quelle mission il s'agit.
    const named = '<span class="sr-only"> : ' + esc(m.title) + '</span>';
    let cta;
    if (p) {
      cta = '<a href="#/wallet" class="' + BIG + ' c-cta-done bg-sunk text-ink hover:bg-line">' + thumb +
        '<span class="c-cta-label">' + (ACTIVE_LABEL[p.status] || ACTIVE_LABEL.inscrite) + named + '</span>' + icon('arrow', 'md:hidden') + '</a>';
    } else if (joining === m.id) {
      cta = '<button type="button" class="' + BIG + ' c-cta-go bg-ink text-surface" data-action="join" data-id="' + esc(m.id) + '" disabled aria-busy="true">' + thumb +
        spinner('h-5 w-5') + '<span class="c-cta-label">Inscription…' + named + '</span></button>';
    } else {
      cta = '<button type="button" class="' + BIG + ' c-cta-go bg-ink text-surface hover:bg-ink/85" data-action="join" data-id="' + esc(m.id) + '"' + (joining ? ' disabled' : '') + '>' + thumb +
        '<span class="c-cta-label">Je participe' + named + '</span>' + icon('arrow', 'h-5 w-5') + '</button>';
    }
    const dur = esc(missionDuration(m) || 'Variable');
    // Lieu affiché sur la ligne d'infos (durée libre, ex. « Le temps du trajet » : il passe dans « Plus d’infos »)
    const place = m.location && !m.durationLabel ? esc(m.location) : '';

    return '<li id="mission-' + esc(m.id) + '" class="group flex scroll-mt-24 flex-col" data-card="' + esc(m.id) + '">' +
      '<div class="ph ph-zoom aspect-[16/10]">' + photo(m, { sizes: '(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw' }) +
        '<div class="c-signs absolute inset-x-3 top-3 flex items-start justify-between gap-2">' +
          '<span class="c-sign ' + PILL + ' ' + t.color + '">' + esc(t.label) + '</span>' +
          (isNew(m) ? '<span class="sticker rotate-3 bg-forest text-white">Nouveau</span>' : '') +
        '</div>' +
      '</div>' +

      '<h2 class="c-card-title mt-4 text-[1.375rem] leading-[1.1] sm:text-[1.6rem]">' + esc(m.title) + '</h2>' +
      // Une seule ligne d'infos : durée · lieu (« Durée » reste lu par les lecteurs d'écran ;
      // durée libre, ex. « Le temps du trajet » : le lieu passe dans « Plus d’infos »)
      '<p class="c-desk mt-2 font-display text-base font-semibold leading-snug text-ink">' +
        '<span class="sr-only">Durée </span>' + dur + (place ? ' · ' + place : '') +
      '</p>' +
      // Téléphone : la même ligne, avec une icône par information (horloge, repère)
      '<p class="c-meta font-display font-semibold text-ink md:hidden">' +
        '<span class="c-meta-i">' + icon('clock') + '<span class="sr-only">Durée </span>' + dur + '</span>' +
        (place ? '<span class="c-meta-i">' + icon('pin') + place + '</span>' : '') +
      '</p>' +

      // Bas de fiche (contrepartie, bouton, détails) calé en bas : les blocs
      // s'alignent d'une carte à l'autre sur une même rangée.
      '<div class="c-card-foot mt-auto pt-4">' +
        // Contrepartie : bloc vert plein, texte blanc (téléphone : carré vert + cadeau, texte noir)
        '<div class="c-reward bg-forest p-4 text-white sm:min-h-[8.5rem] sm:p-5">' +
          '<span class="c-gift md:hidden" aria-hidden="true">' + icon('gift') + '</span>' +
          '<div>' +
            '<p class="c-reward-k font-display text-sm font-semibold">En échange</p>' +
            '<p class="c-reward-t mt-1 font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.015em]">' + esc(m.reward.title) + '</p>' +
            '<p class="c-reward-by mt-1 text-sm">offert par ' + esc(m.reward.partner) + '</p>' +
          '</div>' +
        '</div>' +

        '<div class="c-dock mt-3' + (current ? ' is-current' : '') + '" data-dock="' + esc(m.id) + '">' + cta + '</div>' +

        '<details class="c-more-info acc mt-2"' + (focusId === m.id ? ' open' : '') + '>' +
          '<summary class="min-h-[48px] py-2 font-display text-base font-bold">Plus d’infos<span class="acc-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunk text-ink">' + icon('plus', 'h-5 w-5') + '</span></summary>' +
          '<div class="pb-2 pt-1">' +
            '<p class="text-ink">' + esc(m.description) + '</p>' +
            '<div class="mt-5">' + facts([
              m.location && m.durationLabel ? ['Où', esc(m.location)] : null,
              m.schedule ? ['Quand', esc(m.schedule)] : null,
              m.photoHint ? ['Photo', esc(m.photoHint)] : null,
              m.host ? ['Avec', esc(m.host)] : null,
              m.spots != null && m.spots !== '' ? ['Places', esc(m.spots)] : null,
              ['Saisons', (m.seasons || []).map((s) => esc(seasonLabel(s))).join(', ')],
              p && p.status === 'validee' ? ['Déjà faite', p.validatedAt ? 'le ' + esc(date(p.validatedAt)) : 'oui'] : null,
            ]) + '</div>' +
          '</div>' +
        '</details>' +
      '</div>' +
    '</li>';
  }

  /**
   * Mission ciblée depuis l'accueil (#/missions?focus=<id>) : on ne la traite
   * qu'une fois par arrivée sur la page, pour ne pas ramener l'écran dessus à
   * chaque nouveau rendu (inscription, filtre…).
   */
  let handledFocus = null;
  let scrollPending = false;

  /** Bandeau discret : données affichées depuis la copie locale (hors connexion, serveur injoignable). */
  function offlineBanner(state) {
    if ((state.status !== 'offline' && state.status !== 'error') || !state.known) return '';
    return '<p class="mt-6 bg-ink px-5 py-3 font-display text-base font-semibold text-surface" role="status">' +
      (state.status === 'offline' ? 'Hors connexion' : 'Serveur injoignable') + ' : dernières missions enregistrées sur cet appareil.</p>';
  }

  /** Page sans liste : bientôt disponible, chargement ou erreur. */
  function statusPage(state) {
    if (!state.configured) return soon('Les premières missions arrivent très bientôt.');
    if (!state.known && (state.status === 'loading' || state.status === 'idle')) {
      return notice({ title: 'Chargement des missions…', busy: true });
    }
    if (!state.known) {
      return notice({
        title: 'Missions indisponibles',
        text: state.error || 'Vérifiez votre connexion.',
        extra: '<button type="button" class="btn mt-6 min-h-[56px] bg-ink text-surface hover:bg-ink/85" data-action="retry">Réessayer</button>',
      });
    }
    return '';
  }

  function render(state, params) {
    const { SEASONS, TYPES } = Meleze.data;
    // Titre ; sur téléphone « Missions » et, à droite, le nombre de missions affichées.
    const head = (count) => '<section class="c-head ' + WRAP + ' pt-12 lg:pt-20">' +
      '<div class="c-headrow">' +
        '<h1 id="page-title" tabindex="-1" class="c-h1 text-5xl font-extrabold sm:text-7xl"><span class="c-desk">Les </span><span class="mark c-cap">missions</span></h1>' +
        (count ? '<p class="c-count md:hidden" aria-live="polite">' + count + '</p>' : '') +
      '</div>' +
      '<p class="c-desk mt-4 max-w-xl font-display text-xl font-semibold leading-snug tracking-[-0.01em] text-ink sm:text-2xl">Choisissez une mission, recevez un cadeau en échange.</p>' +
      offlineBanner(state) +
    '</section>';
    const waiting = statusPage(state);
    if (waiting) return head('') + '<section class="' + WRAP + ' pb-16 pt-8 lg:pb-24" aria-live="polite">' + waiting + '</section>';

    if (params.focus && params.focus !== handledFocus) {
      handledFocus = params.focus;
      scrollPending = true;
      // La mission ciblée doit être visible : on retire les filtres qui la masqueraient.
      const target = state.missions.find((m) => m.id === params.focus);
      if (target && ((filters.season !== 'all' && !(target.seasons || []).includes(filters.season)) ||
          (filters.type !== 'all' && target.type !== filters.type))) {
        filters.season = 'all'; filters.type = 'all';
      }
      if (target) currentId = target.id; // sa pilule s'affiche tout de suite (téléphone)
    }
    const list = state.missions.filter((m) =>
      (filters.season === 'all' || (m.seasons || []).includes(filters.season)) &&
      (filters.type === 'all' || m.type === filters.type));
    const filtered = filters.season !== 'all' || filters.type !== 'all';
    const plural = (n) => n + ' mission' + (n > 1 ? 's' : '');
    const count = !state.missions.length ? ''
      : filtered ? plural(list.length) + ' sur ' + state.missions.length
        : list.length + ' en ce moment';
    // Pilule affichée (téléphone) : la mission à l'écran, sinon la première de la liste.
    const shown = list.some((m) => m.id === currentId) ? currentId
      : currentId === null ? null : (list[0] ? list[0].id : null);

    return head(count) +

    '<div class="c-filters mt-7" role="group" aria-label="Filtres">' +
      '<div class="c-filters-in mx-auto max-w-app space-y-1 py-2">' +
        chipRow('Saison',
          chip('season', 'all', 'Toute l’année', filters.season === 'all', 'c-desk') +
          SEASONS.map((s) => chip('season', s.id, esc(s.label), filters.season === s.id)).join(''), 'c-row-season') +
        chipRow('Type de mission',
          // Téléphone : « Toutes » remet les deux filtres à zéro (pas de « Toute l’année » ni « Tous les types »)
          '<button type="button" class="' + CHIP + ' md:hidden" data-action="clear-filters" data-group="all" aria-pressed="' + !filtered + '">Toutes</button>' +
          chip('type', 'all', 'Tous les types', filters.type === 'all', 'c-desk') +
          TYPES.map((t) => chip('type', t.id, esc(t.label), filters.type === t.id)).join(''), 'c-row-type') +
      '</div>' +
    '</div>' +

    '<section class="c-list-sec ' + WRAP + ' pb-16 pt-6 lg:pb-24">' +
      '<div class="c-desk flex min-h-[44px] items-center justify-between gap-4">' +
        '<p class="font-display text-lg font-bold text-ink" aria-live="polite">' + plural(list.length) + '</p>' +
        (filtered && list.length ? '<button type="button" class="link min-h-[44px]" data-action="clear-filters">Effacer les filtres</button>' : '') +
      '</div>' +
      (list.length
        ? '<ul class="c-list mt-6 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-14">' + list.map((m) => card(state, m, params.focus, m.id === shown)).join('') + '</ul>'
        : state.missions.length
          ? '<div class="mt-6 bg-sunk px-6 py-14 text-center sm:py-20">' +
              '<p class="mx-auto max-w-md font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] sm:text-3xl">Aucune mission ne correspond à ces filtres.</p>' +
              '<button type="button" class="btn mt-7 min-h-[56px] bg-ink text-surface hover:bg-ink/85" data-action="clear-filters">Voir toutes les missions</button>' +
            '</div>'
          : '<div class="mt-6">' + notice({ title: 'Aucune mission pour le moment', text: 'Revenez bientôt : de nouvelles missions arrivent.' }) + '</div>') +
    '</section>';
  }

  const actions = {
    filter(el, app) {
      // Téléphone : un filtre déjà choisi se désélectionne (pas de « Toute l’année » ni de
      // « Tous les types » dans la rangée). Ordinateur : inchangé, le filtre reste choisi.
      const { group, value } = el.dataset;
      filters[group] = phone() && filters[group] === value && value !== 'all' ? 'all' : value;
      tapped = '[data-action="filter"][data-group="' + group + '"][data-value="' + CSS.escape(value) + '"]';
      app.rerender();
    },
    'clear-filters'(el, app) {
      filters.season = 'all'; filters.type = 'all';
      tapped = el.closest('.c-filters') ? '[data-action="clear-filters"][data-group="all"]' : null;
      app.rerender();
    },
    retry() { store.refresh(); },
    join(el, app) {
      const m = store.getMission(el.dataset.id);
      if (!m || joining || el.disabled) return; // un seul envoi à la fois
      if (store.participationFor(m.id)) { app.go('#/wallet'); return; }
      joining = m.id;
      app.rerender();
      store.join(m.id)
        .then(() => toast('C’est noté ! Prenez la photo depuis « Mon espace ».'),
          (err) => toast((err && err.message) || 'Inscription impossible. Réessayez.', 'error'))
        .then(() => { joining = null; app.rerender(); });
    },
  };

  // ------------------------------------------------------------------------
  // Téléphone : rangée de filtres qui défile (position conservée d'un rendu à l'autre)
  // ------------------------------------------------------------------------
  let rowLeft = 0; // défilement de la rangée de filtres (rétabli après un nouveau rendu)
  let tapped = null; // filtre qui vient d'être touché : il doit rester visible dans la rangée

  function mountFilters(root) {
    const row = root.querySelector('.c-filters-in');
    if (!row || !phone()) { tapped = null; return; }
    row.scrollLeft = rowLeft;
    const chip = tapped && row.querySelector(tapped);
    tapped = null;
    if (chip) {
      // Le filtre touché reste entièrement visible (marge de 20 px), sans faire défiler la page
      const r = row.getBoundingClientRect(), c = chip.getBoundingClientRect(), pad = 20;
      if (c.left < r.left + pad) row.scrollLeft += c.left - r.left - pad;
      else if (c.right > r.right - pad) row.scrollLeft += c.right - r.right + pad;
    }
    rowLeft = row.scrollLeft;
    row.addEventListener('scroll', () => { rowLeft = row.scrollLeft; }, { passive: true });
  }

  // ------------------------------------------------------------------------
  // Téléphone : pilule « Je participe » de la mission à l'écran
  // ------------------------------------------------------------------------
  /** Mission dont la pilule est affichée ; undefined = pas encore calculée, null = aucune à l'écran. */
  let currentId;
  let observer = null;
  const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);
  /** Hauteur réservée en bas de l'écran (barre d'onglets + pilule) : hors de la zone « à l'écran ». */
  const BOTTOM = 150;

  function setCurrent(root, id) {
    // La pilule qui a le focus clavier ne disparaît pas sous le doigt.
    const active = document.activeElement;
    const holder = active && active.closest ? active.closest('[data-dock]') : null;
    if (holder && root.contains(holder) && holder.dataset.dock !== id) return;
    currentId = id;
    root.querySelectorAll('[data-dock]').forEach((d) => d.classList.toggle('is-current', d.dataset.dock === id));
  }

  /**
   * La mission « à l'écran » est celle dont la plus grande hauteur est visible au-dessus de la
   * pilule (IntersectionObserver) ; le focus clavier dans une fiche la désigne aussi. Sans aucune
   * fiche à l'écran (pied de page), la pilule disparaît. Sur ordinateur, ces classes n'ont aucun
   * effet : chaque fiche garde son bouton.
   */
  function mountDock(root) {
    if (observer) { observer.disconnect(); observer = null; }
    const cards = Array.from(root.querySelectorAll('[data-card]'));
    // Marge en bas de page et notifications au-dessus de la pilule (src/input.css, .has-dock)
    document.documentElement.classList.toggle('has-dock', cards.length > 0);
    if (!cards.length) return;
    cards[0].parentElement.addEventListener('focusin', (e) => {
      const c = e.target.closest('[data-card]');
      if (!c) return;
      const was = currentId;
      setCurrent(root, c.dataset.card);
      // Pilule atteinte au clavier (Tab) ou bouton d'une autre fiche (lecteur d'écran) : elle
      // s'affiche en bas ; on amène sa fiche à l'écran, au-dessus de la pilule (scroll-padding-bottom,
      // src/input.css). Pas au toucher : la page ne bouge pas sous le doigt.
      const keyboard = was !== c.dataset.card || e.target.matches(':focus-visible');
      if (keyboard && e.target.closest('[data-dock]') && phone()) c.scrollIntoView({ block: 'nearest' });
    });
    if (!('IntersectionObserver' in window)) return;
    const seen = new Map();
    observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target.dataset.card, e.isIntersecting ? e.intersectionRect.height : 0));
      // La plus grande hauteur visible ; à égalité, la fiche la plus proche du centre de la zone.
      const mid = (window.innerHeight - BOTTOM) / 2;
      const off = (c) => { const r = c.getBoundingClientRect(); return Math.abs((r.top + r.bottom) / 2 - mid); };
      let best = null, bestH = 0, bestEl = null;
      cards.forEach((c) => {
        const h = seen.get(c.dataset.card) || 0;
        if (h <= 0) return;
        if (h > bestH + 1 || (bestEl && Math.abs(h - bestH) <= 1 && off(c) < off(bestEl))) {
          best = c.dataset.card; bestH = Math.max(h, bestH); bestEl = c;
        }
      });
      setCurrent(root, best);
    }, { rootMargin: '0px 0px -' + BOTTOM + 'px 0px', threshold: THRESHOLDS });
    cards.forEach((c) => observer.observe(c));
  }

  /** Après rendu : on amène la mission ciblée (lien depuis l'accueil) à l'écran. */
  function mounted(root, params) {
    if (params.focus && scrollPending) {
      scrollPending = false;
      const target = document.getElementById('mission-' + params.focus);
      if (target) target.scrollIntoView({ block: 'center' });
    }
    mountFilters(root);
    mountDock(root);
  }

  /** Page quittée : la prochaine arrivée avec ?focus= ciblera de nouveau la mission. */
  function unmount() {
    handledFocus = null;
    scrollPending = false;
    if (observer) { observer.disconnect(); observer = null; }
    currentId = undefined;
    rowLeft = 0;
    tapped = null;
    document.documentElement.classList.remove('has-dock');
  }

  return { title: 'Missions', render, actions, mounted, unmount };
})();
