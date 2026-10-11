/* ==========================================================================
   Vue : Mon espace (profil / wallet du touriste)
   Peu de texte, de grands blocs pleins : une carte par mission en cours
   (photo + titre, puis un bloc noir avec le QR à montrer au référent, ou un
   bloc gris pour envoyer le justificatif photo du trajet), puis les bons
   (blocs verts, QR dans un carré blanc). Une seule consigne par carte.
   Pas d'icônes décoratives : la typographie porte l'information.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.wallet = (function () {
  'use strict';
  const { esc, icon, qr, photo, duration, date, typeOf, toast, compressImage } = Meleze.ui;
  const store = Meleze.store;

  const ACTIVE = ['inscrite', 'preuve', 'refusee'];
  const isPhoto = (m) => m && m.proof === 'photo';
  const s = (n) => (n > 1 ? 's' : '');

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

  /** L'unique consigne d'une mission photo : quoi photographier. */
  function proofHint(m) {
    if (m.type === 'mobilite') {
      return 'Envoyez une photo de votre billet de train ou de car, de votre covoiturage, ou de vous à deux en voiture.';
    }
    return 'Envoyez une photo de la mission réalisée.';
  }

  /** Se désinscrire : action secondaire, simple texte souligné (cible ≥ 44 px). */
  const cancelButton = (p) =>
    '<button type="button" class="min-h-[44px] font-display text-base font-semibold text-ink underline decoration-2 underline-offset-4 hover:text-brand-ink" data-action="cancel" data-id="' + esc(p.id) + '">Me désinscrire</button>';

  /** Mission validée par QR : grand bloc noir, QR propre à cette participation dans un carré blanc. */
  function qrBlock(p) {
    return '<div class="mt-5 flex flex-col items-center bg-ink px-6 pb-7 pt-8 text-center text-surface">' +
        '<div class="bg-white">' + qr(p.code, { size: 'w-60' }) + '</div>' +
        '<p class="mt-5 font-mono text-2xl font-bold tracking-[0.16em]">' + esc(p.code) + '</p>' +
        '<p class="mt-2 font-display text-lg font-semibold leading-snug">À montrer au référent à la fin de la mission.</p>' +
      '</div>' +
      '<div class="mt-2">' + cancelButton(p) + '</div>';
  }

  /** Mission validée par justificatif photo (billet, covoiturage…) : bloc gris plein. */
  function photoBlock(p, m) {
    if (p.status === 'preuve') {
      const proof = p.proof || {};
      return '<div class="mt-5 bg-sunk p-6">' +
          '<div class="flex items-start gap-4">' +
            (proof.image
              ? '<div class="w-24 shrink-0 bg-card p-1 sm:w-28">' +
                  '<img src="' + esc(proof.image) + '" alt="Votre justificatif" class="block aspect-[4/3] w-full object-contain" decoding="async">' +
                '</div>'
              : '') +
            '<div class="min-w-0">' +
              '<p class="font-display text-xl font-bold leading-tight text-ink">Justificatif envoyé</p>' +
              '<p class="mt-1.5 text-ink">Il est en cours de vérification par ' + esc(checker(m)) + '.</p>' +
            '</div>' +
          '</div>' +
          '<div class="mt-5">' + uploadControl(p, 'Remplacer la photo', 'btn-secondary') + '</div>' +
        '</div>';
    }

    // Refus : bandeau rouge plein au-dessus du bloc d'envoi
    const refused = p.status === 'refusee'
      ? '<div class="mt-5 bg-danger px-6 py-4 text-surface" role="status">' +
          '<p class="font-display text-lg font-bold">Justificatif refusé</p>' +
          '<p class="mt-0.5">' + esc(String(p.refusedReason || 'Justificatif illisible ou non conforme').replace(/[\s.]+$/, '')) + '.</p>' +
        '</div>'
      : '';

    return refused +
      '<div class="' + (refused ? '' : 'mt-5 ') + 'bg-sunk p-6">' +
        '<p class="text-lg font-semibold leading-snug text-ink">' + proofHint(m) + '</p>' +
        '<div class="mt-5 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-6">' +
          uploadControl(p, 'Envoyer mon justificatif', 'btn-primary min-h-[56px] w-full text-lg sm:w-auto') +
          cancelButton(p) +
        '</div>' +
      '</div>';
  }

  /** Carte "mission en cours" : photo + type + titre, puis le QR ou le justificatif. */
  function participationCard({ participation: p, mission: m }) {
    const t = typeOf(m.type);
    return '<li class="flex flex-col" id="participation-' + esc(p.id) + '">' +
      '<div class="flex items-center gap-4">' +
        '<div class="ph ph-sm aspect-square w-20 shrink-0 sm:w-24">' + photo(m, { sizes: '100px', alt: '' }) + '</div>' +
        '<div class="min-w-0 flex-1">' +
          '<span class="tag ' + esc(t.color) + '">' + esc(t.label) + '</span>' +
          '<h3 class="mt-2 text-2xl leading-[1.05] sm:text-[1.75rem]">' + esc(m.title) + '</h3>' +
        '</div>' +
      '</div>' +
      (isPhoto(m) ? photoBlock(p, m) : qrBlock(p)) +
    '</li>';
  }

  /**
   * Bon façon ticket, comme les tuiles de l'accueil : bloc vert plein, texte
   * blanc, QR dans un carré blanc. Bon utilisé : bloc gris, titre barré.
   */
  function voucherCard(v) {
    const used = v.status === 'consomme';
    return '<li class="flex flex-col p-6 ' + (used ? 'bg-sunk text-muted' : 'bg-forest text-white') + '">' +
      '<p class="font-display text-base font-semibold">' + esc(v.partner) + '</p>' +
      '<h3 class="mt-3 text-[1.75rem] leading-[1.05] tracking-[-0.025em]' + (used ? ' line-through decoration-2' : '') + '">' + esc(v.title) + '</h3>' +
      '<div class="mt-auto flex items-end justify-between gap-4 pt-7">' +
        '<div class="min-w-0">' +
          '<p class="font-mono text-lg font-bold tracking-[0.12em]">' + esc(v.code) + '</p>' +
          '<p class="mt-1 font-display text-base font-semibold">' + (used ? 'Utilisé le ' + esc(date(v.usedAt)) : 'Valable') + '</p>' +
        '</div>' +
        '<div class="shrink-0 bg-white p-1.5' + (used ? ' opacity-60' : '') + '">' + qr(v.code, { size: 'w-32', muted: used }) + '</div>' +
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
    const H2 = 'text-[2.5rem] sm:text-5xl';

    let intro = 'Vos missions et vos bons apparaîtront ici.';
    if (validated.length) intro = 'Merci pour votre aide !';
    else if (active.length || vouchers.length) intro = 'Vos missions et vos bons, au même endroit.';

    // Deux repères chiffrés, en blocs pleins (noir, vert)
    const TILE = 'flex min-w-0 flex-col justify-between gap-3 p-5 sm:p-6';
    const NUM = 'font-display text-[2.25rem] font-bold leading-none tracking-[-0.04em] sm:text-5xl';
    const CAP = 'font-display text-base font-semibold leading-snug sm:text-lg';
    const stats = validated.length || vouchers.length
      ? '<ul class="mt-8 grid max-w-2xl grid-cols-2 gap-3">' +
          '<li class="' + TILE + ' bg-ink text-surface">' +
            '<p class="' + NUM + ' whitespace-nowrap">' + (minutes ? esc(duration(minutes)) : validated.length) + '</p>' +
            '<p class="' + CAP + '">' + (minutes ? 'pour la montagne' : 'mission' + s(validated.length) + ' validée' + s(validated.length)) + '</p></li>' +
          '<li class="' + TILE + ' bg-forest text-white">' +
            '<p class="' + NUM + '">' + activeCount + '</p>' +
            '<p class="' + CAP + '">bon' + s(activeCount) + ' à utiliser</p></li>' +
        '</ul>'
      : '';

    return '<div class="mx-auto max-w-app px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16">' +
      '<h1 id="page-title" tabindex="-1" class="text-5xl font-extrabold sm:text-6xl lg:text-7xl">Bonjour <span class="mark">' + esc(u.firstName) + '</span></h1>' +
      '<p class="mt-4 max-w-xl font-display text-xl font-semibold leading-snug tracking-[-0.01em] text-ink sm:text-2xl">' + intro + '</p>' +
      stats +

      '<div class="mt-14 space-y-16 lg:mt-20 lg:space-y-20">' +
        // ---- Missions en cours : un QR (ou un justificatif) par mission ------------
        '<section aria-labelledby="ongoing">' +
          '<h2 id="ongoing" class="' + H2 + '">Mes missions</h2>' +
          (active.length
            ? '<ul class="mt-7 grid gap-14 lg:grid-cols-2 lg:gap-x-8">' + active.map(participationCard).join('') + '</ul>'
            : '<div class="mt-7 bg-sunk p-6 sm:p-8">' +
                '<p class="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-ink">Aucune mission en cours.</p>' +
                '<a href="#/missions" class="btn mt-6 min-h-[56px] bg-ink text-lg text-surface hover:bg-ink/85">Trouver une mission ' + icon('arrow', 'h-5 w-5') + '</a>' +
              '</div>') +
        '</section>' +

        // ---- Bons de récompense (h2 → p → ul) ------------------------------------------
        '<section aria-labelledby="rewards">' +
          '<h2 id="rewards" class="' + H2 + '">Mes bons</h2>' +
          (vouchers.length
            ? '<p class="mt-3 font-display text-xl font-semibold leading-snug text-ink">Le commerçant scanne le QR du bon.</p>' +
              '<ul class="mt-7 grid gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">' + vouchers.map(voucherCard).join('') + '</ul>'
            : '<p class="mt-7 bg-sunk p-6 font-display text-xl font-semibold leading-snug text-ink sm:p-8">Vos bons arriveront ici après une mission validée.</p>') +
        '</section>' +

        // ---- Historique (tuiles grises) ------------------------------------------------
        (validated.length
          ? '<section aria-labelledby="validated">' +
              '<h2 id="validated" class="text-[1.75rem] sm:text-3xl">Missions validées</h2>' +
              '<ul class="mt-5 space-y-2">' +
                validated.map(({ participation: p, mission: m }) =>
                  '<li class="flex flex-col gap-0.5 bg-sunk px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">' +
                    '<span class="font-display text-lg font-semibold leading-snug text-ink">' + esc(m.title) + '</span>' +
                    '<span class="shrink-0 text-muted">' + (p.validatedAt ? 'Validée le ' + esc(date(p.validatedAt)) : 'Validée') + '</span>' +
                  '</li>').join('') +
              '</ul>' +
            '</section>'
          : '') +

        '<div>' +
          '<button type="button" class="min-h-[44px] text-sm text-muted underline underline-offset-4 hover:text-ink" data-action="reset">Réinitialiser les données de démo</button>' +
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
