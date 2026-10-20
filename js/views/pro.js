/* ==========================================================================
   Vue : Espace partenaires (#/pro)
   - Connexion par e-mail : un code à 6 chiffres arrive par e-mail, on le
     saisit, c'est tout (aucun mot de passe). Seuls les comptes inscrits
     par l'équipe Mélèze (table partners) accèdent aux outils.
   - « Mes missions »        (#/pro)       : missions publiées, retirées
                                            comprises ; « Retirer » les ôte
                                            du catalogue.
   - « Créer une mission »   (#/pro/creer) : mission + contrepartie + photo
                                            attendue, publiée aussitôt.
   Toute autre adresse (#/pro/…) revient sur « Mes missions ».
   Mise en page : peu de texte, des APLATS pleins (gris clair = formulaires
   et fiches, vert = contrepartie et succès, noir = onglet actif).
   ========================================================================== */
window.Meleze = window.Meleze || {};
Meleze.views = Meleze.views || {};

Meleze.views.pro = (function () {
  'use strict';
  const { esc, icon, duration, missionDuration, typeOf, toast, spinner, notice, soon } = Meleze.ui;
  const api = Meleze.api;
  const store = Meleze.store;
  const { SEASONS, TYPES, CATEGORIES, DURATIONS, LIMITS } = Meleze.data;

  // Conteneur commun : même rythme vertical que les autres pages
  const WRAP = 'mx-auto px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16';
  const LEGEND = 'float-left mb-2 w-full font-display text-3xl font-bold leading-tight tracking-[-0.03em]';
  /** Gros bouton d'action principal (recevoir le code, publier…). */
  const BIG = 'min-h-[64px] w-full text-xl';
  /** Bouton contour blanc, sur les aplats verts. */
  const BTN_WHITE = 'btn border-2 border-white bg-transparent text-white hover:bg-white hover:text-night focus-visible:outline-white';
  /** Champ blanc dans un aplat vert (lisible dans les deux thèmes). */
  const FIELD_ON_GREEN = 'field bg-white text-night [color-scheme:light] placeholder:text-night/60 focus:border-night focus:bg-white';

  /**
   * État de l'écran.
   * phase : 'init' (lecture de la session) | 'email' | 'code' | 'checking'
   *         | 'notPartner' | 'ready' | 'error'
   */
  const S = {
    phase: 'init',
    email: '',
    code: '',
    sending: false,
    verifying: false,
    loginError: null,
    error: null,
    profile: null, // { email, org }
    missions: null, // missions du partenaire (null = pas encore chargées)
    missionsError: null,
    loadingMissions: false,
    retiring: null, // id de la mission en cours de retrait
    draft: {}, // saisie du formulaire de création (survit aux nouveaux rendus)
    formErrors: {},
    submitting: false,
    created: null, // dernière mission publiée (écran de confirmation)
  };
  let starting = false;
  let focusAfter = null;

  const TABS = { '': 'missions', creer: 'creer' };
  const tabOf = (sub) => TABS[sub] || 'missions';

  // ------------------------------------------------------------------------
  // Utilitaires
  // ------------------------------------------------------------------------
  /** Petit trait vert + libellé : en-tête des pages pro. */
  const kicker = (text, size) =>
    '<p class="flex min-w-0 items-center gap-2.5 font-display ' + (size || 'text-base') + ' font-bold leading-tight text-ink">' +
      '<span class="h-[3px] w-6 shrink-0 bg-accent" aria-hidden="true"></span><span class="min-w-0 break-words">' + text + '</span></p>';

  /** Champ de formulaire avec message d'erreur éventuel (relié par aria-describedby). */
  function field(id, label, control, opts) {
    const o = opts || {};
    const err = S.formErrors[o.key || id];
    const errHtml = err
      ? '<p id="' + id + '-err" class="' + (o.onGreen ? 'mt-2 inline-block bg-night px-3 py-1.5 font-semibold text-white' : 'mt-1.5 font-semibold text-danger') + '">' + esc(err) + '</p>'
      : '';
    return '<div><label class="label text-lg' + (o.labelCls ? ' ' + o.labelCls : '') + '" for="' + id + '">' + label + '</label>' +
      control + (o.hint ? '<p class="hint' + (o.onGreen ? ' text-white' : '') + '" id="' + id + '-hint">' + o.hint + '</p>' : '') + errHtml + '</div>';
  }
  /** Attributs ARIA d'un champ (erreur, aide). */
  function aria(id, key, hint) {
    const err = S.formErrors[key || id];
    const ids = [hint ? id + '-hint' : '', err ? id + '-err' : ''].filter(Boolean).join(' ');
    return (err ? ' aria-invalid="true"' : '') + (ids ? ' aria-describedby="' + ids + '"' : '');
  }
  const draft = (k, fallback) => (S.draft[k] != null ? S.draft[k] : fallback);

  // ------------------------------------------------------------------------
  // Chargements
  // ------------------------------------------------------------------------
  function rerender(app) { if (app) app.rerender(); }

  /** Session déjà ouverte sur ce navigateur ? */
  function start(app) {
    if (starting) return;
    starting = true;
    api.partnerSession().then((session) => {
      if (session) { S.email = session.email; return checkProfile(app); }
      S.phase = 'email';
      rerender(app);
    }, (err) => {
      // Session enregistrée mais impossible à renouveler (réseau…) : on ne la
      // traite pas comme une déconnexion ; « Réessayer » relance la lecture.
      S.phase = 'error';
      S.error = (err && err.message) || api.MESSAGES.generic;
      rerender(app);
    })
      .then(() => { starting = false; });
  }

  /** Compte connecté → fiche partenaire (ou « pas encore partenaire »). */
  function checkProfile(app) {
    S.phase = 'checking';
    S.error = null;
    rerender(app);
    return api.partnerProfile().then((profile) => {
      if (!profile) { S.phase = 'notPartner'; S.profile = null; }
      else { S.profile = profile; S.phase = 'ready'; loadMissions(app); }
    }, (err) => {
      S.phase = 'error';
      S.error = (err && err.message) || api.MESSAGES.generic;
    }).then(() => { focusAfter = '#page-title'; rerender(app); });
  }

  function loadMissions(app) {
    if (S.loadingMissions) return;
    S.loadingMissions = true;
    S.missionsError = null;
    rerender(app);
    api.myMissions().then((list) => { S.missions = list; }, (err) => {
      S.missionsError = (err && err.message) || api.MESSAGES.generic;
    }).then(() => { S.loadingMissions = false; rerender(app); });
  }

  function reset() {
    Object.assign(S, {
      phase: 'email', code: '', sending: false, verifying: false, loginError: null, error: null,
      profile: null, missions: null, missionsError: null, loadingMissions: false, retiring: null,
      draft: {}, formErrors: {}, submitting: false, created: null,
    });
  }

  // ------------------------------------------------------------------------
  // Connexion
  // ------------------------------------------------------------------------
  /** Titre des écrans de connexion ; le petit libellé « Espace partenaires » sauf s'il répète le titre. */
  function loginHead(title, noKicker) {
    return (noKicker ? '' : kicker('Espace partenaires')) +
      '<h1 id="page-title" tabindex="-1" class="c-h1 ' + (noKicker ? '' : 'mt-6 ') + 'text-5xl font-extrabold sm:text-6xl">' + title + '</h1>';
  }

  function loginError() {
    return S.loginError
      ? '<p id="login-err" class="bg-danger px-4 py-3 font-semibold leading-snug text-surface" role="alert">' + esc(S.loginError) + '</p>'
      : '';
  }

  function renderEmail() {
    return '<div class="' + WRAP + ' max-w-md">' +
      loginHead('Connexion <span class="mark">partenaire</span>') +
      '<p class="mt-4 text-lg text-ink">Recevez un code de connexion par e-mail. Aucun mot de passe.</p>' +
      '<form class="mt-8 space-y-5" data-form="send-code" novalidate>' +
        '<div><label class="label text-lg" for="email">E-mail professionnel</label>' +
          '<input class="field" id="email" name="email" type="email" inputmode="email" autocomplete="email" required maxlength="254" data-keep="email" value="' + esc(S.email) + '"' +
          (S.loginError ? ' aria-invalid="true" aria-describedby="login-err"' : '') + '></div>' +
        loginError() +
        '<button class="btn-primary ' + BIG + '"' + (S.sending ? ' disabled aria-busy="true"' : '') + '>' +
          (S.sending ? spinner('h-5 w-5') + 'Envoi…' : 'Recevoir un code') + '</button>' +
      '</form>' +
      '<a href="#/" class="link mt-8">Retour au site</a>' +
    '</div>';
  }

  function renderCode() {
    return '<div class="' + WRAP + ' max-w-md">' +
      loginHead('Votre <span class="mark">code</span>') +
      '<p class="mt-6 bg-sunk px-5 py-4 text-lg leading-snug text-ink" role="status">Code envoyé à <span class="break-words font-bold">' + esc(S.email) + '</span>. Pensez aux courriers indésirables.</p>' +
      '<form class="mt-6 space-y-5" data-form="verify-code" novalidate>' +
        '<div><label class="label text-lg" for="code">Code reçu par e-mail</label>' +
          '<input class="field font-mono text-2xl tracking-[0.3em]" id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required data-keep="code" value="' + esc(S.code) + '" aria-describedby="code-hint' + (S.loginError ? ' login-err' : '') + '"' + (S.loginError ? ' aria-invalid="true"' : '') + '>' +
          '<p class="hint" id="code-hint">6 chiffres</p></div>' +
        loginError() +
        '<button class="btn-primary ' + BIG + '"' + (S.verifying ? ' disabled aria-busy="true"' : '') + '>' +
          (S.verifying ? spinner('h-5 w-5') + 'Vérification…' : 'Se connecter') + '</button>' +
      '</form>' +
      '<div class="mt-6 flex flex-wrap gap-x-6 gap-y-2">' +
        '<button type="button" class="link min-h-[44px]" data-action="resend"' + (S.sending ? ' disabled' : '') + '>Renvoyer le code</button>' +
        '<button type="button" class="link min-h-[44px]" data-action="change-email">Changer d’adresse</button>' +
      '</div>' +
    '</div>';
  }

  function renderNotPartner() {
    return '<div class="' + WRAP + ' max-w-xl">' +
      loginHead('Compte non <span class="mark">partenaire</span>') +
      '<div class="mt-8 bg-sunk p-6 sm:p-8">' +
        '<p class="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-ink">' + esc(api.MESSAGES.notPartner) + '</p>' +
        '<p class="mt-3 text-lg leading-snug text-ink">Connecté·e avec <span class="break-words font-bold">' + esc(S.email) + '</span>. ' +
          'Pour devenir partenaire, écrivez à l’équipe Mélèze (adresse dans les <a class="underline decoration-accent decoration-2 underline-offset-4 hover:text-brand-ink" href="#/mentions-legales">mentions légales</a>).</p>' +
        '<div class="mt-6 flex flex-col gap-3 sm:flex-row">' +
          '<button type="button" class="btn bg-ink text-surface hover:bg-ink/85" data-action="recheck">Réessayer</button>' +
          '<button type="button" class="btn-secondary" data-action="logout">Se déconnecter</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderError() {
    return '<div class="' + WRAP + ' max-w-xl">' +
      loginHead('Espace <span class="mark">partenaires</span>', true) +
      '<div class="mt-8">' + notice({
        title: 'Vérification impossible',
        text: S.error || api.MESSAGES.generic,
        extra: '<div class="mt-6 flex flex-col gap-3 sm:flex-row">' +
          '<button type="button" class="btn bg-ink text-surface hover:bg-ink/85" data-action="recheck">Réessayer</button>' +
          '<button type="button" class="btn-secondary" data-action="logout">Se déconnecter</button></div>',
      }) + '</div>' +
    '</div>';
  }

  // ------------------------------------------------------------------------
  // Espace connecté : onglets
  // ------------------------------------------------------------------------
  function renderShell(tab, inner) {
    const tabLink = (href, id, label, aria) =>
      '<a href="' + href + '"' + (aria ? ' aria-label="' + aria + '"' : '') + ' class="flex min-h-[56px] flex-1 items-center justify-center px-3 py-2 text-center font-display text-[1rem] font-bold leading-tight transition-colors ' +
      (tab === id ? 'bg-ink text-surface' : 'bg-sunk text-ink hover:bg-line') + '"' + (tab === id ? ' aria-current="page"' : '') + '>' + label + '</a>';

    return '<div class="' + WRAP + ' max-w-2xl">' +
      '<div class="flex items-center justify-between gap-3">' +
        kicker(esc(S.profile.email), 'text-[0.95rem]') +
        '<button type="button" class="link min-h-[44px] shrink-0 text-[0.95rem]" data-action="logout">Se déconnecter</button>' +
      '</div>' +
      '<h1 id="page-title" tabindex="-1" class="c-h1 mt-4 break-words text-[2.5rem] font-extrabold sm:text-5xl">' + esc(S.profile.org) + '</h1>' +
      '<nav class="mt-8 flex gap-1" aria-label="Outils partenaires">' +
        tabLink('#/pro', 'missions', 'Mes missions') +
        tabLink('#/pro/creer', 'creer', 'Créer<span class="hidden min-[400px]:inline">&nbsp;une mission</span>', 'Créer une mission') +
      '</nav>' +
      '<div class="mt-8">' + inner + '</div>' +
    '</div>';
  }

  /** Une mission du partenaire : statut, contrepartie, photo attendue, « Retirer ». */
  function missionItem(m) {
    const t = typeOf(m.type);
    const meta = [missionDuration(m), m.location].filter(Boolean).map(esc).join(' · ');
    const retiring = S.retiring === m.id;
    return '<li class="bg-sunk p-5 sm:p-6">' +
      '<div class="flex flex-wrap items-center gap-2">' +
        '<span class="tag tag-sign ' + esc(t.color) + '">' + esc(t.label) + '</span>' +
        (m.active ? '<span class="tag bg-forest text-white">En ligne</span>' : '<span class="tag bg-surface text-ink">Retirée</span>') +
      '</div>' +
      '<h3 class="mt-3 break-words text-2xl sm:text-[1.75rem]' + (m.active ? '' : ' text-muted') + '">' + esc(m.title) + '</h3>' +
      (meta ? '<p class="mt-1 text-lg text-ink">' + meta + '</p>' : '') +
      '<p class="mt-3 text-lg leading-snug text-ink"><span class="text-muted">En échange :</span> <span class="font-bold">' + esc(m.reward.title) + '</span></p>' +
      '<p class="mt-1 text-lg leading-snug text-ink"><span class="text-muted">Photo attendue :</span> ' + esc(m.photoHint) + '</p>' +
      (m.active
        ? '<div class="mt-5 flex flex-wrap gap-3">' +
            '<a href="#/missions?focus=' + esc(m.id) + '" class="btn-secondary btn-sm">Voir dans le catalogue</a>' +
            '<button type="button" class="btn btn-sm bg-ink text-surface hover:bg-ink/85" data-action="retire" data-id="' + esc(m.id) + '"' +
              (S.retiring ? ' disabled' : '') + (retiring ? ' aria-busy="true"' : '') + '>' + (retiring ? spinner('h-4 w-4') + 'Retrait…' : 'Retirer') + '</button>' +
          '</div>'
        : '') +
    '</li>';
  }

  function renderMissions() {
    let body;
    if (S.missions == null && S.loadingMissions) body = notice({ title: 'Chargement…', busy: true });
    else if (S.missions == null && S.missionsError) {
      body = notice({
        title: 'Missions indisponibles',
        text: S.missionsError,
        extra: '<button type="button" class="btn mt-6 bg-ink text-surface hover:bg-ink/85" data-action="reload">Réessayer</button>',
      });
    } else if (!S.missions || !S.missions.length) {
      body = notice({
        title: 'Aucune mission publiée',
        extra: '<a href="#/pro/creer" class="btn-primary mt-6">Créer une mission ' + icon('arrow', 'h-5 w-5') + '</a>',
      });
    } else {
      body = '<ul class="space-y-3">' + S.missions.map(missionItem).join('') + '</ul>';
    }
    return '<section aria-labelledby="mine-h">' +
      '<h2 id="mine-h" class="sr-only">Mes missions</h2>' +
      '<div aria-live="polite">' + body + '</div>' +
    '</section>';
  }

  // ------------------------------------------------------------------------
  // Création de mission
  // ------------------------------------------------------------------------
  function renderCreate() {
    if (S.created) {
      // Bloc vert plein : boutons blancs explicites (lisibles aussi en mode sombre)
      return '<div id="created" tabindex="-1" class="bg-forest p-6 text-white outline-none sm:p-8">' +
        '<p class="font-display text-lg font-bold">Mission publiée</p>' +
        '<h2 class="mt-2 break-words text-3xl text-white sm:text-4xl">« ' + esc(S.created.title) + ' »</h2>' +
        '<p class="mt-3 text-lg text-white">Visible dans le catalogue. Les participants la valident avec une photo, vérifiée par une IA.</p>' +
        '<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">' +
          '<a href="#/missions?focus=' + esc(S.created.id) + '" class="btn btn-light focus-visible:outline-white">Voir dans le catalogue' + icon('arrow', 'h-5 w-5') + '</a>' +
          '<button type="button" class="' + BTN_WHITE + '" data-action="new-mission">Créer une autre mission</button>' +
        '</div>' +
      '</div>';
    }

    // Choix en aplats gris ; le choix coché passe en noir plein
    const OPTION = 'flex min-h-[56px] cursor-pointer gap-3 bg-sunk px-4 py-3.5 transition-colors has-[:checked]:bg-ink has-[:checked]:text-surface';
    const CHECK = 'h-5 w-5 shrink-0 accent-forest focus-visible:outline-brand';
    const seasons = draft('seasons', []);
    const dur = String(draft('duration', '90'));
    const type = draft('type', TYPES[0].id);
    const cat = draft('rcat', CATEGORIES[0]);
    const err = S.formErrors;

    return '<form class="space-y-10" data-form="create" novalidate>' +
      '<fieldset class="space-y-5">' +
        '<legend class="' + LEGEND + '">La mission</legend>' +
        field('title', 'Intitulé', '<input class="field" id="title" name="title" required minlength="' + LIMITS.title.min + '" maxlength="' + LIMITS.title.max + '" placeholder="Ex. Nettoyer les berges du Doron" value="' + esc(draft('title', '')) + '"' + aria('title') + '>') +
        field('type', 'Type', '<select class="field" id="type" name="type" required' + aria('type') + '>' +
          TYPES.map((t) => '<option value="' + esc(t.id) + '"' + (t.id === type ? ' selected' : '') + '>' + esc(t.label) + '</option>').join('') + '</select>') +
        '<div><p class="label text-lg" id="seasons-l">Saison(s)</p><div class="grid grid-cols-2 gap-2" role="group" aria-labelledby="seasons-l"' + (err.seasons ? ' aria-describedby="seasons-err"' : '') + '>' +
          SEASONS.map((x) => '<label class="' + OPTION + ' items-center font-display text-lg font-bold">' +
            '<input type="checkbox" name="seasons" value="' + esc(x.id) + '" class="' + CHECK + '"' + (seasons.includes(x.id) ? ' checked' : '') + '>' + esc(x.label) + '</label>').join('') +
        '</div>' + (err.seasons ? '<p id="seasons-err" class="mt-1.5 font-semibold text-danger">' + esc(err.seasons) + '</p>' : '') + '</div>' +
        '<div class="grid grid-cols-2 gap-4">' +
          field('duration', 'Durée', '<select class="field" id="duration" name="duration"' + aria('duration') + '>' +
            DURATIONS.map((d) => '<option value="' + d + '"' + (String(d) === dur ? ' selected' : '') + '>' + duration(d) + '</option>').join('') +
            '<option value="0"' + (dur === '0' ? ' selected' : '') + '>Variable</option>' +
          '</select>') +
          field('spots', 'Places', '<input class="field" id="spots" name="spots" type="number" min="' + LIMITS.spots.min + '" max="' + LIMITS.spots.max + '" inputmode="numeric" value="' + esc(draft('spots', '10')) + '"' + aria('spots', 'spots', true) + '>', { hint: 'Vide : sans limite' }) +
        '</div>' +
        field('location', 'Lieu de rendez-vous', '<input class="field" id="location" name="location" required maxlength="' + LIMITS.location.max + '" placeholder="Ex. Pont de la Pêche" value="' + esc(draft('location', '')) + '"' + aria('location') + '>') +
        field('schedule', 'Quand ?', '<input class="field" id="schedule" name="schedule" maxlength="' + LIMITS.schedule.max + '" placeholder="Ex. Samedi, 9h30" value="' + esc(draft('schedule', '')) + '"' + aria('schedule') + '>') +
        field('description', 'Description', '<textarea class="field min-h-[7rem]" id="description" name="description" required maxlength="' + LIMITS.description.max + '" placeholder="Ce que les participants vont faire…"' + aria('description') + '>' + esc(draft('description', '')) + '</textarea>') +
      '</fieldset>' +

      // Photo attendue : c'est elle que l'IA compare à la photo du participant
      '<fieldset class="space-y-5">' +
        '<legend class="' + LEGEND + ' flex flex-wrap items-center gap-3">La photo attendue <span class="tag bg-ink text-surface">Obligatoire</span></legend>' +
        field('photoHint', 'Ce que la photo doit montrer',
          '<textarea class="field min-h-[6rem]" id="photoHint" name="photoHint" required minlength="' + LIMITS.photoHint.min + '" maxlength="' + LIMITS.photoHint.max + '" ' +
          'placeholder="Ex. Les déchets que vous avez ramassés sur le sentier."' + aria('photoHint', 'photoHint', true) + '>' + esc(draft('photoHint', '')) + '</textarea>',
          { hint: 'Une IA compare la photo du participant à cette phrase. Décrivez ce qu’on doit voir.' }) +
      '</fieldset>' +

      // Contrepartie : aplat vert plein, champs blancs, obligatoire
      '<fieldset class="space-y-5 bg-forest p-5 text-white sm:p-7">' +
        '<legend class="' + LEGEND + ' flex flex-wrap items-center gap-3 text-white">La contrepartie <span class="tag bg-white">Obligatoire</span></legend>' +
        field('rtitle', 'Ce que vous offrez', '<input class="' + FIELD_ON_GREEN + '" id="rtitle" name="rtitle" required maxlength="' + LIMITS.rewardTitle.max + '" placeholder="Ex. Une descente en luge" value="' + esc(draft('rtitle', '')) + '"' + aria('rtitle', 'rewardTitle') + '>', { key: 'rewardTitle', labelCls: 'text-white', onGreen: true }) +
        field('rpartner', 'Offert par', '<input class="' + FIELD_ON_GREEN + '" id="rpartner" name="rpartner" required maxlength="' + LIMITS.rewardPartner.max + '" value="' + esc(draft('rpartner', S.profile.org)) + '"' + aria('rpartner', 'rewardPartner') + '>', { key: 'rewardPartner', labelCls: 'text-white', onGreen: true }) +
        field('rcat', 'Catégorie', '<select class="' + FIELD_ON_GREEN + '" id="rcat" name="rcat"' + aria('rcat', 'rewardCategory') + '>' + CATEGORIES.map((c) => '<option' + (c === cat ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>', { key: 'rewardCategory', labelCls: 'text-white', onGreen: true }) +
        '<label class="flex cursor-pointer items-start gap-3 text-lg font-semibold leading-snug text-white">' +
          '<input type="checkbox" name="commit" required class="mt-1 h-5 w-5 shrink-0 accent-night [color-scheme:light] focus-visible:outline-white"' + (draft('commit', false) ? ' checked' : '') + (err.commit ? ' aria-invalid="true" aria-describedby="commit-err"' : '') + '>' +
          'Je m’engage à l’offrir à chaque participant validé.</label>' +
        (err.commit ? '<p id="commit-err" class="inline-block bg-night px-3 py-1.5 font-semibold text-white">' + esc(err.commit) + '</p>' : '') +
      '</fieldset>' +

      '<button class="btn-primary ' + BIG + '"' + (S.submitting ? ' disabled aria-busy="true"' : '') + '>' +
        (S.submitting ? spinner('h-5 w-5') + 'Publication…' : 'Publier la mission') + '</button>' +
    '</form>';
  }

  /** Saisie du formulaire → objet mission (champ « commit » à part). */
  function readForm(form) {
    const f = new FormData(form);
    const t = (k) => String(f.get(k) || '').trim();
    const minutes = Math.max(0, Math.round(Number(f.get('duration')) || 0));
    const type = t('type');
    return {
      draft: {
        title: t('title'), type, seasons: f.getAll('seasons').map(String), duration: String(minutes), spots: t('spots'),
        location: t('location'), schedule: t('schedule'), description: t('description'), photoHint: t('photoHint'),
        rtitle: t('rtitle'), rpartner: t('rpartner'), rcat: t('rcat'), commit: f.get('commit') != null,
      },
      mission: {
        org: S.profile ? S.profile.org : '',
        title: t('title'),
        type,
        seasons: f.getAll('seasons').map(String),
        duration: minutes,
        durationLabel: minutes ? '' : (type === 'mobilite' ? 'Le temps du trajet' : 'Durée variable'),
        spots: t('spots') === '' ? null : Number(t('spots')),
        location: t('location'),
        schedule: t('schedule'),
        description: t('description'),
        photoHint: t('photoHint'),
        reward: { title: t('rtitle'), partner: t('rpartner'), category: t('rcat') },
      },
    };
  }

  // Ordre des champs : le premier en erreur reçoit le focus
  const FIELD_ORDER = [
    ['title', '#title'], ['type', '#type'], ['seasons', '[name="seasons"]'], ['duration', '#duration'], ['spots', '#spots'],
    ['location', '#location'], ['schedule', '#schedule'], ['description', '#description'], ['photoHint', '#photoHint'],
    ['rewardTitle', '#rtitle'], ['rewardPartner', '#rpartner'], ['rewardCategory', '#rcat'], ['commit', '[name="commit"]'],
  ];

  // ------------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------------
  function render(state, params, sub) {
    if (!api.ready()) {
      return '<div class="' + WRAP + ' max-w-xl">' +
        loginHead('Espace <span class="mark">partenaires</span>', true) +
        '<div class="mt-8">' + soon('L’espace partenaires ouvrira très bientôt.') + '</div>' +
      '</div>';
    }
    switch (S.phase) {
      case 'init':
      case 'checking':
        return '<div class="' + WRAP + ' max-w-md">' + loginHead('Espace <span class="mark">partenaires</span>', true) +
          '<div class="mt-8">' + notice({ title: S.phase === 'checking' ? 'Vérification du compte…' : 'Chargement…', busy: true }) + '</div></div>';
      case 'email': return renderEmail();
      case 'code': return renderCode();
      case 'notPartner': return renderNotPartner();
      case 'error': return renderError();
      default: {
        const tab = tabOf(sub);
        return renderShell(tab, tab === 'creer' ? renderCreate() : renderMissions());
      }
    }
  }

  function mounted(root, params, sub, app) {
    // Anciennes adresses de l’espace pro, ou inconnues : retour sur #/pro sans nouvel historique
    if (sub && !TABS[sub]) {
      try { history.replaceState(null, '', '#/pro'); } catch (e) { /* rien */ }
    }
    if (api.ready() && S.phase === 'init') start(app);

    // Saisie conservée si l'écran se redessine (chargement en arrière-plan…)
    root.querySelectorAll('[data-keep]').forEach((input) => {
      input.addEventListener('input', () => { S[input.dataset.keep] = input.value; });
    });
    const form = root.querySelector('form[data-form="create"]');
    if (form) {
      const keep = () => { S.draft = readForm(form).draft; };
      form.addEventListener('input', keep);
      form.addEventListener('change', keep);
    }

    if (focusAfter) {
      const el = root.querySelector(focusAfter);
      focusAfter = null;
      if (el) {
        el.focus({ preventScroll: true });
        const r = el.getBoundingClientRect();
        if (r.top < 64 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' });
      }
    }
  }

  // ------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------
  function sendCode(app, email) {
    if (S.sending) return;
    S.sending = true;
    S.loginError = null;
    rerender(app);
    api.sendCode(email).then((e) => {
      S.email = e;
      S.code = '';
      S.phase = 'code';
      focusAfter = '#code';
      toast('Code envoyé. Vérifiez vos e-mails.');
    }, (err) => {
      S.loginError = (err && err.message) || api.MESSAGES.sendCode;
      focusAfter = S.phase === 'code' ? '#code' : '#email';
    }).then(() => { S.sending = false; rerender(app); });
  }

  const actions = {
    resend(el, app) { sendCode(app, S.email); },
    'change-email'(el, app) {
      S.phase = 'email';
      S.code = '';
      S.loginError = null;
      focusAfter = '#email';
      rerender(app);
    },
    recheck(el, app) {
      if (S.email) { checkProfile(app); return; }
      S.phase = 'init';
      rerender(app);
      start(app);
    },
    reload(el, app) { loadMissions(app); },
    logout(el, app) {
      api.signOut().catch(() => { /* la session locale est effacée quoi qu'il arrive */ }).then(() => {
        const email = S.email;
        reset();
        S.email = email;
        toast('Vous êtes déconnecté·e.');
        app.go('#/pro');
      });
    },
    retire(el, app) {
      const id = el.dataset.id;
      const m = S.missions && S.missions.find((x) => x.id === id);
      if (!m || S.retiring) return;
      if (!confirm('Retirer « ' + m.title + ' » ? Elle disparaîtra du catalogue et les inscrits ne pourront plus la valider.')) return;
      S.retiring = id;
      rerender(app);
      api.retireMission(id).then(() => {
        m.active = false;
        toast('Mission retirée du catalogue.');
        store.refresh(); // le catalogue touriste ne la montre plus
      }, (err) => toast((err && err.message) || api.MESSAGES.retire, 'error'))
        .then(() => { S.retiring = null; loadMissions(app); });
    },
    'new-mission'(el, app) {
      S.created = null;
      S.draft = {};
      S.formErrors = {};
      focusAfter = '#title';
      rerender(app);
    },
  };

  const forms = {
    'send-code'(form, app) {
      const email = String(new FormData(form).get('email') || '').trim();
      S.email = email;
      sendCode(app, email);
    },
    'verify-code'(form, app) {
      if (S.verifying) return;
      const code = String(new FormData(form).get('code') || '').replace(/\s+/g, '');
      S.code = code;
      S.verifying = true;
      S.loginError = null;
      rerender(app);
      api.verifyCode(S.email, code).then((session) => {
        S.email = session.email;
        S.verifying = false;
        S.code = '';
        return checkProfile(app);
      }, (err) => {
        S.verifying = false;
        S.loginError = (err && err.message) || api.MESSAGES.badCode;
        focusAfter = '#code';
        rerender(app);
      });
    },
    create(form, app) {
      if (S.submitting) return;
      const { draft: d, mission } = readForm(form);
      S.draft = d;
      const errors = api.validateMission(mission);
      if (!d.commit) errors.commit = 'Cochez l’engagement pour publier.';
      S.formErrors = errors;
      const first = FIELD_ORDER.find(([k]) => errors[k]);
      if (first) {
        focusAfter = first[1];
        toast('Vérifiez le formulaire : ' + errors[first[0]], 'error');
        rerender(app);
        return;
      }
      S.submitting = true;
      rerender(app);
      api.createMission(mission).then((created) => {
        S.created = created;
        S.draft = {};
        S.formErrors = {};
        S.missions = null;
        toast('Mission publiée dans le catalogue.');
        focusAfter = '#created';
        loadMissions(app);
        store.refresh(); // le catalogue touriste la montre aussitôt
      }, (err) => {
        if (err && err.fields) S.formErrors = err.fields;
        toast((err && err.message) || api.MESSAGES.generic, 'error');
      }).then(() => { S.submitting = false; rerender(app); });
    },
  };

  return { title: 'Espace partenaires', render, actions, forms, mounted };
})();
