/* ==========================================================================
   Mélèze — accès au serveur (Supabase) : le SEUL fichier qui lui parle.
   Bibliothèque : js/vendor/supabase.min.js (supabase-js v2, window.supabase).

   Deux clients séparés, chacun avec sa propre clé de session dans le
   navigateur, pour qu'une connexion partenaire n'efface jamais la session
   d'un touriste sur le même appareil :
   - « meleze-tourist » : compte ANONYME, créé seulement quand le touriste
     s'inscrit à sa première mission (jamais pour une simple visite). Le
     touriste peut ensuite y ajouter son e-mail (code à 6 chiffres) : le même
     compte devient permanent et ses bons se retrouvent sur un autre
     téléphone (« Retrouver mes bons ») ;
   - « meleze-partner » : connexion par code reçu par e-mail.

   Toutes les fonctions renvoient des promesses. En cas d'échec, elles
   rejettent une ApiError dont `message` est une phrase française prête à
   afficher (vouvoiement) et `code` un identifiant court pour le code appelant.
   Les objets renvoyés ont la forme utilisée par les vues (camelCase) :
     mission       { id, title, type, seasons, duration, durationLabel, location,
                     schedule, spots, host, description, photoHint,
                     reward: { title, partner, category }, photo, active, createdAt }
     participation { id, missionId, status ('inscrite'|'validee'), attempts,
                     lastCheck, createdAt, validatedAt }
     voucher       { id, code, missionId, participationId, title, partner,
                     category, createdAt, usedAt }
     verdict       { valid, confidence, reason, voucher|null, attemptsLeft|null }
   ========================================================================== */
window.Meleze = window.Meleze || {};

Meleze.api = (function () {
  'use strict';

  const STORAGE_KEYS = { tourist: 'meleze-tourist', partner: 'meleze-partner' };
  const FUNCTION = 'verify-photo';
  /** Délai max d'une requête ordinaire, et de la vérification photo (IA). */
  const REQUEST_TIMEOUT = 20000;
  const VERIFY_TIMEOUT = 60000;
  /** Taille max de la photo encodée (le serveur refuse un corps > 2,5 Mo). */
  const MAX_IMAGE_B64 = 2400000;

  // Colonnes lues : jamais `created_by` (identifiant du compte partenaire) côté public.
  const MISSION_COLUMNS = 'id,org,title,type,seasons,duration_min,duration_label,location,schedule,spots,' +
    'description,photo_hint,reward_title,reward_partner,reward_category,photo,active,created_at';
  const PARTICIPATION_COLUMNS = 'id,mission_id,status,attempts,last_check,created_at,validated_at';
  const VOUCHER_COLUMNS = 'id,participation_id,mission_id,code,reward_title,reward_partner,reward_category,created_at,used_at';

  const MESSAGES = {
    unconfigured: 'Bientôt disponible.',
    offline: 'Connexion nécessaire : vérifiez votre réseau puis réessayez.',
    generic: 'Le service ne répond pas. Réessayez dans un instant.',
    forbidden: 'Action non autorisée.',
    invalid: 'Certaines informations ne sont pas valides.',
    session: 'Votre session a expiré. Rechargez la page puis réessayez.',
    signin: 'Inscription impossible pour le moment. Réessayez dans un instant.',
    duplicate: 'Vous participez déjà à cette mission.',
    cancel: 'Cette participation ne peut plus être annulée.',
    voucher: 'Ce bon ne peut pas être utilisé (déjà utilisé ?).',
    badImage: 'Photo illisible. Reprenez-la.',
    tooLarge: 'Photo trop lourde. Reprenez-la.',
    timeout: 'La vérification prend trop de temps. Réessayez.',
    verify: 'Vérification impossible pour le moment. Réessayez dans un instant.',
    email: 'Adresse e-mail non valide.',
    sendCode: 'Envoi du code impossible. Vérifiez l’adresse puis réessayez.',
    tooMany: 'Trop de demandes. Patientez une minute avant de réessayer.',
    badCode: 'Code incorrect ou expiré.',
    notPartner: 'Ce compte n’est pas (encore) partenaire de Mélèze.',
    retire: 'Cette mission ne peut pas être retirée.',
    emailTaken: 'Cette adresse est déjà utilisée. Choisissez « Retrouver mes bons ».',
    noSavedVouchers: 'Aucun bon n’est enregistré avec cette adresse.',
    missionGone: 'Cette mission n’est plus proposée.',
  };
  /** Qui prévenir quand le service est mal réglé (contact de l'éditeur). */
  const CONTACT = 'Prévenez l’équipe Mélèze (contact dans les mentions légales).';

  /**
   * Erreurs de la fonction verify-photo, qui répond { error: <code>, message }
   * (voir supabase/functions/verify-photo/handler.ts) → phrase courte pour le
   * touriste. `retry` : panne passagère, la MÊME photo pourra être renvoyée
   * (« Réessayer l’envoi ») ; sinon il faut reprendre la photo, ou rien à faire.
   */
  const VERIFY_ERRORS = {
    bad_request: { msg: 'Envoi refusé. Rechargez la page puis réessayez.' },
    bad_image: { msg: MESSAGES.badImage },
    payload_too_large: { msg: MESSAGES.tooLarge },
    unauthorized: { msg: MESSAGES.session },
    origin_not_allowed: { msg: 'Vérification indisponible depuis ce site. ' + CONTACT },
    method_not_allowed: { msg: MESSAGES.verify, retry: true },
    not_found: { msg: 'Participation introuvable. Rechargez la page.' },
    already_validated: { msg: 'Cette mission est déjà validée.' },
    mission_inactive: { msg: MESSAGES.missionGone },
    attempts_exhausted: { msg: 'Plus d’essai possible pour cette mission.' },
    rate_limited: { msg: 'Trop de vérifications aujourd’hui. Réessayez plus tard.', retry: true },
    config_error: { msg: 'Vérification indisponible pour le moment. ' + CONTACT, retry: true },
    internal_error: { msg: 'Erreur du serveur. Réessayez dans un instant.', retry: true },
    upstream_error: { msg: 'La vérification n’a pas abouti. Réessayez.', retry: true },
    bad_model_output: { msg: 'La vérification n’a pas abouti. Réessayez.', retry: true },
    upstream_busy: { msg: 'Service saturé, réessayez dans un instant.', retry: true },
    busy: { msg: 'Service très demandé aujourd’hui. Réessayez plus tard.', retry: true },
  };
  /** Statut HTTP → code, quand la réponse n'est pas celle de la fonction (passerelle Supabase…). */
  const VERIFY_BY_STATUS = {
    400: 'bad_image', 401: 'unauthorized', 403: 'origin_not_allowed', 404: 'not_found', 405: 'method_not_allowed',
    409: 'already_validated', 410: 'mission_inactive', 413: 'payload_too_large', 422: 'attempts_exhausted',
    429: 'rate_limited', 500: 'internal_error', 502: 'upstream_error', 503: 'upstream_busy',
  };

  class ApiError extends Error {
    constructor(message, code, status) {
      super(message);
      this.name = 'ApiError';
      this.code = code || 'error';
      this.status = status || 0;
      this.retry = false; // vérification photo : la même photo peut être renvoyée
      this.attemptsLeft = null; // vérification photo : essais restants, si le serveur le dit
    }
  }

  // ------------------------------------------------------------------------
  // Configuration et clients
  // ------------------------------------------------------------------------
  function config() {
    const c = (window.Meleze && Meleze.config) || {};
    return {
      url: typeof c.supabaseUrl === 'string' ? c.supabaseUrl.trim().replace(/\/+$/, '') : '',
      key: typeof c.supabaseAnonKey === 'string' ? c.supabaseAnonKey.trim() : '',
    };
  }

  /** false tant que js/config.js n'est pas rempli (ou si la bibliothèque manque). */
  function ready() {
    const c = config();
    return /^https?:\/\/[^\s/]+/i.test(c.url) && c.key.length > 0 &&
      !!(window.supabase && typeof window.supabase.createClient === 'function');
  }

  /** fetch avec délai maximal (réseau de montagne : on n'attend pas indéfiniment). */
  function timedFetch(input, init) {
    const opts = init || {};
    if (opts.signal || typeof AbortController !== 'function') return fetch(input, opts);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
    return fetch(input, Object.assign({}, opts, { signal: ctrl.signal })).finally(() => clearTimeout(timer));
  }

  const clients = {};
  /** Client « tourist » ou « partner », créé à la première utilisation. */
  function client(kind) {
    if (!ready()) throw new ApiError(MESSAGES.unconfigured, 'unconfigured');
    if (!clients[kind]) {
      const c = config();
      clients[kind] = window.supabase.createClient(c.url, c.key, {
        auth: {
          storageKey: STORAGE_KEYS[kind],
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false, // connexion par code : rien à lire dans l'adresse (#/… est au routeur)
        },
        global: { fetch: timedFetch },
      });
    }
    return clients[kind];
  }

  const online = () => !(typeof navigator !== 'undefined' && navigator.onLine === false);

  // ------------------------------------------------------------------------
  // Erreurs
  // ------------------------------------------------------------------------
  function isNetworkError(e) {
    if (!e) return false;
    const msg = String(e.message || '');
    return e.name === 'AuthRetryableFetchError' || e.name === 'FunctionsFetchError' ||
      (!e.code && /Failed to fetch|NetworkError|Load failed|AbortError|TimeoutError|FetchError|network/i.test(msg));
  }

  /** Erreur de la base (PostgREST) → ApiError. */
  function dbError(e, fallback) {
    if (e instanceof ApiError) return e;
    if (!online() || isNetworkError(e)) return new ApiError(MESSAGES.offline, 'offline');
    const code = e && e.code;
    if (code === '23505') return new ApiError(MESSAGES.duplicate, 'duplicate');
    if (code === '42501' || code === 'PGRST301' || code === 'PGRST302' || code === 'PGRST303') return new ApiError(MESSAGES.forbidden, 'forbidden');
    if (code === '23514' || code === '23502' || code === '22001' || code === '22P02') return new ApiError(MESSAGES.invalid, 'invalid');
    return new ApiError(fallback || MESSAGES.generic, code || 'error');
  }

  /** Erreur d'authentification (codes Supabase Auth) → ApiError. */
  function authError(e, fallback) {
    if (e instanceof ApiError) return e;
    if (!online() || isNetworkError(e)) return new ApiError(MESSAGES.offline, 'offline');
    const status = e && e.status;
    const code = (e && e.code) || '';
    if (status === 429 || /rate_limit/.test(code)) return new ApiError(MESSAGES.tooMany, 'rate_limit', 429);
    return new ApiError(fallback || MESSAGES.generic, code || 'auth', status);
  }

  /** Délai « Retry-After » (secondes) → fin de phrase ; null s'il est illisible. */
  function retryAfterText(res) {
    let secs = NaN;
    try { secs = Number(res && res.headers && res.headers.get('Retry-After')); } catch (e) { /* en-tête non exposé (CORS) */ }
    if (!Number.isFinite(secs) || secs <= 0) return null;
    if (secs <= 90) return 'Réessayez dans une minute.';
    if (secs <= 5400) return 'Réessayez dans une heure.';
    return 'Réessayez demain.';
  }

  /** Erreur de la fonction verify-photo (supabase-js : FunctionsHttpError…) → ApiError. */
  async function functionError(e) {
    const name = e && e.name;
    let err;
    if (name === 'FunctionsHttpError') {
      const res = e.context;
      const status = (res && res.status) || 0;
      let body = null;
      try { body = res && typeof res.json === 'function' ? await res.json() : null; } catch (x) { body = null; }
      const code = body && typeof body.error === 'string' && VERIFY_ERRORS[body.error] ? body.error
        : VERIFY_BY_STATUS[status] || (status >= 500 ? 'internal_error' : '');
      const known = VERIFY_ERRORS[code];
      let message = known ? known.msg : MESSAGES.verify;
      if (code === 'rate_limited') {
        const when = retryAfterText(res);
        if (when) message = 'Trop de vérifications aujourd’hui. ' + when;
      }
      err = new ApiError(message, code || 'http_' + status, status);
      err.retry = known ? !!known.retry : status >= 500;
      if (body && Number.isFinite(body.attemptsLeft)) err.attemptsLeft = Math.max(0, body.attemptsLeft);
      else if (code === 'attempts_exhausted') err.attemptsLeft = 0;
      return err;
    }
    if (name === 'FunctionsFetchError') {
      const cause = e.context;
      if (cause && (cause.name === 'AbortError' || cause.name === 'TimeoutError')) err = new ApiError(MESSAGES.timeout, 'timeout');
      else err = new ApiError(online() ? MESSAGES.verify : MESSAGES.offline, online() ? 'network' : 'offline');
    } else {
      err = new ApiError(MESSAGES.verify, 'verify'); // FunctionsRelayError, réponse inattendue…
    }
    err.retry = true;
    return err;
  }

  /** Erreur d'e-mail (ajout d'adresse, code, retrouver ses bons) → ApiError. */
  function emailError(e, fallback) {
    if (e instanceof ApiError) return e;
    const code = String((e && e.code) || '');
    if (code === 'email_exists' || code === 'user_already_exists' || code === 'identity_already_exists') return new ApiError(MESSAGES.emailTaken, 'email_taken', e.status);
    if (code === 'otp_disabled' || code === 'signup_disabled' || code === 'user_not_found') return new ApiError(MESSAGES.noSavedVouchers, 'no_account', e.status);
    if (code === 'email_address_invalid' || code === 'validation_failed') return new ApiError(MESSAGES.email, 'email', e.status);
    return authError(e, fallback);
  }

  /** Erreur de code à 6 chiffres → ApiError. */
  function codeError(e) {
    if (e instanceof ApiError) return e;
    const status = e && e.status;
    if (e && (status === 429 || /rate_limit/.test(e.code || ''))) return new ApiError(MESSAGES.tooMany, 'rate_limit', 429);
    if (e && (!online() || isNetworkError(e))) return new ApiError(MESSAGES.offline, 'offline');
    return new ApiError(MESSAGES.badCode, 'bad_code', status);
  }

  // ------------------------------------------------------------------------
  // Correspondance lignes SQL ↔ objets des vues
  // ------------------------------------------------------------------------
  const str = (v) => (v == null ? '' : String(v));

  function toMission(r) {
    return {
      id: str(r.id),
      title: str(r.title),
      type: str(r.type),
      seasons: Array.isArray(r.seasons) ? r.seasons.map(str) : [],
      duration: Math.max(0, Number(r.duration_min) || 0),
      durationLabel: str(r.duration_label),
      location: str(r.location),
      schedule: str(r.schedule),
      spots: r.spots == null ? null : Number(r.spots),
      host: str(r.org),
      description: str(r.description),
      photoHint: str(r.photo_hint),
      reward: { title: str(r.reward_title), partner: str(r.reward_partner), category: str(r.reward_category) },
      photo: r.photo ? str(r.photo) : null,
      active: r.active !== false,
      createdAt: str(r.created_at),
    };
  }

  /** Mission saisie par un partenaire → ligne `missions` (org imposée par le serveur). */
  function fromMission(m, org) {
    const minutes = Math.max(0, Math.round(Number(m.duration) || 0));
    return {
      org,
      title: str(m.title).trim(),
      type: str(m.type),
      seasons: (m.seasons || []).map(str),
      duration_min: minutes,
      duration_label: str(m.durationLabel).trim() || null,
      location: str(m.location).trim(),
      schedule: str(m.schedule).trim() || null,
      spots: m.spots == null || m.spots === '' ? null : Math.round(Number(m.spots)),
      description: str(m.description).trim(),
      photo_hint: str(m.photoHint).trim(),
      reward_title: str(m.reward && m.reward.title).trim(),
      reward_partner: str(m.reward && m.reward.partner).trim(),
      reward_category: str(m.reward && m.reward.category).trim(),
      photo: null, // photo par défaut selon le type (js/photos.js)
    };
  }

  function toParticipation(r) {
    return {
      id: str(r.id),
      missionId: str(r.mission_id),
      status: r.status === 'validee' ? 'validee' : 'inscrite',
      attempts: Math.max(0, Number(r.attempts) || 0),
      lastCheck: r.last_check && typeof r.last_check === 'object' ? r.last_check : null,
      createdAt: str(r.created_at),
      validatedAt: r.validated_at ? str(r.validated_at) : null,
    };
  }

  function toVoucher(r) {
    return {
      id: str(r.id),
      code: str(r.code),
      missionId: r.mission_id ? str(r.mission_id) : null,
      participationId: str(r.participation_id),
      title: str(r.reward_title),
      partner: str(r.reward_partner),
      category: str(r.reward_category),
      createdAt: str(r.created_at),
      usedAt: r.used_at ? str(r.used_at) : null,
    };
  }

  // ------------------------------------------------------------------------
  // Validation d'une mission (mêmes règles que les contraintes SQL)
  // ------------------------------------------------------------------------
  /**
   * @returns {Object<string,string>} champ → message ; objet vide si tout est bon.
   * Champs : title, type, seasons, duration, durationLabel, location, schedule,
   * spots, description, photoHint, rewardTitle, rewardPartner, rewardCategory.
   */
  function validateMission(m) {
    const L = Meleze.data.LIMITS;
    const errors = {};
    const len = (v) => str(v).trim().length;
    const between = (key, v, lim, label) => {
      const n = len(v);
      if (lim.min && n < lim.min) errors[key] = lim.min > 1 ? label + ' : ' + lim.min + ' caractères minimum.' : label + ' : obligatoire.';
      else if (n > lim.max) errors[key] = label + ' : ' + lim.max + ' caractères maximum.';
    };
    between('title', m.title, L.title, 'Intitulé');
    if (!Meleze.data.TYPES.some((t) => t.id === m.type)) errors.type = 'Choisissez un type de mission.';
    const seasons = Array.isArray(m.seasons) ? m.seasons : [];
    if (!seasons.length || !seasons.every((s) => Meleze.data.SEASONS.some((x) => x.id === s))) errors.seasons = 'Choisissez au moins une saison.';
    const d = Number(m.duration);
    if (!Number.isInteger(d) || d < L.durationMin.min || d > L.durationMin.max) errors.duration = 'Durée non valide.';
    if (len(m.durationLabel) > L.durationLabel.max) errors.durationLabel = 'Durée : ' + L.durationLabel.max + ' caractères maximum.';
    between('location', m.location, L.location, 'Lieu');
    if (len(m.schedule) > L.schedule.max) errors.schedule = 'Quand : ' + L.schedule.max + ' caractères maximum.';
    if (m.spots != null && m.spots !== '') {
      const s = Number(m.spots);
      if (!Number.isInteger(s) || s < L.spots.min || s > L.spots.max) errors.spots = 'Places : entre ' + L.spots.min + ' et ' + L.spots.max + '.';
    }
    between('description', m.description, L.description, 'Description');
    between('photoHint', m.photoHint, L.photoHint, 'Photo attendue');
    const r = m.reward || {};
    between('rewardTitle', r.title, L.rewardTitle, 'Ce que vous offrez');
    between('rewardPartner', r.partner, L.rewardPartner, 'Offert par');
    between('rewardCategory', r.category, L.rewardCategory, 'Catégorie');
    return errors;
  }

  // ------------------------------------------------------------------------
  // Sessions
  // ------------------------------------------------------------------------
  /** Une session est-elle enregistrée dans ce navigateur (même expirée) ? */
  function hasStoredSession(kind) {
    try { return !!window.localStorage.getItem(STORAGE_KEYS[kind]); } catch (e) { return false; }
  }

  /**
   * Session enregistrée dans ce navigateur (lecture locale, sans réseau sauf
   * renouvellement du jeton), ou null s'il n'y en a VRAIMENT pas.
   * Session enregistrée mais impossible à renouveler maintenant (réseau
   * d'altitude, serveur d'authentification en panne…) : ApiError, surtout pas
   * null. Sinon l'app croirait qu'il n'y a pas de compte : « Mon espace » vide,
   * nouveau compte anonyme qui remplacerait l'ancien (bons perdus)…
   */
  async function session(kind) {
    const { data, error } = await client(kind).auth.getSession();
    if (data && data.session) return data.session;
    if (!error) return null; // aucune session enregistrée
    if (!online() || isNetworkError(error)) throw new ApiError(MESSAGES.offline, 'offline');
    // Jeton refusé pour de bon : supabase-js a effacé la session (plus rien à protéger).
    if (!hasStoredSession(kind)) return null;
    throw new ApiError(MESSAGES.generic, 'session_unavailable', error.status);
  }

  let anonPending = null;
  /**
   * Session touriste : créée (compte anonyme) seulement ici, à la première
   * inscription, et seulement s'il n'y a aucune session enregistrée (une
   * session impossible à renouveler fait échouer l'appel : voir session()).
   */
  async function ensureTourist() {
    const s = await session('tourist');
    if (s) return s.user.id;
    if (!online()) throw new ApiError(MESSAGES.offline, 'offline');
    if (!anonPending) {
      anonPending = client('tourist').auth.signInAnonymously()
        .then(({ data, error }) => {
          if (error || !data || !data.session) throw authError(error, MESSAGES.signin);
          return data.session.user.id;
        })
        .finally(() => { anonPending = null; });
    }
    return anonPending;
  }

  // ------------------------------------------------------------------------
  // Touriste
  // ------------------------------------------------------------------------
  /** Missions publiées (actives), les plus anciennes d'abord. */
  async function listMissions() {
    const { data, error } = await client('tourist').from('missions')
      .select(MISSION_COLUMNS).eq('active', true).order('created_at', { ascending: true });
    if (error) throw dbError(error);
    return (data || []).map(toMission);
  }

  async function myParticipations() {
    const s = await session('tourist');
    if (!s) return [];
    const { data, error } = await client('tourist').from('participations')
      .select(PARTICIPATION_COLUMNS).eq('user_id', s.user.id).order('created_at', { ascending: false });
    if (error) throw dbError(error);
    return (data || []).map(toParticipation);
  }

  async function myVouchers() {
    const s = await session('tourist');
    if (!s) return [];
    const { data, error } = await client('tourist').from('vouchers')
      .select(VOUCHER_COLUMNS).eq('user_id', s.user.id).order('created_at', { ascending: false });
    if (error) throw dbError(error);
    return (data || []).map(toVoucher);
  }

  /**
   * Missions par identifiant, retirées comprises : celles auxquelles le
   * touriste a participé restent lisibles (règle missions_select_joined), pour
   * afficher leur titre dans « Mon espace » après leur retrait.
   */
  async function missionsByIds(ids) {
    const list = (ids || []).filter((id) => typeof id === 'string' && id);
    if (!list.length) return [];
    const s = await session('tourist');
    if (!s) return [];
    const { data, error } = await client('tourist').from('missions').select(MISSION_COLUMNS).in('id', list);
    if (error) throw dbError(error);
    return (data || []).map(toMission);
  }

  /** Inscription à une mission (crée le compte anonyme au besoin). */
  async function join(missionId) {
    const uid = await ensureTourist();
    const { data, error } = await client('tourist').from('participations')
      .insert({ user_id: uid, mission_id: missionId }).select(PARTICIPATION_COLUMNS);
    if (error) {
      const err = dbError(error, MESSAGES.signin);
      // Refus de la règle d'inscription : la mission a été retirée entre-temps.
      if (err.code === 'forbidden') throw new ApiError(MESSAGES.missionGone, 'mission_inactive', 403);
      throw err;
    }
    if (!data || !data[0]) throw new ApiError(MESSAGES.signin, 'empty');
    return toParticipation(data[0]);
  }

  /** Annulation (seulement tant que la mission n'est pas validée). */
  async function cancel(participationId) {
    const s = await session('tourist');
    if (!s) throw new ApiError(MESSAGES.cancel, 'no_session');
    const { data, error } = await client('tourist').from('participations')
      .delete().eq('id', participationId).eq('status', 'inscrite').select('id');
    if (error) throw dbError(error, MESSAGES.cancel);
    if (!data || !data.length) throw new ApiError(MESSAGES.cancel, 'not_found');
    return true;
  }

  /**
   * Envoie la photo à la fonction de vérification (IA).
   * @param {string} participationId
   * @param {string} jpegDataUrl  "data:image/jpeg;base64,…" (réduite à 1024 px, voir js/camera.js)
   * @returns {Promise<{valid:boolean, confidence:number, reason:string, voucher:object|null, attemptsLeft:number|null}>}
   *   En cas d'échec : ApiError avec `code` (celui du serveur : attempts_exhausted,
   *   mission_inactive…), `retry` et éventuellement `attemptsLeft`.
   */
  async function verifyPhoto(participationId, jpegDataUrl) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(String(jpegDataUrl || ''));
    if (!m) throw new ApiError(MESSAGES.badImage, 'bad_image');
    if (m[2].length > MAX_IMAGE_B64) throw new ApiError(MESSAGES.tooLarge, 'too_large');
    if (!online()) throw new ApiError(MESSAGES.offline, 'offline');
    const s = await session('tourist');
    if (!s) throw new ApiError(MESSAGES.session, 'no_session');
    const { data, error } = await client('tourist').functions.invoke(FUNCTION, {
      body: { participationId, image: m[2], mediaType: m[1] },
      timeout: VERIFY_TIMEOUT,
    });
    if (error) throw await functionError(error);
    let res = data;
    if (typeof res === 'string') { try { res = JSON.parse(res); } catch (e) { res = null; } }
    if (!res || typeof res.valid !== 'boolean') throw new ApiError(MESSAGES.verify, 'bad_response');
    return {
      valid: res.valid,
      confidence: Math.min(1, Math.max(0, Number(res.confidence) || 0)),
      reason: str(res.reason).slice(0, 300),
      voucher: res.voucher && typeof res.voucher === 'object' ? toVoucher(res.voucher) : null,
      attemptsLeft: Number.isFinite(res.attemptsLeft) ? Math.max(0, res.attemptsLeft) : null,
    };
  }

  /** Utilisation d'un bon (irréversible, une seule fois) : fonction SQL use_voucher. */
  async function useVoucher(id) {
    const s = await session('tourist');
    if (!s) throw new ApiError(MESSAGES.session, 'no_session');
    const { data, error } = await client('tourist').rpc('use_voucher', { p_id: id });
    if (error) throw dbError(error, MESSAGES.voucher);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.used_at) throw new ApiError(MESSAGES.voucher, 'voucher');
    return toVoucher(row);
  }

  /** « Supprimer mes données » : efface participations et bons (journal des vérifications anonymisé), puis oublie le compte anonyme. */
  async function deleteMyData() {
    const s = await session('tourist'); // session impossible à renouveler : erreur, rien n'est effacé
    if (!s) return true; // aucune session : rien sur le serveur
    const { error } = await client('tourist').rpc('delete_my_data');
    if (error) throw dbError(error);
    await client('tourist').auth.signOut({ scope: 'local' }).catch(() => {});
    return true;
  }

  // ------------------------------------------------------------------------
  // Touriste : garder ses bons avec un e-mail (facultatif)
  // Tout se passe sur le client « tourist » : le compte anonyme reçoit
  // l'adresse et devient permanent, SANS changer d'identifiant (participations
  // et bons conservés). Sur un autre appareil, « Retrouver mes bons » ouvre ce
  // même compte avec un code reçu par e-mail.
  // ------------------------------------------------------------------------
  const normEmail = (email) => str(email).trim().toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /** Adresse saisie → adresse normalisée, sinon ApiError (adresse, réseau). */
  function checkEmail(email) {
    const e = normEmail(email);
    if (!EMAIL_RE.test(e) || e.length > 254) throw new ApiError(MESSAGES.email, 'email');
    if (!online()) throw new ApiError(MESSAGES.offline, 'offline');
    return e;
  }
  /** Code saisi → chiffres seuls, sinon ApiError. */
  function checkToken(code) {
    const token = str(code).replace(/\s+/g, '');
    if (!/^\d{6,10}$/.test(token)) throw new ApiError(MESSAGES.badCode, 'bad_code');
    if (!online()) throw new ApiError(MESSAGES.offline, 'offline');
    return token;
  }

  /**
   * Compte touriste de ce navigateur (lecture locale), ou null.
   * `email` : adresse confirmée ('' tant que le compte est anonyme).
   */
  async function touristAccount() {
    if (!ready()) return null;
    const s = await session('tourist');
    if (!s || !s.user) return null;
    const u = s.user;
    return { userId: str(u.id), email: u.is_anonymous ? '' : normEmail(u.email) };
  }

  /** Étape 1 : Supabase envoie un code à 6 chiffres à cette adresse (modèle « Change Email Address »). */
  async function saveEmailSend(email) {
    const e = checkEmail(email);
    const s = await session('tourist');
    if (!s) throw new ApiError(MESSAGES.session, 'no_session');
    const { error } = await client('tourist').auth.updateUser({ email: e });
    if (error) throw emailError(error, MESSAGES.sendCode);
    return e;
  }

  /** Étape 2 : le code confirme l'adresse ; le compte devient permanent, mêmes bons. */
  async function saveEmailVerify(email, code) {
    const token = checkToken(code);
    const e = normEmail(email);
    const { data, error } = await client('tourist').auth.verifyOtp({ email: e, token, type: 'email_change' });
    if (error) throw codeError(error);
    let user = data && data.session && data.session.user;
    if (!user) {
      // Réponse sans session (cas rare) : on recharge la session pour lire l'adresse confirmée.
      const r = await client('tourist').auth.refreshSession();
      user = r && r.data && r.data.session && r.data.session.user;
    }
    if (!user || user.is_anonymous || normEmail(user.email) !== e) throw new ApiError(MESSAGES.badCode, 'bad_code');
    return { userId: str(user.id), email: e };
  }

  /** « Retrouver mes bons » : code envoyé seulement si un compte existe déjà avec cette adresse. */
  async function recoverSend(email) {
    const e = checkEmail(email);
    const { error } = await client('tourist').auth.signInWithOtp({ email: e, options: { shouldCreateUser: false } });
    if (error) throw emailError(error, MESSAGES.sendCode);
    return e;
  }

  /**
   * Code reçu → ce navigateur passe sur le compte de cette adresse. Le compte
   * anonyme d'avant est abandonné : l'appelant prévient AVANT s'il avait des
   * missions ou des bons (voir store.hasUnsavedData).
   */
  async function recoverVerify(email, code) {
    const token = checkToken(code);
    const e = normEmail(email);
    const { data, error } = await client('tourist').auth.verifyOtp({ email: e, token, type: 'email' });
    if (error || !data || !data.session) throw codeError(error);
    return { userId: str(data.session.user.id), email: normEmail(data.session.user.email) || e };
  }

  // ------------------------------------------------------------------------
  // Partenaire
  // ------------------------------------------------------------------------
  /** Envoie un code de connexion par e-mail. */
  async function sendCode(email) {
    const e = checkEmail(email);
    const { error } = await client('partner').auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    if (error) throw authError(error, MESSAGES.sendCode);
    return e;
  }

  /** Vérifie le code reçu (6 chiffres par défaut chez Supabase). */
  async function verifyCode(email, code) {
    const token = checkToken(code);
    const { data, error } = await client('partner').auth.verifyOtp({ email: normEmail(email), token, type: 'email' });
    if (error || !data || !data.session) throw codeError(error);
    return { email: normEmail(data.session.user.email), userId: data.session.user.id };
  }

  /** Partenaire connecté sur ce navigateur, ou null. */
  async function partnerSession() {
    if (!ready()) return null;
    const s = await session('partner');
    return s && s.user ? { email: normEmail(s.user.email), userId: s.user.id } : null;
  }

  /** Fiche partenaire (table partners) du compte connecté ; null s'il n'est pas (encore) partenaire. */
  async function partnerProfile() {
    const s = await session('partner');
    if (!s) return null;
    const email = normEmail(s.user.email);
    const { data, error } = await client('partner').from('partners').select('email,org').eq('email', email);
    if (error) throw dbError(error);
    const row = data && data[0];
    return row ? { email: normEmail(row.email), org: str(row.org) } : null;
  }

  /** Missions du partenaire connecté, retirées comprises, les plus récentes d'abord. */
  async function myMissions() {
    const s = await session('partner');
    if (!s) throw new ApiError(MESSAGES.session, 'no_session');
    const { data, error } = await client('partner').from('missions')
      .select(MISSION_COLUMNS).eq('created_by', s.user.id).order('created_at', { ascending: false });
    if (error) throw dbError(error);
    return (data || []).map(toMission);
  }

  /**
   * Publie une mission. `fields.org` = organisation de la fiche partenaire
   * (le serveur vérifie qu'elle correspond au compte connecté).
   */
  async function createMission(fields) {
    const errors = validateMission(fields);
    if (Object.keys(errors).length) {
      const err = new ApiError(MESSAGES.invalid, 'invalid');
      err.fields = errors;
      throw err;
    }
    const s = await session('partner');
    if (!s) throw new ApiError(MESSAGES.session, 'no_session');
    if (!online()) throw new ApiError(MESSAGES.offline, 'offline');
    const row = Object.assign(fromMission(fields, str(fields.org)), { created_by: s.user.id });
    const { data, error } = await client('partner').from('missions').insert(row).select(MISSION_COLUMNS);
    if (error) throw dbError(error);
    if (!data || !data[0]) throw new ApiError(MESSAGES.forbidden, 'forbidden');
    return toMission(data[0]);
  }

  /** Retire une mission du catalogue (active = false ; aucune suppression). */
  async function retireMission(id) {
    if (!online()) throw new ApiError(MESSAGES.offline, 'offline');
    const { data, error } = await client('partner').from('missions')
      .update({ active: false }).eq('id', id).select('id,active');
    if (error) throw dbError(error, MESSAGES.retire);
    if (!data || !data.length) throw new ApiError(MESSAGES.retire, 'not_found');
    return true;
  }

  /** Déconnexion du partenaire (cet appareil seulement ; la session touriste reste intacte). */
  async function signOut() {
    if (!ready()) return;
    const { error } = await client('partner').auth.signOut({ scope: 'local' });
    if (error && !isNetworkError(error)) throw authError(error);
  }

  return {
    ApiError, MESSAGES, ready, validateMission,
    // touriste
    listMissions, myParticipations, myVouchers, missionsByIds, join, cancel, verifyPhoto, useVoucher, deleteMyData,
    touristAccount, saveEmailSend, saveEmailVerify, recoverSend, recoverVerify,
    // partenaire
    sendCode, verifyCode, partnerSession, partnerProfile, myMissions, createMission, retireMission, signOut,
  };
})();
