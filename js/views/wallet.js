/* ==========================================================================
   Vue : Profil / Wallet du touriste
   QR personnel · missions en cours · bons de récompense
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.wallet = (function () {
  'use strict';
  const { esc, icon, qr, photo, duration, date, typeOf, toast } = Meleze.ui;
  const store = Meleze.store;

  const STATUS = {
    inscrite: { label: 'Inscrit·e', cls: 'bg-sunk text-ink ring-1 ring-line' },
    terminee: { label: 'À faire valider', cls: 'bg-accent text-on-accent' },
  };

  function participationRow({ participation: p, mission: m }) {
    const s = STATUS[p.status];
    const t = typeOf(m.type);
    const actions = p.status === 'inscrite'
      ? '<div class="mt-4 flex flex-wrap gap-2">' +
          '<button type="button" class="btn-primary btn-sm" data-action="done" data-id="' + esc(p.id) + '">' + icon('check', 'h-4 w-4') + 'J’ai terminé ma mission</button>' +
          '<button type="button" class="btn-ghost btn-sm" data-action="cancel" data-id="' + esc(p.id) + '">Annuler</button>' +
        '</div>'
      : '<p class="mt-4 flex items-start gap-2.5 rounded-2xl bg-accent/15 p-3 text-sm">' + icon('scan', 'h-5 w-5 shrink-0 text-accent-ink') +
        '<span>Montrez votre QR au référent pour débloquer <strong>' + esc(m.reward.title) + '</strong></span></p>';

    return '<li class="rounded-[1.75rem] bg-card p-2 ring-1 ring-line/80">' +
      '<div class="flex gap-4">' +
        '<div class="ph aspect-square w-24 shrink-0 rounded-[1.25rem] sm:w-28">' + photo(m, { sizes: '120px', alt: '' }) + '</div>' +
        '<div class="min-w-0 flex-1 py-1 pr-2">' +
          '<div class="flex flex-wrap items-center gap-2">' +
            '<span class="badge ' + s.cls + '">' + s.label + '</span>' +
            '<span class="text-xs text-muted">' + esc(t.label) + ' · ' + duration(m.duration) + '</span>' +
          '</div>' +
          '<h3 class="mt-2 text-2xl leading-[1.05]">' + esc(m.title) + '</h3>' +
          '<p class="mt-1 flex items-center gap-1.5 text-sm text-muted">' + icon('pin', 'h-4 w-4 shrink-0') + esc(m.location) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="px-2 pb-2">' + actions + '</div>' +
    '</li>';
  }

  /** Bon au format "ticket" : photo, perforation, QR. */
  function voucherCard(v) {
    const used = v.status === 'consomme';
    const m = store.getMission(v.missionId);
    return '<li class="overflow-hidden rounded-[1.75rem] bg-card ring-1 ring-line/80 ' + (used ? 'opacity-60' : '') + '">' +
      '<div class="ph aspect-[16/7] ' + (used ? 'grayscale' : '') + '">' + photo(m || 'range', { sizes: '(min-width:640px) 40vw, 95vw', alt: '' }) +
        '<span class="badge absolute left-3 top-3 ' + (used ? 'bg-snow-50 text-mineral-700' : 'bg-accent text-on-accent') + '">' + (used ? 'Utilisé le ' + date(v.usedAt) : 'Valable') + '</span>' +
      '</div>' +
      '<div class="p-5">' +
        '<p class="text-sm text-muted">' + esc(v.partner) + '</p>' +
        '<h3 class="mt-1 text-[1.7rem] leading-[1.05] ' + (used ? 'line-through decoration-1' : '') + '">' + esc(v.title) + '</h3>' +
      '</div>' +
      '<div class="ticket-cut mx-5"></div>' +
      '<div class="flex items-center gap-4 p-5">' +
        '<div class="shrink-0 rounded-2xl bg-snow-100 p-1.5 ring-1 ring-line">' + qr(v.code, { size: 'w-20', muted: used }) + '</div>' +
        '<div><p class="text-xs uppercase tracking-[0.16em] text-muted">Code du bon</p>' +
        '<p class="mt-1 font-mono text-lg font-semibold tracking-wider">' + esc(v.code) + '</p>' +
        '<p class="text-xs text-muted">Obtenu le ' + date(v.issuedAt) + '</p></div>' +
      '</div>' +
    '</li>';
  }

  function render(state) {
    const u = state.user;
    const active = state.participations
      .filter((p) => p.status !== 'validee')
      .map((p) => ({ participation: p, mission: store.getMission(p.missionId) }))
      .filter((x) => x.mission);
    const validated = state.participations.filter((p) => p.status === 'validee');
    const minutes = validated.reduce((sum, p) => sum + ((store.getMission(p.missionId) || {}).duration || 0), 0);
    const vouchers = state.vouchers.slice().sort((a, b) => (a.status === b.status ? 0 : a.status === 'actif' ? -1 : 1));
    const activeCount = vouchers.filter((v) => v.status === 'actif').length;

    return '<div class="mx-auto max-w-app px-5 pb-16 pt-10 sm:px-8 sm:pt-16">' +
      '<p class="eyebrow">Mon wallet</p>' +
      '<h1 id="page-title" tabindex="-1" class="mt-4 text-6xl leading-[0.9] sm:text-8xl">Bonjour <em>' + esc(u.firstName) + '</em></h1>' +

      '<dl class="mt-10 grid grid-cols-3 border-y border-line py-6">' +
        kpi(minutes ? duration(minutes) : '0 h', 'offertes à la montagne') +
        kpi(validated.length, 'mission' + (validated.length > 1 ? 's' : '') + ' validée' + (validated.length > 1 ? 's' : '')) +
        kpi(activeCount, 'bon' + (activeCount > 1 ? 's' : '') + ' à utiliser') +
      '</dl>' +

      '<div class="mt-10 grid gap-12 lg:grid-cols-[24rem_1fr]">' +
        // ---- QR personnel : carte "pass" ------------------------------------------
        '<section aria-labelledby="myqr" class="lg:sticky lg:top-24 lg:self-start">' +
          '<div class="overflow-hidden rounded-[2rem] bg-fir-900 text-snow-50 shadow-xl shadow-fir-900/20">' +
            '<div class="ph scrim relative h-36">' + photo('hero', { sizes: '400px', alt: '' }) +
              '<div class="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-5">' +
                '<div><p class="text-xs uppercase tracking-[0.16em] text-snow-200/80">Pass participant</p>' +
                '<h2 id="myqr" class="text-3xl">' + esc(u.firstName) + '</h2></div>' +
                '<span class="font-serif text-2xl text-larch-300">Mélèze</span>' +
              '</div>' +
            '</div>' +
            '<div class="p-6 text-center">' +
              '<div class="mx-auto w-fit rounded-[1.5rem] bg-snow-100 p-3">' + qr(u.code, { size: 'w-52' }) + '</div>' +
              '<p class="mt-5 font-mono text-xl font-semibold tracking-[0.25em] text-larch-300">' + esc(u.code) + '</p>' +
              '<p class="mx-auto mt-2 max-w-[16rem] text-sm text-snow-200/75">À présenter au référent à la fin de chaque mission. Pensez à monter la luminosité.</p>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<div class="space-y-14">' +
          // ---- Missions en cours ----------------------------------------------
          '<section aria-labelledby="ongoing">' +
            '<h2 id="ongoing" class="text-4xl sm:text-5xl">Missions <em>en cours</em></h2>' +
            (active.length
              ? '<ul class="mt-5 space-y-3">' + active.map(participationRow).join('') + '</ul>'
              : '<div class="card mt-5 p-6"><p class="text-muted">Aucune mission en cours.</p><a href="#/missions" class="btn-primary btn-sm mt-4">Trouver une mission</a></div>') +
          '</section>' +

          // ---- Bons de récompense ----------------------------------------------
          '<section aria-labelledby="rewards">' +
            '<h2 id="rewards" class="text-4xl sm:text-5xl">Mes <em>bons</em></h2>' +
            '<p class="mt-2 text-muted">Montrez le QR du bon au commerçant : il le scanne et le bon est consommé.</p>' +
            (vouchers.length
              ? '<ul class="mt-5 grid gap-4 sm:grid-cols-2">' + vouchers.map(voucherCard).join('') + '</ul>'
              : '<p class="card mt-5 p-6 text-muted">Vos récompenses apparaîtront ici.</p>') +
          '</section>' +

          '<button type="button" class="text-sm font-medium text-muted underline underline-offset-4 hover:text-ink" data-action="reset">Réinitialiser les données de démo</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function kpi(value, label) {
    // flex-col-reverse : la valeur s'affiche au-dessus, mais <dt> reste avant <dd> dans le HTML.
    return '<div class="flex flex-col-reverse"><dt class="mt-1 text-xs text-muted sm:text-sm">' + label + '</dt><dd class="font-serif text-4xl leading-none sm:text-6xl">' + value + '</dd></div>';
  }

  const actions = {
    done(el) { store.markDone(el.dataset.id); toast('Bravo ! Montrez maintenant votre QR au référent.'); },
    cancel(el) { store.cancel(el.dataset.id); toast('Inscription annulée.'); },
    reset() {
      if (confirm('Remettre toutes les données de démonstration à zéro ?')) { store.reset(); toast('Données de démo réinitialisées.'); }
    },
  };

  return { title: 'Mon wallet', render, actions };
})();
