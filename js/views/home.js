/* ==========================================================================
   Vue : Accueil touriste
   Ton volontairement simple et concret, comme un panneau d'information
   de village : on explique, on rassure, on montre les missions.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.home = (function () {
  'use strict';
  const { esc, icon, photo, duration, typeOf, currentSeason, seasonLabel } = Meleze.ui;

  const STEPS = [
    ['Vous choisissez une mission', 'Dans le catalogue, chaque mission indique sa durée, le point de rendez-vous et ce que vous recevez en échange. L’inscription se fait en un clic.'],
    ['Vous la faites avec quelqu’un du coin', 'Un garde du Parc, l’équipe des sentiers ou un artisan vous accueille. Le matériel est fourni : venez simplement avec de bonnes chaussures.'],
    ['Le référent valide, vous profitez', 'À la fin, il scanne le QR de votre espace. Votre bon apparaît aussitôt, il suffit de le montrer au commerçant.'],
  ];

  const FAQ = [
    ['C’est vraiment gratuit ?', 'Oui. Vous donnez un peu de temps, les commerçants partenaires offrent la contrepartie. On ne vous demandera jamais de carte bancaire.'],
    ['Je ne suis pas très sportif, est-ce pour moi ?', 'Sûrement. Beaucoup de missions se font à plat ou presque, et certaines conviennent aux enfants. La durée et le lieu sont indiqués sur chaque fiche.'],
    ['Et s’il fait mauvais ?', 'Une sortie peut être reportée en cas de mauvais temps. Votre inscription reste valable pour la date suivante.'],
    ['Comment utiliser mon bon ?', 'Ouvrez « Mon espace » et montrez le QR du bon au commerçant. Il le scanne, et le bon est marqué comme utilisé.'],
  ];

  /** Petite carte mission (photo + infos pratiques). */
  function missionCard(m) {
    const t = typeOf(m.type);
    return '<li><a href="#/missions?focus=' + esc(m.id) + '" class="group block h-full overflow-hidden rounded-2xl border border-line bg-card transition-colors hover:border-muted">' +
      '<div class="ph aspect-[3/2]">' + photo(m, { sizes: '(min-width:768px) 33vw, 100vw', alt: '' }) + '</div>' +
      '<div class="p-4">' +
        '<p class="text-sm text-muted">' + esc(t.label) + ' · ' + duration(m.duration) + '</p>' +
        '<h3 class="mt-1 text-xl group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">' + esc(m.title) + '</h3>' +
        '<p class="mt-3 text-[0.95rem]"><span class="text-muted">En échange :</span> ' + esc(m.reward.title) + '</p>' +
      '</div>' +
    '</a></li>';
  }

  function render(state) {
    const season = currentSeason();
    const picks = state.missions.filter((m) => m.seasons.includes(season)).slice(0, 3);

    // Partenaires et ce qu'ils offrent, déduits des missions
    const partners = {};
    state.missions.forEach((m) => { (partners[m.reward.partner] = partners[m.reward.partner] || []).push(m.reward.title); });

    return (
      // ---- Introduction -----------------------------------------------------------
      '<section class="mx-auto grid max-w-app gap-8 px-5 pb-14 pt-8 sm:px-8 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-12 md:py-16">' +
        '<div>' +
          '<p class="text-muted">Pralognan-la-Vanoise, été comme hiver</p>' +
          '<h1 id="page-title" tabindex="-1" class="mt-3 text-[2.5rem] sm:text-6xl">Une heure pour la montagne, une expérience en retour.</h1>' +
          '<p class="mt-5 max-w-xl text-lg text-muted">Pendant votre séjour, donnez un coup de main à la station : remettre un sentier en état, compter les marmottes avec un garde du Parc, ou tout simplement venir en train. En remerciement, les commerçants du village vous offrent une montée en téléphérique, une soirée à la patinoire ou un beau morceau de Beaufort.</p>' +
          '<div class="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">' +
            '<a href="#/missions" class="btn-primary">Voir les missions</a>' +
            '<a href="#/wallet" class="link">Mon espace ' + icon('arrow', 'h-4 w-4') + '</a>' +
          '</div>' +
        '</div>' +
        '<figure>' +
          '<div class="ph aspect-[4/3] rounded-2xl md:aspect-[4/5]">' + photo('hero', { eager: true, sizes: '(min-width:768px) 45vw, 100vw' }) + '</div>' +
          '<figcaption class="mt-2 text-sm text-muted">Au-dessus des nuages, un matin d’automne.</figcaption>' +
        '</figure>' +
      '</section>' +

      // ---- Comment ça se passe --------------------------------------------------------
      '<section class="bg-tint" aria-labelledby="how">' +
        '<div class="mx-auto max-w-app px-5 py-14 sm:px-8 md:py-20">' +
          '<h2 id="how" class="text-3xl sm:text-4xl">Comment ça se passe</h2>' +
          '<ol class="mt-8 grid gap-8 md:grid-cols-3">' +
            STEPS.map(([title, text], i) =>
              '<li class="border-t border-sage-300 pt-4">' +
                '<p class="font-serif text-2xl text-brand-ink">' + (i + 1) + '.</p>' +
                '<h3 class="mt-1 text-xl">' + title + '</h3>' +
                '<p class="mt-2 text-muted">' + text + '</p>' +
              '</li>').join('') +
          '</ol>' +
        '</div>' +
      '</section>' +

      // ---- Missions du moment -----------------------------------------------------------
      '<section class="mx-auto max-w-app px-5 py-14 sm:px-8 md:py-20" aria-labelledby="now">' +
        '<div class="flex flex-wrap items-baseline justify-between gap-3">' +
          '<h2 id="now" class="text-3xl sm:text-4xl">En ce moment, en ' + seasonLabel(season).toLowerCase() + '</h2>' +
          '<a href="#/missions" class="link">Toutes les missions (' + state.missions.length + ') ' + icon('arrow', 'h-4 w-4') + '</a>' +
        '</div>' +
        '<ul class="mt-8 grid gap-5 sm:grid-cols-2 md:grid-cols-3">' + picks.map(missionCard).join('') + '</ul>' +
      '</section>' +

      // ---- Pourquoi Mélèze (texte + deux photos) ------------------------------------------
      '<section class="mx-auto grid max-w-app gap-8 px-5 pb-14 sm:px-8 md:grid-cols-2 md:items-center md:gap-14 md:pb-20" aria-labelledby="why">' +
        '<div class="grid grid-cols-5 gap-3">' +
          '<figure class="col-span-3"><div class="ph aspect-[3/4] rounded-2xl">' + photo('forest', { sizes: '(min-width:768px) 28vw, 60vw', alt: 'Sous-bois éclairé par le soleil' }) + '</div></figure>' +
          '<figure class="col-span-2 self-end"><div class="ph aspect-[3/4] rounded-2xl">' + photo('meadow', { sizes: '(min-width:768px) 18vw, 40vw', alt: 'Prairie d’alpage' }) + '</div>' +
            '<figcaption class="mt-2 text-sm text-muted">Les alpages, en juin.</figcaption></figure>' +
        '</div>' +
        '<div>' +
          '<h2 id="why" class="text-3xl sm:text-4xl">Pourquoi Mélèze ?</h2>' +
          '<div class="mt-5 space-y-4 text-muted">' +
            '<p>Beaucoup de visiteurs aiment la Vanoise et aimeraient lui rendre un peu de ce qu’elle leur donne, sans savoir par où commencer.</p>' +
            '<p>Mélèze rassemble de petites missions concrètes, encadrées par des gens d’ici. Les commerçants, eux, ont trouvé une façon simple de dire merci.</p>' +
            '<p>Le nom vient du mélèze, le seul conifère de nos forêts à perdre ses aiguilles : en octobre, il dore toute la vallée.</p>' +
          '</div>' +
        '</div>' +
      '</section>' +

      // ---- Partenaires ---------------------------------------------------------------------
      '<section class="border-t border-line" aria-labelledby="partners">' +
        '<div class="mx-auto max-w-app px-5 py-14 sm:px-8 md:py-20">' +
          '<h2 id="partners" class="text-3xl sm:text-4xl">Ils participent</h2>' +
          '<p class="mt-2 text-muted">Les commerçants et structures qui offrent les contreparties.</p>' +
          '<ul class="mt-8 grid gap-x-10 sm:grid-cols-2">' +
            Object.keys(partners).map((name) =>
              '<li class="flex flex-col border-b border-line py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">' +
                '<span class="font-semibold">' + esc(name) + '</span>' +
                '<span class="text-[0.95rem] text-muted sm:text-right">' + esc(partners[name][0]) + '</span>' +
              '</li>').join('') +
          '</ul>' +
        '</div>' +
      '</section>' +

      // ---- Questions -----------------------------------------------------------------------
      '<section class="bg-sunk" aria-labelledby="faq">' +
        '<div class="mx-auto grid max-w-app gap-6 px-5 py-14 sm:px-8 md:grid-cols-[1fr_2fr] md:py-20">' +
          '<h2 id="faq" class="text-3xl sm:text-4xl">Vos questions</h2>' +
          '<div>' +
            FAQ.map(([q, a]) =>
              '<details class="acc border-b border-line py-4">' +
                '<summary class="text-lg font-semibold">' + q + '<span class="acc-icon text-muted">' + icon('chevron') + '</span></summary>' +
                '<p class="mt-2 max-w-xl text-muted">' + a + '</p>' +
              '</details>').join('') +
          '</div>' +
        '</div>' +
      '</section>' +

      // ---- Dernier mot ------------------------------------------------------------------------
      '<section class="mx-auto max-w-app px-5 py-14 text-center sm:px-8 md:py-20">' +
        '<h2 class="mx-auto max-w-xl text-3xl sm:text-4xl">Une heure, c’est souvent assez pour changer un bout de sentier.</h2>' +
        '<a href="#/missions" class="btn-primary mt-7">Trouver ma mission</a>' +
      '</section>'
    );
  }

  return { title: 'Accueil', render };
})();
