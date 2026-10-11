/* ==========================================================================
   Vue : Catalogue des missions (filtres Saison + Type)
   Fiche courte : photo, type, titre, UNE ligne (durée · lieu), contrepartie
   dans un bloc vert plein, gros bouton noir. Le reste (quand, validation,
   encadrant, places, saisons) est replié dans « Plus d’infos ».
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.catalogue = (function () {
  'use strict';
  const { esc, icon, photo, missionDuration, date, typeOf, seasonLabel, toast } = Meleze.ui;
  const store = Meleze.store;

  /** Conteneur commun : même largeur et mêmes marges que les autres pages. */
  const WRAP = 'mx-auto max-w-app px-5 sm:px-8';
  /** Pastille posée sur la photo (type) : texte seul, jamais inclinée. */
  const PILL = 'rounded-full px-3.5 py-1.5 font-display text-base font-bold leading-snug';

  // Filtres conservés pendant la navigation (pas besoin de les persister)
  const filters = { season: 'all', type: 'all' };

  function chip(group, value, label, active) {
    return '<button type="button" class="chip min-h-[48px] border-transparent bg-sunk px-5 text-base" data-action="filter" data-group="' + group + '" data-value="' + esc(value) + '" aria-pressed="' + active + '">' + label + '</button>';
  }

  /** Rangée de filtres défilant horizontalement, jusqu'au bord de l'écran sur mobile. */
  function chipRow(label, chips) {
    return '<div class="flex gap-2 overflow-x-auto px-5 py-1 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="' + label + '">' + chips + '</div>';
  }

  /** Grille de définitions (dans « Plus d’infos ») : libellé à gauche, valeur à droite. */
  function facts(rows) {
    return '<dl class="grid grid-cols-[6.5rem_1fr] items-baseline gap-x-4 gap-y-3">' +
      rows.filter(Boolean).map((r) => '<dt class="text-base text-muted">' + r[0] + '</dt><dd class="min-w-0 font-semibold text-ink">' + r[1] + '</dd>').join('') +
    '</dl>';
  }

  /** Libellé du bouton quand une participation est en cours (lien vers « Mon espace »). */
  const ACTIVE_LABEL = {
    inscrite: 'Inscrit·e, voir mon espace',
    preuve: 'Justificatif envoyé',
    refusee: 'Justificatif refusé, à renvoyer',
  };

  /** Dernière participation validée pour cette mission (historique du touriste). */
  function lastValidated(state, missionId) {
    return state.participations
      .filter((x) => x.missionId === missionId && x.status === 'validee')
      .sort((a, b) => String(b.validatedAt || '').localeCompare(String(a.validatedAt || '')))[0];
  }

  function card(state, m, focusId) {
    const t = typeOf(m.type);
    const isPhoto = m.proof === 'photo';
    const p = store.participationFor(m.id);
    const done = !p && lastValidated(state, m.id);
    // Gros bouton pilule : noir pour participer, gris plein si déjà inscrit·e
    const BIG = 'btn min-h-[60px] w-full text-lg';
    const cta = p
      ? '<a href="#/wallet" class="' + BIG + ' bg-sunk text-ink hover:bg-line">' + (ACTIVE_LABEL[p.status] || ACTIVE_LABEL.inscrite) + '</a>'
      : '<button type="button" class="' + BIG + ' bg-ink text-surface hover:bg-ink/85" data-action="join" data-id="' + esc(m.id) + '">Je participe ' + icon('arrow', 'h-5 w-5') + '</button>';

    return '<li id="mission-' + esc(m.id) + '" class="group flex scroll-mt-24 flex-col md:scroll-mt-48">' +
      '<div class="ph ph-zoom aspect-[4/3]">' + photo(m, { sizes: '(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw' }) +
        '<div class="absolute inset-x-3 top-3 flex items-start justify-between gap-2">' +
          '<span class="' + PILL + ' ' + t.color + '">' + esc(t.label) + '</span>' +
          (m.isNew ? '<span class="sticker rotate-3 bg-forest text-white">Nouveau</span>' : '') +
        '</div>' +
      '</div>' +

      '<h2 class="mt-6 text-[2rem] leading-[1.02] sm:text-[2.15rem]">' + esc(m.title) + '</h2>' +
      // Une seule ligne d'infos : durée · lieu (« Durée » reste lu par les lecteurs d'écran ;
      // durée libre, ex. « Le temps du trajet » : le lieu passe dans « Plus d’infos »)
      '<p class="mt-3 font-display text-lg font-semibold leading-snug text-ink">' +
        '<span class="sr-only">Durée </span>' + esc(missionDuration(m) || 'Variable') +
        (m.location && !m.durationLabel ? ' · ' + esc(m.location) : '') +
      '</p>' +

      // Bas de fiche (contrepartie, bouton, détails) calé en bas : les blocs
      // s'alignent d'une carte à l'autre sur une même rangée.
      '<div class="mt-auto pt-6">' +
        // Contrepartie : bloc vert plein, texte blanc
        '<div class="bg-forest p-6 text-white sm:min-h-[12.25rem]">' +
          '<p class="font-display text-base font-semibold">En échange</p>' +
          '<p class="mt-2 font-display text-[1.6rem] font-bold leading-[1.08] tracking-[-0.02em]">' + esc(m.reward.title) + '</p>' +
          '<p class="mt-2 text-base">offert par ' + esc(m.reward.partner) + '</p>' +
        '</div>' +

        '<div class="mt-4">' + cta + '</div>' +

        '<details class="acc mt-2"' + (focusId === m.id ? ' open' : '') + '>' +
          '<summary class="min-h-[56px] py-2 font-display text-lg font-bold">Plus d’infos<span class="acc-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunk text-ink">' + icon('plus', 'h-5 w-5') + '</span></summary>' +
          '<div class="pb-2 pt-1">' +
            '<p class="text-ink">' + esc(m.description) + '</p>' +
            '<div class="mt-5">' + facts([
              m.location && m.durationLabel ? ['Où', esc(m.location)] : null,
              m.schedule ? ['Quand', esc(m.schedule)] : null,
              ['Validation', isPhoto ? 'Justificatif photo' : 'QR code sur place'],
              m.host ? [isPhoto ? 'Vérifié par' : 'Encadré par', esc(m.host)] : null,
              m.spots != null && m.spots !== '' ? ['Places', esc(m.spots)] : null,
              ['Saisons', (m.seasons || []).map((s) => esc(seasonLabel(s))).join(', ')],
              done ? ['Déjà faite', done.validatedAt ? 'le ' + esc(date(done.validatedAt)) : 'oui'] : null,
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

  function render(state, params) {
    const { SEASONS, TYPES } = Meleze.data;
    if (params.focus && params.focus !== handledFocus) {
      handledFocus = params.focus;
      scrollPending = true;
      // La mission ciblée doit être visible : on retire les filtres qui la masqueraient.
      const target = state.missions.find((m) => m.id === params.focus);
      if (target && ((filters.season !== 'all' && !(target.seasons || []).includes(filters.season)) ||
          (filters.type !== 'all' && target.type !== filters.type))) {
        filters.season = 'all'; filters.type = 'all';
      }
    }
    const list = state.missions.filter((m) =>
      (filters.season === 'all' || (m.seasons || []).includes(filters.season)) &&
      (filters.type === 'all' || m.type === filters.type));
    const filtered = filters.season !== 'all' || filters.type !== 'all';

    return '<section class="' + WRAP + ' pt-12 lg:pt-20">' +
      '<h1 id="page-title" tabindex="-1" class="text-5xl font-extrabold sm:text-7xl">Les <span class="mark">missions</span></h1>' +
      '<p class="mt-4 max-w-xl font-display text-xl font-semibold leading-snug tracking-[-0.01em] text-ink sm:text-2xl">Choisissez une mission, recevez un cadeau en échange.</p>' +
    '</section>' +

    '<div class="mt-7 md:sticky md:top-[65px] md:z-30 md:bg-surface/95 md:backdrop-blur" role="group" aria-label="Filtres">' +
      '<div class="mx-auto max-w-app space-y-1 py-2">' +
        chipRow('Saison',
          chip('season', 'all', 'Toute l’année', filters.season === 'all') +
          SEASONS.map((s) => chip('season', s.id, esc(s.label), filters.season === s.id)).join('')) +
        chipRow('Type de mission',
          chip('type', 'all', 'Tous les types', filters.type === 'all') +
          TYPES.map((t) => chip('type', t.id, esc(t.label), filters.type === t.id)).join('')) +
      '</div>' +
    '</div>' +

    '<section class="' + WRAP + ' pb-16 pt-6 lg:pb-24">' +
      '<div class="flex min-h-[44px] items-center justify-between gap-4">' +
        '<p class="font-display text-lg font-bold text-ink" aria-live="polite">' + list.length + ' mission' + (list.length > 1 ? 's' : '') + '</p>' +
        (filtered && list.length ? '<button type="button" class="link min-h-[44px]" data-action="clear-filters">Effacer les filtres</button>' : '') +
      '</div>' +
      (list.length
        ? '<ul class="mt-6 grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-20">' + list.map((m) => card(state, m, params.focus)).join('') + '</ul>'
        : '<div class="mt-6 bg-sunk px-6 py-14 text-center sm:py-20">' +
            '<p class="mx-auto max-w-md font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] sm:text-3xl">Aucune mission ne correspond à ces filtres.</p>' +
            '<button type="button" class="btn mt-7 min-h-[56px] bg-ink text-surface hover:bg-ink/85" data-action="clear-filters">Voir toutes les missions</button>' +
          '</div>') +
    '</section>';
  }

  const actions = {
    filter(el, app) {
      filters[el.dataset.group] = el.dataset.value;
      app.rerender();
    },
    'clear-filters'(el, app) {
      filters.season = 'all'; filters.type = 'all';
      app.rerender();
    },
    join(el) {
      const m = store.getMission(el.dataset.id);
      if (!m || !store.join(m.id)) return;
      toast(m.proof === 'photo'
        ? 'C’est noté. Envoyez votre justificatif depuis « Mon espace ».'
        : 'C’est noté : le QR code de « ' + m.title + ' » est dans « Mon espace ».');
    },
  };

  /** Après rendu : on amène la mission ciblée (lien depuis l'accueil) à l'écran. */
  function mounted(root, params) {
    if (!params.focus || !scrollPending) return;
    scrollPending = false;
    const target = document.getElementById('mission-' + params.focus);
    if (target) target.scrollIntoView({ block: 'center' });
  }

  /** Page quittée : la prochaine arrivée avec ?focus= ciblera de nouveau la mission. */
  function unmount() {
    handledFocus = null;
    scrollPending = false;
  }

  return { title: 'Missions', render, actions, mounted, unmount };
})();
