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
  const { esc, icon, photo, missionDuration, typeOf, currentSeason, seasonLabel } = Meleze.ui;

  /** Conteneur commun : même largeur et mêmes marges sur toute la page. */
  const WRAP = 'mx-auto max-w-app px-5 sm:px-8';
  const H2 = 'text-4xl sm:text-5xl lg:text-6xl';
  const INTRO = 'mt-4 max-w-xl text-lg text-muted';

  const STEPS = [
    { color: 'bg-sun', title: 'Choisissez une mission', text: 'Marché du village, sentiers du Parc ou trajet sans voiture : inscrivez-vous, la mission arrive dans « Mon espace ». Chaque fiche indique la durée, le rendez-vous et ce que vous recevez.' },
    { color: 'bg-leaf', title: 'Faites-la avec un local', text: 'Les commerçants du marché ou les gardes du Parc vous accueillent, le matériel est fourni. Vous venez en train ou en covoiturage ? Gardez votre billet.' },
    { color: 'bg-sky', title: 'Recevez votre bon', text: 'Le référent scanne le QR de votre mission, ou vous envoyez votre billet : votre bon arrive dans votre espace, prêt à montrer au commerçant.' },
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
          '<span class="absolute left-3 top-3 rounded-full px-3 py-1 font-display text-sm font-semibold text-night ' + t.color + '">' + esc(t.label) + '</span>' +
        '</div>' +
        '<h3 class="mt-5 text-2xl group-hover:underline group-hover:decoration-lime-400 group-hover:decoration-[3px] group-hover:underline-offset-4">' + esc(m.title) + '</h3>' +
        '<p class="mt-2 text-muted">' + meta + '</p>' +
        '<p class="mt-1 text-sm text-muted">' + when + '</p>' +
        '<p class="mt-3 text-ink"><span class="text-muted">En échange :</span> <span class="font-semibold">' + esc(m.reward.title) + '</span></p>' +
      '</a></li>';
  }

  /** Tuile "contrepartie" dans le bloc vert. */
  function rewardTile(m) {
    const t = typeOf(m.type);
    return '<li class="flex min-h-[9rem] flex-col justify-between gap-6 p-5 text-night sm:min-h-[12rem] sm:p-6 ' + t.color + '">' +
      '<p class="text-sm text-night/60">' + esc(m.reward.category || t.label) + '</p>' +
      '<div><p class="break-words font-display text-xl font-bold leading-tight tracking-[-0.02em] lg:text-2xl">' + esc(m.reward.title) + '</p>' +
      '<p class="mt-1.5 text-sm text-night/70">' + esc(m.reward.partner) + '</p></div>' +
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
      // ---- Hero : titre + grille de photos -------------------------------------------
      '<section class="' + WRAP + ' grid gap-10 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-14">' +
        '<div>' +
          '<span class="tag text-ink">Pralognan-la-Vanoise · 4 saisons</span>' +
          '<h1 id="page-title" tabindex="-1" class="mt-5 text-[2.75rem] font-extrabold sm:text-7xl lg:text-[4.6rem]">Une heure pour la <span class="mark">montagne</span>, une expérience en retour.</h1>' +
          '<p class="mt-6 max-w-lg text-lg text-muted">Venez sans votre voiture, aidez à monter le marché ou nettoyez les sentiers avec les gardes du Parc. Les commerçants du village vous remercient : téléphérique, patinoire, Beaufort d’alpage…</p>' +
          '<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">' +
            '<a href="#/missions" class="btn-primary">Voir les missions ' + icon('arrow', 'h-5 w-5') + '</a>' +
            '<a href="#/wallet" class="btn-secondary">Mon espace</a>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-2 gap-3 sm:gap-4">' +
          '<div class="ph ph-lg col-span-2 aspect-[16/10]">' + photo('hero', { eager: true, sizes: '(min-width:1024px) 45vw, 100vw' }) +
            '<span class="sticker absolute left-4 top-4 -rotate-3 bg-lime-300">Téléphérique offert</span></div>' +
          '<div class="ph ph-lg aspect-square">' + photo('meadow', { sizes: '(min-width:1024px) 22vw, 48vw', alt: 'Prairie d’alpage' }) +
            '<span class="sticker absolute bottom-4 left-4 rotate-2 bg-white">Avec les gardes du Parc</span></div>' +
          '<div class="flex aspect-square flex-col justify-between bg-sky p-5 text-night sm:p-6">' +
            '<p class="font-display text-sm font-semibold text-night/60">Sur place</p>' +
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

      // ---- Contreparties (bloc vert) -------------------------------------------------------------
      '<section class="bg-pine-700 py-16 text-white lg:py-24" aria-labelledby="gifts">' +
        '<div class="' + WRAP + '">' +
          '<h2 id="gifts" class="max-w-3xl ' + H2 + '">Ce que les commerçants vous <span class="mark">offrent</span></h2>' +
          '<p class="mt-4 max-w-xl text-lg text-white/80">Une contrepartie par mission, offerte par un commerce ou un service de la station.</p>' +
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
