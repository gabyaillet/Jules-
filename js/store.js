/* ==========================================================================
   Mélèze — store : état de l'application + persistance locale
   Une V2 remplacera ces fonctions par des appels API ; les vues n'ont pas
   besoin de changer tant que les signatures restent les mêmes.

   Règle produit : chaque participation à une mission a SON propre code
   (MLZ-P-XXXX), donc son propre QR. Le référent scanne ce QR et valide :
   un bon de récompense (MLZ-B-XXXX) est alors émis. Les missions à
   justificatif photo (transport) sont validées depuis la liste des
   justificatifs, sans QR.
   ========================================================================== */
window.Meleze = window.Meleze || {};

Meleze.store = (function () {
  'use strict';

  // v3 : nouvelles photos de missions + prénom de démo « Gab ». Les anciens états
  // (v1, v2) sont ignorés et effacés : la démo repart des nouvelles données.
  const KEY = 'meleze:state:v3';
  const OLD_KEYS = ['meleze:state:v1', 'meleze:state:v2'];
  const SESSION_KEY = 'meleze:pro';
  const listeners = new Set();
  let memPro = null;
  let persisted = true; // résultat de la dernière écriture complète dans localStorage

  // --- Persistance (tolérante : navigation privée, stockage bloqué ou plein…) -
  /** Accès protégé : lire `window.localStorage` peut lui-même lever une exception. */
  function storage(name) {
    try { return window[name] || null; } catch (e) { return null; }
  }
  /** Texte brut enregistré sous `key` (null si absent ou illisible). */
  function readRaw(storage, key) {
    try { return storage ? storage.getItem(key) : null; } catch (e) { return null; }
  }
  function parse(raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function read(storage, key) {
    return parse(readRaw(storage, key));
  }
  /** @returns {boolean} true si l'écriture a réussi */
  function writeRaw(storage, key, raw) {
    try { storage.setItem(key, raw); return true; } catch (e) { return false; /* mode mémoire seule */ }
  }
  function write(storage, key, value) {
    return writeRaw(storage, key, JSON.stringify(value));
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

  /** Un état relu du stockage n'est utilisé que s'il a la bonne forme. */
  function isValidState(s) {
    return !!s && typeof s === 'object' && !!s.user && typeof s.user === 'object' &&
      Array.isArray(s.missions) && Array.isArray(s.participations) && Array.isArray(s.vouchers);
  }

  /**
   * Au chargement : un justificatif « en attente » dont la photo n'a pas pu
   * être enregistrée (stockage plein) est perdu → le touriste doit le renvoyer.
   */
  function repair(s) {
    s.participations.forEach((p) => {
      if (p.status === 'preuve' && (!p.proof || !p.proof.image)) {
        p.status = 'inscrite';
        delete p.proof;
      }
    });
    return s;
  }

  // Dernière version du stockage connue de cet onglet (lue ou écrite par lui).
  // Si le stockage contient autre chose, c'est qu'un autre onglet a écrit.
  let lastRaw = null;

  let state = (function () {
    const ls = storage('localStorage');
    lastRaw = readRaw(ls, KEY);
    const saved = parse(lastRaw);
    try { OLD_KEYS.forEach((k) => ls.removeItem(k)); } catch (e) { /* rien */ }
    return isValidState(saved) ? repair(saved) : seed();
  })();

  function notify() {
    listeners.forEach((fn) => { try { fn(state); } catch (e) { /* une vue ne doit pas bloquer les autres */ } });
  }

  /**
   * Plusieurs onglets (ex. démo touriste + pro sur le même ordinateur) :
   * reprend l'état enregistré par un autre onglet, pour ne jamais valider ni
   * consommer à partir d'un état périmé, ni écraser ce que l'autre a écrit.
   * @returns {boolean} true si l'état a changé
   */
  function sync() {
    const raw = readRaw(storage('localStorage'), KEY);
    if (raw == null || raw === lastRaw) return false;
    lastRaw = raw;
    const s = parse(raw);
    if (!isValidState(s)) return false;
    state = repair(s);
    return true;
  }
  /** Avant chaque modification : repart du dernier état enregistré. */
  function refresh() {
    if (sync()) notify();
  }
  // Écriture d'un autre onglet : les vues se redessinent avec le nouvel état.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) refresh();
  });

  // Au-delà de cette taille, une photo de justificatif est sacrifiée si le
  // stockage est plein (les données légères, elles, restent enregistrées).
  const HEAVY_IMAGE = 16 * 1024;

  /** Retire les grosses photos des participations retenues par `which`. */
  function stripImages(s, which) {
    s.participations.forEach((p) => {
      if (which(p) && p.proof && typeof p.proof.image === 'string' && p.proof.image.length > HEAVY_IMAGE) p.proof.image = null;
    });
  }

  /**
   * Enregistre l'état puis prévient les vues. Ne lève jamais d'exception :
   * si localStorage est plein, l'état complet reste en mémoire (session en
   * cours) et on enregistre une version allégée, en deux temps :
   * 1. sans les photos qui ne s'affichent plus (justificatifs déjà traités) ;
   * 2. sinon, sans aucune grosse photo (le justificatif en attente devra être
   *    renvoyé après un rechargement).
   * `persisted` vaut false dès que la photo en attente n'a pas pu être gardée,
   * ou si rien n'a pu être écrit.
   */
  function commit() {
    const ls = storage('localStorage');
    const full = JSON.stringify(state);
    persisted = !!ls && writeRaw(ls, KEY, full);
    if (persisted) {
      lastRaw = full;
    } else if (ls) {
      const light = JSON.parse(full);
      stripImages(light, (p) => p.status !== 'preuve');
      let raw = JSON.stringify(light);
      if (raw !== full && writeRaw(ls, KEY, raw)) {
        persisted = true; // seules des photos invisibles ont été retirées
        lastRaw = raw;
      } else {
        stripImages(light, () => true);
        raw = JSON.stringify(light);
        if (writeRaw(ls, KEY, raw)) lastRaw = raw; // données légères sauvées, photo en attente perdue
      }
    }
    notify();
    return persisted;
  }

  // --- Utilitaires ---------------------------------------------------------
  /** Date du jour (heure locale) au format AAAA-MM-JJ. */
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  /**
   * Code lisible type MLZ-P-K7Q2 (participation) ou MLZ-B-K7Q2 (bon),
   * sans 0/O/1/I pour éviter les confusions, unique parmi tous les codes.
   */
  function makeCode(kind) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const taken = (c) => state.participations.some((p) => p.code === c) || state.vouchers.some((v) => v.code === c);
    let code;
    do {
      code = 'MLZ-' + kind + '-';
      for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    } while (taken(code));
    return code;
  }

  const getMission = (id) => state.missions.find((m) => m.id === id);
  const getParticipation = (id) => state.participations.find((p) => p.id === id);
  const proofOf = (m) => (m && m.proof === 'photo' ? 'photo' : 'qr');

  // --- API publique ----------------------------------------------------------
  return {
    get state() { return state; },
    /** false si la dernière écriture complète dans localStorage a échoué (stockage plein). */
    get persisted() { return persisted; },
    getMission,

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** Remet les données de démo (utile pour rejouer le parcours). */
    reset() { state = seed(); commit(); },

    // ----- Touriste -----
    /** Participation en cours (non validée) pour cette mission, s'il y en a une. */
    participationFor(missionId) {
      return state.participations.find((p) => p.missionId === missionId && p.status !== 'validee');
    },

    /** Inscription : crée une participation avec son propre code (= son QR). */
    join(missionId) {
      refresh();
      if (!getMission(missionId) || this.participationFor(missionId)) return null;
      const p = { id: uid('p'), missionId, code: makeCode('P'), status: 'inscrite', date: today() };
      state.participations.unshift(p);
      commit();
      return p;
    },

    /** Désinscription (impossible une fois la mission validée). */
    cancel(participationId) {
      refresh();
      const p = getParticipation(participationId);
      if (!p || p.status === 'validee') return false;
      state.participations = state.participations.filter((x) => x !== p);
      commit();
      return true;
    },

    /**
     * Envoi (ou remplacement) du justificatif d'une mission « photo ».
     * @param {string} imageDataUrl  data URL d'image (déjà compressée, voir ui.compressImage)
     * @returns {{ok:true, persisted:boolean} | {ok:false, reason:string}}
     *          persisted=false : stockage plein, la photo n'est gardée que pour cette session.
     */
    submitProof(participationId, imageDataUrl) {
      refresh();
      const p = getParticipation(participationId);
      const m = p && getMission(p.missionId);
      if (!p || !m) return { ok: false, reason: 'Participation introuvable.' };
      if (proofOf(m) !== 'photo') return { ok: false, reason: 'Cette mission se valide avec un QR code.' };
      if (!['inscrite', 'refusee', 'preuve'].includes(p.status)) return { ok: false, reason: 'Cette mission est déjà validée.' };
      if (typeof imageDataUrl !== 'string' || !/^data:image\//i.test(imageDataUrl)) return { ok: false, reason: 'Ce fichier n’est pas une image.' };
      p.status = 'preuve';
      p.proof = { image: imageDataUrl, sentAt: today(), ts: Date.now() };
      delete p.refusedAt;
      delete p.refusedReason;
      return { ok: true, persisted: commit() };
    },

    // ----- Pro -----
    /**
     * Validation par un pro → émission d'un bon de récompense.
     * Mission QR : participation `inscrite` ; mission photo : justificatif `preuve`.
     * Renvoie null sinon (empêche notamment la double validation).
     */
    validate(participationId) {
      refresh();
      const p = getParticipation(participationId);
      const m = p && getMission(p.missionId);
      if (!p || !m) return null;
      const proof = proofOf(m);
      const allowed = (proof === 'qr' && p.status === 'inscrite') || (proof === 'photo' && p.status === 'preuve');
      if (!allowed) return null;
      p.status = 'validee';
      p.validatedAt = today();
      // La photo ne s'affiche plus nulle part : on ne garde que sa date d'envoi
      // (sinon chaque justificatif validé alourdit le stockage).
      if (p.proof) p.proof.image = null;
      const reward = m.reward || {};
      const voucher = {
        id: uid('v'),
        code: makeCode('B'),
        missionId: m.id,
        title: reward.title,
        partner: reward.partner,
        status: 'actif',
        issuedAt: today(),
        usedAt: null,
      };
      state.vouchers.unshift(voucher);
      commit();
      return voucher;
    },

    /** Refus d'un justificatif photo en attente : le touriste pourra en renvoyer un. */
    refuse(participationId, reason) {
      refresh();
      const p = getParticipation(participationId);
      const m = p && getMission(p.missionId);
      if (!p || !m || proofOf(m) !== 'photo' || p.status !== 'preuve') return null;
      p.status = 'refusee';
      p.refusedAt = today();
      if (p.proof) p.proof.image = null; // un nouveau justificatif sera envoyé
      p.refusedReason = String(reason || '').trim() || 'Justificatif illisible ou non conforme';
      commit();
      return p;
    },

    /** Consommation d'un bon : irréversible, pour éviter la double utilisation. */
    consume(voucherId) {
      refresh();
      const v = state.vouchers.find((x) => x.id === voucherId);
      if (!v || v.status !== 'actif') return null;
      v.status = 'consomme';
      v.usedAt = today();
      commit();
      return v;
    },

    /** Création d'une mission par un pro : publiée immédiatement. */
    addMission(input) {
      refresh();
      const mission = Object.assign({ id: uid('m'), isNew: true, createdAt: today() }, input);
      mission.proof = proofOf(mission);
      mission.duration = Math.max(0, Number(mission.duration) || 0);
      state.missions.unshift(mission);
      commit();
      return mission;
    },

    /** Justificatifs photo en attente de vérification, les plus récents d'abord. */
    pendingProofs() {
      return state.participations
        .filter((p) => p.status === 'preuve')
        .map((p) => ({ participation: p, mission: getMission(p.missionId) }))
        .filter((x) => x.mission)
        .sort((a, b) => {
          const pa = a.participation.proof || {}, pb = b.participation.proof || {};
          return String(pb.sentAt || '').localeCompare(String(pa.sentAt || '')) || (pb.ts || 0) - (pa.ts || 0);
        });
    },

    /**
     * Interprète un code scanné ou saisi.
     * @returns {{kind:'participation', participation, mission, user} | {kind:'voucher', voucher} | {kind:'unknown', code}}
     */
    lookup(raw) {
      const code = String(raw || '').trim().toUpperCase();
      const participation = code && state.participations.find((p) => p.code === code);
      const mission = participation && getMission(participation.missionId);
      if (participation && mission) return { kind: 'participation', participation, mission, user: state.user };
      const voucher = code && state.vouchers.find((v) => v.code === code);
      if (voucher) return { kind: 'voucher', voucher };
      return { kind: 'unknown', code };
    },

    // ----- Session pro (sessionStorage : expire à la fermeture de l'onglet) -----
    // `memPro` sert de repli si le stockage du navigateur est indisponible.
    get pro() { return read(storage('sessionStorage'), SESSION_KEY) || memPro; },
    login(profile) { memPro = profile; write(storage('sessionStorage'), SESSION_KEY, profile); },
    logout() { memPro = null; try { storage('sessionStorage').removeItem(SESSION_KEY); } catch (e) { /* rien */ } },
  };
})();
