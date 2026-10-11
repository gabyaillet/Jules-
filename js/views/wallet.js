/* ==========================================================================
   Vue : Mon espace (profil / wallet du touriste)
   Une carte par mission en cours : QR de la mission (à montrer au référent)
   ou envoi d'un justificatif photo (transport) · bons de récompense.
   Pas d'icônes décoratives : la typographie et la couleur du type portent l'info.
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

  /** Mission validée par QR : le QR propre à cette participation. */
  function qrBlock(p) {
    return '<div class="mt-5 flex flex-col items-center gap-5 border-2 border-ink p-5 text-center sm:flex-row sm:p-6 sm:text-left">' +
        '<div class="shrink-0 bg-white p-2">' + qr(p.code, { size: 'w-44' }) + '</div>' +
        '<div class="min-w-0">' +
          '<p class="font-display text-xl font-bold leading-tight">Le QR de cette mission</p>' +
          '<p class="mt-2 font-mono text-lg font-bold tracking-[0.18em]">' + esc(p.code) + '</p>' +
          '<p class="mt-2 text-[0.95rem] leading-snug text-muted">À montrer au référent à la fin de la mission.</p>' +
          '<p class="mt-1 text-sm text-muted">Pensez à monter la luminosité de l’écran.</p>' +
        '</div>' +
      '</div>' +
      '<div class="mt-4">' + cancelButton(p, 'btn-sm') + '</div>';
  }

  /** Mission validée par justificatif photo (billet, covoiturage…). */
  function photoBlock(p, m) {
    if (p.status === 'preuve') {
      const proof = p.proof || {};
      return '<div class="mt-5 flex items-start gap-4 bg-sunk p-4 sm:p-5">' +
          (proof.image
            ? '<div class="w-24 shrink-0 border border-line bg-surface sm:w-28">' +
                '<img src="' + esc(proof.image) + '" alt="Votre justificatif" class="block aspect-[4/3] w-full object-contain" decoding="async">' +
              '</div>'
            : '') +
          '<div class="min-w-0">' +
            '<p class="font-display text-lg font-bold leading-tight">Justificatif envoyé</p>' +
            '<p class="mt-1 text-[0.95rem] leading-snug text-muted">' +
              (proof.sentAt ? 'Envoyé le ' + esc(date(proof.sentAt)) + ', en' : 'En') +
              ' cours de vérification par ' + esc(checker(m)) + '. Votre bon arrivera ici.' +
            '</p>' +
          '</div>' +
        '</div>' +
        '<div class="mt-4">' + uploadControl(p, 'Remplacer la photo', 'btn-secondary btn-sm') + '</div>';
    }

    const refused = p.status === 'refusee'
      ? '<div class="mt-5 border-l-4 border-danger bg-sunk p-4 sm:p-5" role="status">' +
          '<p class="font-display font-bold">Justificatif refusé' + (p.refusedAt ? ' le ' + esc(date(p.refusedAt)) : '') + '</p>' +
          '<p class="mt-1 text-[0.95rem] leading-snug">' + esc(String(p.refusedReason || 'Justificatif illisible ou non conforme').replace(/[\s.]+$/, '')) + '. Vous pouvez en envoyer un autre.</p>' +
        '</div>'
      : '';

    return refused +
      '<div class="' + (refused ? 'mt-3' : 'mt-5') + ' bg-sunk p-4 sm:p-5">' +
        '<p class="font-display text-lg font-bold leading-tight">Pour valider : une photo suffit</p>' +
        '<p class="mt-1 text-[0.95rem] leading-snug text-muted">' + proofHint(m) + '</p>' +
        (m.schedule ? '<p class="mt-2 text-sm text-muted">' + esc(m.schedule) + '.</p>' : '') +
      '</div>' +
      '<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">' +
        uploadControl(p, 'Envoyer mon justificatif', 'btn-primary') +
        cancelButton(p, '') +
      '</div>';
  }

  /** Carte "mission en cours" : vignette, type, titre, infos, contrepartie, puis QR ou justificatif. */
  function participationCard({ participation: p, mission: m }) {
    const t = typeOf(m.type);
    const meta = [missionDuration(m), m.location].filter(Boolean).map(esc).join(' · ');
    return '<li class="card p-5 sm:p-6" id="participation-' + esc(p.id) + '">' +
      '<div class="flex items-start gap-4 sm:gap-5">' +
        '<div class="ph ph-sm aspect-square w-16 shrink-0 sm:w-20">' + photo(m, { sizes: '100px', alt: '' }) + '</div>' +
        '<div class="min-w-0 flex-1">' +
          '<span class="tag ' + esc(t.color) + '">' + esc(t.label) + '</span>' +
          '<h3 class="mt-2 text-xl leading-tight sm:text-2xl">' + esc(m.title) + '</h3>' +
          (meta ? '<p class="mt-1.5 text-sm text-muted">' + meta + '</p>' : '') +
          (m.schedule && !isPhoto(m) ? '<p class="text-sm text-muted">' + esc(m.schedule) + '</p>' : '') +
        '</div>' +
      '</div>' +
      (m.reward
        ? '<p class="mt-4 text-[0.95rem]"><span class="text-muted">En échange :</span> <span class="font-semibold">' + esc(m.reward.title) + '</span></p>'
        : '') +
      (isPhoto(m) ? photoBlock(p, m) : qrBlock(p)) +
    '</li>';
  }

  /** Bon façon ticket : partenaire + contrepartie en haut, code et QR en bas. */
  function voucherCard(v) {
    const used = v.status === 'consomme';
    const m = store.getMission(v.missionId);
    // Bon valable : bloc vert forêt plein ; bon utilisé : gris neutre.
    const surface = used ? 'bg-sunk text-muted' : 'bg-forest text-white';
    const soft = used ? 'text-muted' : 'text-white/75';
    const softer = used ? 'text-muted' : 'text-white/80';
    return '<li class="flex flex-col justify-between gap-8 p-5 sm:p-6 ' + esc(surface) + '">' +
      '<div>' +
        '<p class="text-sm ' + soft + '">' + esc(v.partner) + '</p>' +
        '<h3 class="mt-1.5 text-2xl' + (used ? ' line-through decoration-2' : '') + '">' + esc(v.title) + '</h3>' +
      '</div>' +
      '<div class="flex items-end justify-between gap-4">' +
        '<div class="min-w-0">' +
          '<p class="font-mono text-[0.95rem] font-semibold tracking-wide">' + esc(v.code) + '</p>' +
          '<p class="mt-1 text-sm ' + softer + '">' +
            (used ? 'Utilisé le ' + esc(date(v.usedAt)) : '<span class="font-semibold text-white">Valable</span> · reçu le ' + esc(date(v.issuedAt))) +
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
    const done = plural(validated.length, 'mission') + ' validée' + (validated.length > 1 ? 's' : '');
    const H2 = 'text-4xl sm:text-5xl';

    let intro = 'Vos missions et vos bons apparaîtront ici.';
    if (validated.length && minutes) intro = 'Vous avez déjà donné ' + duration(minutes) + ' à la montagne (' + done + '). Merci !';
    else if (validated.length) intro = 'Déjà ' + done + '. Merci !';
    if (activeCount) intro += ' Il vous reste ' + plural(activeCount, 'bon') + ' à utiliser.';

    return '<div class="mx-auto max-w-app px-5 pb-16 pt-8 sm:px-8 lg:pb-24 lg:pt-14">' +
      '<h1 id="page-title" tabindex="-1" class="text-5xl font-extrabold sm:text-6xl lg:text-7xl">Bonjour <span class="mark">' + esc(u.firstName) + '</span></h1>' +
      '<p class="mt-4 max-w-xl text-lg text-muted">' + intro + '</p>' +

      '<div class="mt-12 space-y-16 lg:mt-16 lg:space-y-20">' +
        // ---- Missions en cours : un QR (ou un justificatif) par mission ------------
        '<section aria-labelledby="ongoing">' +
          '<h2 id="ongoing" class="' + H2 + '">Mes missions</h2>' +
          (active.length
            ? '<ul class="mt-8 grid items-start gap-4 lg:grid-cols-2">' + active.map(participationCard).join('') + '</ul>'
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
            ? '<ul class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">' + vouchers.map(voucherCard).join('') + '</ul>'
            : '<p class="mt-8 bg-sunk p-6 text-muted sm:p-8">Vos bons apparaîtront ici après validation d’une mission.</p>') +
        '</section>' +

        // ---- Historique ----------------------------------------------------------------
        (validated.length
          ? '<section aria-labelledby="validated">' +
              '<h2 id="validated" class="text-2xl sm:text-3xl">Missions validées</h2>' +
              '<ul class="mt-5 divide-y divide-line border-y border-line">' +
                validated.map(({ participation: p, mission: m }) =>
                  '<li class="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">' +
                    '<span class="font-display font-semibold leading-snug">' + esc(m.title) + '</span>' +
                    '<span class="shrink-0 text-sm text-muted">' + (p.validatedAt ? 'Validée le ' + esc(date(p.validatedAt)) : 'Validée') + '</span>' +
                  '</li>').join('') +
              '</ul>' +
            '</section>'
          : '') +

        // Pas de second filet si la liste « Missions validées » (déjà bordée) précède
        '<div' + (validated.length ? '' : ' class="border-t border-line pt-8"') + '>' +
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
