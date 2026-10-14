/* ==========================================================================
   Mélèze — store : copie locale des données du serveur
   Le serveur (js/api.js) fait foi. Le store garde la dernière version reçue
   (missions publiées, participations et bons du touriste) pour l'affichage,
   la recopie dans localStorage pour la lecture HORS CONNEXION (couverture
   aléatoire en altitude) et prévient les vues à chaque changement.

   États (`state.status`) :
     idle → loading → ready | error | offline
   `state.known` : true dès qu'on a des données à montrer (cache ou serveur).
   Toute ACTION (s'inscrire, vérifier une photo, utiliser un bon…) passe par
   le serveur : sans réseau elle échoue avec « Connexion nécessaire… ».
   ========================================================================== */
window.Meleze = window.Meleze || {};

Meleze.store = (function () {
  'use strict';
  const api = Meleze.api;

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
    missions: [],
    participations: [],
    vouchers: [],
    hasAccount: false, // un compte touriste (anonyme) existe dans ce navigateur
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
        participations: state.participations,
        vouchers: state.vouchers,
        hasAccount: state.hasAccount,
        savedAt: state.savedAt,
      }));
    } catch (e) { /* stockage plein ou bloqué : l'app marche, sans copie hors connexion */ }
  }
  function applyCache(c) {
    state.missions = c.missions;
    state.participations = c.participations;
    state.vouchers = c.vouchers;
    state.hasAccount = !!c.hasAccount;
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
    pending = Promise.all([api.listMissions(), api.hasTouristSession()])
      .then(([missions, hasAccount]) => Promise.all([
        missions,
        hasAccount,
        hasAccount ? api.myParticipations() : [],
        hasAccount ? api.myVouchers() : [],
      ]))
      .then(([missions, hasAccount, participations, vouchers]) => {
        if (startGen !== gen) { outdated = true; return; }
        state.missions = missions;
        state.participations = participations;
        state.vouchers = vouchers;
        state.hasAccount = hasAccount;
        state.status = 'ready';
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
  const getMission = (id) => state.missions.find((m) => m.id === id) || null;
  const getParticipation = (id) => state.participations.find((p) => p.id === id) || null;
  /** Participation (en cours ou validée) du touriste pour cette mission. */
  const participationFor = (missionId) => state.participations.find((p) => p.missionId === missionId) || null;

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
        if (err && err.code === 'duplicate') resync(); // déjà inscrit·e (autre onglet) : on recharge
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
          p.attempts += 1;
          p.lastCheck = { valid: res.valid, reason: res.reason, confidence: res.confidence };
          if (res.valid) { p.status = 'validee'; p.validatedAt = new Date().toISOString(); }
        }
        if (res.voucher) state.vouchers = [res.voucher].concat(state.vouchers.filter((v) => v.id !== res.voucher.id));
        commit();
        resync(); // le serveur fait foi (code du bon, compteur d'essais)
        return res;
      }, (err) => {
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
        state.vouchers = [];
        state.hasAccount = false;
        commit();
      });
  }

  return {
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    refresh, ensureFresh, markOffline,
    getMission, getParticipation, participationFor,
    join, cancel, verifyPhoto, useVoucher, deleteMyData,
  };
})();
