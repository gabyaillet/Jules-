/* ==========================================================================
   Vue : Mon espace (profil / wallet du touriste)
   QR personnel · missions en cours · bons de récompense
   Pas d'icônes décoratives : la typographie et la couleur du type portent l'info.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.wallet = (function () {
  'use strict';
  const { esc, icon, qr, photo, duration, date, typeOf, toast } = Meleze.ui;
  const store = Meleze.store;

  // Lignes sur fond blanc : l'étiquette "Inscrit·e" est grise, "À faire valider" lime.
  const STATUS = {
    inscrite: { label: 'Inscrit·e', cls: 'tag' },
    terminee: { label: 'À faire valider', cls: 'tag bg-lime-300' },
  };

  /** Ligne "mission en cours" : vignette, statut, titre, infos, contrepartie, actions. */
  function participationRow({ participation: p, mission: m }) {
    const s = STATUS[p.status] || STATUS.inscrite;
    const meta = [m.duration ? duration(m.duration) : '', m.location ? esc(m.location) : ''].filter(Boolean).join(' · ');
    const next = p.status === 'inscrite'
      ? '<div class="mt-4 flex flex-wrap gap-2">' +
          '<button type="button" class="btn-primary btn-sm" data-action="done" data-id="' + esc(p.id) + '">J’ai terminé</button>' +
          '<button type="button" class="btn-secondary btn-sm" data-action="cancel" data-id="' + esc(p.id) + '">Me désinscrire</button>' +
        '</div>'
      : '<p class="mt-1 text-[0.95rem] text-muted">Montrez votre QR au référent pour le recevoir.</p>';

    return '<li class="py-6">' +
      '<div class="flex items-start gap-4 sm:gap-5">' +
        '<div class="ph ph-sm aspect-square w-16 shrink-0 sm:w-24">' + photo(m, { sizes: '100px', alt: '' }) + '</div>' +
        '<div class="min-w-0 flex-1">' +
          '<span class="' + s.cls + '">' + s.label + '</span>' +
          '<h3 class="mt-2 text-lg leading-tight sm:text-2xl">' + esc(m.title) + '</h3>' +
          (meta ? '<p class="mt-1.5 text-sm text-muted">' + meta + '</p>' : '') +
        '</div>' +
      '</div>' +
      '<div class="mt-4 sm:ml-[7.25rem]">' +
        '<p class="text-[0.95rem]"><span class="text-muted">En échange :</span> <span class="font-semibold">' + esc(m.reward.title) + '</span></p>' +
        next +
      '</div>' +
    '</li>';
  }

  /** Bon façon ticket : partenaire + contrepartie en haut, code et QR en bas. */
  function voucherCard(v) {
    const used = v.status === 'consomme';
    const m = store.getMission(v.missionId);
    const surface = used ? 'bg-sunk text-muted' : (m ? typeOf(m.type).color : 'bg-leaf') + ' text-night';
    const soft = used ? 'text-muted' : 'text-night/60';
    const softer = used ? 'text-muted' : 'text-night/70';
    return '<li class="flex flex-col justify-between gap-8 p-5 sm:p-6 ' + surface + '">' +
      '<div>' +
        '<p class="text-sm ' + soft + '">' + esc(v.partner) + '</p>' +
        '<h3 class="mt-1.5 text-2xl' + (used ? ' line-through decoration-2' : '') + '">' + esc(v.title) + '</h3>' +
      '</div>' +
      '<div class="flex items-end justify-between gap-4">' +
        '<div class="min-w-0">' +
          '<p class="font-mono text-[0.95rem] font-semibold tracking-wide">' + esc(v.code) + '</p>' +
          '<p class="mt-1 text-sm ' + softer + '">' +
            (used ? 'Utilisé le ' + date(v.usedAt) : '<span class="font-semibold text-night">Valable</span> · reçu le ' + date(v.issuedAt)) +
          '</p>' +
        '</div>' +
        '<div class="shrink-0 bg-white p-2' + (used ? ' opacity-60' : '') + '">' + qr(v.code, { size: 'w-24', muted: used }) + '</div>' +
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
    const H2 = 'text-4xl sm:text-5xl';

    return '<div class="mx-auto max-w-app px-5 pb-16 pt-8 sm:px-8 lg:pb-24 lg:pt-14">' +
      '<h1 id="page-title" tabindex="-1" class="text-5xl font-extrabold sm:text-6xl lg:text-7xl">Bonjour <span class="mark">' + esc(u.firstName) + '</span></h1>' +
      '<p class="mt-4 max-w-xl text-lg text-muted">' +
        (validated.length
          ? 'Vous avez déjà donné ' + duration(minutes) + ' à la montagne (' + plural(validated.length, 'mission') + ' validée' + (validated.length > 1 ? 's' : '') + '). Merci !'
          : 'Vos missions et vos bons apparaîtront ici.') +
        (activeCount ? ' Il vous reste ' + plural(activeCount, 'bon') + ' à utiliser.' : '') +
      '</p>' +

      '<div class="mt-10 grid gap-16 lg:mt-14 lg:grid-cols-[20rem_1fr] lg:gap-16">' +
        // ---- QR personnel ------------------------------------------------------------
        '<section aria-labelledby="myqr" class="lg:sticky lg:top-24 lg:self-start">' +
          '<div class="bg-lime-300 p-6 text-center text-night sm:p-8">' +
            '<h2 id="myqr" class="text-3xl sm:text-4xl">Mon QR</h2>' +
            '<p class="mx-auto mt-2 max-w-[16rem] text-[0.95rem] leading-snug text-night/70">À montrer au référent à la fin de chaque mission.</p>' +
            '<div class="mx-auto mt-6 w-fit bg-white p-3">' + qr(u.code, { size: 'w-48 sm:w-52' }) + '</div>' +
            '<p class="mt-5 font-mono text-lg font-bold tracking-[0.18em]">' + esc(u.code) + '</p>' +
            '<p class="mt-1 text-sm text-night/60">Pensez à monter la luminosité de l’écran.</p>' +
          '</div>' +
        '</section>' +

        '<div class="min-w-0 space-y-16 lg:space-y-20">' +
          // ---- Missions en cours -------------------------------------------------------
          '<section aria-labelledby="ongoing">' +
            '<h2 id="ongoing" class="' + H2 + '">Mes missions</h2>' +
            (active.length
              ? '<ul class="mt-8 divide-y divide-line border-y border-line">' + active.map(participationRow).join('') + '</ul>'
              : '<div class="mt-8 bg-sunk p-6 sm:p-8">' +
                  '<p class="text-lg text-muted">Aucune mission en cours.</p>' +
                  '<a href="#/missions" class="link mt-3">Trouver une mission ' + icon('arrow', 'h-4 w-4') + '</a>' +
                '</div>') +
          '</section>' +

          // ---- Bons de récompense (h2 → p → ul) ------------------------------------------
          '<section aria-labelledby="rewards">' +
            '<h2 id="rewards" class="' + H2 + '">Mes bons</h2>' +
            '<p class="mt-4 max-w-xl text-lg text-muted">Le commerçant scanne le QR du bon, et c’est tout.</p>' +
            (vouchers.length
              ? '<ul class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">' + vouchers.map(voucherCard).join('') + '</ul>'
              : '<p class="mt-8 bg-sunk p-6 text-muted sm:p-8">Vos bons apparaîtront ici après validation d’une mission.</p>') +
          '</section>' +

          '<div class="border-t border-line pt-8">' +
            '<button type="button" class="text-sm text-muted underline underline-offset-4 hover:text-ink" data-action="reset">Réinitialiser les données de démo</button>' +
          '</div>' +
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
