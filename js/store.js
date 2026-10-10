/* ==========================================================================
   Mélèze — store : état de l'application + persistance locale
   Une V2 remplacera ces fonctions par des appels API ; les vues n'ont pas
   besoin de changer tant que les signatures restent les mêmes.
   ========================================================================== */
window.Meleze = window.Meleze || {};

Meleze.store = (function () {
  'use strict';

  const KEY = 'meleze:state:v1';
  const SESSION_KEY = 'meleze:pro';
  const listeners = new Set();
  let memPro = null;

  // --- Persistance (tolérante : navigation privée, stockage bloqué…) -------
  function read(storage, key) {
    try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; }
  }
  function write(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (e) { /* mode mémoire seule */ }
  }

  /** Copie profonde des données de démo pour repartir d'un état propre. */
  function seed() {
    const d = Meleze.data;
    return JSON.parse(JSON.stringify({
      missions: d.missions,
      user: d.user,
      participations: d.participations,
      vouchers: d.vouchers,
    }));
  }

  let state = read(localStorage, KEY) || seed();

  function commit() {
    write(localStorage, KEY, state);
    listeners.forEach((fn) => fn(state));
  }

  // --- Utilitaires ---------------------------------------------------------
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  /** Code lisible type MLZ-B-K7Q2 (sans 0/O/1/I pour éviter les confusions). */
  function makeCode(kind) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = 'MLZ-' + kind + '-';
      for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    } while (state.vouchers.some((v) => v.code === code));
    return code;
  }

  const getMission = (id) => state.missions.find((m) => m.id === id);

  // --- API publique ----------------------------------------------------------
  return {
    get state() { return state; },
    getMission,

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** Remet les données de démo (utile pour rejouer le parcours). */
    reset() { state = seed(); commit(); },

    // ----- Touriste -----
    participationFor(missionId) {
      return state.participations.find((p) => p.missionId === missionId && p.status !== 'validee');
    },

    join(missionId) {
      if (this.participationFor(missionId)) return null;
      const p = { id: uid('p'), missionId, status: 'inscrite', date: today() };
      state.participations.unshift(p);
      commit();
      return p;
    },

    cancel(participationId) {
      state.participations = state.participations.filter((p) => p.id !== participationId);
      commit();
    },

    /** Le touriste déclare avoir terminé : il doit alors montrer son QR à un pro. */
    markDone(participationId) {
      const p = state.participations.find((x) => x.id === participationId);
      if (p && p.status === 'inscrite') { p.status = 'terminee'; commit(); }
    },

    // ----- Pro -----
    /** Validation par un pro → émission d'un bon de récompense. */
    validate(participationId) {
      const p = state.participations.find((x) => x.id === participationId);
      if (!p || p.status !== 'terminee') return null;
      const m = getMission(p.missionId);
      p.status = 'validee';
      const voucher = {
        id: uid('v'),
        code: makeCode('B'),
        missionId: m.id,
        title: m.reward.title,
        partner: m.reward.partner,
        status: 'actif',
        issuedAt: today(),
        usedAt: null,
      };
      state.vouchers.unshift(voucher);
      commit();
      return voucher;
    },

    /** Consommation d'un bon : irréversible, pour éviter la double utilisation. */
    consume(voucherId) {
      const v = state.vouchers.find((x) => x.id === voucherId);
      if (!v || v.status !== 'actif') return null;
      v.status = 'consomme';
      v.usedAt = today();
      commit();
      return v;
    },

    /** Création d'une mission par un pro : publiée immédiatement. */
    addMission(input) {
      const mission = Object.assign({ id: uid('m'), isNew: true, createdAt: today() }, input);
      state.missions.unshift(mission);
      commit();
      return mission;
    },

    /**
     * Interprète un code scanné.
     * @returns {{kind:'user', user, items} | {kind:'voucher', voucher} | {kind:'unknown', code}}
     */
    lookup(raw) {
      const code = String(raw || '').trim().toUpperCase();
      if (code === state.user.code) {
        const items = state.participations
          .filter((p) => p.status !== 'validee')
          .map((p) => ({ participation: p, mission: getMission(p.missionId) }))
          .filter((x) => x.mission);
        return { kind: 'user', user: state.user, items };
      }
      const voucher = state.vouchers.find((v) => v.code === code);
      if (voucher) return { kind: 'voucher', voucher };
      return { kind: 'unknown', code };
    },

    // ----- Session pro (sessionStorage : expire à la fermeture de l'onglet) -----
    // `memPro` sert de repli si le stockage du navigateur est indisponible.
    get pro() { return read(sessionStorage, SESSION_KEY) || memPro; },
    login(profile) { memPro = profile; write(sessionStorage, SESSION_KEY, profile); },
    logout() { memPro = null; try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* rien */ } },
  };
})();
