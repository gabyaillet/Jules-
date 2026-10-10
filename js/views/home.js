/* ==========================================================================
   Vue : Accueil touriste
   Grands titres gras, fond blanc, blocs pastel carrés par type de mission,
   photos arrondies et quelques étiquettes inclinées. Pas d'icônes décoratives : la typographie porte
   l'information.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.home = (function () {
  'use strict';
  const { esc, icon, photo, duration, typeOf, currentSeason, seasonLabel } = Meleze.ui;

  /** Conteneur commun : même largeur et mêmes marges sur toute la page. */
  const WRAP = 'mx-auto max-w-app px-5 sm:px-8';
  const H2 = 'text-4xl sm:text-5xl lg:text-6xl';
  const INTRO = 'mt-4 max-w-xl text-lg text-muted';

  const STEPS = [
    { color: 'bg-sun', title: 'Choisissez une mission', text: 'Sentier, comptage de marmottes, arrivée en train… Chaque fiche indique la durée, le rendez-vous et ce que vous recevez.' },
    { color: 'bg-leaf', title: 'Faites-la avec un local', text: 'Un garde du Parc, l’équipe des sentiers ou un artisan vous accueille. Le matériel est fourni.' },
    { color: 'bg-sky', title: 'Recevez votre bon', text: 'Le référent scanne votre QR : le bon arrive dans votre espace, prêt à montrer au commerçant.' },
  ];

  const FAQ = [
    ['C’est vraiment gratuit ?', 'Oui. Vous donnez un peu de temps, les commerçants partenaires offrent la contrepartie. On ne vous demandera jamais de carte bancaire.'],
    ['Je ne suis pas très sportif, est-ce pour moi ?', 'Sûrement. Beaucoup de missions se font à plat ou presque, et certaines conviennent aux enfants. La durée et le lieu sont indiqués sur chaque fiche.'],
    ['Et s’il fait mauvais ?', 'Une sortie peut être reportée en cas de mauvais temps. Votre inscription reste valable pour la date suivante.'],
    ['Comment utiliser mon bon ?', 'Ouvrez « Mon espace » et montrez le QR du bon au commerçant. Il le scanne, et le bon est marqué comme utilisé.'],
  ];

  /** Carte mission : photo + type, titre, infos pratiques, contrepartie. */
  function missionCard(m) {
    const t = typeOf(m.type);
    const meta = [duration(m.duration), m.location ? esc(m.location) : ''].filter(Boolean).join(' · ');
    return '<li class="w-[82%] shrink-0 snap-start sm:w-[46%] lg:w-auto">' +
      '<a href="#/missions?focus=' + esc(m.id) + '" class="group block">' +
        '<div class="ph ph-zoom aspect-[4/3]">' + photo(m, { sizes: '(min-width:1024px) 30vw, 82vw', alt: '' }) +
          '<span class="absolute left-3 top-3 rounded-full px-3 py-1 font-display text-sm font-semibold text-night ' + t.color + '">' + esc(t.label) + '</span>' +
        '</div>' +
        '<h3 class="mt-5 text-2xl group-hover:underline group-hover:decoration-lime-400 group-hover:decoration-[3px] group-hover:underline-offset-4">' + esc(m.title) + '</h3>' +
        '<p class="mt-2 text-muted">' + meta + '</p>' +
        '<p class="mt-3 text-ink"><span class="text-muted">En échange :</span> <span class="font-semibold">' + esc(m.reward.title) + '</span></p>' +
      '</a></li>';
  }

  /** Tuile "contrepartie" dans le bloc vert. */
  function rewardTile(m) {
    const t = typeOf(m.type);
    return '<li class="flex min-h-[10.5rem] flex-col justify-between gap-6 p-4 text-night sm:min-h-[12rem] sm:p-6 ' + t.color + '">' +
      '<p class="text-sm text-night/60">' + esc(m.reward.category || t.label) + '</p>' +
      '<div><p class="break-words font-display text-base font-bold leading-tight tracking-[-0.02em] sm:text-xl">' + esc(m.reward.title) + '</p>' +
      '<p class="mt-1.5 text-sm text-night/70">' + esc(m.reward.partner) + '</p></div>' +
    '</li>';
  }

  function render(state) {
    const season = currentSeason();
    let picks = state.missions.filter((m) => m.seasons.includes(season)).slice(0, 3);
    if (!picks.length) picks = state.missions.slice(0, 3);
    // Nombre pair de tuiles pour une grille sans trou (2 colonnes mobile, 4 desktop)
    const giftCount = Math.min(8, state.missions.length - (state.missions.length % 2));
    const gifts = state.missions.slice(0, giftCount);

    return (
      // ---- Hero : titre + grille de photos -------------------------------------------
      '<section class="' + WRAP + ' grid gap-10 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-14">' +
        '<div>' +
          '<span class="tag text-ink">Pralognan-la-Vanoise · 4 saisons</span>' +
          '<h1 id="page-title" tabindex="-1" class="mt-5 text-[2.75rem] font-extrabold sm:text-7xl lg:text-[4.6rem]">Une heure pour la <span class="mark">montagne</span>, une expérience en retour.</h1>' +
          '<p class="mt-6 max-w-lg text-lg text-muted">Donnez un coup de main à la station pendant votre séjour. Les commerçants du village vous remercient : téléphérique, patinoire, Beaufort d’alpage…</p>' +
          '<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">' +
            '<a href="#/missions" class="btn-primary">Voir les missions ' + icon('arrow', 'h-5 w-5') + '</a>' +
            '<a href="#/wallet" class="btn-secondary">Mon espace</a>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-2 gap-3 sm:gap-4">' +
          '<div class="ph ph-lg col-span-2 aspect-[16/10]">' + photo('hero', { eager: true, sizes: '(min-width:1024px) 45vw, 100vw' }) +
            '<span class="sticker absolute left-4 top-4 -rotate-3 bg-lime-300">Téléphérique offert</span></div>' +
          '<div class="ph ph-lg aspect-square">' + photo('meadow', { sizes: '(min-width:1024px) 22vw, 48vw', alt: 'Prairie d’alpage' }) +
            '<span class="sticker absolute bottom-4 left-4 rotate-2 bg-white">Marmottes</span></div>' +
          '<div class="flex aspect-square flex-col justify-between bg-sky p-5 text-night sm:p-6">' +
            '<p class="font-display text-sm font-semibold text-night/60">Par mission</p>' +
            '<div><p class="font-display text-[2.5rem] font-bold leading-none tracking-[-0.04em] sm:text-6xl">1 à 2 h</p>' +
            '<p class="mt-2 text-sm leading-snug text-night/70 sm:text-base">Matériel fourni, encadré par un local.</p></div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      // ---- Comment ça marche --------------------------------------------------------------
      '<section class="' + WRAP + ' pb-16 lg:pb-24" aria-labelledby="how">' +
        '<h2 id="how" class="' + H2 + '">Comment ça marche</h2>' +
        '<p class="' + INTRO + '">Trois étapes, de la fiche mission au bon cadeau.</p>' +
        '<ol class="mt-10 grid gap-4 md:grid-cols-3 lg:gap-6">' +
          STEPS.map((s, i) =>
            '<li class="flex flex-col p-6 text-night sm:p-8 md:min-h-[14rem] ' + s.color + '">' +
              '<span class="font-display text-5xl font-bold leading-none tracking-[-0.05em] md:text-6xl" aria-hidden="true">' + (i + 1) + '</span>' +
              '<h3 class="mt-auto pt-6 text-2xl md:pt-10">' + s.title + '</h3>' +
              '<p class="mt-2 text-night/75">' + s.text + '</p>' +
            '</li>').join('') +
        '</ol>' +
      '</section>' +

      // ---- Missions de saison ------------------------------------------------------------------
      '<section class="' + WRAP + ' pb-16 lg:pb-24" aria-labelledby="now">' +
        '<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">' +
          '<div><span class="tag bg-lime-300">' + esc(seasonLabel(season)) + '</span>' +
          '<h2 id="now" class="mt-4 ' + H2 + '">Les missions du moment</h2></div>' +
          '<a href="#/missions" class="link">Voir les ' + state.missions.length + ' missions ' + icon('arrow', 'h-4 w-4') + '</a>' +
        '</div>' +
        '<ul class="-mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">' +
          picks.map(missionCard).join('') +
        '</ul>' +
      '</section>' +

      // ---- Contreparties (bloc vert) -------------------------------------------------------------
      '<section class="bg-pine-700 py-16 text-white lg:py-24" aria-labelledby="gifts">' +
        '<div class="' + WRAP + '">' +
          '<h2 id="gifts" class="max-w-3xl ' + H2 + '">Ce que les commerçants vous <span class="mark">offrent</span></h2>' +
          '<p class="mt-4 max-w-xl text-lg text-white/80">Une contrepartie par mission, offerte par un commerce ou un service de la station.</p>' +
          '<ul class="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">' + gifts.map(rewardTile).join('') + '</ul>' +
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
          '<span class="sticker absolute -bottom-4 left-6 -rotate-2 bg-sun px-5 py-2.5 text-base">Les mélèzes dorent en octobre</span>' +
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

      // ---- Appel final (bloc noir) ------------------------------------------------------------------------
      '<section class="border-y border-white/10 bg-night py-16 text-white lg:py-24">' +
        '<div class="' + WRAP + ' grid items-center gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">' +
          '<div>' +
            '<h2 class="' + H2 + '">Prêt·e à donner <span class="mark whitespace-nowrap">une heure</span> à la Vanoise&nbsp;?</h2>' +
            '<p class="mt-4 max-w-md text-lg text-white/70">Une mission, un local pour vous guider, un commerçant pour vous remercier.</p>' +
            '<a href="#/missions" class="btn-lime mt-8">Je choisis ma mission ' + icon('arrow', 'h-5 w-5') + '</a>' +
          '</div>' +
          '<div class="ph ph-lg hidden aspect-[4/3] bg-white/10 lg:block">' + photo('stars', { sizes: '30vw', alt: '' }) + '</div>' +
        '</div>' +
      '</section>'
    );
  }

  return { title: 'Accueil', render };
})();
