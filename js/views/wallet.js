/* ==========================================================================
   Vue : Mon espace (profil / wallet du touriste)
   QR personnel · missions en cours · bons de récompense
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.wallet = (function () {
  'use strict';
  const { esc, icon, qr, photo, duration, date, typeOf, toast } = Meleze.ui;
  const store = Meleze.store;

  const STATUS = {
    inscrite: { label: 'Inscrit·e', cls: 'tag' },
    terminee: { label: 'À faire valider', cls: 'tag bg-sand-300 text-olive-900' },
  };

  function participationRow({ participation: p, mission: m }) {
    const s = STATUS[p.status];
    const t = typeOf(m.type);
    const actions = p.status === 'inscrite'
      ? '<div class="mt-4 flex flex-wrap gap-2">' +
          '<button type="button" class="btn-primary btn-sm" data-action="done" data-id="' + esc(p.id) + '">J’ai terminé</button>' +
          '<button type="button" class="btn-secondary btn-sm" data-action="cancel" data-id="' + esc(p.id) + '">Me désinscrire</button>' +
        '</div>'
      : '<p class="mt-4 rounded-xl bg-tint px-4 py-3 text-[0.95rem]">Montrez votre QR au référent pour recevoir : <strong>' + esc(m.reward.title) + '</strong>.</p>';

    return '<li class="rounded-2xl border border-line bg-card p-4">' +
      '<div class="flex gap-4">' +
        '<div class="ph aspect-square w-20 shrink-0 rounded-xl sm:w-24">' + photo(m, { sizes: '100px', alt: '' }) + '</div>' +
        '<div class="min-w-0 flex-1">' +
          '<span class="' + s.cls + '">' + s.label + '</span>' +
          '<h3 class="mt-1.5 text-xl">' + esc(m.title) + '</h3>' +
          '<p class="mt-0.5 text-sm text-muted">' + esc(t.label) + ' · ' + duration(m.duration) + ' · ' + esc(m.location) + '</p>' +
        '</div>' +
      '</div>' +
      actions +
    '</li>';
  }

  function voucherCard(v) {
    const used = v.status === 'consomme';
    return '<li class="flex gap-4 rounded-2xl border border-line p-4 ' + (used ? 'bg-sunk text-muted' : 'bg-card') + '">' +
      '<div class="shrink-0 self-start rounded-xl bg-sand-50 p-1.5 ring-1 ring-line">' + qr(v.code, { size: 'w-20', muted: used }) + '</div>' +
      '<div class="min-w-0">' +
        '<p class="text-sm text-muted">' + esc(v.partner) + '</p>' +
        '<h3 class="mt-0.5 text-xl ' + (used ? 'line-through decoration-1' : '') + '">' + esc(v.title) + '</h3>' +
        '<p class="mt-2 font-mono text-[0.95rem] font-semibold tracking-wide">' + esc(v.code) + '</p>' +
        '<p class="text-sm ' + (used ? '' : 'text-brand-ink') + '">' + (used ? 'Utilisé le ' + date(v.usedAt) : 'Valable · reçu le ' + date(v.issuedAt)) + '</p>' +
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
    const plural = (n, word) => n + ' ' + word + (n > 1 ? 's' : '');

    return '<div class="mx-auto max-w-app px-5 pb-16 pt-8 sm:px-8 md:pt-12">' +
      '<h1 id="page-title" tabindex="-1" class="text-4xl sm:text-5xl">Bonjour ' + esc(u.firstName) + '</h1>' +
      '<p class="mt-3 text-muted">' +
        (validated.length
          ? 'Vous avez déjà donné ' + duration(minutes) + ' à la montagne (' + plural(validated.length, 'mission') + ' validée' + (validated.length > 1 ? 's' : '') + '). Merci !'
          : 'Vos missions et vos bons apparaîtront ici.') +
        (activeCount ? ' Il vous reste ' + plural(activeCount, 'bon') + ' à utiliser.' : '') +
      '</p>' +

      '<div class="mt-8 grid gap-10 lg:grid-cols-[20rem_1fr] lg:gap-14">' +
        // ---- QR personnel ------------------------------------------------------------
        '<section aria-labelledby="myqr" class="lg:sticky lg:top-24 lg:self-start">' +
          '<div class="rounded-2xl border border-sage-300 bg-tint p-5 text-center">' +
            '<h2 id="myqr" class="text-2xl">Mon QR de participant</h2>' +
            '<p class="mt-1 text-[0.95rem] text-muted">À montrer au référent à la fin de chaque mission.</p>' +
            '<div class="mx-auto mt-4 w-fit rounded-xl bg-sand-50 p-3 ring-1 ring-line">' + qr(u.code, { size: 'w-48' }) + '</div>' +
            '<p class="mt-3 font-mono text-lg font-semibold tracking-[0.18em]">' + esc(u.code) + '</p>' +
            '<p class="mt-1 text-sm text-muted">Astuce : montez la luminosité de l’écran.</p>' +
          '</div>' +
        '</section>' +

        '<div class="space-y-12">' +
          '<section aria-labelledby="ongoing">' +
            '<h2 id="ongoing" class="text-3xl">Mes missions</h2>' +
            (active.length
              ? '<ul class="mt-4 space-y-3">' + active.map(participationRow).join('') + '</ul>'
              : '<div class="mt-4 rounded-2xl bg-sunk p-5"><p class="text-muted">Aucune mission en cours.</p><a href="#/missions" class="link mt-2">Trouver une mission ' + icon('arrow', 'h-4 w-4') + '</a></div>') +
          '</section>' +

          '<section aria-labelledby="rewards">' +
            '<h2 id="rewards" class="text-3xl">Mes bons</h2>' +
            '<p class="mt-1 text-muted">Le commerçant scanne le QR du bon, et c’est tout.</p>' +
            (vouchers.length
              ? '<ul class="mt-4 grid gap-3 xl:grid-cols-2">' + vouchers.map(voucherCard).join('') + '</ul>'
              : '<p class="mt-4 rounded-2xl bg-sunk p-5 text-muted">Vos bons apparaîtront ici.</p>') +
          '</section>' +

          '<button type="button" class="text-sm text-muted underline underline-offset-4 hover:text-ink" data-action="reset">Réinitialiser les données de démo</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  const actions = {
    done(el) { store.markDone(el.dataset.id); toast('Merci ! Montrez maintenant votre QR au référent.'); },
    cancel(el) { store.cancel(el.dataset.id); toast('Vous êtes désinscrit·e de cette mission.'); },
    reset() {
      if (confirm('Remettre toutes les données de démonstration à zéro ?')) { store.reset(); toast('Données de démo réinitialisées.'); }
    },
  };

  return { title: 'Mon espace', render, actions };
})();
