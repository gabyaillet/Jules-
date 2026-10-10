/* ==========================================================================
   Vue : Accueil touriste
   Style "CopenPay" : grands titres gras, fond blanc, blocs de couleur,
   photos arrondies en grille et petites pastilles inclinées.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.home = (function () {
  'use strict';
  const { esc, icon, photo, duration, typeOf, currentSeason, seasonLabel } = Meleze.ui;

  const STEPS = [
    { color: 'bg-sun', ic: 'mountain', title: 'Choisissez une mission', text: 'Sentier, comptage de marmottes, arrivée en train… Chaque fiche indique la durée, le rendez-vous et la contrepartie.' },
    { color: 'bg-leaf', ic: 'users', title: 'Faites-la avec un local', text: 'Un garde du Parc, l’équipe des sentiers ou un artisan vous accueille. Le matériel est fourni.' },
    { color: 'bg-sky', ic: 'gift', title: 'Recevez votre cadeau', text: 'Le référent scanne votre QR : le bon arrive dans votre espace, à montrer au commerçant.' },
  ];

  const FAQ = [
    ['C’est vraiment gratuit ?', 'Oui. Vous donnez un peu de temps, les commerçants partenaires offrent la contrepartie. On ne vous demandera jamais de carte bancaire.'],
    ['Je ne suis pas très sportif, est-ce pour moi ?', 'Sûrement. Beaucoup de missions se font à plat ou presque, et certaines conviennent aux enfants. La durée et le lieu sont indiqués sur chaque fiche.'],
    ['Et s’il fait mauvais ?', 'Une sortie peut être reportée en cas de mauvais temps. Votre inscription reste valable pour la date suivante.'],
    ['Comment utiliser mon bon ?', 'Ouvrez « Mon espace » et montrez le QR du bon au commerçant. Il le scanne, et le bon est marqué comme utilisé.'],
  ];

  /** Carte mission avec photo, pour la sélection de saison. */
  function missionCard(m) {
    const t = typeOf(m.type);
    return '<li class="w-[85%] shrink-0 snap-start sm:w-[47%] lg:w-auto">' +
      '<a href="#/missions?focus=' + esc(m.id) + '" class="group block">' +
        '<div class="ph ph-zoom aspect-[4/3] rounded-3xl">' + photo(m, { sizes: '(min-width:1024px) 30vw, 85vw', alt: '' }) +
          '<span class="sticker absolute left-3 top-3 ' + t.color + '">' + icon(t.icon, 'h-4 w-4') + esc(t.label) + '</span>' +
          '<span class="sticker absolute bottom-3 right-3 bg-white">' + icon('clock', 'h-4 w-4') + duration(m.duration) + '</span>' +
        '</div>' +
        '<h3 class="mt-4 text-2xl group-hover:underline group-hover:decoration-lime-400 group-hover:decoration-[3px] group-hover:underline-offset-4">' + esc(m.title) + '</h3>' +
        '<p class="mt-2 flex items-start gap-2 text-muted">' + icon('gift', 'mt-1 h-4 w-4 shrink-0 text-brand-ink') + esc(m.reward.title) + '</p>' +
      '</a></li>';
  }

  function render(state) {
    const season = currentSeason();
    const picks = state.missions.filter((m) => m.seasons.includes(season)).slice(0, 3);

    return (
      // ---- Hero : titre + grille de photos ----------------------------------------
      '<section class="mx-auto grid max-w-app gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-14">' +
        '<div>' +
          '<span class="tag">' + icon('pin', 'h-3.5 w-3.5') + 'Pralognan-la-Vanoise · 4 saisons</span>' +
          '<h1 id="page-title" tabindex="-1" class="mt-5 text-[2.9rem] font-extrabold sm:text-7xl lg:text-[4.7rem]">Une heure pour la <span class="mark">montagne</span>, une expérience en retour.</h1>' +
          '<p class="mt-6 max-w-lg text-lg text-muted">Donnez un coup de main à la station pendant votre séjour. Les commerçants du village vous remercient : téléphérique, patinoire, Beaufort d’alpage…</p>' +
          '<div class="mt-8 flex flex-wrap gap-3">' +
            '<a href="#/missions" class="btn-primary">Voir les missions ' + icon('arrow', 'h-5 w-5') + '</a>' +
            '<a href="#/wallet" class="btn-secondary">Mon espace</a>' +
          '</div>' +
        '</div>' +
        // Grille "bento"
        '<div class="grid grid-cols-2 gap-3 sm:gap-4">' +
          '<div class="ph col-span-2 aspect-[16/10] rounded-4xl">' + photo('hero', { eager: true, sizes: '(min-width:1024px) 45vw, 100vw' }) +
            '<span class="sticker absolute left-4 top-4 -rotate-3 bg-lime-300">' + icon('gift', 'h-4 w-4') + 'Téléphérique offert</span>' +
          '</div>' +
          '<div class="ph aspect-square rounded-4xl">' + photo('meadow', { sizes: '(min-width:1024px) 22vw, 48vw', alt: 'Prairie d’alpage' }) +
            '<span class="sticker absolute bottom-4 left-4 rotate-2 bg-white">' + icon('leaf', 'h-4 w-4') + 'Marmottes</span>' +
          '</div>' +
          '<div class="flex aspect-square flex-col justify-between rounded-4xl bg-sky p-5 text-night">' +
            icon('clock', 'h-7 w-7') +
            '<p class="font-display text-[1.7rem] font-bold leading-[1.02] tracking-[-0.03em] sm:text-4xl">1 à 2 h<br>par mission</p>' +
          '</div>' +
        '</div>' +
      '</section>' +

      // ---- Comment ça marche ----------------------------------------------------------
      '<section class="mx-auto max-w-app px-5 pb-16 sm:px-8 lg:pb-24" aria-labelledby="how">' +
        '<h2 id="how" class="text-4xl sm:text-6xl">Comment ça marche</h2>' +
        '<ol class="mt-8 grid gap-4 md:grid-cols-3">' +
          STEPS.map((s, i) =>
            '<li class="flex min-h-[15rem] flex-col rounded-4xl p-6 text-night ' + s.color + '">' +
              '<div class="flex items-center justify-between">' +
                '<span class="flex h-12 w-12 items-center justify-center rounded-full bg-white font-display text-xl font-bold">' + (i + 1) + '</span>' +
                icon(s.ic, 'h-7 w-7') +
              '</div>' +
              '<h3 class="mt-auto pt-8 text-2xl">' + s.title + '</h3>' +
              '<p class="mt-2 text-night/75">' + s.text + '</p>' +
            '</li>').join('') +
        '</ol>' +
      '</section>' +

      // ---- Missions de saison ----------------------------------------------------------
      '<section class="mx-auto max-w-app px-5 pb-16 sm:px-8 lg:pb-24" aria-labelledby="now">' +
        '<div class="flex flex-wrap items-end justify-between gap-4">' +
          '<div><span class="tag bg-lime-300">' + seasonLabel(season) + '</span>' +
          '<h2 id="now" class="mt-3 text-4xl sm:text-6xl">Les missions du moment</h2></div>' +
          '<a href="#/missions" class="link">Les ' + state.missions.length + ' missions ' + icon('arrow', 'h-4 w-4') + '</a>' +
        '</div>' +
        '<ul class="-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0">' + picks.map(missionCard).join('') + '</ul>' +
      '</section>' +

      // ---- Ce que vous pouvez recevoir (bloc vert) --------------------------------------------
      '<section class="px-3 sm:px-4" aria-labelledby="gifts">' +
        '<div class="mx-auto max-w-[80rem] rounded-4xl bg-pine-700 px-5 py-14 text-white sm:px-10 lg:py-20">' +
          '<div class="mx-auto max-w-app">' +
            '<div class="flex flex-wrap items-end justify-between gap-4">' +
              '<h2 id="gifts" class="max-w-2xl text-4xl sm:text-6xl">Ce que les commerçants vous <span class="mark">offrent</span></h2>' +
              '<p class="max-w-xs text-white/80">Une contrepartie par mission, offerte par un commerce ou un service de la station.</p>' +
            '</div>' +
            '<ul class="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">' +
              state.missions.slice(0, 8).map((m, i) =>
                '<li class="flex min-h-[9.5rem] flex-col justify-between rounded-3xl p-4 text-night sm:p-5 ' + typeOf(m.type).color + (i % 3 === 1 ? ' sm:rotate-1' : i % 3 === 2 ? ' sm:-rotate-1' : '') + '">' +
                  icon('gift', 'h-6 w-6') +
                  '<div><p class="font-display text-lg font-bold leading-tight tracking-[-0.02em]">' + esc(m.reward.title) + '</p>' +
                  '<p class="mt-1 text-sm text-night/70">' + esc(m.reward.partner) + '</p></div>' +
                '</li>').join('') +
            '</ul>' +
          '</div>' +
        '</div>' +
      '</section>' +

      // ---- Pourquoi Mélèze ----------------------------------------------------------------------
      '<section class="mx-auto grid max-w-app gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24" aria-labelledby="why">' +
        '<div>' +
          '<h2 id="why" class="text-4xl sm:text-6xl">Pourquoi «&nbsp;Mélèze&nbsp;»&nbsp;?</h2>' +
          '<div class="mt-6 space-y-4 text-lg text-muted">' +
            '<p>Beaucoup de visiteurs aiment la Vanoise et aimeraient lui rendre un peu de ce qu’elle leur donne, sans savoir par où commencer.</p>' +
            '<p>Mélèze rassemble de petites missions concrètes, encadrées par des gens d’ici. Les commerçants, eux, ont trouvé une façon simple de dire merci.</p>' +
            '<p>Et le nom ? Le mélèze est le seul conifère de nos forêts à perdre ses aiguilles. En octobre, il dore toute la vallée.</p>' +
          '</div>' +
        '</div>' +
        '<div class="relative">' +
          '<div class="ph aspect-[4/3] rounded-4xl">' + photo('forest', { sizes: '(min-width:1024px) 45vw, 100vw', alt: 'Lumière dorée dans une forêt' }) + '</div>' +
          '<span class="sticker absolute -bottom-4 left-6 -rotate-2 bg-sun px-5 py-2.5 text-base">' + icon('leaf', 'h-5 w-5') + 'Les mélèzes dorent en octobre</span>' +
        '</div>' +
      '</section>' +

      // ---- Questions ------------------------------------------------------------------------------
      '<section class="mx-auto grid max-w-app gap-8 px-5 pb-16 sm:px-8 lg:grid-cols-[1fr_1.5fr] lg:pb-24" aria-labelledby="faq">' +
        '<h2 id="faq" class="text-4xl sm:text-6xl">Vos questions</h2>' +
        '<div class="space-y-3">' +
          FAQ.map(([q, a]) =>
            '<details class="acc rounded-3xl bg-sunk px-5 py-4">' +
              '<summary class="font-display text-lg font-semibold tracking-[-0.01em]">' + q +
              '<span class="acc-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-surface">' + icon('plus', 'h-4 w-4') + '</span></summary>' +
              '<p class="mt-2 max-w-xl pb-1 text-muted">' + a + '</p>' +
            '</details>').join('') +
        '</div>' +
      '</section>' +

      // ---- Appel final (bloc noir) -------------------------------------------------------------------
      '<section class="px-3 pb-3 sm:px-4 sm:pb-4">' +
        '<div class="mx-auto grid max-w-[80rem] items-center gap-10 overflow-hidden rounded-4xl bg-night px-6 py-14 text-white sm:px-12 lg:grid-cols-[1.4fr_1fr] lg:py-20">' +
          '<div>' +
            '<h2 class="text-4xl sm:text-6xl">Prêt·e à donner <span class="mark">une heure</span> à la Vanoise&nbsp;?</h2>' +
            '<a href="#/missions" class="btn-lime mt-8">Je choisis ma mission ' + icon('arrow', 'h-5 w-5') + '</a>' +
          '</div>' +
          '<div class="hidden grid-cols-2 gap-4 lg:grid">' +
            '<div class="ph aspect-[3/4] -rotate-3 rounded-3xl">' + photo('stars', { sizes: '18vw', alt: '' }) + '</div>' +
            '<div class="ph mt-10 aspect-[3/4] rotate-2 rounded-3xl">' + photo('lake', { sizes: '18vw', alt: '' }) + '</div>' +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }

  return { title: 'Accueil', render };
})();
