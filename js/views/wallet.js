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
    terminee: { label: 'À faire valider', cls: 'tag bg-lime-300' },
  };

  function participationRow({ participation: p, mission: m }) {
    const s = STATUS[p.status];
    const t = typeOf(m.type);
    const actions = p.status === 'inscrite'
      ? '<div class="mt-4 flex flex-wrap gap-2">' +
          '<button type="button" class="btn-primary btn-sm" data-action="done" data-id="' + esc(p.id) + '">J’ai terminé</button>' +
          '<button type="button" class="btn-secondary btn-sm" data-action="cancel" data-id="' + esc(p.id) + '">Me désinscrire</button>' +
        '</div>'
      : '<p class="mt-4 flex items-start gap-2.5 rounded-2xl bg-tint px-4 py-3 text-[0.95rem]">' + icon('scan', 'mt-0.5 h-5 w-5 shrink-0') + '<span>Montrez votre QR au référent pour recevoir : <strong>' + esc(m.reward.title) + '</strong>.</span></p>';

    return '<li class="rounded-4xl border border-line bg-card p-3 sm:p-4">' +
      '<div class="flex gap-4">' +
        '<div class="ph aspect-square w-20 shrink-0 rounded-3xl sm:w-24">' + photo(m, { sizes: '100px', alt: '' }) + '</div>' +
        '<div class="min-w-0 flex-1">' +
          '<span class="' + s.cls + '">' + s.label + '</span>' +
          '<h3 class="mt-2 text-xl">' + esc(m.title) + '</h3>' +
          '<p class="mt-0.5 text-sm text-muted">' + esc(t.label) + ' · ' + duration(m.duration) + ' · ' + esc(m.location) + '</p>' +
        '</div>' +
      '</div>' +
      actions +
    '</li>';
  }

  function voucherCard(v) {
    const used = v.status === 'consomme';
    const m = store.getMission(v.missionId);
    const color = used ? 'bg-sunk text-muted' : (m ? typeOf(m.type).color : 'bg-leaf') + ' text-night';
    return '<li class="flex gap-4 rounded-4xl p-4 ' + color + '">' +
      '<div class="shrink-0 self-start rounded-2xl bg-white p-1.5">' + qr(v.code, { size: 'w-20', muted: used }) + '</div>' +
      '<div class="min-w-0">' +
        '<p class="text-sm opacity-75">' + esc(v.partner) + '</p>' +
        '<h3 class="mt-0.5 text-xl ' + (used ? 'line-through decoration-2' : '') + '">' + esc(v.title) + '</h3>' +
        '<p class="mt-2 font-mono text-[0.95rem] font-semibold tracking-wide">' + esc(v.code) + '</p>' +
        '<p class="mt-1 text-sm">' + (used ? 'Utilisé le ' + date(v.usedAt) : '<span class="tag bg-white">Valable</span> <span class="opacity-75">reçu le ' + date(v.issuedAt) + '</span>') + '</p>' +
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
      '<h1 id="page-title" tabindex="-1" class="text-5xl font-extrabold sm:text-7xl">Bonjour <span class="mark">' + esc(u.firstName) + '</span></h1>' +
      '<p class="mt-4 max-w-2xl text-lg text-muted">' +
        (validated.length
          ? 'Vous avez déjà donné ' + duration(minutes) + ' à la montagne (' + plural(validated.length, 'mission') + ' validée' + (validated.length > 1 ? 's' : '') + '). Merci !'
          : 'Vos missions et vos bons apparaîtront ici.') +
        (activeCount ? ' Il vous reste ' + plural(activeCount, 'bon') + ' à utiliser.' : '') +
      '</p>' +

      '<div class="mt-8 grid gap-10 lg:grid-cols-[20rem_1fr] lg:gap-14">' +
        // ---- QR personnel ------------------------------------------------------------
        '<section aria-labelledby="myqr" class="lg:sticky lg:top-24 lg:self-start">' +
          '<div class="rounded-4xl bg-lime-300 p-6 text-center text-night">' +
            '<h2 id="myqr" class="text-3xl">Mon QR</h2>' +
            '<p class="mt-1 text-[0.95rem] text-night/70">À montrer au référent à la fin de chaque mission.</p>' +
            '<div class="mx-auto mt-5 w-fit rounded-3xl bg-white p-3">' + qr(u.code, { size: 'w-48' }) + '</div>' +
            '<p class="mt-4 font-mono text-lg font-bold tracking-[0.18em]">' + esc(u.code) + '</p>' +
            '<p class="mt-1 text-sm text-night/70">Astuce : montez la luminosité de l’écran.</p>' +
          '</div>' +
        '</section>' +

        '<div class="space-y-12">' +
          '<section aria-labelledby="ongoing">' +
            '<h2 id="ongoing" class="text-4xl">Mes missions</h2>' +
            (active.length
              ? '<ul class="mt-4 space-y-3">' + active.map(participationRow).join('') + '</ul>'
              : '<div class="mt-4 rounded-4xl bg-sunk p-6"><p class="text-muted">Aucune mission en cours.</p><a href="#/missions" class="link mt-2">Trouver une mission ' + icon('arrow', 'h-4 w-4') + '</a></div>') +
          '</section>' +

          '<section aria-labelledby="rewards">' +
            '<h2 id="rewards" class="text-4xl">Mes bons</h2>' +
            '<p class="mt-1 text-muted">Le commerçant scanne le QR du bon, et c’est tout.</p>' +
            (vouchers.length
              ? '<ul class="mt-4 grid gap-3 xl:grid-cols-2">' + vouchers.map(voucherCard).join('') + '</ul>'
              : '<p class="mt-4 rounded-4xl bg-sunk p-6 text-muted">Vos bons apparaîtront ici.</p>') +
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
