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
    return '<div class="flex gap-2.5">' + icon(ic, 'mt-0.5 h-5 w-5 shrink-0 text-muted') +
      '<div><dt class="sr-only">' + label + '</dt><dd>' + value + '</dd></div></div>';
  }

  function card(m, focusId) {
    const t = typeOf(m.type);
    const p = store.participationFor(m.id);
    const cta = p
      ? '<a href="#/wallet" class="btn-secondary w-full">' + icon('check', 'h-5 w-5 text-brand-ink') + (p.status === 'terminee' ? 'Terminée, à faire valider' : 'Inscrit·e, voir mon espace') + '</a>'
      : '<button type="button" class="btn-primary w-full" data-action="join" data-id="' + esc(m.id) + '">Je participe</button>';

    return '<li id="mission-' + esc(m.id) + '" class="flex flex-col overflow-hidden rounded-2xl border border-line bg-card">' +
      '<div class="ph aspect-[3/2]">' + photo(m, { sizes: '(min-width:1024px) 30vw, (min-width:640px) 45vw, 100vw' }) + '</div>' +
      '<div class="flex flex-1 flex-col p-5">' +
        '<div class="flex flex-wrap items-center gap-2">' +
          '<span class="tag">' + esc(t.label) + '</span>' +
          (m.isNew ? '<span class="tag bg-sand-200 text-olive-800">Nouveau</span>' : '') +
        '</div>' +
        '<h2 class="mt-3 text-2xl">' + esc(m.title) + '</h2>' +
        '<dl class="mt-4 space-y-2 text-[0.98rem]">' +
          info('clock', 'Durée', duration(m.duration)) +
          info('pin', 'Rendez-vous', esc(m.location)) +
          (m.schedule ? info('calendar', 'Quand', esc(m.schedule)) : '') +
        '</dl>' +
        // Contrepartie : toujours visible, c'est le cœur de la promesse
        '<div class="mt-5 rounded-xl bg-tint px-4 py-3">' +
          '<p class="text-sm text-muted">En échange</p>' +
          '<p class="font-semibold leading-snug">' + esc(m.reward.title) + '</p>' +
          '<p class="text-sm text-muted">offert par ' + esc(m.reward.partner) + '</p>' +
        '</div>' +
        '<details class="acc mt-3"' + (focusId === m.id ? ' open' : '') + '>' +
          '<summary class="py-2 font-semibold text-brand-ink">Plus d’infos<span class="acc-icon">' + icon('chevron', 'h-5 w-5') + '</span></summary>' +
          '<p class="text-muted">' + esc(m.description) + '</p>' +
          '<p class="mt-3 text-sm text-muted">Avec : <span class="text-ink">' + esc(m.host || '—') + '</span> · ' + esc(m.spots) + ' places · ' + m.seasons.map(seasonLabel).join(', ') + '</p>' +
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

    return '<section class="mx-auto max-w-app px-5 pt-8 sm:px-8 md:pt-12">' +
      '<h1 id="page-title" tabindex="-1" class="text-4xl sm:text-5xl">Les missions</h1>' +
      '<p class="mt-3 max-w-2xl text-muted">Des actions utiles d’1 à 2 heures, encadrées par des gens du coin. La contrepartie est indiquée sur chaque fiche.</p>' +
    '</section>' +

    '<div class="sticky top-[61px] z-30 mt-6 border-y border-line bg-surface" role="group" aria-label="Filtres">' +
      '<div class="mx-auto max-w-app space-y-2 px-5 py-3 sm:px-8">' +
        '<div class="flex gap-2 overflow-x-auto pb-0.5" aria-label="Saison">' +
          chip('season', 'all', 'Toute l’année', filters.season === 'all') +
          SEASONS.map((s) => chip('season', s.id, s.label, filters.season === s.id)).join('') +
        '</div>' +
        '<div class="flex gap-2 overflow-x-auto pb-0.5" aria-label="Type de mission">' +
          chip('type', 'all', 'Tous les types', filters.type === 'all') +
          TYPES.map((t) => chip('type', t.id, t.label, filters.type === t.id)).join('') +
        '</div>' +
      '</div>' +
    '</div>' +

    '<section class="mx-auto max-w-app px-5 pb-16 pt-5 sm:px-8">' +
      '<p class="text-muted" aria-live="polite">' + list.length + ' mission' + (list.length > 1 ? 's' : '') + '</p>' +
      (list.length
        ? '<ul class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">' + list.map((m) => card(m, params.focus)).join('') + '</ul>'
        : '<div class="mt-4 rounded-2xl bg-sunk p-8 text-center"><p class="text-lg">Aucune mission ne correspond à ces filtres pour l’instant.</p>' +
          '<button type="button" class="btn-secondary btn-sm mt-4" data-action="clear-filters">Voir toutes les missions</button></div>') +
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
