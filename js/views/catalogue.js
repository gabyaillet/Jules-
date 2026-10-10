/* ==========================================================================
   Vue : Catalogue des missions (filtres Saison + Type)
   Fiches sans icônes décoratives : photo, titre, infos pratiques en
   typographie simple, contrepartie dans la couleur du type de mission.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.catalogue = (function () {
  'use strict';
  const { esc, icon, photo, duration, typeOf, seasonLabel, toast } = Meleze.ui;
  const store = Meleze.store;

  /** Conteneur commun : même largeur et mêmes marges que les autres pages. */
  const WRAP = 'mx-auto max-w-app px-5 sm:px-8';
  /** Pastille posée sur la photo (type, nouveauté) : texte seul, jamais inclinée. */
  const PILL = 'rounded-full px-3 py-1 font-display text-sm font-semibold leading-snug text-night';

  // Filtres conservés pendant la navigation (pas besoin de les persister)
  const filters = { season: 'all', type: 'all' };

  function chip(group, value, label, active) {
    return '<button type="button" class="chip" data-action="filter" data-group="' + group + '" data-value="' + esc(value) + '" aria-pressed="' + active + '">' + label + '</button>';
  }

  /** Rangée de filtres défilant horizontalement, jusqu'au bord de l'écran sur mobile. */
  function chipRow(label, chips) {
    return '<div class="flex gap-2 overflow-x-auto px-5 py-1 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="' + label + '">' + chips + '</div>';
  }

  /** Petite grille de définitions : libellé discret à gauche, valeur à droite. */
  function facts(rows) {
    return '<dl class="grid grid-cols-[6rem_1fr] items-baseline gap-x-4 gap-y-2">' +
      rows.filter(Boolean).map((r) => '<dt class="text-sm text-muted">' + r[0] + '</dt><dd class="min-w-0 text-ink">' + r[1] + '</dd>').join('') +
    '</dl>';
  }

  function card(m, focusId) {
    const t = typeOf(m.type);
    const p = store.participationFor(m.id);
    const cta = p
      ? '<a href="#/wallet" class="btn-secondary w-full">' + (p.status === 'terminee' ? 'Terminée, à faire valider' : 'Inscrit·e, voir mon espace') + '</a>'
      : '<button type="button" class="btn-primary w-full" data-action="join" data-id="' + esc(m.id) + '">Je participe ' + icon('arrow', 'h-5 w-5') + '</button>';

    return '<li id="mission-' + esc(m.id) + '" class="group flex scroll-mt-24 flex-col md:scroll-mt-48">' +
      '<div class="ph ph-zoom aspect-[4/3]">' + photo(m, { sizes: '(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw' }) +
        '<div class="absolute inset-x-3 top-3 flex items-start justify-between gap-2">' +
          '<span class="' + PILL + ' ' + t.color + '">' + esc(t.label) + '</span>' +
          (m.isNew ? '<span class="sticker rotate-3 bg-lime-300">Nouveau</span>' : '') +
        '</div>' +
      '</div>' +

      '<h2 class="mt-5 text-[1.75rem] sm:text-[1.85rem]">' + esc(m.title) + '</h2>' +

      '<div class="mt-5">' + facts([
        ['Durée', '<span class="font-semibold">' + duration(m.duration) + '</span>'],
        ['Rendez-vous', esc(m.location)],
        m.schedule ? ['Quand', esc(m.schedule)] : null,
      ]) + '</div>' +

      // Bas de fiche (contrepartie, détails, bouton) calé en bas : les blocs
      // s'alignent d'une carte à l'autre sur une même rangée.
      '<div class="mt-auto pt-6">' +
        // Contrepartie : dans la couleur du type de mission
        '<div class="p-5 text-night ' + t.color + '">' +
          '<p class="text-sm text-night/60">En échange</p>' +
          '<p class="mt-1 font-display text-xl font-bold leading-tight tracking-[-0.02em]">' + esc(m.reward.title) + '</p>' +
          '<p class="mt-1.5 text-sm text-night/70">offert par ' + esc(m.reward.partner) + '</p>' +
        '</div>' +

        '<details class="acc mt-3"' + (focusId === m.id ? ' open' : '') + '>' +
          '<summary class="min-h-[48px] py-2 font-display font-semibold">Plus d’infos<span class="acc-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunk">' + icon('plus', 'h-4 w-4') + '</span></summary>' +
          '<div class="pb-2 pt-1">' +
            '<p class="text-muted">' + esc(m.description) + '</p>' +
            '<div class="mt-4">' + facts([
              m.host ? ['Encadré par', esc(m.host)] : null,
              ['Places', esc(m.spots)],
              ['Saisons', m.seasons.map((s) => esc(seasonLabel(s))).join(', ')],
            ]) + '</div>' +
          '</div>' +
        '</details>' +

        '<div class="pt-5">' + cta + '</div>' +
      '</div>' +
    '</li>';
  }

  function render(state, params) {
    const { SEASONS, TYPES } = Meleze.data;
    const list = state.missions.filter((m) =>
      (filters.season === 'all' || m.seasons.includes(filters.season)) &&
      (filters.type === 'all' || m.type === filters.type));
    const filtered = filters.season !== 'all' || filters.type !== 'all';

    return '<section class="' + WRAP + ' pt-12 lg:pt-20">' +
      '<h1 id="page-title" tabindex="-1" class="text-5xl font-extrabold sm:text-7xl">Les <span class="mark">missions</span></h1>' +
      '<p class="mt-4 max-w-xl text-lg text-muted">Des actions utiles d’une à deux heures, encadrées par des gens du coin. Chaque fiche indique ce que vous recevez en échange.</p>' +
    '</section>' +

    '<div class="mt-8 md:sticky md:top-[65px] md:z-30 md:bg-surface/95 md:backdrop-blur" role="group" aria-label="Filtres">' +
      '<div class="mx-auto max-w-app space-y-1 py-2">' +
        chipRow('Saison',
          chip('season', 'all', 'Toute l’année', filters.season === 'all') +
          SEASONS.map((s) => chip('season', s.id, esc(s.label), filters.season === s.id)).join('')) +
        chipRow('Type de mission',
          chip('type', 'all', 'Tous les types', filters.type === 'all') +
          TYPES.map((t) => chip('type', t.id, '<span class="h-2.5 w-2.5 rounded-full ' + t.color + '" aria-hidden="true"></span>' + esc(t.label), filters.type === t.id)).join('')) +
      '</div>' +
    '</div>' +

    '<section class="' + WRAP + ' pb-16 pt-6 lg:pb-24">' +
      '<div class="flex min-h-[44px] items-center justify-between gap-4">' +
        '<p class="font-display font-semibold text-muted" aria-live="polite">' + list.length + ' mission' + (list.length > 1 ? 's' : '') + '</p>' +
        (filtered && list.length ? '<button type="button" class="link text-[0.95rem]" data-action="clear-filters">Effacer les filtres</button>' : '') +
      '</div>' +
      (list.length
        ? '<ul class="mt-6 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">' + list.map((m) => card(m, params.focus)).join('') + '</ul>'
        : '<div class="mt-6 bg-sunk px-6 py-14 text-center sm:py-20">' +
            '<p class="mx-auto max-w-md font-display text-2xl font-bold leading-tight tracking-[-0.02em] sm:text-3xl">Aucune mission ne correspond à ces filtres pour l’instant.</p>' +
            '<p class="mt-3 text-muted">Essayez une autre saison ou un autre type.</p>' +
            '<button type="button" class="btn-secondary btn-sm mt-6" data-action="clear-filters">Voir toutes les missions</button>' +
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
      if (store.join(el.dataset.id)) toast('C’est noté : vous participez à « ' + m.title + ' ».');
    },
  };

  /** Après rendu : on amène la mission ciblée (lien depuis l'accueil) à l'écran. */
  function mounted(root, params) {
    if (!params.focus) return;
    const target = document.getElementById('mission-' + params.focus);
    if (target) target.scrollIntoView({ block: 'center' });
  }

  return { title: 'Missions', render, actions, mounted };
})();
