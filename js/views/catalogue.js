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

  /** Une ligne d'info pratique (icône + libellé + valeur). */
  function info(ic, label, value) {
    return '<div class="flex items-start gap-2.5">' + icon(ic, 'mt-0.5 h-5 w-5 shrink-0') +
      '<div><dt class="sr-only">' + label + '</dt><dd>' + value + '</dd></div></div>';
  }

  function card(m, focusId) {
    const t = typeOf(m.type);
    const p = store.participationFor(m.id);
    const cta = p
      ? '<a href="#/wallet" class="btn-secondary w-full">' + icon('check', 'h-5 w-5') + (p.status === 'terminee' ? 'Terminée, à faire valider' : 'Inscrit·e, voir mon espace') + '</a>'
      : '<button type="button" class="btn-primary w-full" data-action="join" data-id="' + esc(m.id) + '">Je participe ' + icon('arrow', 'h-5 w-5') + '</button>';

    return '<li id="mission-' + esc(m.id) + '" class="group flex flex-col rounded-4xl border border-line bg-card p-2">' +
      '<div class="ph ph-zoom aspect-[4/3] rounded-3xl">' + photo(m, { sizes: '(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw' }) +
        '<span class="sticker absolute left-3 top-3 ' + t.color + '">' + icon(t.icon, 'h-4 w-4') + esc(t.label) + '</span>' +
        (m.isNew ? '<span class="sticker absolute right-3 top-3 rotate-3 bg-lime-300">Nouveau</span>' : '') +
      '</div>' +
      '<div class="flex flex-1 flex-col px-3 pb-3 pt-4">' +
        '<h2 class="text-[1.65rem]">' + esc(m.title) + '</h2>' +
        '<dl class="mt-4 space-y-2 text-[0.98rem] text-muted">' +
          info('clock', 'Durée', '<strong class="font-semibold text-ink">' + duration(m.duration) + '</strong>') +
          info('pin', 'Rendez-vous', esc(m.location)) +
          (m.schedule ? info('calendar', 'Quand', esc(m.schedule)) : '') +
        '</dl>' +
        // Contrepartie : dans la couleur du type de mission
        '<div class="mt-5 flex items-center gap-3 rounded-3xl p-3 text-night ' + t.color + '">' +
          '<span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white">' + icon('gift', 'h-5 w-5') + '</span>' +
          '<div class="min-w-0"><p class="font-display font-bold leading-snug tracking-[-0.01em]">' + esc(m.reward.title) + '</p>' +
          '<p class="text-sm text-night/70">offert par ' + esc(m.reward.partner) + '</p></div>' +
        '</div>' +
        '<details class="acc mt-3"' + (focusId === m.id ? ' open' : '') + '>' +
          '<summary class="py-2 font-display font-semibold">Plus d’infos<span class="acc-icon flex h-8 w-8 items-center justify-center rounded-full bg-sunk">' + icon('plus', 'h-4 w-4') + '</span></summary>' +
          '<p class="text-muted">' + esc(m.description) + '</p>' +
          '<p class="mt-3 text-sm text-muted">Avec <span class="font-semibold text-ink">' + esc(m.host || '—') + '</span> · ' + esc(m.spots) + ' places · ' + m.seasons.map(seasonLabel).join(', ') + '</p>' +
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

    return '<section class="mx-auto max-w-app px-5 pt-8 sm:px-8 md:pt-14">' +
      '<div class="flex flex-wrap items-end justify-between gap-4">' +
        '<h1 id="page-title" tabindex="-1" class="text-5xl font-extrabold sm:text-7xl">Les <span class="mark">missions</span></h1>' +
        '<p class="max-w-sm text-muted">Des actions utiles d’1 à 2 heures, encadrées par des gens du coin. La contrepartie est indiquée sur chaque fiche.</p>' +
      '</div>' +
    '</section>' +

    '<div class="sticky top-[65px] z-30 mt-6 bg-surface/95 backdrop-blur" role="group" aria-label="Filtres">' +
      '<div class="mx-auto max-w-app space-y-2 px-5 py-3 sm:px-8">' +
        '<div class="flex gap-2 overflow-x-auto pb-0.5" aria-label="Saison">' +
          chip('season', 'all', 'Toute l’année', filters.season === 'all') +
          SEASONS.map((s) => chip('season', s.id, s.label, filters.season === s.id)).join('') +
        '</div>' +
        '<div class="flex gap-2 overflow-x-auto pb-0.5" aria-label="Type de mission">' +
          chip('type', 'all', 'Tous les types', filters.type === 'all') +
          TYPES.map((t) => chip('type', t.id, '<span class="h-2.5 w-2.5 rounded-full ' + t.color + '"></span>' + t.label, filters.type === t.id)).join('') +
        '</div>' +
      '</div>' +
    '</div>' +

    '<section class="mx-auto max-w-app px-5 pb-16 pt-4 sm:px-8">' +
      '<p class="font-display font-semibold text-muted" aria-live="polite">' + list.length + ' mission' + (list.length > 1 ? 's' : '') + '</p>' +
      (list.length
        ? '<ul class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">' + list.map((m) => card(m, params.focus)).join('') + '</ul>'
        : '<div class="mt-4 rounded-4xl bg-sunk p-10 text-center"><p class="font-display text-2xl font-bold">Aucune mission ne correspond à ces filtres pour l’instant.</p>' +
          '<button type="button" class="btn-secondary btn-sm mt-5" data-action="clear-filters">Voir toutes les missions</button></div>') +
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
