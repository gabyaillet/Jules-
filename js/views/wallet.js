/* ==========================================================================
   Vue : Mon espace (profil / wallet du touriste)
   Une carte par mission en cours : QR de la mission (à montrer au référent)
   ou envoi d'un justificatif photo (transport) · bons de récompense.
   Langage du concept A : blocs carrés cerclés d'un filet noir, rangées
   séparées par des filets, accent vert, QR dans des carrés blancs.
   Pas d'icônes décoratives : la typographie porte l'information.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.wallet = (function () {
  'use strict';
  const { esc, icon, qr, photo, duration, missionDuration, date, typeOf, toast, compressImage } = Meleze.ui;
  const store = Meleze.store;

  const ACTIVE = ['inscrite', 'preuve', 'refusee'];
  const isPhoto = (m) => m && m.proof === 'photo';
  const plural = (n, word) => n + ' ' + word + (n > 1 ? 's' : '');

  /**
   * Bouton d'envoi de photo : un <label> en forme de bouton qui contient le
   * vrai <input type="file"> (masqué mais focalisable au clavier).
   * L'input déclenche view.changes.proof via data-change.
   */
  function uploadControl(p, text, cls) {
    return '<label class="' + cls + ' cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">' +
      '<span data-upload-text>' + text + '</span>' +
      '<input type="file" accept="image/*" class="sr-only" data-change="proof" data-id="' + esc(p.id) + '">' +
    '</label>';
  }

  /**
   * Qui vérifie le justificatif : l'organisateur de la mission (l'Office de
   * tourisme pour le transport). Texte brut : à échapper avant affichage.
   */
  function checker(m) {
    const host = String((m && m.host) || '').trim();
    if (!host) return 'l’organisateur';
    if (/^(l[’']\s*)?office de tourisme$/i.test(host)) return 'l’Office de tourisme';
    return 'l’organisateur (' + host + ')';
  }

  /** Ce qu'il faut photographier : billet ou covoiturage pour la mobilité douce. */
  function proofHint(m) {
    if (m.type === 'mobilite') {
      return 'Votre billet de train ou de car, votre réservation de covoiturage, ou une photo de vous à deux (ou plus) dans la voiture. Vérifiez que la date et le trajet sont lisibles.';
    }
    return 'Envoyez une photo qui montre la mission réalisée, en suivant les consignes de la mission.';
  }

  const cancelButton = (p, cls) =>
    '<button type="button" class="btn-secondary ' + cls + '" data-action="cancel" data-id="' + esc(p.id) + '">Me désinscrire</button>';

  /** Rangées d'une carte : blocs carrés séparés par des filets noirs. */
  const ROW = 'border-t border-ink px-5 sm:px-6';
  const LABEL = 'font-display text-sm font-semibold text-brand-ink';

  /** Rangée du bas : date d'inscription + action(s). */
  function footRow(p, actionsHtml) {
    return '<div class="' + ROW + ' flex flex-wrap items-center justify-between gap-3 py-4">' +
      '<p class="text-sm text-muted">' + (p.date ? 'Inscrit·e le ' + esc(date(p.date)) : 'Inscrit·e') + '</p>' +
      '<div class="flex flex-wrap gap-3">' + actionsHtml + '</div>' +
    '</div>';
  }

  /** Mission validée par QR : le QR propre à cette participation, dans un carré blanc. */
  function qrBlock(p) {
    return '<div class="' + ROW + ' flex flex-col items-center gap-5 py-6 text-center sm:flex-row sm:gap-6 sm:text-left">' +
        '<div class="shrink-0 border border-ink bg-white p-1.5">' + qr(p.code, { size: 'w-44' }) + '</div>' +
        '<div class="min-w-0">' +
          '<p class="' + LABEL + '">QR de la mission</p>' +
          '<p class="mt-2 font-mono text-xl font-bold tracking-[0.16em]">' + esc(p.code) + '</p>' +
          '<p class="mt-3 text-[0.95rem] leading-snug text-muted">À montrer au référent à la fin de la mission. Pensez à monter la luminosité de l’écran.</p>' +
        '</div>' +
      '</div>' +
      footRow(p, cancelButton(p, 'btn-sm'));
  }

  /** Mission validée par justificatif photo (billet, covoiturage…). */
  function photoBlock(p, m) {
    if (p.status === 'preuve') {
      const proof = p.proof || {};
      return '<div class="' + ROW + ' flex items-start gap-4 py-5">' +
          (proof.image
            ? '<div class="w-24 shrink-0 border border-ink bg-sunk sm:w-28">' +
                '<img src="' + esc(proof.image) + '" alt="Votre justificatif" class="block aspect-[4/3] w-full object-contain" decoding="async">' +
              '</div>'
            : '') +
          '<div class="min-w-0">' +
            '<p class="' + LABEL + '">En cours de vérification</p>' +
            '<p class="mt-1 font-display text-lg font-bold leading-tight">Justificatif envoyé</p>' +
            '<p class="mt-1 text-[0.95rem] leading-snug text-muted">' +
              (proof.sentAt ? 'Envoyé le ' + esc(date(proof.sentAt)) + ', en' : 'En') +
              ' cours de vérification par ' + esc(checker(m)) + '. Votre bon arrivera ici.' +
            '</p>' +
          '</div>' +
        '</div>' +
        footRow(p, uploadControl(p, 'Remplacer la photo', 'btn-secondary btn-sm'));
    }

    const refused = p.status === 'refusee'
      ? '<div class="border-t border-ink border-l-4 border-l-danger px-5 py-4 sm:px-6" role="status">' +
          '<p class="font-display font-bold text-danger">Justificatif refusé' + (p.refusedAt ? ' le ' + esc(date(p.refusedAt)) : '') + '</p>' +
          '<p class="mt-1 text-[0.95rem] leading-snug">' + esc(String(p.refusedReason || 'Justificatif illisible ou non conforme').replace(/[\s.]+$/, '')) + '. Vous pouvez en envoyer un autre.</p>' +
        '</div>'
      : '';

    return refused +
      '<div class="' + ROW + ' py-5">' +
        '<p class="' + LABEL + '">Pour valider</p>' +
        '<p class="mt-1 font-display text-lg font-bold leading-tight">Une photo suffit</p>' +
        '<p class="mt-1 text-[0.95rem] leading-snug text-muted">' + proofHint(m) + '</p>' +
        (m.schedule ? '<p class="mt-2 text-sm text-muted">' + esc(m.schedule) + '.</p>' : '') +
        '<div class="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">' +
          uploadControl(p, 'Envoyer mon justificatif', 'btn-primary') +
          cancelButton(p, '') +
        '</div>' +
      '</div>';
  }

  /**
   * Carte "mission en cours" : bloc carré cerclé d'un filet noir, en rangées —
   * vignette + titre, contrepartie, puis QR ou justificatif.
   */
  function participationCard({ participation: p, mission: m }) {
    const t = typeOf(m.type);
    const meta = [missionDuration(m), m.location].filter(Boolean).map(esc).join(' · ');
    return '<li class="border border-ink bg-card" id="participation-' + esc(p.id) + '">' +
      '<div class="flex items-start gap-4 p-5 sm:gap-5 sm:p-6">' +
        '<div class="ph ph-sm aspect-square w-16 shrink-0 sm:w-20">' + photo(m, { sizes: '100px', alt: '' }) + '</div>' +
        '<div class="min-w-0 flex-1">' +
          '<span class="tag ' + esc(t.color) + '">' + esc(t.label) + '</span>' +
          '<h3 class="mt-2.5 text-xl leading-tight sm:text-2xl">' + esc(m.title) + '</h3>' +
          (meta ? '<p class="mt-1.5 text-sm text-muted">' + meta + '</p>' : '') +
          (m.schedule && !isPhoto(m) ? '<p class="text-sm text-muted">' + esc(m.schedule) + '</p>' : '') +
        '</div>' +
      '</div>' +
      (m.reward
        ? '<div class="' + ROW + ' py-4">' +
            '<p class="' + LABEL + '">En échange</p>' +
            '<p class="mt-0.5 font-display text-lg font-bold leading-snug tracking-[-0.01em]">' + esc(m.reward.title) + '</p>' +
          '</div>'
        : '') +
      (isPhoto(m) ? photoBlock(p, m) : qrBlock(p)) +
    '</li>';
  }

  /**
   * Bon façon ticket, comme les tuiles de l'accueil : bloc vert plein, texte
   * blanc, QR dans un carré blanc. Bon utilisé : bloc blanc, filet gris, barré.
   */
  function voucherCard(v, i) {
    const used = v.status === 'consomme';
    const surface = used ? 'border border-line bg-card text-muted' : 'bg-forest text-white';
    const rule = used ? 'border-line' : 'border-white/60';
    return '<li class="flex flex-col ' + surface + '">' +
      '<div class="flex items-baseline justify-between gap-4 px-5 pt-5 sm:px-6">' +
        '<p class="font-display text-sm font-semibold">' + esc(v.partner) + '</p>' +
        '<p class="shrink-0 font-display text-sm font-semibold" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</p>' +
      '</div>' +
      '<h3 class="mt-6 px-5 pb-6 text-[1.7rem] leading-[1.05] tracking-[-0.025em] sm:px-6' + (used ? ' line-through decoration-2' : '') + '">' + esc(v.title) + '</h3>' +
      '<div class="mt-auto flex items-end justify-between gap-4 border-t ' + rule + ' px-5 py-5 sm:px-6">' +
        '<div class="min-w-0">' +
          '<p class="font-mono text-base font-bold tracking-[0.12em]">' + esc(v.code) + '</p>' +
          '<p class="mt-1 text-sm">' +
            (used ? 'Utilisé le ' + esc(date(v.usedAt)) : '<span class="font-semibold">Valable</span> · reçu le ' + esc(date(v.issuedAt))) +
          '</p>' +
        '</div>' +
        '<div class="shrink-0 bg-white p-1' + (used ? ' opacity-60' : '') + '">' + qr(v.code, { size: 'w-28', muted: used }) + '</div>' +
      '</div>' +
    '</li>';
  }

  function render(state) {
    const u = state.user || {};
    const active = state.participations
      .filter((p) => ACTIVE.includes(p.status))
      .map((p) => ({ participation: p, mission: store.getMission(p.missionId) }))
      .filter((x) => x.mission);
    const validated = state.participations
      .filter((p) => p.status === 'validee')
      .map((p) => ({ participation: p, mission: store.getMission(p.missionId) }))
      .filter((x) => x.mission)
      .sort((a, b) => String(b.participation.validatedAt || '').localeCompare(String(a.participation.validatedAt || '')));
    const minutes = validated.reduce((sum, x) => sum + (Number(x.mission.duration) || 0), 0);
    const vouchers = state.vouchers.slice().sort((a, b) => (a.status === b.status ? 0 : a.status === 'actif' ? -1 : 1));
    const activeCount = vouchers.filter((v) => v.status === 'actif').length;
    const H2 = 'text-4xl sm:text-5xl';
    const INTRO = 'mt-3 max-w-xl text-lg text-muted';

    let intro = 'Vos missions et vos bons apparaîtront ici.';
    if (validated.length && minutes) intro = 'Vous avez déjà donné ' + duration(minutes) + ' à la montagne. Merci !';
    else if (validated.length) intro = 'Merci pour votre aide !';

    // Trois repères chiffrés, comme sous la photo de l'accueil
    const stats = [
      [validated.length, 'mission' + (validated.length > 1 ? 's' : '') + ' validée' + (validated.length > 1 ? 's' : '')],
      [active.length, 'en cours'],
      [activeCount, 'bon' + (activeCount > 1 ? 's' : '') + ' à utiliser'],
    ];

    return '<div class="mx-auto max-w-app px-5 pb-16 pt-8 sm:px-8 lg:pb-24 lg:pt-14">' +
      '<p class="flex items-center gap-3 font-display text-[0.95rem] font-semibold text-ink">' +
        '<span class="h-[2px] w-8 bg-accent" aria-hidden="true"></span>Mon espace</p>' +
      '<h1 id="page-title" tabindex="-1" class="mt-6 text-5xl font-extrabold sm:text-6xl lg:text-7xl">Bonjour <span class="mark">' + esc(u.firstName) + '</span></h1>' +
      '<p class="mt-4 max-w-xl text-lg text-muted">' + intro + '</p>' +
      '<ul class="mt-8 grid max-w-3xl grid-cols-3 gap-4 sm:gap-8">' +
        stats.map(([n, label]) =>
          '<li class="border-t-2 border-ink pt-3">' +
            '<p class="font-display text-[2rem] font-bold leading-none tracking-[-0.04em] sm:text-5xl">' + n + '</p>' +
            '<p class="mt-2 text-sm leading-snug text-muted sm:text-base">' + label + '</p></li>').join('') +
      '</ul>' +

      '<div class="mt-14 space-y-16 lg:mt-20 lg:space-y-20">' +
        // ---- Missions en cours : un QR (ou un justificatif) par mission ------------
        '<section aria-labelledby="ongoing">' +
          '<h2 id="ongoing" class="' + H2 + '">Mes missions</h2>' +
          '<p class="' + INTRO + '">Sur place, montrez le QR de la mission au référent. Pour le trajet, envoyez une photo de votre billet.</p>' +
          (active.length
            ? '<ul class="mt-8 grid items-start gap-4 lg:grid-cols-2 lg:gap-6">' + active.map(participationCard).join('') + '</ul>'
            : '<div class="mt-8 border border-ink p-6 sm:p-8">' +
                '<p class="font-display text-2xl font-bold leading-tight tracking-[-0.02em]">Aucune mission en cours.</p>' +
                '<a href="#/missions" class="link mt-4">Trouver une mission ' + icon('arrow', 'h-4 w-4') + '</a>' +
              '</div>') +
        '</section>' +

        // ---- Bons de récompense (h2 → p → ul) ------------------------------------------
        '<section aria-labelledby="rewards">' +
          '<h2 id="rewards" class="' + H2 + '">Mes bons</h2>' +
          '<p class="' + INTRO + '">Le commerçant scanne le QR du bon, et c’est tout.</p>' +
          (vouchers.length
            ? '<ul class="mt-8 grid gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">' + vouchers.map(voucherCard).join('') + '</ul>'
            : '<p class="mt-8 border border-ink p-6 text-muted sm:p-8">Vos bons apparaîtront ici après validation d’une mission.</p>') +
        '</section>' +

        // ---- Historique ----------------------------------------------------------------
        (validated.length
          ? '<section aria-labelledby="validated">' +
              '<h2 id="validated" class="text-2xl sm:text-3xl">Missions validées</h2>' +
              '<ul class="mt-5 border-t-2 border-ink">' +
                validated.map(({ participation: p, mission: m }) =>
                  '<li class="flex flex-col gap-1 border-b border-line py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">' +
                    '<span class="font-display font-semibold leading-snug">' + esc(m.title) + '</span>' +
                    '<span class="shrink-0 text-sm text-muted">' + (p.validatedAt ? 'Validée le ' + esc(date(p.validatedAt)) : 'Validée') + '</span>' +
                  '</li>').join('') +
              '</ul>' +
            '</section>'
          : '') +

        '<div>' +
          '<button type="button" class="text-sm text-muted underline underline-offset-4 hover:text-ink" data-action="reset">Réinitialiser les données de démo</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  const actions = {
    cancel(el) {
      if (store.cancel(el.dataset.id)) toast('Vous êtes désinscrit·e de cette mission.');
      else toast('Impossible de se désinscrire d’une mission déjà validée.', 'error');
    },
    reset() {
      if (confirm('Remettre toutes les données de démonstration à zéro ?')) { store.reset(); toast('Données de démo réinitialisées.'); }
    },
  };

  // Envoi du justificatif : compression (JPEG ~1280 px, sans EXIF) puis store.
  let sending = false;
  const changes = {
    proof(input) {
      const file = input.files && input.files[0];
      if (!file || sending) return;
      sending = true;
      const label = input.closest('label');
      const text = label && label.querySelector('[data-upload-text]');
      const before = text ? text.textContent : '';
      if (label) { label.setAttribute('aria-busy', 'true'); label.classList.add('pointer-events-none', 'opacity-60'); }
      if (text) text.textContent = 'Envoi en cours…';

      const restore = () => {
        sending = false;
        if (!input.isConnected) return; // la vue a déjà été redessinée
        input.value = '';
        if (label) { label.removeAttribute('aria-busy'); label.classList.remove('pointer-events-none', 'opacity-60'); }
        if (text) text.textContent = before;
      };

      compressImage(file)
        .then((dataUrl) => {
          const id = input.dataset.id;
          const res = store.submitProof(id, dataUrl);
          if (!res || !res.ok) {
            toast((res && res.reason) || 'Envoi impossible, réessayez.', 'error');
          } else if (res.persisted === false) {
            toast('Justificatif envoyé, mais le stockage du téléphone est plein : la photo n’est gardée que pour cette session.', 'error');
          } else {
            const p = store.state.participations.find((x) => x.id === id);
            toast('Justificatif envoyé. Il sera vérifié par ' + checker(p && store.getMission(p.missionId)) + '.'); // toast() échappe
          }
        })
        .catch((err) => toast((err && err.message) || 'Impossible de lire cette photo.', 'error'))
        .then(restore);
    },
  };

  return { title: 'Mon espace', render, actions, changes };
})();
