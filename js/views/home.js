/* ==========================================================================
   Vue : Accueil / landing page touriste
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.home = (function () {
  'use strict';
  const { esc, icon, ridge, duration, typeOf, currentSeason, seasonLabel } = Meleze.ui;

  const STEPS = [
    { n: '01', title: 'Choisissez une mission', text: 'Sentier, comptage de marmottes, arrivée en train… 1 à 2 heures, en été comme en hiver.' },
    { n: '02', title: 'Agissez avec un référent', text: 'Un garde du Parc, un artisan ou l’équipe sentiers vous accueille et vous guide sur place.' },
    { n: '03', title: 'Recevez votre expérience', text: 'Le référent scanne votre QR : un bon s’ajoute à votre wallet, à utiliser chez un commerçant.' },
  ];

  const FAQ = [
    ['Est-ce payant ?', 'Non. Vous donnez du temps, la station et ses commerçants vous offrent une expérience en retour. Aucun moyen de paiement n’est demandé.'],
    ['Faut-il être sportif ?', 'Les missions sont pensées pour tous : la durée, le lieu et le niveau sont indiqués sur chaque carte. Beaucoup conviennent aux familles.'],
    ['Comment ma mission est-elle validée ?', 'À la fin, montrez le QR code de votre wallet au référent. Il le scanne et votre récompense est débloquée instantanément.'],
    ['Pourquoi l’application est-elle si sobre ?', 'Pas d’images lourdes, pas de police téléchargée, pas de traqueur : Mélèze pèse moins qu’une photo et fonctionne même avec une mauvaise couverture réseau.'],
  ];

  /** Carte compacte pour la sélection "cette saison". */
  function miniCard(m) {
    const t = typeOf(m.type);
    return '<li><a href="#/missions?focus=' + esc(m.id) + '" class="card group flex h-full flex-col gap-4 p-5 transition-colors hover:border-ink/40">' +
      '<span class="flex items-center gap-2 text-sm font-semibold text-muted">' + icon(t.icon, 'h-4 w-4') + esc(t.label) + ' · ' + duration(m.duration) + '</span>' +
      '<span class="font-serif text-xl leading-snug">' + esc(m.title) + '</span>' +
      '<span class="mt-auto flex items-center gap-2 rounded-2xl bg-accent/15 px-3 py-2 text-sm font-semibold text-ink">' + icon('gift', 'h-4 w-4 shrink-0 text-accent-ink') + esc(m.reward.title) + '</span>' +
      '</a></li>';
  }

  function render(state) {
    const season = currentSeason();
    const picks = state.missions.filter((m) => m.seasons.includes(season)).slice(0, 3);
    const partners = Array.from(new Set(state.missions.map((m) => m.reward.partner)));

    return (
      // ---- Hero ---------------------------------------------------------------
      '<section class="relative overflow-hidden rounded-b-4xl bg-fir-900 text-snow-100">' +
        '<div class="mx-auto max-w-app px-4 pb-40 pt-10 sm:px-8 sm:pt-16 md:pb-56">' +
          '<p class="text-xs font-bold uppercase tracking-[0.2em] text-larch-300">Pralognan-la-Vanoise · 4 saisons</p>' +
          '<h1 id="page-title" tabindex="-1" class="mt-4 max-w-3xl text-[2.6rem] leading-[1.05] sm:text-6xl md:text-7xl">Une heure pour la montagne, <em class="text-larch-400">une expérience</em> en retour.</h1>' +
          '<p class="mt-6 max-w-xl text-lg text-snow-200/90">Donnez un peu de votre séjour à la station&nbsp;: entretien de sentiers, comptages naturalistes, arrivée en train… Les commerçants vous remercient en téléphérique, en patinoire ou en produits du terroir.</p>' +
          '<div class="mt-8 flex flex-col gap-3 sm:flex-row">' +
            '<a href="#/missions" class="btn-accent">Découvrir les missions ' + icon('arrow') + '</a>' +
            '<a href="#/wallet" class="btn border-2 border-snow-100/70 text-snow-100 hover:bg-snow-100/10">Mon wallet</a>' +
          '</div>' +
        '</div>' +
        ridge('absolute inset-x-0 bottom-0 h-32 w-full md:h-44') +
      '</section>' +

      // ---- Chiffres clés ----------------------------------------------------------
      '<section class="mx-auto max-w-app px-4 sm:px-8" aria-label="En bref">' +
        '<dl class="-mt-8 grid grid-cols-3 divide-x divide-line rounded-3xl border border-line bg-card text-center shadow-sm relative">' +
          stat(state.missions.length, 'missions ouvertes') + stat('1–2 h', 'par mission') + stat('0 €', 'juste du temps') +
        '</dl>' +
      '</section>' +

      // ---- Concept en 3 étapes ----------------------------------------------------
      '<section class="mx-auto max-w-app px-4 py-16 sm:px-8" aria-labelledby="how">' +
        '<p class="eyebrow">Le principe</p>' +
        '<h2 id="how" class="mt-2 text-3xl sm:text-5xl">Trois étapes, zéro paperasse.</h2>' +
        '<ol class="mt-10 border-t-2 border-ink">' +
          STEPS.map((s) =>
            '<li class="grid grid-cols-[4.5rem_1fr] gap-4 border-b border-line py-6 sm:grid-cols-[8rem_1fr_1.2fr] sm:items-baseline sm:py-8">' +
              '<span class="font-serif text-4xl text-accent-ink sm:text-6xl">' + s.n + '</span>' +
              '<h3 class="text-2xl sm:text-3xl">' + s.title + '</h3>' +
              '<p class="col-start-2 text-muted sm:col-start-3">' + s.text + '</p>' +
            '</li>').join('') +
        '</ol>' +
      '</section>' +

      // ---- Missions de la saison --------------------------------------------------
      '<section class="bg-sunk py-16" aria-labelledby="now">' +
        '<div class="mx-auto max-w-app px-4 sm:px-8">' +
          '<div class="flex flex-wrap items-end justify-between gap-4">' +
            '<div><p class="eyebrow">En ce moment · ' + seasonLabel(season) + '</p>' +
            '<h2 id="now" class="mt-2 text-3xl sm:text-5xl">Les missions de saison</h2></div>' +
            '<a href="#/missions" class="btn-ghost btn-sm">Tout le catalogue ' + icon('arrow', 'h-4 w-4') + '</a>' +
          '</div>' +
          '<ul class="mt-8 grid gap-4 md:grid-cols-3">' + picks.map(miniCard).join('') + '</ul>' +
        '</div>' +
      '</section>' +

      // ---- Partenaires -----------------------------------------------------------
      '<section class="mx-auto max-w-app px-4 py-16 sm:px-8" aria-labelledby="partners">' +
        '<p class="eyebrow">Ils vous disent merci</p>' +
        '<h2 id="partners" class="mt-2 text-3xl sm:text-5xl">Des commerçants engagés</h2>' +
        '<ul class="mt-8 flex flex-wrap gap-2">' +
          partners.map((p) => '<li class="rounded-full border-2 border-line px-4 py-2 font-serif text-lg">' + esc(p) + '</li>').join('') +
        '</ul>' +
      '</section>' +

      // ---- FAQ en accordéon --------------------------------------------------------
      '<section class="mx-auto max-w-app px-4 pb-16 sm:px-8" aria-labelledby="faq">' +
        '<h2 id="faq" class="text-3xl sm:text-5xl">Questions fréquentes</h2>' +
        '<div class="mt-8 border-t-2 border-ink">' +
          FAQ.map(([q, a]) =>
            '<details class="acc border-b border-line py-5">' +
              '<summary class="text-xl font-semibold sm:text-2xl"><span class="font-serif">' + q + '</span>' +
              '<span class="acc-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-line">' + icon('plus') + '</span></summary>' +
              '<p class="mt-3 max-w-2xl text-muted">' + a + '</p>' +
            '</details>').join('') +
        '</div>' +
      '</section>' +

      // ---- Appel final ------------------------------------------------------------
      '<section class="mx-auto max-w-app px-4 pb-8 sm:px-8">' +
        '<div class="rounded-4xl bg-accent px-6 py-12 text-on-accent sm:px-12">' +
          '<h2 class="max-w-2xl text-3xl sm:text-5xl">Prêt·e à donner une heure à la Vanoise&nbsp;?</h2>' +
          '<a href="#/missions" class="btn mt-6 bg-fir-900 text-snow-100 hover:bg-fir-800">Je choisis ma mission ' + icon('arrow') + '</a>' +
        '</div>' +
      '</section>'
    );
  }

  function stat(value, label) {
    return '<div class="flex flex-col-reverse px-2 py-5"><dt class="mt-1 text-xs text-muted sm:text-sm">' + label + '</dt>' +
      '<dd class="font-serif text-2xl sm:text-4xl">' + value + '</dd></div>';
  }

  return { title: 'Accueil', render };
})();
