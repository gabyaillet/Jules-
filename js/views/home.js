/* ==========================================================================
   Vue : Accueil / landing page touriste
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.home = (function () {
  'use strict';
  const { esc, icon, photo, duration, typeOf, currentSeason, seasonLabel } = Meleze.ui;

  const STEPS = [
    { n: '01', photo: 'mist', title: 'Choisissez une mission', text: 'Sentier, comptage de marmottes, arrivée en train… 1 à 2 heures, en été comme en hiver.' },
    { n: '02', photo: 'forest', title: 'Agissez avec un référent', text: 'Un garde du Parc, un artisan ou l’équipe sentiers vous accueille et vous guide sur place.' },
    { n: '03', photo: 'lake', title: 'Recevez votre expérience', text: 'Le référent scanne votre QR : un bon s’ajoute à votre wallet, à utiliser chez un commerçant.' },
  ];

  const FAQ = [
    ['Est-ce payant ?', 'Non. Vous donnez du temps, la station et ses commerçants vous offrent une expérience en retour. Aucun moyen de paiement n’est demandé.'],
    ['Faut-il être sportif ?', 'Les missions sont pensées pour tous : la durée, le lieu et le niveau sont indiqués sur chaque carte. Beaucoup conviennent aux familles.'],
    ['Comment ma mission est-elle validée ?', 'À la fin, montrez le QR code de votre wallet au référent. Il le scanne et votre récompense est débloquée instantanément.'],
    ['Et l’impact numérique ?', 'Mélèze est éco-conçu : pas de framework, pas de traqueur, des photos compressées chargées seulement quand elles s’affichent, et un mode sombre économe. L’app fonctionne même hors-ligne.'],
  ];

  /** Carte mission avec photo, pour le carrousel "de saison". */
  function photoCard(m) {
    const t = typeOf(m.type);
    return '<li class="w-[82%] shrink-0 sm:w-[46%] lg:w-[31.5%]">' +
      '<a href="#/missions?focus=' + esc(m.id) + '" class="group block">' +
        '<div class="ph ph-zoom scrim aspect-[4/5] rounded-[1.75rem]">' + photo(m, { sizes: '(min-width:1024px) 30vw, 80vw', alt: '' }) +
          '<span class="badge-glass absolute left-4 top-4 z-10">' + icon(t.icon, 'h-3.5 w-3.5') + esc(t.label) + '</span>' +
          '<span class="badge-glass absolute right-4 top-4 z-10">' + icon('clock', 'h-3.5 w-3.5') + duration(m.duration) + '</span>' +
          '<div class="absolute inset-x-0 bottom-0 z-10 p-5 text-snow-50">' +
            '<h3 class="text-[1.75rem] leading-[1.05]">' + esc(m.title) + '</h3>' +
            '<p class="mt-3 flex items-center gap-2 text-sm text-snow-100/90">' + icon('gift', 'h-4 w-4 shrink-0 text-larch-300') + esc(m.reward.title) + '</p>' +
          '</div>' +
        '</div>' +
      '</a></li>';
  }

  function render(state) {
    const season = currentSeason();
    const picks = state.missions.filter((m) => m.seasons.includes(season));
    const partners = Array.from(new Set(state.missions.map((m) => m.reward.partner)));
    const marqueeItems = partners.concat(partners) // doublé pour une boucle continue
      .map((p, i) => '<li class="flex items-center gap-10 whitespace-nowrap font-serif text-3xl sm:text-5xl"' + (i >= partners.length ? ' aria-hidden="true"' : '') + '>' +
        esc(p) + '<span class="text-accent">✳</span></li>').join('');

    return (
      // ---- Hero plein écran ---------------------------------------------------
      '<section class="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-fir-950 text-snow-50">' +
        '<div class="ph absolute inset-0">' + photo('hero', { eager: true, sizes: '100vw' }) + '</div>' +
        '<div class="absolute inset-0" style="background:linear-gradient(180deg,rgb(11 22 17/.55) 0%,rgb(11 22 17/.05) 35%,rgb(11 22 17/.35) 60%,rgb(11 22 17/.92) 100%)"></div>' +
        '<div class="relative mx-auto w-full max-w-app px-5 pb-28 pt-32 sm:px-8 sm:pb-16">' +
          '<p class="fade-up badge-glass">' + icon('pin', 'h-3.5 w-3.5') + 'Pralognan-la-Vanoise · 1 418 m</p>' +
          '<h1 id="page-title" tabindex="-1" class="fade-up mt-5 max-w-4xl text-[3.4rem] leading-[0.92] sm:text-8xl lg:text-[8.5rem]" style="animation-delay:.08s">' +
            'Une heure pour la montagne, <em class="text-larch-300">une expérience</em> en retour.</h1>' +
          '<div class="fade-up mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between" style="animation-delay:.16s">' +
            '<p class="max-w-md text-base text-snow-100/85 sm:text-lg">Donnez un peu de votre séjour à la station. Les commerçants vous remercient en téléphérique, en patinoire ou en produits du terroir.</p>' +
            '<div class="flex flex-col gap-3 sm:flex-row">' +
              '<a href="#/missions" class="btn bg-snow-50 text-fir-900 hover:bg-snow-100">Voir les missions <span class="btn-arrow">' + icon('arrow', 'h-4 w-4') + '</span></a>' +
              '<a href="#/wallet" class="btn-glass hidden sm:inline-flex">Mon wallet</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      // ---- Manifeste avec photos insérées dans le texte -------------------------
      '<section class="mx-auto max-w-app px-5 py-20 sm:px-8 sm:py-32">' +
        '<p class="eyebrow">Le concept</p>' +
        '<p class="display mt-6 text-[2.1rem] leading-[1.08] sm:text-6xl lg:text-7xl">' +
          'Entretenir un sentier <span class="inline-photo">' + photo('lake', { sizes: '120px', alt: '' }) + '</span>, compter les marmottes ' +
          '<span class="inline-photo">' + photo('meadow', { sizes: '120px', alt: '' }) + '</span> ou venir en train : chaque geste compte. ' +
          '<span class="text-muted">La station vous dit merci</span> <span class="inline-photo">' + photo('stars', { sizes: '120px', alt: '' }) + '</span><span class="text-muted">.</span>' +
        '</p>' +
        '<dl class="mt-14 grid grid-cols-3 border-t border-line pt-8">' +
          stat(state.missions.length, 'missions ouvertes') + stat('1–2 h', 'par mission') + stat('4', 'saisons') +
        '</dl>' +
      '</section>' +

      // ---- 3 étapes en cartes photo ------------------------------------------------
      '<section class="mx-auto max-w-app px-5 pb-20 sm:px-8 sm:pb-32" aria-labelledby="how">' +
        '<div class="flex flex-wrap items-end justify-between gap-4">' +
          '<h2 id="how" class="text-5xl leading-none sm:text-7xl">Comment <em>ça marche</em></h2>' +
          '<p class="max-w-xs text-muted">Trois étapes, zéro paperasse, aucun paiement.</p>' +
        '</div>' +
        '<ol class="rail mt-10 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">' +
          STEPS.map((s) =>
            '<li class="w-[82%] shrink-0 sm:w-[46%] lg:w-auto">' +
              '<div class="ph aspect-[4/3] rounded-[1.75rem]">' + photo(s.photo, { sizes: '(min-width:1024px) 30vw, 80vw', alt: '' }) +
                '<span class="absolute left-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-snow-50 font-serif text-xl text-fir-900">' + s.n + '</span></div>' +
              '<h3 class="mt-5 text-3xl">' + s.title + '</h3>' +
              '<p class="mt-2 text-muted">' + s.text + '</p>' +
            '</li>').join('') +
        '</ol>' +
      '</section>' +

      // ---- Missions de la saison (carrousel) --------------------------------------
      '<section class="overflow-hidden rounded-t-[2.5rem] bg-fir-900 py-20 text-snow-50 sm:py-28" aria-labelledby="now">' +
        '<div class="mx-auto max-w-app px-5 sm:px-8">' +
          '<div class="flex flex-wrap items-end justify-between gap-6">' +
            '<div><p class="eyebrow text-snow-200/70">En ce moment · ' + seasonLabel(season) + '</p>' +
            '<h2 id="now" class="mt-4 text-5xl leading-none sm:text-7xl">Missions de <em class="text-larch-300">saison</em></h2></div>' +
            '<a href="#/missions" class="btn-glass btn-sm">Tout le catalogue ' + icon('arrow', 'h-4 w-4') + '</a>' +
          '</div>' +
          '<ul class="rail mt-10">' + picks.map(photoCard).join('') + '</ul>' +
        '</div>' +
      '</section>' +

      // ---- Grande image + citation ---------------------------------------------------
      '<section class="bg-fir-900 px-3 pb-3 sm:px-4 sm:pb-4">' +
        '<div class="ph scrim relative min-h-[34rem] rounded-[2rem] sm:min-h-[40rem]">' + photo('range', { sizes: '100vw', alt: 'Chaîne de montagnes au crépuscule' }) +
          '<div class="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-app p-6 text-snow-50 sm:p-12">' +
            '<p class="display max-w-3xl text-4xl leading-[1.02] sm:text-6xl">Un tourisme qui <em class="text-larch-300">rend</em> à la montagne ce qu’elle nous donne.</p>' +
            '<p class="mt-4 text-sm text-snow-200/80">Pralognan-la-Vanoise, aux portes du Parc national de la Vanoise</p>' +
          '</div>' +
        '</div>' +
      '</section>' +

      // ---- Partenaires (bandeau défilant) ---------------------------------------------
      '<section class="overflow-hidden py-20 sm:py-28" aria-labelledby="partners">' +
        '<div class="mx-auto max-w-app px-5 sm:px-8">' +
          '<p class="eyebrow">Ils vous disent merci</p>' +
          '<h2 id="partners" class="mt-4 text-5xl leading-none sm:text-7xl">Des commerçants <em>engagés</em></h2>' +
        '</div>' +
        '<div class="mt-12 border-y border-line py-6"><ul class="marquee" aria-label="Commerçants partenaires">' + marqueeItems + '</ul></div>' +
      '</section>' +

      // ---- FAQ en accordéon ---------------------------------------------------------------
      '<section class="mx-auto grid max-w-app gap-10 px-5 pb-20 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:pb-28" aria-labelledby="faq">' +
        '<div><p class="eyebrow">FAQ</p><h2 id="faq" class="mt-4 text-5xl leading-none sm:text-6xl">Questions <em>fréquentes</em></h2></div>' +
        '<div>' +
          FAQ.map(([q, a], i) =>
            '<details class="acc border-b border-line py-6' + (i === 0 ? ' border-t' : '') + '">' +
              '<summary class="text-lg font-medium sm:text-xl">' + q +
              '<span class="acc-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunk">' + icon('plus', 'h-4 w-4') + '</span></summary>' +
              '<p class="mt-3 max-w-xl text-muted">' + a + '</p>' +
            '</details>').join('') +
        '</div>' +
      '</section>' +

      // ---- Appel final sur photo de nuit -------------------------------------------------
      '<section class="px-3 sm:px-4">' +
        '<div class="ph relative overflow-hidden rounded-[2rem] text-snow-50">' + photo('stars', { sizes: '100vw', alt: '' }) +
          '<div class="absolute inset-0 bg-fir-950/50"></div>' +
          '<div class="relative mx-auto flex min-h-[28rem] max-w-app flex-col items-start justify-end p-6 sm:p-12">' +
            '<h2 class="max-w-2xl text-5xl leading-[0.95] sm:text-7xl">Prêt·e à donner une heure à la <em class="text-larch-300">Vanoise</em>&nbsp;?</h2>' +
            '<a href="#/missions" class="btn mt-8 bg-accent text-on-accent hover:bg-larch-300">Je choisis ma mission <span class="btn-arrow">' + icon('arrow', 'h-4 w-4') + '</span></a>' +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }

  function stat(value, label) {
    return '<div class="flex flex-col-reverse"><dt class="mt-1 text-sm text-muted">' + label + '</dt>' +
      '<dd class="font-serif text-5xl leading-none sm:text-7xl">' + value + '</dd></div>';
  }

  return { title: 'Accueil', render, overlayHeader: true };
})();
