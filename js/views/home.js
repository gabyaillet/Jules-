/* ==========================================================================
   Vue : Accueil touriste — concept A « Typo-photo », version allégée
   Base blanche, titres gras quasi noirs, un seul accent vert. Le mot
   « montagne » du titre est rempli par une photo (background-clip: text).
   Peu de texte, une idée par bloc, des APLATS pleins (vert, noir, gris clair)
   plutôt que des filets. Photos arrondies ; tous les autres blocs sont carrés.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.home = (function () {
  'use strict';
  const { esc, icon, photo, photoUrl, missionDuration, typeOf, currentSeason } = Meleze.ui;

  /** Conteneur commun : même largeur et mêmes marges sur toute la page. */
  const WRAP = 'mx-auto max-w-app px-5 sm:px-8';
  const SECTION = WRAP + ' py-14 lg:py-24';
  const H2 = 'text-[2.5rem] sm:text-5xl lg:text-6xl';
  /** Lignes du titre qui encadrent le mot-photo géant. */
  const HERO_LINE = 'text-[length:clamp(2rem,10.2vw,2.5rem)] leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-[4.75rem]';

  /**
   * Mot géant rempli par une photo (voir .photo-word dans src/input.css).
   * `y` choisit la bande de photo visible dans les lettres.
   */
  function photoWord(text, key, y, cls) {
    const url = (w) => esc(photoUrl(key, w));
    // Photo haute définition : le mot fait toute la largeur de l'écran.
    return '<span class="photo-word ' + cls + '" style="--ph-sm:url(&quot;' + url(1600) + '&quot;);--ph-lg:url(&quot;' + url(2400) + '&quot;);--ph-y:' + y + '">' + text + '</span>';
  }

  /** Trois étapes, trois aplats : gris clair, vert, noir (inversé en thème sombre). */
  const STEPS = [
    { title: 'Choisissez une mission', text: 'Marché, sentiers ou trajet sans voiture.', cls: 'bg-sunk text-ink', sub: 'text-ink' },
    { title: 'Faites-la avec un local', text: 'Un commerçant ou un garde du Parc vous guide.', cls: 'bg-forest text-white', sub: 'text-white' },
    { title: 'Recevez votre bon', text: 'Il arrive dans « Mon espace ».', cls: 'bg-ink text-surface', sub: 'text-surface' },
  ];

  const FAQ = [
    ['C’est vraiment gratuit ?', 'Oui. On ne vous demande jamais de carte bancaire.'],
    ['Où est le QR de ma mission ?', 'Dans « Mon espace ». Montrez-le au référent à la fin.'],
    ['Je viens en train ou en covoiturage ?', 'Envoyez une photo de votre billet depuis « Mon espace ».'],
  ];

  /** Carte mission : grande photo + type, titre, durée. (La contrepartie est dans le bandeau vert.) */
  function missionCard(m) {
    const t = typeOf(m.type);
    return '<li class="w-[85%] shrink-0 snap-start sm:w-[46%] lg:w-auto">' +
      '<a href="#/missions?focus=' + esc(m.id) + '" class="group block">' +
        '<div class="ph ph-zoom aspect-[5/4]">' + photo(m, { sizes: '(min-width:1024px) 30vw, 85vw', alt: '' }) +
          '<span class="tag absolute left-3 top-3 ' + esc(t.color) + '">' + esc(t.label) + '</span>' +
        '</div>' +
        '<h3 class="mt-5 text-[1.75rem] leading-[1.05] group-hover:underline group-hover:decoration-accent group-hover:decoration-[3px] group-hover:underline-offset-4">' + esc(m.title) + '</h3>' +
        '<p class="mt-2 font-display text-lg font-semibold text-ink">' + esc(missionDuration(m)) + '</p>' +
      '</a></li>';
  }

  /** Tuile "contrepartie" : carré blanc posé sur le bandeau vert. */
  function rewardTile(m) {
    return '<li class="flex min-h-[9rem] flex-col justify-end bg-white p-6 text-night sm:min-h-[12rem] lg:p-7">' +
      '<p class="break-words font-display text-[1.75rem] font-bold leading-[1.05] tracking-[-0.025em] lg:text-[2rem]">' + esc(m.reward.title) + '</p>' +
      '<p class="mt-3 font-display text-base font-semibold text-night/70">' + esc(m.reward.partner) + '</p>' +
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
        '<p class="flex items-center gap-3 font-display text-base font-bold tracking-[-0.005em] text-ink">' +
          '<span class="h-[3px] w-8 bg-accent" aria-hidden="true"></span>Pralognan-la-Vanoise</p>' +
        // Nom accessible explicite : les lignes en bloc ajouteraient une espace avant la virgule
        '<h1 id="page-title" tabindex="-1" class="mt-7 font-extrabold sm:mt-10" aria-label="Une heure pour la montagne, une expérience en retour.">' +
          '<span class="block ' + HERO_LINE + '">Une heure pour la </span>' +
          // Bande basse des sommets : roche au soleil, neige, éboulis bleutés
          photoWord('montagne', 'stars', '55%', 'mb-1.5 mt-2 sm:mb-1 sm:mt-4') +
          '<span class="sr-only">, </span>' +
          '<span class="block ' + HERO_LINE + ' md:text-right">une expérience en retour.</span>' +
        '</h1>' +
        '<div class="mt-8 grid gap-7 md:mt-14 md:grid-cols-[1fr_auto] md:items-end md:gap-12">' +
          '<p class="max-w-md font-display text-xl font-semibold leading-snug tracking-[-0.01em] text-ink sm:text-2xl">Une petite mission, un cadeau des commerçants du village.</p>' +
          '<div class="flex flex-col gap-3 sm:flex-row">' +
            '<a href="#/missions" class="btn-primary">Voir les missions ' + icon('arrow', 'h-5 w-5') + '</a>' +
            '<a href="#/wallet" class="btn-secondary">Mon espace</a>' +
          '</div>' +
        '</div>' +
        '<div class="relative mt-12 lg:mt-16">' +
          '<div class="ph ph-lg aspect-[4/3] sm:aspect-[21/9]">' + photo('hero', { eager: true, sizes: '(min-width:1216px) 1152px, 100vw' }) + '</div>' +
          '<span class="sticker absolute -top-4 right-5 -rotate-3 bg-forest px-4 py-2 text-base text-white sm:right-10">Téléphérique offert</span>' +
        '</div>' +
      '</section>' +

      // ---- Comment ça marche : trois aplats pleins, gros numéros ----------------------------
      '<section class="' + WRAP + ' pb-14 lg:pb-24" aria-labelledby="how">' +
        '<h2 id="how" class="' + H2 + '">Comment ça marche</h2>' +
        '<ol class="mt-8 grid gap-3 md:mt-10 md:grid-cols-3 md:gap-4">' +
          STEPS.map((s, i) =>
            '<li class="flex flex-col p-6 sm:p-8 ' + s.cls + '">' +
              '<span class="font-display text-7xl font-extrabold leading-[0.85] tracking-[-0.05em] lg:text-8xl" aria-hidden="true">' + (i + 1) + '</span>' +
              '<h3 class="mt-6 text-[1.75rem] leading-[1.05] md:mt-12">' + s.title + '</h3>' +
              '<p class="mt-2 text-lg ' + s.sub + '">' + s.text + '</p>' +
            '</li>').join('') +
        '</ol>' +
      '</section>' +

      // ---- Les missions : grandes cartes photo ----------------------------------------------
      '<section class="' + WRAP + ' pb-14 lg:pb-24" aria-labelledby="now">' +
        '<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">' +
          '<h2 id="now" class="' + H2 + '">Les missions</h2>' +
          '<a href="#/missions" class="link text-lg">' + (more ? 'Voir les ' + state.missions.length + ' missions' : 'Voir le détail') + ' ' + icon('arrow', 'h-5 w-5') + '</a>' +
        '</div>' +
        '<ul class="-mx-5 mt-8 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 md:mt-10 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">' +
          picks.map(missionCard).join('') +
        '</ul>' +
      '</section>' +

      // ---- Contreparties : bandeau vert plein, tuiles blanches carrées ----------------------
      '<section class="bg-forest py-14 text-white lg:py-24" aria-labelledby="gifts">' +
        '<div class="' + WRAP + '">' +
          '<h2 id="gifts" class="max-w-3xl ' + H2 + '">Ce que les commerçants vous offrent</h2>' +
          '<ul class="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4 md:mt-10">' + picks.map(rewardTile).join('') + '</ul>' +
        '</div>' +
      '</section>' +

      // ---- Pourquoi Mélèze : une photo, une phrase -------------------------------------------
      '<section class="' + SECTION + ' grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16" aria-labelledby="why">' +
        '<div>' +
          '<h2 id="why" class="' + H2 + '">Pourquoi «&nbsp;Mélèze&nbsp;»&nbsp;?</h2>' +
          '<p class="mt-5 max-w-md text-xl leading-snug text-ink lg:text-2xl">Pour rendre un peu à la Vanoise, simplement, avec des gens d’ici.</p>' +
        '</div>' +
        '<div class="relative lg:order-first">' +
          '<div class="ph ph-lg aspect-[4/3] lg:aspect-[5/4]">' + photo('forest', { sizes: '(min-width:1024px) 45vw, 100vw', alt: 'Lumière dorée dans une forêt' }) + '</div>' +
          '<span class="sticker absolute -bottom-4 left-5 -rotate-2 bg-ink px-5 py-2.5 text-base text-surface">Le mélèze dore la vallée en octobre</span>' +
        '</div>' +
      '</section>' +

      // ---- Questions : trois tuiles grises pleines -------------------------------------------
      '<section class="' + WRAP + ' grid gap-8 pb-14 lg:grid-cols-[1fr_1.5fr] lg:gap-16 lg:pb-24" aria-labelledby="faq">' +
        '<h2 id="faq" class="' + H2 + '">Vos questions</h2>' +
        '<div class="grid gap-3">' +
          FAQ.map(([q, a]) =>
            '<details class="acc bg-sunk px-5 py-4 sm:px-6">' +
              '<summary class="min-h-[3rem] font-display text-xl font-bold leading-tight tracking-[-0.015em] text-ink">' + q +
              '<span class="acc-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-surface">' + icon('plus', 'h-5 w-5') + '</span></summary>' +
              '<p class="mt-2 max-w-xl pb-1 text-lg text-ink">' + a + '</p>' +
            '</details>').join('') +
        '</div>' +
      '</section>' +

      // ---- Appel final (bloc quasi noir) : le titre répond au hero, « Vanoise » rempli d'une photo ----
      '<section class="bg-night py-14 text-white lg:py-24">' +
        '<div class="typo-hero ' + WRAP + '">' +
          '<h2 class="font-extrabold">' +
            '<span class="block ' + HERO_LINE + '">Prêt·e à donner une heure à la</span>' +
            // Même photo, cadrée un peu plus haut : le sommet et la neige, en écho au hero
            photoWord('Vanoise&nbsp;?', 'peak', '45%', 'photo-word-short on-dark mt-2.5 sm:mt-4') +
          '</h2>' +
          '<a href="#/missions" class="btn btn-light mt-10 w-full sm:w-auto md:mt-14">Je choisis ma mission ' + icon('arrow', 'h-5 w-5') + '</a>' +
        '</div>' +
      '</section>'
    );
  }

  return { title: 'Accueil', render };
})();
