/* ==========================================================================
   Vue : Accueil touriste — base blanche, titres gras quasi noirs, un seul
   accent vert. Hero « Plein écran » sur tablette / ordinateur (grande photo,
   titre en blanc posé dessus) ; sur téléphone (concept « Cartes »), le titre
   puis « Missions du moment » en grandes cartes photo qui défilent de côté. Le mot « Vanoise » de l'appel final
   est rempli par une photo (background-clip: text).
   Les missions viennent du serveur (store) ; tant qu'il n'est pas branché,
   la liste laisse place à « Bientôt disponible ».
   Peu de texte, une idée par bloc, des APLATS pleins (vert, noir, gris clair)
   plutôt que des filets. Photos arrondies ; tous les autres blocs sont carrés.
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.home = (function () {
  'use strict';
  const { esc, icon, photo, photoUrl, missionDuration, typeOf, currentSeason, spinner } = Meleze.ui;

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
    { title: 'Choisissez une mission', text: 'Utile au village et à la montagne, en une à deux heures.', cls: 'bg-sunk text-ink', sub: 'text-ink' },
    { title: 'Prenez la photo', text: 'Une IA la vérifie en quelques secondes.', cls: 'bg-forest text-white', sub: 'text-white' },
    { title: 'Recevez votre cadeau', text: 'Montrez votre bon au partenaire.', cls: 'bg-ink text-surface', sub: 'text-surface' },
  ];

  const FAQ = [
    ['C’est vraiment gratuit ?', 'Oui. On ne vous demande jamais de carte bancaire.'],
    ['Comment ma mission est-elle validée ?', 'Dans « Mon espace », prenez la photo demandée. Une IA la vérifie en quelques secondes.'],
    ['Ma photo est-elle gardée ?', 'Mélèze ne la garde pas. Elle est envoyée à l’IA d’Anthropic (États-Unis), seulement pour la vérification. Détails dans les mentions légales.'],
    ['Comment utiliser mon bon ?', 'Devant le partenaire, appuyez sur « Utiliser mon bon ». Il ne sert qu’une fois.'],
    ['Et si je change de téléphone ?', 'Ajoutez votre e-mail dans « Mon espace » : vous retrouverez vos bons avec un code reçu par e-mail.'],
  ];

  /** Carte mission : grande photo + type, titre, durée. (La contrepartie est dans le bandeau vert.) */
  function missionCard(m) {
    const t = typeOf(m.type);
    return '<li class="w-[85%] shrink-0 snap-start sm:w-[46%] lg:w-auto">' +
      '<a href="#/missions?focus=' + esc(m.id) + '" class="group block">' +
        '<div class="ph ph-zoom aspect-[16/10]">' + photo(m, { sizes: '(min-width:1024px) 30vw, 85vw', alt: '' }) +
          '<span class="tag tag-sign absolute left-3 top-3 ' + esc(t.color) + '">' + esc(t.label) + '</span>' +
        '</div>' +
        '<h3 class="mt-4 text-[1.375rem] leading-[1.1] group-hover:underline group-hover:decoration-accent group-hover:decoration-[3px] group-hover:underline-offset-4">' + esc(m.title) + '</h3>' +
        '<p class="mt-1 font-display text-base font-semibold text-ink">' + esc(missionDuration(m)) + '</p>' +
      '</a></li>';
  }

  /** Tuile "contrepartie" : carré blanc posé sur le bandeau vert. */
  function rewardTile(m) {
    return '<li class="flex min-h-[9rem] flex-col justify-end bg-white p-6 text-night sm:min-h-[12rem] lg:p-7">' +
      '<p class="break-words font-display text-[1.75rem] font-bold leading-[1.05] tracking-[-0.025em] lg:text-[2rem]">' + esc(m.reward.title) + '</p>' +
      '<p class="mt-3 font-display text-base font-semibold text-night/70">' + esc(m.reward.partner) + '</p>' +
    '</li>';
  }

  /** Participation du touriste : pastille verte posée sur la photo. */
  const STATUS = { inscrite: 'Inscrit·e', validee: 'Validée' };

  /**
   * Carte du téléphone (concept « Cartes ») : grande photo arrondie avec la pancarte du type
   * et la durée en pilule blanche, puis le titre et la contrepartie (carré vert + cadeau).
   * Les cartes défilent à l'horizontale (on voit le début de la suivante) ; toute la carte
   * mène à la mission dans le catalogue.
   */
  function railCard(m) {
    const t = typeOf(m.type);
    const p = Meleze.store.participationFor(m.id);
    return '<li class="w-[75vw] max-w-[20rem] shrink-0 snap-start">' +
      '<a href="#/missions?focus=' + esc(m.id) + '" class="group block">' +
        '<div class="ph aspect-[292/280] rounded-[28px]">' + photo(m, { sizes: '(max-width:767px) 75vw, 320px', alt: '' }) +
          '<span class="c-sign absolute left-3.5 top-3.5 font-display font-bold ' + esc(t.color) + '">' + esc(t.label) + '</span>' +
          (p ? '<span class="absolute right-3.5 top-3.5 inline-flex h-[30px] items-center rounded-full bg-forest px-3 font-display text-sm font-bold text-white">' + esc(STATUS[p.status] || STATUS.inscrite) + '</span>' : '') +
          '<span class="absolute bottom-3.5 left-3.5 inline-flex h-8 max-w-[calc(100%-1.75rem)] items-center gap-1.5 rounded-full bg-white pl-2.5 pr-3 font-display text-sm font-bold leading-none text-night">' +
            icon('clock', 'h-[17px] w-[17px] shrink-0') + '<span class="sr-only">Durée : </span><span class="truncate">' + esc(missionDuration(m) || 'Variable') + '</span></span>' +
        '</div>' +
        '<h3 class="mt-3.5 text-[1.3125rem] leading-[1.1] tracking-[-0.025em] text-ink group-hover:underline group-hover:decoration-accent group-hover:decoration-2 group-hover:underline-offset-4">' + esc(m.title) + '</h3>' +
        '<div class="mt-2.5 flex items-start gap-2.5">' +
          '<span class="c-gift" aria-hidden="true">' + icon('gift') + '</span>' +
          '<p class="pt-1 font-display text-base font-semibold leading-[1.2] tracking-[-0.01em] text-ink [text-wrap:balance]"><span class="sr-only">En échange : </span>' + esc(m.reward.title) + '</p>' +
        '</div>' +
      '</a></li>';
  }

  /**
   * À la place de la liste des missions : bientôt disponible, chargement,
   * erreur ou aucune mission. Renvoie '' quand il y a des missions à montrer.
   * @param {boolean} compact  version courte (hero mobile)
   */
  function missionsState(state, compact) {
    const BOX = 'bg-sunk ' + (compact ? 'p-5' : 'p-6 sm:p-8');
    const TITLE = 'flex items-center gap-3 font-display font-bold leading-tight tracking-[-0.02em] text-ink ' + (compact ? 'text-2xl' : 'text-[1.75rem]');
    const TEXT = 'mt-1.5 text-lg leading-snug text-ink';
    if (!state.configured) {
      return '<div class="' + BOX + '"><p class="' + TITLE + '">Bientôt disponible</p>' +
        '<p class="' + TEXT + '">Les premières missions arrivent très bientôt.</p></div>';
    }
    if (state.missions.length) return '';
    if (!state.known && (state.status === 'loading' || state.status === 'idle')) {
      return '<div class="' + BOX + '" role="status"><p class="' + TITLE + '">' + spinner() + 'Chargement des missions…</p></div>';
    }
    if (!state.known) {
      return '<div class="' + BOX + '"><p class="' + TITLE + '">Missions indisponibles</p>' +
        '<p class="' + TEXT + '">' + esc(state.error || 'Vérifiez votre connexion.') + '</p>' +
        '<button type="button" class="btn mt-4 bg-ink text-surface hover:bg-ink/85" data-action="retry">Réessayer</button></div>';
    }
    return '<div class="' + BOX + '"><p class="' + TITLE + '">Aucune mission pour le moment</p>' +
      '<p class="' + TEXT + '">Revenez bientôt : de nouvelles missions arrivent.</p></div>';
  }

  function render(state) {
    // Les 3 missions mises en avant : celles de la saison en cours d'abord.
    const season = currentSeason();
    const inSeason = (m) => ((m.seasons || []).includes(season) ? 0 : 1);
    const picks = (state.configured ? state.missions : [])
      .map((m, i) => ({ m, i }))
      .sort((a, b) => inSeason(a.m) - inSeason(b.m) || a.i - b.i)
      .slice(0, 3)
      .map((x) => x.m);
    const more = state.missions.length > picks.length;
    const empty = missionsState(state, false);
    const emptyCompact = missionsState(state, true);

    return (
      // ---- Hero : une seule section, deux mises en page -------------------------------------
      // · Téléphone (< md), concept « Cartes » : le lieu, le titre, puis « Missions du moment »
      //   (+ « Tout voir ») en grandes cartes photo qui défilent de côté, avec des points.
      // · Tablette / ordinateur (≥ md) « Vidéo plein écran » (inspiration Campus) : une vidéo de
      //   nature en fond, bord à bord, assombrie ; au centre, le lieu, le titre en capitales
      //   blanches et les deux boutons. Tant qu'aucune vidéo n'est fournie (Meleze.media.heroVideo),
      //   la photo HD s'affiche avec un lent zoom (« Ken Burns »).
      // Un seul <h1 id="page-title"> : seule sa mise en forme change selon la largeur.
      '<section class="c-hero ' + WRAP + ' pb-14 pt-4 sm:pt-6 md:max-w-none md:px-0 md:pb-4 md:pt-0 lg:pb-12">' +
        '<div class="md:relative md:isolate md:flex md:h-[calc(100svh-4rem)] md:max-h-[62rem] md:min-h-[34rem] md:flex-col md:items-center md:justify-center md:overflow-hidden md:pb-10 md:text-center lg:pb-12">' +
          // Fond (≥ md) : photo HD (chargement différé → jamais téléchargée sur mobile, où ce
          // bloc est masqué) + vidéo éventuelle par-dessus + voile léger pour la lisibilité.
          '<div class="absolute inset-0 -z-10 hidden overflow-hidden bg-night md:block">' +
            '<div class="hero-kenburns absolute inset-0 [&>img]:absolute [&>img]:inset-0 [&>img]:h-full [&>img]:w-full [&>img]:object-cover">' +
              heroBackdrop() +
            '</div>' +
            // Voile en plus pour la photo seule (avant la vidéo, ou « moins d'animations ») :
            // la vidéo, opaque, le recouvre dès qu'elle tourne.
            '<div class="pointer-events-none absolute inset-0 bg-[image:linear-gradient(to_bottom,rgb(0_0_0/0.35),rgb(0_0_0/0.35)_45%,rgb(0_0_0/0.45))]" aria-hidden="true"></div>' +
            heroVideo() +
            // Voile commun, léger : 20 % partout + un halo sombre centré derrière le texte, pour
            // que la vidéo reste lumineuse (titre ≥ 3:1 mesuré sur toute la vidéo, ombre en plus).
            '<div class="pointer-events-none absolute inset-0 bg-black/20 bg-[image:radial-gradient(70%_40%_at_50%_46%,rgb(0_0_0/0.35),transparent)]" aria-hidden="true"></div>' +
          '</div>' +
          // Mobile : le lieu, avec un trait vert (sur ordinateur, il est au-dessus du titre)
          '<p class="flex items-center gap-2.5 font-display text-[0.9375rem] font-bold leading-tight tracking-[-0.005em] text-ink md:hidden">' +
            '<span class="h-[3px] w-[26px] shrink-0 bg-accent" aria-hidden="true"></span>Pralognan-la-Vanoise</p>' +
          // Centre (≥ md) : le lieu, le titre et les boutons, avec une ombre douce sous le texte.
          '<div class="mt-2.5 md:mt-0 md:flex md:flex-col md:items-center md:px-8">' +
            '<p class="hidden font-display text-sm font-bold uppercase tracking-[0.28em] text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.5),0_0_20px_rgb(0_0_0/0.45)] md:block lg:text-base">Pralognan-la-Vanoise · Savoie</p>' +
            '<h1 id="page-title" tabindex="-1" class="c-hero-title max-w-[17ch] text-[length:clamp(1.75rem,7.7vw,1.9rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-[2.25rem] md:mt-6 md:max-w-none md:text-[3.25rem] md:uppercase md:leading-[0.95] md:tracking-[-0.03em] md:text-white md:[text-shadow:0_2px_4px_rgb(0_0_0/0.25),0_2px_30px_rgb(0_0_0/0.4)] lg:text-[4.25rem] xl:text-[5rem]">Une heure pour la montagne,<br class="hidden md:block"> une expérience en retour.</h1>' +
            '<div class="hidden gap-4 md:mt-10 md:flex md:flex-wrap md:items-center md:justify-center">' +
              '<a href="#/missions" class="btn-primary">Voir les missions ' + icon('arrow', 'h-5 w-5') + '</a>' +
              '<a href="#/wallet" class="btn border-2 border-white text-white hover:bg-white hover:text-night">Mon espace</a>' +
            '</div>' +
          '</div>' +
          // Mobile : « Missions du moment » en grandes cartes qui défilent à l'horizontale
          // (dans leur propre conteneur : la page ne défile jamais de côté), points de position.
          '<div class="mt-[22px] flex items-center justify-between gap-4 md:hidden">' +
            '<h2 class="text-[1.25rem] leading-tight tracking-[-0.02em]">Missions du moment</h2>' +
            (picks.length ? '<a href="#/missions" class="-mr-0.5 inline-flex min-h-[44px] shrink-0 items-center gap-1.5 pl-3.5 pr-0.5 font-display text-base font-bold text-ink">Tout voir<span class="sr-only"> les missions</span>' + icon('arrow', 'h-[18px] w-[18px]') + '</a>' : '') +
          '</div>' +
          (picks.length
            ? '<ul class="c-rail relative -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pt-1.5 md:hidden" data-rail>' + picks.map(railCard).join('') + '</ul>' +
              (picks.length > 1 ? '<div class="mt-[18px] flex gap-1.5 md:hidden" aria-hidden="true">' + picks.map((m, i) => '<span class="c-dot' + (i === 0 ? ' is-on' : '') + '" data-dot></span>').join('') + '</div>' : '')
            : '<div class="mt-1.5 md:hidden">' + emptyCompact + '</div>') +
          // Bas (≥ md, comme Campus) : le début de la suite, un pan blanc aux coins arrondis
          // (même arrondi que les photos) qui recouvre le bas de la vidéo et invite à défiler.
          '<div class="absolute inset-x-0 bottom-0 hidden h-10 rounded-t-3xl bg-surface md:block lg:h-12 lg:rounded-t-4xl" aria-hidden="true"></div>' +
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
          (picks.length ? '<a href="#/missions" class="link text-lg">' + (more ? 'Voir les ' + state.missions.length + ' missions' : 'Toutes les missions') + ' ' + icon('arrow', 'h-5 w-5') + '</a>' : '') +
        '</div>' +
        (picks.length
          ? '<ul class="-mx-5 mt-8 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 md:mt-10 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">' +
              picks.map(missionCard).join('') +
            '</ul>'
          : '<div class="mt-8 md:mt-10">' + empty + '</div>') +
      '</section>' +

      // ---- Contreparties : bandeau vert plein, tuiles blanches carrées (s'il y a des missions) ----
      (picks.length
        ? '<section class="bg-forest py-14 text-white lg:py-24" aria-labelledby="gifts">' +
            '<div class="' + WRAP + '">' +
              '<h2 id="gifts" class="max-w-3xl ' + H2 + '">Ce que les partenaires vous offrent</h2>' +
              '<ul class="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4 md:mt-10">' + picks.map(rewardTile).join('') + '</ul>' +
            '</div>' +
          '</section>'
        : '') +

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

      // ---- Questions : tuiles grises pleines -------------------------------------------
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

  /** Fond fixe derrière la vidéo : l'image tirée de la vidéo s'il y en a une (transition
   *  sans saut), sinon la photo HD. Chargement différé : rien n'est téléchargé sur mobile. */
  function heroBackdrop() {
    const v = Meleze.media && Meleze.media.heroVideo;
    if (v && v.poster) return '<img src="' + esc(v.poster) + '" alt="" loading="lazy" decoding="async">';
    return photo('range', { sizes: '100vw', alt: '' });
  }

  // ---- Vidéo de fond (≥ md) ------------------------------------------------------------------
  // Le <video> est écrit SANS source : mounted() ne branche les sources que si l'écran est
  // assez large, si le visiteur n'a demandé ni « moins d'animations » ni « économie de
  // données ». Aucune vidéo n'est donc jamais téléchargée sur mobile.
  function heroVideo() {
    const v = Meleze.media && Meleze.media.heroVideo;
    if (!v) return '';
    // Pas d'attribut poster : il serait téléchargé même sur mobile ; l'image fixe est déjà
    // affichée derrière (heroBackdrop, en chargement différé).
    return '<video class="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700" data-hero-video muted loop playsinline preload="none" aria-hidden="true"></video>';
  }

  // ---- Cartes du téléphone : points de position, défilement conservé ----------------------
  let railLeft = 0; // position du défilement (rétablie après un nouveau rendu)
  function mountRail(root) {
    const rail = root.querySelector('[data-rail]');
    if (!rail) return;
    const dots = root.querySelectorAll('[data-dot]');
    if (railLeft) rail.scrollLeft = railLeft;
    let frame = 0;
    const update = () => {
      frame = 0;
      railLeft = rail.scrollLeft;
      const items = rail.children;
      if (!dots.length || !items.length) return;
      const step = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : 1;
      const end = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 2;
      const i = end ? items.length - 1 : Math.min(items.length - 1, Math.round(rail.scrollLeft / step));
      dots.forEach((d, k) => d.classList.toggle('is-on', k === i));
    };
    rail.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  let heroObserver = null;
  function mounted(root) {
    mountRail(root);
    const video = root.querySelector('[data-hero-video]');
    const v = Meleze.media && Meleze.media.heroVideo;
    if (!video || !v) return;
    const wide = window.matchMedia('(min-width: 768px)').matches;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    if (!wide || calm || saveData) return; // la photo HD reste affichée
    [['video/webm', v.webm], ['video/mp4', v.mp4]].forEach(([type, src]) => {
      if (!src) return;
      const s = document.createElement('source');
      s.type = type; s.src = src; video.appendChild(s);
    });
    // La vidéo n'apparaît qu'une fois la lecture lancée : si le navigateur ne sait pas lire
    // le fichier (ex. MP4 en HEVC), la photo HD reste affichée.
    video.addEventListener('playing', () => video.classList.remove('opacity-0'), { once: true });
    video.load();
    // Économie : la vidéo ne tourne que lorsqu'elle est visible à l'écran.
    if ('IntersectionObserver' in window) {
      heroObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) video.play().catch(() => {}); else video.pause(); });
      }, { threshold: 0.15 });
      heroObserver.observe(video);
    } else {
      video.play().catch(() => {});
    }
  }
  function unmount() {
    if (heroObserver) { heroObserver.disconnect(); heroObserver = null; }
    railLeft = 0;
  }

  const actions = {
    retry() { Meleze.store.refresh(); },
  };

  return { title: 'Accueil', render, actions, mounted, unmount };
})();
