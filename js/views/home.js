/* ==========================================================================
   Vue : Accueil touriste — base blanche, titres gras quasi noirs, un seul
   accent vert. Hero « Plein écran » sur tablette / ordinateur (grande photo,
   titre en blanc posé dessus) ; sur mobile, hero « direct » : le titre puis
   les 3 missions, visibles dès l'arrivée. Le mot « Vanoise » de l'appel final
   est rempli par une photo (background-clip: text).
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
  /** Lignes du titre qui accompagnent le mot-photo géant (appel final). */
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
          '<span class="tag tag-sign absolute left-3 top-3 ' + esc(t.color) + '">' + esc(t.label) + '</span>' +
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

  /** Contrepartie en version courte pour les lignes du hero mobile (sinon : le titre, tronqué). */
  const SHORT_REWARD = {
    'm-sentiers': 'Téléphérique offert',
    'm-marche': 'Beaufort offert',
    'm-transport': 'Patinoire offerte',
  };
  /** Participation en cours : pastille noire à la place de la contrepartie. */
  const STATUS = { inscrite: 'Inscrit·e', preuve: 'Justificatif envoyé', refusee: 'Justificatif refusé' };

  /**
   * Ligne mission du hero mobile : vignette, titre, puis durée + contrepartie (ou statut)
   * sur une même ligne quand il y a la place, flèche. Une tuile gris clair carrée,
   * entièrement cliquable.
   */
  function missionRow(m) {
    const p = Meleze.store.participationFor(m.id);
    const PILL = 'tag block min-w-0 max-w-full truncate px-2.5 py-0.5 text-[0.875rem] max-[359px]:px-2 max-[359px]:text-[0.8125rem]';
    const badge = p
      ? '<span class="' + PILL + ' bg-ink text-surface">' + esc(STATUS[p.status] || STATUS.inscrite) + '</span>'
      : '<span class="sr-only">En échange : ' + esc(m.reward.title) + '</span>' +
        '<span class="' + PILL + ' bg-forest text-white" aria-hidden="true">' + esc(SHORT_REWARD[m.id] || m.reward.title) + '</span>';
    return '<li><a href="#/missions?focus=' + esc(m.id) + '" class="flex items-center gap-3 bg-sunk p-2 pr-2.5 transition-colors hover:bg-line">' +
      '<div class="ph ph-sm h-16 w-16 shrink-0 min-[360px]:h-[4.75rem] min-[360px]:w-[4.75rem] min-[375px]:h-[5.5rem] min-[375px]:w-[5.5rem]">' + photo(m, { sizes: '88px', alt: '' }) + '</div>' +
      '<div class="min-w-0 flex-1 py-1">' +
        '<h3 class="line-clamp-3 text-[1.1rem] leading-[1.1] tracking-[-0.02em] text-ink">' + esc(m.title) + '</h3>' +
        '<div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">' +
          '<p class="font-display text-[0.95rem] font-semibold leading-tight text-ink"><span class="sr-only">Durée : </span>' + esc(missionDuration(m) || 'Variable') + '</p>' +
          badge +
        '</div>' +
      '</div>' +
      icon('arrow', 'h-5 w-5 shrink-0 text-ink') +
    '</a></li>';
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
      // ---- Hero : une seule section, deux mises en page -------------------------------------
      // · Mobile (< md) « direct » : le lieu, le titre, puis tout de suite les 3 missions en
      //   lignes compactes et le bouton, le tout visible sur le premier écran.
      // · Tablette / ordinateur (≥ md) « Plein écran » : une photo de montagne haute définition
      //   (Unsplash, jusqu'à 2400 px) en grand, le titre en blanc posé dessus, les deux boutons.
      // Un seul <h1 id="page-title"> : seule sa mise en forme change selon la largeur.
      '<section class="' + WRAP + ' pb-14 pt-4 sm:pt-6 lg:pb-24 lg:pt-8">' +
        '<div class="md:relative md:isolate md:flex md:h-[min(78svh,56rem)] md:min-h-[34rem] md:flex-col md:justify-between md:overflow-hidden md:rounded-3xl lg:rounded-4xl md:[[data-theme=dark]_&]:ring-1 md:[[data-theme=dark]_&]:ring-white/15">' +
          // Photo (≥ md) : chargement différé (loading=lazy) → jamais téléchargée sur mobile,
          // où ce bloc est masqué ; à l'écran sur ordinateur, elle se charge aussitôt.
          '<div class="ph ph-lg absolute inset-0 -z-10 hidden md:block">' +
            photo('range', { sizes: '(min-width:1216px) 1152px, 100vw' }) +
            // Voile léger en haut, plus dense dans l'angle du lieu (roche claire sur grand écran)
            '<div class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[image:radial-gradient(ellipse_60%_100%_at_0%_0%,rgb(0_0_0/0.5),transparent),linear-gradient(to_bottom,rgb(0_0_0/0.3),transparent)] lg:h-64" aria-hidden="true"></div>' +
          '</div>' +
          // Haut : le lieu (avec un trait vert sur mobile, en blanc sur la photo) + l'autocollant (≥ md)
          '<div class="flex items-start justify-between gap-x-4 md:p-8 lg:p-12">' +
            '<p class="flex items-center gap-3 font-display text-base font-bold leading-tight tracking-[-0.005em] text-ink md:block md:pt-1 md:text-white md:[text-shadow:0_1px_10px_rgb(0_0_0/0.45)] lg:text-lg">' +
              '<span class="h-[3px] w-8 shrink-0 bg-accent md:hidden" aria-hidden="true"></span>Pralognan-la-Vanoise</p>' +
            '<span class="sticker ml-auto hidden shrink-0 rotate-3 bg-forest px-4 py-2 text-[0.95rem] text-white md:inline-flex lg:px-5 lg:py-2.5 lg:text-lg">Téléphérique offert</span>' +
          '</div>' +
          // Bas (≥ md) : le dégradé sombre suit le bloc de texte (et le déborde de 10rem vers le
          // haut), quelle que soit la hauteur de l'écran : blanc sur noir ≥ 0,68 → contraste ≥ 4,5:1.
          '<div class="mt-2.5 md:relative md:isolate md:mt-0 md:grid md:gap-6 md:p-8 md:before:pointer-events-none md:before:absolute md:before:inset-x-0 md:before:-top-40 md:before:bottom-0 md:before:-z-10 md:before:bg-[image:linear-gradient(to_top,rgb(0_0_0/0.82)_0%,rgb(0_0_0/0.68)_calc(100%-10rem),rgb(0_0_0/0.3)_calc(100%-5rem),transparent_100%)] lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12 lg:p-12">' +
            '<h1 id="page-title" tabindex="-1" class="max-w-[17ch] text-[length:clamp(1.75rem,7.7vw,1.9rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[2.25rem] md:max-w-[14ch] md:text-6xl md:leading-[0.95] md:tracking-[-0.04em] md:text-white md:[text-shadow:0_2px_24px_rgb(0_0_0/0.35)] lg:max-w-[15ch] lg:text-[4.25rem] lg:leading-[0.92] xl:text-[5rem]">Une heure pour la montagne, une expérience en retour.</h1>' +
            '<div class="hidden gap-4 md:flex md:flex-wrap md:items-center lg:flex-col lg:items-stretch lg:gap-3">' +
              '<a href="#/missions" class="btn-primary">Voir les missions ' + icon('arrow', 'h-5 w-5') + '</a>' +
              '<a href="#/wallet" class="btn border-2 border-white text-white hover:bg-white hover:text-night">Mon espace</a>' +
            '</div>' +
          '</div>' +
          // Mobile : les missions tout de suite, puis le bouton (« Mon espace » est dans la barre du bas)
          '<h2 class="sr-only md:hidden">Les missions</h2>' +
          '<ul class="mt-5 grid grid-cols-1 gap-2 md:hidden">' + picks.map(missionRow).join('') + '</ul>' +
          '<a href="#/missions" class="btn-primary mt-3 w-full md:hidden">Voir les missions ' + icon('arrow', 'h-5 w-5') + '</a>' +
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

      // ---- Les missions : grandes cartes photo (≥ md ; sur mobile, elles sont dans le hero) ----
      '<section class="' + WRAP + ' hidden pb-14 md:block lg:pb-24" aria-labelledby="now">' +
        '<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">' +
          '<h2 id="now" class="' + H2 + '">Les missions</h2>' +
          '<a href="#/missions" class="link text-lg">' + (more ? 'Voir les ' + state.missions.length + ' missions' : 'Toutes les missions') + ' ' + icon('arrow', 'h-5 w-5') + '</a>' +
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
      '<section class="night-block bg-night py-14 text-white lg:py-24">' +
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
