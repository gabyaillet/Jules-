/* ==========================================================================
   Mélèze — données de démonstration (mock data)
   Tout est fictif sauf les lieux de Pralognan-la-Vanoise, cités pour le réalisme.
   Ces données ne servent qu'au premier lancement : ensuite l'état vit dans
   localStorage (voir store.js) et peut être réinitialisé depuis le wallet.
   ========================================================================== */
window.Meleze = window.Meleze || {};

Meleze.data = (function () {
  'use strict';

  const SEASONS = [
    { id: 'printemps', label: 'Printemps' },
    { id: 'ete', label: 'Été' },
    { id: 'automne', label: 'Automne' },
    { id: 'hiver', label: 'Hiver' },
  ];

  /** `color` : fond pastel associé au type (cartes, étiquettes, bons). */
  const TYPES = [
    { id: 'mobilite', label: 'Mobilité douce', color: 'bg-sky' },
    { id: 'village', label: 'Vie du village', color: 'bg-sun' },
    { id: 'nature', label: 'Sentiers & nature', color: 'bg-leaf' },
  ];

  /**
   * Façons de valider une mission :
   * - `qr`    → le référent scanne le QR de la participation, sur place ;
   * - `photo` → le touriste envoie un justificatif, vérifié par un pro.
   */
  const PROOFS = [
    { id: 'qr', label: 'QR code scanné sur place' },
    { id: 'photo', label: 'Justificatif photo' },
  ];

  /**
   * Catalogue initial des missions. `reward` est obligatoire.
   * `duration` en minutes (0 = variable : on affiche alors `durationLabel`).
   */
  const missions = [
    {
      id: 'm-transport',
      photo: 'valley',
      title: 'Venir en transport en commun ou en covoiturage',
      type: 'mobilite',
      proof: 'photo',
      seasons: ['printemps', 'ete', 'automne', 'hiver'],
      duration: 0,
      durationLabel: 'Le temps du trajet',
      location: 'Votre trajet jusqu’à Pralognan',
      schedule: 'Justificatif à envoyer dans les 48\u00a0h après votre arrivée',
      spots: null,
      host: 'Office de tourisme',
      description:
        'Train jusqu’à Moûtiers puis car, ou covoiturage : laissez la voiture individuelle au garage. Depuis votre espace, envoyez une photo de votre billet de train ou de car, de votre réservation de covoiturage, ou une photo de vous à deux (ou plus) dans la voiture.',
      reward: { title: 'Entrée patinoire + location de patins', partner: 'Patinoire de Pralognan', category: 'Expérience' },
    },
    {
      id: 'm-marche',
      photo: 'sunbeam',
      title: 'Aider à monter le marché du village',
      type: 'village',
      proof: 'qr',
      seasons: ['ete', 'hiver'],
      duration: 90,
      location: 'Place du village',
      schedule: 'Jour de marché · 7h00',
      spots: 6,
      host: 'Les commerçants du marché',
      description:
        'Avec les commerçants, on monte les tentes, on installe les tables et les stands avant l’arrivée des visiteurs. Aucune expérience demandée, juste de l’énergie le matin.',
      reward: { title: 'Morceau de Beaufort d’alpage (250\u00a0g)', partner: 'Fromagerie du Grand Marchet', category: 'Produit local' },
    },
    {
      id: 'm-sentiers',
      photo: 'lake',
      title: 'Nettoyer les sentiers avec les gardes du Parc',
      type: 'nature',
      proof: 'qr',
      seasons: ['printemps', 'ete', 'automne'],
      duration: 120,
      location: 'Parking des Fontanettes',
      schedule: 'Mardi et jeudi · 9h00',
      spots: 12,
      host: 'Gardes du Parc national de la Vanoise',
      description:
        'Avec les gardes du Parc national, on ramasse les déchets, on dégage les branches tombées et on remet en place les marches de pierre. Gants et sacs fournis, prévoyez de bonnes chaussures.',
      reward: { title: 'Aller-retour au téléphérique du Mont Bochor', partner: 'Téléphérique du Mont Bochor', category: 'Expérience' },
    },
  ];

  /** Le touriste de démonstration (plus de QR personnel : un QR par mission). */
  const user = { firstName: 'Camille', since: '2026-10-04' };

  /**
   * Justificatif de démonstration : un billet de train générique dessiné en
   * SVG (aucun logo ni marque réelle), encodé en data URL comme une photo envoyée.
   */
  const DEMO_TICKET = (function () {
    const bars = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1]
      .reduce((acc, w, i) => {
        if (i % 2 === 0) acc.d += 'M' + acc.x + ' 300h' + w * 3 + 'v56h-' + w * 3 + 'z';
        acc.x += w * 3 + 3;
        return acc;
      }, { x: 40, d: '' }).d;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400">' +
      '<rect width="640" height="400" fill="#E9ECE8"/>' +
      '<rect x="20" y="20" width="600" height="360" fill="#FFFFFF" stroke="#C9CFC9" stroke-width="2"/>' +
      '<rect x="20" y="20" width="600" height="64" fill="#121614"/>' +
      '<g font-family="Helvetica, Arial, sans-serif" fill="#121614">' +
      '<text x="40" y="61" font-size="26" font-weight="700" fill="#FFFFFF">Billet de train</text>' +
      '<text x="600" y="61" font-size="18" text-anchor="end" fill="#BFEF5F">2de classe</text>' +
      '<text x="40" y="132" font-size="16" fill="#5B635D">Trajet</text>' +
      '<text x="40" y="168" font-size="30" font-weight="700">Moûtiers → Pralognan (car)</text>' +
      '<text x="40" y="214" font-size="16" fill="#5B635D">Date</text>' +
      '<text x="40" y="242" font-size="22" font-weight="700">04/10/2026 · 10h12</text>' +
      '<text x="330" y="214" font-size="16" fill="#5B635D">Voyageur</text>' +
      '<text x="330" y="242" font-size="22" font-weight="700">1 adulte</text>' +
      '<text x="600" y="342" font-size="14" text-anchor="end" fill="#5B635D">Réf. DEMO-48271</text>' +
      '</g>' +
      '<path fill="#121614" d="' + bars + '"/>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  })();

  /**
   * Participations : chacune a son propre code (et donc son propre QR).
   * - `inscrite` → le touriste s'est inscrit (mission QR : il montre le QR au référent)
   * - `preuve`   → justificatif photo envoyé, en attente de vérification par un pro
   * - `refusee`  → justificatif refusé : le touriste peut en renvoyer un
   * - `validee`  → un pro a validé, un bon a été émis
   */
  const participations = [
    { id: 'p1', missionId: 'm-sentiers', code: 'MLZ-P-S7K4', status: 'inscrite', date: '2026-10-09' },
    {
      id: 'p2',
      missionId: 'm-transport',
      code: 'MLZ-P-T3R8',
      status: 'preuve',
      date: '2026-10-04',
      proof: { image: DEMO_TICKET, sentAt: '2026-10-04' },
    },
    { id: 'p0', missionId: 'm-marche', code: 'MLZ-P-M2C9', status: 'validee', date: '2026-10-03', validatedAt: '2026-10-03' },
  ];

  /** Bons de récompense : `actif` ou `consomme`. */
  const vouchers = [
    {
      id: 'v1',
      code: 'MLZ-B-PT42',
      missionId: 'm-marche',
      title: 'Morceau de Beaufort d’alpage (250\u00a0g)',
      partner: 'Fromagerie du Grand Marchet',
      status: 'actif',
      issuedAt: '2026-10-03',
      usedAt: null,
    },
    {
      id: 'v0',
      code: 'MLZ-B-SF19',
      missionId: 'm-sentiers',
      title: 'Aller-retour au téléphérique du Mont Bochor',
      partner: 'Téléphérique du Mont Bochor',
      status: 'consomme',
      issuedAt: '2026-08-14',
      usedAt: '2026-08-15',
    },
  ];

  /** Identifiants de démonstration de l'espace pro. */
  const proDemo = { email: 'pro@meleze.demo', pin: '1234' };

  return { SEASONS, TYPES, PROOFS, missions, user, participations, vouchers, proDemo };
})();
