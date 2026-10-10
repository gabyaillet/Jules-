/* ==========================================================================
   Vue : Catalogue des missions (filtres Saison + Type)
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.catalogue = (function () {
  'use strict';
  const { esc, icon, photo, duration, typeOf, seasonLabel, toast } = Meleze.ui;
  const store = Meleze.store;

  // Filtres conservés pendant la navigation (pas besoin de les persister)
  const filters = { season: 'all', type: 'all' };

  function chip(group, value, label, active) {
    return '<button type="button" class="chip" data-action="filter" data-group="' + group + '" data-value="' + value + '" aria-pressed="' + active + '">' + label + '</button>';
  }

  function card(m, focusId) {
    const t = typeOf(m.type);
    const p = store.participationFor(m.id);
    const cta = p
      ? '<a href="#/wallet" class="btn-ghost w-full">' + icon('check', 'h-4 w-4') + (p.status === 'terminee' ? 'Terminée · à faire valider' : 'Inscrit·e · voir mon wallet') + '</a>'
      : '<button type="button" class="btn-primary w-full" data-action="join" data-id="' + esc(m.id) + '">Je participe <span class="btn-arrow">' + icon('arrow', 'h-4 w-4') + '</span></button>';

    return '<li id="mission-' + esc(m.id) + '" class="group flex flex-col rounded-[2rem] bg-card p-2 ring-1 ring-line/80">' +
      // Photo + étiquettes
      '<div class="ph ph-zoom aspect-[4/3] rounded-[1.5rem]">' + photo(m, { sizes: '(min-width:1024px) 30vw, (min-width:768px) 45vw, 95vw' }) +
        '<span class="badge-glass absolute left-3 top-3">' + icon(t.icon, 'h-3.5 w-3.5') + esc(t.label) + '</span>' +
        (m.isNew ? '<span class="badge absolute right-3 top-3 bg-accent text-on-accent">Nouveau</span>' : '') +
        '<span class="badge absolute bottom-3 left-3 bg-snow-50 text-fir-900">' + icon('clock', 'h-3.5 w-3.5') + duration(m.duration) + '</span>' +
      '</div>' +
      '<div class="flex flex-1 flex-col px-3 pb-3 pt-5">' +
        '<p class="flex items-center gap-1.5 text-sm text-muted">' + icon('pin', 'h-4 w-4 shrink-0') + esc(m.location) + '</p>' +
        '<h2 class="mt-2 text-[1.85rem] leading-[1.05]">' + esc(m.title) + '</h2>' +
        (m.schedule ? '<p class="mt-2 flex items-center gap-1.5 text-sm text-muted">' + icon('calendar', 'h-4 w-4 shrink-0') + esc(m.schedule) + '</p>' : '') +
        // Récompense : toujours visible, c'est le cœur de la promesse
        '<div class="mt-5 flex items-center gap-3 rounded-2xl bg-accent/15 p-3">' +
          '<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">' + icon('gift', 'h-5 w-5') + '</span>' +
          '<div class="min-w-0"><p class="font-semibold leading-snug">' + esc(m.reward.title) + '</p>' +
          '<p class="text-sm text-muted">offert par ' + esc(m.reward.partner) + '</p></div>' +
        '</div>' +
        '<details class="acc mt-3"' + (focusId === m.id ? ' open' : '') + '>' +
          '<summary class="py-2 text-sm font-semibold">En savoir plus<span class="acc-icon flex h-8 w-8 items-center justify-center rounded-full bg-sunk">' + icon('plus', 'h-4 w-4') + '</span></summary>' +
          '<p class="mt-1 text-[0.95rem] text-muted">' + esc(m.description) + '</p>' +
          '<dl class="mt-4 grid grid-cols-2 gap-3 text-sm">' +
            '<div class="rounded-2xl bg-sunk p-3"><dt class="text-muted">Référent</dt><dd class="font-semibold">' + esc(m.host || '—') + '</dd></div>' +
            '<div class="rounded-2xl bg-sunk p-3"><dt class="text-muted">Places</dt><dd class="font-semibold">' + esc(m.spots) + '</dd></div>' +
            '<div class="col-span-2 rounded-2xl bg-sunk p-3"><dt class="text-muted">Saisons</dt><dd class="font-semibold">' + m.seasons.map(seasonLabel).join(' · ') + '</dd></div>' +
          '</dl>' +
        '</details>' +
        '<div class="mt-auto pt-4">' + cta + '</div>' +
      '</div>' +
    '</li>';
  }

  function render(state, params) {
    const { SEASONS, TYPES } = Meleze.data;
    const list = state.missions.filter((m) =>
      (filters.season === 'all' || m.seasons.includes(filters.season)) &&
      (filters.type === 'all' || m.type === filters.type));

    return '<section class="mx-auto max-w-app px-5 pt-10 sm:px-8 sm:pt-16">' +
      '<div class="flex flex-wrap items-end justify-between gap-4">' +
        '<div><p class="eyebrow">Catalogue</p>' +
        '<h1 id="page-title" tabindex="-1" class="mt-4 text-6xl leading-[0.9] sm:text-8xl">Les <em>missions</em></h1></div>' +
        '<p class="max-w-xs text-muted">Une action utile d\u20191 à 2 heures. La récompense est indiquée sur chaque carte.</p>' +
      '</div>' +
    '</section>' +

    '<div class="sticky top-[68px] z-30 mt-8 border-y border-line/70 bg-surface/90 backdrop-blur-xl" role="group" aria-label="Filtres">' +
      '<div class="mx-auto max-w-app space-y-2 px-5 py-3 sm:px-8">' +
        '<div class="rail !mx-0 !px-0 gap-2" aria-label="Saison">' +
          chip('season', 'all', 'Toutes saisons', filters.season === 'all') +
          SEASONS.map((s) => chip('season', s.id, s.label, filters.season === s.id)).join('') +
        '</div>' +
        '<div class="rail !mx-0 !px-0 gap-2" aria-label="Type de mission">' +
          chip('type', 'all', 'Tous types', filters.type === 'all') +
          TYPES.map((t) => chip('type', t.id, icon(t.icon, 'h-4 w-4') + t.label, filters.type === t.id)).join('') +
        '</div>' +
      '</div>' +
    '</div>' +

    '<section class="mx-auto max-w-app px-5 pb-16 pt-6 sm:px-8">' +
      '<p class="text-sm font-medium text-muted" aria-live="polite">' + list.length + ' mission' + (list.length > 1 ? 's' : '') + ' disponible' + (list.length > 1 ? 's' : '') + '</p>' +
      (list.length
        ? '<ul class="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">' + list.map((m) => card(m, params.focus)).join('') + '</ul>'
        : '<div class="card mt-4 p-10 text-center"><p class="font-serif text-4xl">Aucune mission pour ces filtres.</p>' +
          '<button type="button" class="btn-ghost btn-sm mt-6" data-action="clear-filters">Réinitialiser les filtres</button></div>') +
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
      if (store.join(el.dataset.id)) toast('Inscription confirmée : ' + m.title);
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
