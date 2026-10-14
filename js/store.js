/* ==========================================================================
   Mélèze — store : copie locale des données du serveur
   Le serveur (js/api.js) fait foi. Le store garde la dernière version reçue
   (missions publiées, participations et bons du touriste) pour l'affichage,
   la recopie dans localStorage pour la lecture HORS CONNEXION (couverture
   aléatoire en altitude) et prévient les vues à chaque changement.

   États (`state.status`) :
     idle → loading → ready | error | offline
   `state.known` : true dès qu'on a des données à montrer (cache ou serveur).
   `state.confirmed` : true seulement après un chargement RÉUSSI depuis le
   serveur pendant cette visite. Tant qu'il est faux, les données viennent de
   la copie locale (modifiable par n'importe qui sur son téléphone) : les
   vues ne présentent alors pas un bon comme « à utiliser » ou « utilisé ».
   `state.pastMissions` : missions retirées auxquelles le touriste a
   participé (titre et durée dans « Mon espace »), jamais listées au catalogue.
   Toute ACTION (s'inscrire, vérifier une photo, utiliser un bon…) passe par
   le serveur : sans réseau elle échoue avec « Connexion nécessaire… ».
   `state.email` : adresse qui garde les bons du touriste ('' = compte
   anonyme, lié à ce seul navigateur).
   ========================================================================== */
window.Meleze = window.Meleze || {};

Meleze.store = (function () {
  'use strict';
  const api = Meleze.api;
  const MAX_ATTEMPTS = Meleze.data.MAX_ATTEMPTS;

  const CACHE_KEY = 'meleze:cache:v1';
  // Anciennes versions (données locales de la maquette) : effacées au démarrage.
  const OLD_KEYS = ['meleze:state:v1', 'meleze:state:v2', 'meleze:state:v3'];
  const OLD_SESSION_KEYS = ['meleze:pro'];
  /** Au-delà, une page qui s'affiche recharge les données (voir ensureFresh). */
  const STALE_MS = 60 * 1000;

  const listeners = new Set();
  const state = {
    configured: api.ready(),
    status: 'idle',
    error: null,
    known: false,
    confirmed: false,
    missions: [],
    pastMissions: [],
    participations: [],
    vouchers: [],
    hasAccount: false, // un compte touriste existe dans ce navigateur (anonyme ou avec e-mail)
    email: '', // adresse confirmée du compte touriste ('' = anonyme)
    savedAt: 0, // date des données affichées (serveur ou cache)
  };
  let loadedAt = 0; // dernier chargement réussi pendant cette visite
  let pending = null;
  // Incrémenté à chaque changement local : un chargement lancé AVANT ce changement
  // renverrait des données périmées → il est ignoré et relancé.
  let gen = 0;

  // --- Stockage local (tolérant : navigation privée, stockage bloqué ou plein) ---
  function storage(name) {
    try { return window[name] || null; } catch (e) { return null; }
  }
  function readCache() {
    try {
      const raw = storage('localStorage') && storage('localStorage').getItem(CACHE_KEY);
      const c = raw ? JSON.parse(raw) : null;
      if (!c || !Array.isArray(c.missions) || !Array.isArray(c.participations) || !Array.isArray(c.vouchers)) return null;
      return c;
    } catch (e) { return null; }
  }
  function writeCache() {
    try {
      storage('localStorage').setItem(CACHE_KEY, JSON.stringify({
        missions: state.missions,
        pastMissions: state.pastMissions,
        participations: state.participations,
        vouchers: state.vouchers,
        hasAccount: state.hasAccount,
        email: state.email,
        savedAt: state.savedAt,
      }));
    } catch (e) { /* stockage plein ou bloqué : l'app marche, sans copie hors connexion */ }
  }
  function applyCache(c) {
    state.missions = c.missions;
    state.pastMissions = Array.isArray(c.pastMissions) ? c.pastMissions : [];
    state.participations = c.participations;
    state.vouchers = c.vouchers;
    state.hasAccount = !!c.hasAccount;
    state.email = typeof c.email === 'string' ? c.email : '';
    state.savedAt = Number(c.savedAt) || 0;
    state.known = true;
  }

  // Démarrage : nettoyage des anciennes clés, puis reprise du cache.
  (function init() {
    const ls = storage('localStorage');
    const ss = storage('sessionStorage');
    try { OLD_KEYS.forEach((k) => ls && ls.removeItem(k)); } catch (e) { /* rien */ }
    try { OLD_SESSION_KEYS.forEach((k) => ss && ss.removeItem(k)); } catch (e) { /* rien */ }
    if (!state.configured) return;
    const c = readCache();
    if (c) applyCache(c);
  })();

  function notify() {
    listeners.forEach((fn) => { try { fn(state); } catch (e) { /* une vue ne doit pas bloquer les autres */ } });
  }
  /** Après une action réussie : copie locale + nouveau rendu. */
  function commit() {
    gen += 1;
    state.savedAt = Date.now();
    state.known = true;
    writeCache();
    notify();
  }

  // Un autre onglet a reçu des données plus récentes : on les reprend.
  window.addEventListener('storage', (e) => {
    if (e.key !== CACHE_KEY || !state.configured) return;
    const c = readCache();
    if (c) { applyCache(c); notify(); }
  });

  const online = () => !(navigator && navigator.onLine === false);

  /** Vérifie qu'une action est possible maintenant (serveur branché, réseau). */
  function guard() {
    if (!state.configured) return Promise.reject(new api.ApiError(api.MESSAGES.unconfigured, 'unconfigured'));
    if (!online()) return Promise.reject(new api.ApiError(api.MESSAGES.offline, 'offline'));
    return Promise.resolve();
  }

  // ------------------------------------------------------------------------
  // Chargement
  // ------------------------------------------------------------------------
  /**
   * Recharge missions, participations et bons depuis le serveur.
   * Les données déjà affichées restent visibles pendant le chargement.
   * @returns {Promise<object>} l'état (jamais rejetée)
   */
  function refresh() {
    if (!state.configured) return Promise.resolve(state);
    if (pending) return pending;
    if (!online()) {
      state.status = 'offline';
      state.error = api.MESSAGES.offline;
      notify();
      return Promise.resolve(state);
    }
    state.status = 'loading';
    state.error = null;
    notify();
    const startGen = gen;
    let outdated = false;
    // touristAccount() échoue (au lieu de répondre « pas de compte ») si la
    // session enregistrée ne peut pas être renouvelée : les données affichées
    // et la copie locale restent alors intactes.
    pending = Promise.all([api.listMissions(), api.touristAccount()])
      .then(([missions, account]) => Promise.all([
        missions,
        account,
        account ? api.myParticipations() : [],
        account ? api.myVouchers() : [],
      ]))
      .then(([missions, account, participations, vouchers]) => {
        // Missions retirées auxquelles le touriste a participé : lues à part.
        const active = new Set(missions.map((m) => m.id));
        const missing = Array.from(new Set(participations.map((p) => p.missionId).filter((id) => id && !active.has(id))));
        const known = state.pastMissions.filter((m) => missing.includes(m.id));
        const past = missing.length
          ? api.missionsByIds(missing).catch(() => known) // facultatif : sans eux, « Mission retirée »
          : [];
        return Promise.all([missions, account, participations, vouchers, past]);
      })
      .then(([missions, account, participations, vouchers, past]) => {
        if (startGen !== gen) { outdated = true; return; }
        state.missions = missions;
        state.pastMissions = past;
        state.participations = participations;
        state.vouchers = vouchers;
        state.hasAccount = !!account;
        state.email = (account && account.email) || '';
        state.status = 'ready';
        state.confirmed = true;
        loadedAt = Date.now();
        state.savedAt = loadedAt;
        state.known = true;
        writeCache();
      })
      .catch((err) => {
        const offline = !online() || (err && err.code === 'offline');
        state.status = offline ? 'offline' : 'error';
        state.error = (err && err.message) || api.MESSAGES.generic;
      })
      .then(() => {
        pending = null;
        if (outdated) return refresh();
        notify();
        return state;
      });
    return pending;
  }

  /** Recharge seulement si les données ont plus d'une minute (ou n'ont jamais été chargées). */
  function ensureFresh() {
    if (!state.configured || pending) return;
    if (!loadedAt || Date.now() - loadedAt > STALE_MS) refresh();
  }

  /** Réseau perdu : on l'indique sans effacer ce qui est affiché. */
  function markOffline() {
    if (!state.configured || pending) return;
    state.status = 'offline';
    state.error = api.MESSAGES.offline;
    notify();
  }

  // ------------------------------------------------------------------------
  // Lecture
  // ------------------------------------------------------------------------
  /** Mission du catalogue (active). */
  const getMission = (id) => state.missions.find((m) => m.id === id) || null;
  /** Mission active OU retirée (participations de « Mon espace ») ; `active` dit laquelle. */
  const missionInfo = (id) => getMission(id) || state.pastMissions.find((m) => m.id === id) || null;
  const getParticipation = (id) => state.participations.find((p) => p.id === id) || null;
  /** Participation (en cours ou validée) du touriste pour cette mission. */
  const participationFor = (missionId) => state.participations.find((p) => p.missionId === missionId) || null;
  /** Des missions ou des bons liés à ce seul navigateur (aucun e-mail pour les retrouver) ? */
  const hasUnsavedData = () => !state.email && (state.participations.length > 0 || state.vouchers.length > 0);

  /** Rechargement discret après une action (compteur d'essais, statut…). */
  function resync() { gen += 1; loadedAt = 0; refresh(); }

  // ------------------------------------------------------------------------
  // Actions (toujours via le serveur)
  // ------------------------------------------------------------------------
  /** Inscription : crée le compte anonyme au besoin. */
  function join(missionId) {
    return guard()
      .then(() => api.join(missionId))
      .then((p) => {
        state.participations = [p].concat(state.participations.filter((x) => x.id !== p.id));
        state.hasAccount = true;
        commit();
        return p;
      }, (err) => {
        // Déjà inscrit·e (autre onglet), mission retirée entre-temps… : on recharge
        // (sauf sans réseau ni serveur : rien à relire).
        if (err && err.code !== 'offline' && err.code !== 'unconfigured') resync();
        throw err;
      });
  }

  function cancel(participationId) {
    return guard()
      .then(() => api.cancel(participationId))
      .then(() => {
        state.participations = state.participations.filter((p) => p.id !== participationId);
        commit();
      }, (err) => { resync(); throw err; });
  }

  /**
   * Vérification de la photo par le serveur (IA).
   * @returns {Promise<{valid, confidence, reason, voucher}>}
   */
  function verifyPhoto(participationId, dataUrl) {
    return guard()
      .then(() => api.verifyPhoto(participationId, dataUrl))
      .then((res) => {
        const p = getParticipation(participationId);
        if (p) {
          p.attempts = res.attemptsLeft == null ? p.attempts + 1 : Math.max(p.attempts, MAX_ATTEMPTS - res.attemptsLeft);
          p.lastCheck = { valid: res.valid, reason: res.reason, confidence: res.confidence };
          if (res.valid) { p.status = 'validee'; p.validatedAt = new Date().toISOString(); }
        }
        if (res.voucher) state.vouchers = [res.voucher].concat(state.vouchers.filter((v) => v.id !== res.voucher.id));
        commit();
        resync(); // le serveur fait foi (code du bon, compteur d'essais)
        return res;
      }, (err) => {
        const p = getParticipation(participationId);
        if (p && err && err.attemptsLeft != null) { p.attempts = MAX_ATTEMPTS - err.attemptsLeft; commit(); }
        if (err && err.code !== 'offline' && err.code !== 'unconfigured') resync();
        throw err;
      });
  }

  /** Utilisation d'un bon, devant le partenaire (irréversible). */
  function useVoucher(voucherId) {
    return guard()
      .then(() => api.useVoucher(voucherId))
      .then((v) => {
        state.vouchers = state.vouchers.map((x) => (x.id === v.id ? v : x));
        commit();
        return v;
      }, (err) => { resync(); throw err; });
  }

  /** « Supprimer mes données » : serveur, puis copie locale. */
  function deleteMyData() {
    return guard()
      .then(() => api.deleteMyData())
      .then(() => {
        state.participations = [];
        state.pastMissions = [];
        state.vouchers = [];
        state.hasAccount = false;
        state.email = '';
        commit();
      });
  }

  // ------------------------------------------------------------------------
  // E-mail du touriste (facultatif) : garder ses bons, les retrouver ailleurs
  // ------------------------------------------------------------------------
  /** Envoie le code de confirmation de l'adresse (le compte anonyme doit exister). */
  function saveEmailSend(email) {
    return guard().then(() => api.saveEmailSend(email));
  }

  /** Code reçu → l'adresse garde désormais les bons de ce compte. */
  function saveEmailVerify(email, code) {
    return guard()
      .then(() => api.saveEmailVerify(email, code))
      .then((account) => {
        state.email = account.email;
        state.hasAccount = true;
        commit();
        return account;
      });
  }

  /** « Retrouver mes bons » : code envoyé à l'adresse d'un compte existant. */
  function recoverSend(email) {
    return guard().then(() => api.recoverSend(email));
  }

  /**
   * Code reçu → ce navigateur passe sur le compte de l'adresse. L'appelant a
   * prévenu avant si des missions non sauvegardées allaient être perdues
   * (hasUnsavedData). Les données affichées sont rechargées depuis le serveur.
   */
  function recoverVerify(email, code) {
    return guard()
      .then(() => api.recoverVerify(email, code))
      .then((account) => {
        state.participations = [];
        state.pastMissions = [];
        state.vouchers = [];
        state.hasAccount = true;
        state.email = account.email;
        commit();
        loadedAt = 0;
        return refresh().then(() => account);
      });
  }

  return {
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    refresh, ensureFresh, markOffline,
    getMission, missionInfo, getParticipation, participationFor, hasUnsavedData,
    join, cancel, verifyPhoto, useVoucher, deleteMyData,
    saveEmailSend, saveEmailVerify, recoverSend, recoverVerify,
  };
})();
