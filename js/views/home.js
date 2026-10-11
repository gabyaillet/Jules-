/* ==========================================================================
   Vue : Accueil touriste — concept A « Typo-photo »
   Base blanche, titres gras quasi noirs, un seul accent vert. Le mot
   « montagne » du titre est rempli par une photo (background-clip: text).
   Photos arrondies ; tous les autres blocs sont carrés. Aucune couleur pastel,
   pas d'icônes décoratives : la typographie porte l'information.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.home = (function () {
  'use strict';
  const { esc, icon, photo, photoUrl, missionDuration, typeOf, currentSeason, seasonLabel } = Meleze.ui;

  /** Conteneur commun : même largeur et mêmes marges sur toute la page. */
  const WRAP = 'mx-auto max-w-app px-5 sm:px-8';
  const H2 = 'text-4xl sm:text-5xl lg:text-6xl';
  const INTRO = 'mt-4 max-w-xl text-lg text-muted';
  /** Lignes du titre qui encadrent le mot-photo géant. */
  const HERO_LINE = 'text-[2.1rem] leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-[4.75rem]';

  /**
   * Mot géant rempli par une photo (voir .photo-word dans src/input.css).
   * Photo locale du client (sommets de la Vanoise) : `y` choisit la bande
   * visible — jamais le bas de la photo, où se trouve le ©.
   */
  function photoWord(text, key, y, cls) {
    const url = (w) => esc(photoUrl(key, w));
    return '<span class="photo-word ' + cls + '" style="--ph-sm:url(&quot;' + url(1200) + '&quot;);--ph-lg:url(&quot;' + url(1800) + '&quot;);--ph-y:' + y + '">' + text + '</span>';
  }

  /** Trois repères chiffrés sous la photo du hero. */
  const FACTS = [
    ['1 à 2\u00a0h', 'sur place, encadré par un local'],
    ['0\u00a0€', 'gratuit, sans carte bancaire'],
    ['3', 'missions, encadrées par des gens d’ici'],
  ];

  const STEPS = [
    { title: 'Choisissez une mission', text: 'Marché du village, sentiers du Parc ou trajet sans voiture : inscrivez-vous, la mission arrive dans « Mon espace ». Chaque fiche indique la durée, le rendez-vous et ce que vous recevez.' },
    { title: 'Faites-la avec un local', text: 'Les commerçants du marché ou les gardes du Parc vous accueillent, le matériel est fourni. Vous venez en train ou en covoiturage ? Gardez votre billet.' },
    { title: 'Recevez votre bon', text: 'Le référent scanne le QR de votre mission, ou vous envoyez votre billet : votre bon arrive dans votre espace, prêt à montrer au commerçant.' },
  ];

  const FAQ = [
    ['C’est vraiment gratuit ?', 'Oui. Vous donnez un peu de temps, les commerçants partenaires offrent la contrepartie. On ne vous demandera jamais de carte bancaire.'],
    ['Je ne suis pas très sportif, est-ce pour moi ?', 'Sûrement. Monter le marché se fait sur la place du village, sans expérience demandée, et venir en train ne demande aucun effort. La durée et le rendez-vous sont indiqués sur chaque fiche.'],
    ['Où trouver le QR code de ma mission ?', 'Dans « Mon espace » : chaque mission à laquelle vous êtes inscrit·e a son propre QR code. Montrez-le au référent à la fin de la mission, il le scanne et votre bon arrive aussitôt.'],
    ['Je viens en train ou en covoiturage, comment valider ?', 'Depuis « Mon espace », envoyez une photo de votre billet de train ou de car, de votre réservation de covoiturage, ou une photo de vous à deux dans la voiture. L’Office de tourisme la vérifie, puis votre bon arrive dans votre espace.'],
    ['Et s’il fait mauvais ?', 'Le nettoyage des sentiers peut être reporté en cas de mauvais temps. Votre inscription et son QR code restent valables pour la date suivante.'],
    ['Comment utiliser mon bon ?', 'Ouvrez « Mon espace » et montrez le QR du bon au commerçant. Il le scanne, et le bon est marqué comme utilisé.'],
  ];

  /** Saisons d'une mission en clair : "Toute l’année", "Été et hiver"… */
  function seasonsText(m) {
    const ids = m.seasons || [];
    if (ids.length >= 4) return 'Toute l’année';
    const labels = ids.map((id, i) => (i ? String(seasonLabel(id)).toLowerCase() : seasonLabel(id)));
    return labels.length > 1 ? labels.slice(0, -1).join(', ') + ' et ' + labels[labels.length - 1] : (labels[0] || '');
  }

  /** Mode de validation : QR scanné par le référent ou justificatif photo. */
  const proofText = (m) => (m.proof === 'photo' ? 'Justificatif photo' : 'QR code sur place');

  /** Carte mission : photo + type, titre, infos pratiques, contrepartie. */
  function missionCard(m) {
    const t = typeOf(m.type);
    const meta = [esc(missionDuration(m)), m.location ? esc(m.location) : ''].filter(Boolean).join(' · ');
    const when = [esc(seasonsText(m)), proofText(m)].filter(Boolean).join(' · ');
    return '<li class="w-[82%] shrink-0 snap-start sm:w-[46%] lg:w-auto">' +
      '<a href="#/missions?focus=' + esc(m.id) + '" class="group block">' +
        '<div class="ph ph-zoom aspect-[4/3]">' + photo(m, { sizes: '(min-width:1024px) 30vw, 82vw', alt: '' }) +
          '<span class="absolute left-3 top-3 rounded-full px-3 py-1 font-display text-sm font-semibold ' + t.color + '">' + esc(t.label) + '</span>' +
        '</div>' +
        '<h3 class="mt-5 text-2xl group-hover:underline group-hover:decoration-accent group-hover:decoration-2 group-hover:underline-offset-4">' + esc(m.title) + '</h3>' +
        '<p class="mt-2 text-muted">' + meta + '</p>' +
        '<p class="mt-1 text-sm text-muted">' + when + '</p>' +
        '<p class="mt-4 border-t border-line pt-3 text-ink"><span class="text-muted">En échange :</span> <span class="font-semibold text-brand-ink">' + esc(m.reward.title) + '</span></p>' +
      '</a></li>';
  }

  /** Tuile "contrepartie" : carré blanc posé sur le bandeau vert. */
  function rewardTile(m, i) {
    const t = typeOf(m.type);
    return '<li class="flex min-h-[10rem] flex-col justify-between gap-8 bg-white p-5 text-night sm:min-h-[13rem] sm:p-6">' +
      '<div class="flex items-baseline justify-between gap-4">' +
        '<p class="font-display text-sm font-semibold text-forest">' + esc(m.reward.category || t.label) + '</p>' +
        '<p class="font-display text-sm font-semibold text-night/60" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</p>' +
      '</div>' +
      '<div><p class="break-words font-display text-[1.6rem] font-bold leading-[1.05] tracking-[-0.025em] lg:text-[1.85rem]">' + esc(m.reward.title) + '</p>' +
      '<p class="mt-2 text-sm text-night/65">' + esc(m.reward.partner) + '</p></div>' +
    '</li>';
  }

  function render(state) {
    // Les missions (3 pour l'instant) : celles de la saison en cours d'abord.
    const season = currentSeason();
    const inSeason = (m) => ((m.seasons || []).includes(season) ? 0 : 1);
    const picks = state.missions
      .map((m, i) => ({ m, i }))
      .sort((a, b) => inSeason(a.m) - inSeason(b.m) || a.i - b.i)
      .slice(0, 3)
      .map((x) => x.m);
    const more = state.missions.length > picks.length;

    return (
      // ---- Hero « Typo-photo » : le mot montagne rempli par une photo -----------------------
      '<section class="typo-hero ' + WRAP + ' pb-14 pt-8 sm:pt-12 lg:pb-24 lg:pt-16">' +
        '<p class="flex items-center gap-3 font-display text-[0.95rem] font-semibold tracking-[-0.005em] text-ink">' +
          '<span class="h-[2px] w-8 bg-accent" aria-hidden="true"></span>Pralognan-la-Vanoise · 4 saisons</p>' +
        '<h1 id="page-title" tabindex="-1" class="mt-7 font-extrabold sm:mt-10">' +
          '<span class="block ' + HERO_LINE + '">Une heure pour la</span>' +
          // Bande basse des sommets : roche au soleil, neige, éboulis bleutés
          photoWord('montagne', 'sentiers', '30%', 'mb-1.5 mt-2 sm:mb-1 sm:mt-4') +
          '<span class="sr-only">,</span>' +
          '<span class="block ' + HERO_LINE + ' md:text-right">une expérience en retour.</span>' +
        '</h1>' +
        '<div class="mt-8 grid gap-7 border-t border-line pt-7 md:mt-14 md:grid-cols-[1fr_auto] md:items-end md:gap-12 md:pt-8">' +
          '<p class="max-w-xl text-lg text-muted">Venez sans votre voiture, aidez à monter le marché ou nettoyez les sentiers avec les gardes du Parc. Les commerçants du village vous remercient : téléphérique, patinoire, Beaufort d’alpage…</p>' +
          '<div class="flex flex-col gap-3 sm:flex-row">' +
            '<a href="#/missions" class="btn-primary">Voir les missions ' + icon('arrow', 'h-5 w-5') + '</a>' +
            '<a href="#/wallet" class="btn-secondary">Mon espace</a>' +
          '</div>' +
        '</div>' +
        '<div class="relative mt-12 lg:mt-16">' +
          '<div class="ph ph-lg aspect-[4/3] sm:aspect-[21/9]">' + photo('hero', { eager: true, sizes: '(min-width:1216px) 1152px, 100vw' }) + '</div>' +
          '<span class="sticker absolute -top-4 right-5 -rotate-3 bg-forest px-4 py-2 text-white sm:right-10">Téléphérique offert</span>' +
        '</div>' +
        '<ul class="mt-8 grid grid-cols-3 gap-4 sm:gap-8">' +
          FACTS.map(([k, v]) =>
            '<li class="border-t-2 border-ink pt-3">' +
              '<p class="font-display text-[1.65rem] font-bold leading-none tracking-[-0.04em] sm:text-5xl">' + k + '</p>' +
              '<p class="mt-2 text-sm leading-snug text-muted sm:text-base">' + v + '</p></li>').join('') +
        '</ul>' +
      '</section>' +

      // ---- Comment ça marche : trois colonnes éditoriales, numéros verts ----------------
      '<section class="' + WRAP + ' pb-16 lg:pb-24" aria-labelledby="how">' +
        '<h2 id="how" class="' + H2 + '">Comment ça marche</h2>' +
        '<p class="' + INTRO + '">Trois étapes, de la fiche mission au bon cadeau.</p>' +
        '<ol class="mt-10 grid gap-8 md:grid-cols-3 md:gap-8 lg:gap-12">' +
          STEPS.map((s, i) =>
            '<li class="border-t-2 border-ink pt-5">' +
              '<span class="font-display text-5xl font-extrabold leading-none tracking-[-0.05em] text-brand-ink md:text-7xl" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span>' +
              '<h3 class="mt-4 text-2xl md:mt-10">' + s.title + '</h3>' +
              '<p class="mt-2 text-muted">' + s.text + '</p>' +
            '</li>').join('') +
        '</ol>' +
      '</section>' +

      // ---- Les missions -------------------------------------------------------------------------------
      '<section class="' + WRAP + ' pb-16 lg:pb-24" aria-labelledby="now">' +
        '<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">' +
          '<div><h2 id="now" class="' + H2 + '">Les missions</h2>' +
          '<p class="' + INTRO + '">Sur place, chaque inscription a son propre QR code, à montrer au référent. Pour le trajet, une photo de votre billet suffit.</p></div>' +
          '<a href="#/missions" class="link">' + (more ? 'Voir les ' + state.missions.length + ' missions' : 'Voir le détail') + ' ' + icon('arrow', 'h-4 w-4') + '</a>' +
        '</div>' +
        '<ul class="-mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">' +
          picks.map(missionCard).join('') +
        '</ul>' +
      '</section>' +

      // ---- Contreparties : bandeau vert plein, tuiles blanches carrées ------------------------
      '<section class="bg-forest py-16 text-white lg:py-24" aria-labelledby="gifts">' +
        '<div class="' + WRAP + '">' +
          '<div class="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16">' +
            '<h2 id="gifts" class="max-w-3xl ' + H2 + '">Ce que les commerçants vous offrent</h2>' +
            '<p class="max-w-md text-lg text-white">Une contrepartie par mission, offerte par un commerce ou un service de la station.</p>' +
          '</div>' +
          '<ul class="mt-10 grid gap-3 sm:grid-cols-3 sm:gap-4">' + picks.map(rewardTile).join('') + '</ul>' +
        '</div>' +
      '</section>' +

      // ---- Pourquoi Mélèze -------------------------------------------------------------------------
      '<section class="' + WRAP + ' grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24" aria-labelledby="why">' +
        '<div>' +
          '<h2 id="why" class="' + H2 + '">Pourquoi «&nbsp;Mélèze&nbsp;»&nbsp;?</h2>' +
          '<div class="mt-6 max-w-xl space-y-4 text-lg text-muted">' +
            '<p>Beaucoup de visiteurs aiment la Vanoise et aimeraient lui rendre un peu de ce qu’elle leur donne, sans savoir par où commencer.</p>' +
            '<p>Mélèze rassemble de petites missions concrètes, encadrées par des gens d’ici. Les commerçants, eux, ont trouvé une façon simple de dire merci.</p>' +
            '<p>Et le nom ? Le mélèze est le seul conifère de nos forêts à perdre ses aiguilles. En octobre, il dore toute la vallée.</p>' +
          '</div>' +
        '</div>' +
        '<div class="relative lg:order-first">' +
          '<div class="ph ph-lg aspect-[4/3] lg:aspect-[5/4]">' + photo('forest', { sizes: '(min-width:1024px) 45vw, 100vw', alt: 'Lumière dorée dans une forêt' }) + '</div>' +
          '<span class="sticker absolute -bottom-4 left-6 -rotate-2 bg-ink px-5 py-2.5 text-base text-surface">Les mélèzes dorent en octobre</span>' +
        '</div>' +
      '</section>' +

      // ---- Questions ------------------------------------------------------------------------------------
      '<section class="' + WRAP + ' grid gap-10 pb-16 lg:grid-cols-[1fr_1.5fr] lg:gap-16 lg:pb-24" aria-labelledby="faq">' +
        '<div>' +
          '<h2 id="faq" class="' + H2 + '">Vos questions</h2>' +
          '<p class="' + INTRO + '">L’essentiel avant de vous lancer.</p>' +
        '</div>' +
        '<div class="border-t border-line">' +
          FAQ.map(([q, a]) =>
            '<details class="acc border-b border-line py-5">' +
              '<summary class="min-h-[2.75rem] font-display text-lg font-semibold tracking-[-0.01em]">' + q +
              '<span class="acc-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-surface">' + icon('plus', 'h-4 w-4') + '</span></summary>' +
              '<p class="mt-2 max-w-xl pb-1 text-muted">' + a + '</p>' +
            '</details>').join('') +
        '</div>' +
      '</section>' +

      // ---- Appel final (bloc quasi noir) : le titre répond au hero, « Vanoise » rempli d'une photo ----
      '<section class="bg-night py-16 text-white lg:py-24">' +
        '<div class="typo-hero ' + WRAP + '">' +
          '<h2 class="font-extrabold">' +
            '<span class="block ' + HERO_LINE + '">Prêt·e à donner une heure à la</span>' +
            // Même photo, cadrée plus haut : les sommets et le ciel, en écho au hero
            photoWord('Vanoise&nbsp;?', 'sentiers', '22%', 'photo-word-short on-dark mt-2.5 sm:mt-4') +
          '</h2>' +
          '<div class="mt-10 grid gap-8 border-t border-white/15 pt-8 md:mt-14 md:grid-cols-[1fr_auto] md:items-end md:gap-12">' +
            '<p class="max-w-md text-lg text-white/70">Une mission, un local pour vous guider, un commerçant pour vous remercier.</p>' +
            '<a href="#/missions" class="btn btn-light">Je choisis ma mission ' + icon('arrow', 'h-5 w-5') + '</a>' +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }

  return { title: 'Accueil', render };
})();
