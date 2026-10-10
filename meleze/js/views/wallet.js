/* ==========================================================================
   Vue : Profil / Wallet du touriste
   QR personnel · missions en cours · bons de récompense
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.wallet = (function () {
  'use strict';
  const { esc, icon, qr, duration, date, typeOf, toast } = Meleze.ui;
  const store = Meleze.store;

  const STATUS = {
    inscrite: { label: 'Inscrit·e', cls: 'bg-sunk text-ink' },
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
      : '<p class="mt-4 flex items-start gap-2 rounded-2xl bg-accent/15 p-3 text-sm font-semibold">' + icon('scan', 'h-5 w-5 shrink-0 text-accent-ink') +
        'Montrez votre QR code personnel au référent pour débloquer&nbsp;: ' + esc(m.reward.title) + '</p>';

    return '<li class="card p-5">' +
      '<div class="flex items-start justify-between gap-3">' +
        '<span class="flex items-center gap-2 text-sm text-muted">' + icon(t.icon, 'h-4 w-4') + esc(t.label) + ' · ' + duration(m.duration) + '</span>' +
        '<span class="badge shrink-0 ' + s.cls + '">' + s.label + '</span>' +
      '</div>' +
      '<h3 class="mt-2 text-xl leading-snug">' + esc(m.title) + '</h3>' +
      '<p class="mt-1 flex items-center gap-1.5 text-sm text-muted">' + icon('pin', 'h-4 w-4') + esc(m.location) + '</p>' +
      actions +
    '</li>';
  }

  function voucherCard(v) {
    const used = v.status === 'consomme';
    return '<li class="card flex gap-4 p-4 ' + (used ? 'opacity-60 grayscale' : '') + '">' +
      '<div class="shrink-0 self-start rounded-2xl bg-snow-100 p-1.5">' + qr(v.code, { size: 'w-24', muted: used }) + '</div>' +
      '<div class="min-w-0 flex-1">' +
        '<span class="badge ' + (used ? 'bg-sunk text-muted' : 'bg-ok/15 text-ok') + '">' + (used ? 'Utilisé' : 'Valable') + '</span>' +
        '<h3 class="mt-2 text-lg leading-snug ' + (used ? 'line-through' : '') + '">' + esc(v.title) + '</h3>' +
        '<p class="text-sm text-muted">' + esc(v.partner) + '</p>' +
        '<p class="mt-2 font-mono text-sm font-bold tracking-wider">' + esc(v.code) + '</p>' +
        '<p class="text-xs text-muted">' + (used ? 'Utilisé le ' + date(v.usedAt) : 'Obtenu le ' + date(v.issuedAt)) + '</p>' +
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

    return '<div class="mx-auto max-w-app px-4 py-10 sm:px-8">' +
      '<p class="eyebrow">Mon wallet</p>' +
      '<h1 id="page-title" tabindex="-1" class="mt-2 text-4xl sm:text-6xl">Bonjour ' + esc(u.firstName) + '</h1>' +

      '<dl class="mt-6 grid grid-cols-3 gap-3 text-center">' +
        kpi(minutes ? duration(minutes) : '0 h', 'offertes à la montagne') +
        kpi(validated.length, 'mission' + (validated.length > 1 ? 's' : '') + ' validée' + (validated.length > 1 ? 's' : '')) +
        kpi(activeCount, 'bon' + (activeCount > 1 ? 's' : '') + ' à utiliser') +
      '</dl>' +

      '<div class="mt-8 grid gap-8 lg:grid-cols-[22rem_1fr]">' +
        // ---- QR personnel -------------------------------------------------------
        '<section aria-labelledby="myqr" class="lg:sticky lg:top-6 lg:self-start">' +
          '<div class="rounded-4xl bg-fir-900 p-6 text-center text-snow-100">' +
            '<h2 id="myqr" class="text-2xl">Mon QR participant</h2>' +
            '<p class="mt-1 text-sm text-snow-200/80">À présenter au référent à la fin de chaque mission.</p>' +
            '<div class="mx-auto mt-5 w-fit rounded-3xl bg-snow-100 p-3">' + qr(u.code, { size: 'w-52' }) + '</div>' +
            '<p class="mt-4 font-mono text-xl font-bold tracking-[0.2em] text-larch-300">' + esc(u.code) + '</p>' +
            '<p class="mt-1 text-xs text-snow-200/70">Augmentez la luminosité de l’écran pour le scan.</p>' +
          '</div>' +
        '</section>' +

        '<div class="space-y-10">' +
          // ---- Missions en cours ----------------------------------------------
          '<section aria-labelledby="ongoing">' +
            '<h2 id="ongoing" class="text-3xl">Missions en cours</h2>' +
            (active.length
              ? '<ul class="mt-4 space-y-3">' + active.map(participationRow).join('') + '</ul>'
              : '<div class="card mt-4 p-6"><p class="text-muted">Aucune mission en cours.</p><a href="#/missions" class="btn-primary btn-sm mt-4">Trouver une mission</a></div>') +
          '</section>' +

          // ---- Bons de récompense ----------------------------------------------
          '<section aria-labelledby="rewards">' +
            '<h2 id="rewards" class="text-3xl">Mes bons</h2>' +
            '<p class="mt-1 text-sm text-muted">Montrez le QR du bon au commerçant : il le scanne et le bon est consommé.</p>' +
            (vouchers.length
              ? '<ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">' + vouchers.map(voucherCard).join('') + '</ul>'
              : '<p class="card mt-4 p-6 text-muted">Vos récompenses apparaîtront ici.</p>') +
          '</section>' +

          '<button type="button" class="text-sm font-semibold text-muted underline underline-offset-4" data-action="reset">Réinitialiser les données de démo</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function kpi(value, label) {
    // flex-col-reverse : la valeur s'affiche au-dessus, mais <dt> reste avant <dd> dans le HTML.
    return '<div class="card flex flex-col-reverse px-2 py-4"><dt class="mt-1 text-xs text-muted sm:text-sm">' + label + '</dt><dd class="font-serif text-2xl sm:text-3xl">' + value + '</dd></div>';
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
