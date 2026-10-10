/* ==========================================================================
   Vue : Catalogue des missions (filtres Saison + Type)
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.catalogue = (function () {
  'use strict';
  const { esc, icon, duration, typeOf, seasonLabel, toast } = Meleze.ui;
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
      ? '<a href="#/wallet" class="btn-ghost w-full">' + icon('check') + (p.status === 'terminee' ? 'Terminée · à valider' : 'Inscrit·e · voir mon wallet') + '</a>'
      : '<button type="button" class="btn-primary w-full" data-action="join" data-id="' + esc(m.id) + '">Je participe</button>';

    return '<li id="mission-' + esc(m.id) + '" class="card flex flex-col p-5 sm:p-6">' +
      '<div class="flex flex-wrap items-center gap-2">' +
        '<span class="badge bg-sunk text-ink">' + icon(t.icon, 'h-3.5 w-3.5') + esc(t.label) + '</span>' +
        (m.isNew ? '<span class="badge bg-accent text-on-accent">Nouveau</span>' : '') +
      '</div>' +
      '<h2 class="mt-4 text-2xl leading-snug">' + esc(m.title) + '</h2>' +
      '<ul class="mt-4 space-y-2 text-[0.95rem]">' +
        '<li class="flex items-center gap-2.5">' + icon('clock', 'h-5 w-5 shrink-0 text-accent-ink') + '<span><strong>' + duration(m.duration) + '</strong></span></li>' +
        '<li class="flex items-center gap-2.5">' + icon('pin', 'h-5 w-5 shrink-0 text-accent-ink') + '<span>' + esc(m.location) + '</span></li>' +
        (m.schedule ? '<li class="flex items-center gap-2.5">' + icon('calendar', 'h-5 w-5 shrink-0 text-accent-ink') + '<span>' + esc(m.schedule) + '</span></li>' : '') +
      '</ul>' +
      // Récompense : toujours visible, c'est le cœur de la promesse
      '<div class="mt-5 rounded-2xl bg-accent/15 p-4">' +
        '<p class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent-ink">' + icon('gift', 'h-4 w-4') + 'En retour</p>' +
        '<p class="mt-1 font-semibold">' + esc(m.reward.title) + '</p>' +
        '<p class="text-sm text-muted">offert par ' + esc(m.reward.partner) + '</p>' +
      '</div>' +
      '<details class="acc mt-4"' + (focusId === m.id ? ' open' : '') + '>' +
        '<summary class="py-2 text-sm font-semibold">En savoir plus<span class="acc-icon">' + icon('plus', 'h-4 w-4') + '</span></summary>' +
        '<p class="mt-2 text-muted">' + esc(m.description) + '</p>' +
        '<dl class="mt-3 grid grid-cols-2 gap-3 text-sm">' +
          '<div><dt class="text-muted">Référent</dt><dd class="font-semibold">' + esc(m.host || '—') + '</dd></div>' +
          '<div><dt class="text-muted">Places</dt><dd class="font-semibold">' + esc(m.spots) + '</dd></div>' +
          '<div class="col-span-2"><dt class="text-muted">Saisons</dt><dd class="font-semibold">' + m.seasons.map(seasonLabel).join(' · ') + '</dd></div>' +
        '</dl>' +
      '</details>' +
      '<div class="mt-auto pt-5">' + cta + '</div>' +
    '</li>';
  }

  function render(state, params) {
    const { SEASONS, TYPES } = Meleze.data;
    const list = state.missions.filter((m) =>
      (filters.season === 'all' || m.seasons.includes(filters.season)) &&
      (filters.type === 'all' || m.type === filters.type));

    return '<div class="mx-auto max-w-app px-4 py-10 sm:px-8">' +
      '<p class="eyebrow">Catalogue</p>' +
      '<h1 id="page-title" tabindex="-1" class="mt-2 text-4xl sm:text-6xl">Les missions</h1>' +
      '<p class="mt-3 max-w-xl text-muted">Choisissez une action utile d’1 à 2 heures. La récompense est indiquée sur chaque carte.</p>' +

      '<div class="sticky top-0 z-10 -mx-4 mt-6 space-y-3 border-b border-line bg-surface px-4 py-3 sm:-mx-8 sm:px-8" role="group" aria-label="Filtres">' +
        '<div class="flex gap-2 overflow-x-auto pb-1" aria-label="Saison">' +
          chip('season', 'all', 'Toutes saisons', filters.season === 'all') +
          SEASONS.map((s) => chip('season', s.id, s.label, filters.season === s.id)).join('') +
        '</div>' +
        '<div class="flex gap-2 overflow-x-auto pb-1" aria-label="Type de mission">' +
          chip('type', 'all', 'Tous types', filters.type === 'all') +
          TYPES.map((t) => chip('type', t.id, icon(t.icon, 'h-4 w-4') + t.label, filters.type === t.id)).join('') +
        '</div>' +
      '</div>' +

      '<p class="mt-4 text-sm font-semibold text-muted" aria-live="polite">' + list.length + ' mission' + (list.length > 1 ? 's' : '') + '</p>' +
      (list.length
        ? '<ul class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">' + list.map((m) => card(m, params.focus)).join('') + '</ul>'
        : '<div class="card mt-4 p-8 text-center"><p class="font-serif text-2xl">Aucune mission pour ces filtres.</p>' +
          '<button type="button" class="btn-ghost btn-sm mt-4" data-action="clear-filters">Réinitialiser les filtres</button></div>') +
    '</div>';
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
