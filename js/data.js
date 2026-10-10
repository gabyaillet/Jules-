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

  const TYPES = [
    { id: 'sentiers', label: 'Sentiers', icon: 'route' },
    { id: 'biodiversite', label: 'Biodiversité', icon: 'leaf' },
    { id: 'mobilite', label: 'Mobilité douce', icon: 'train' },
    { id: 'proprete', label: 'Propreté', icon: 'trash' },
    { id: 'patrimoine', label: 'Patrimoine & entraide', icon: 'heart' },
  ];

  /** Catalogue initial des missions. `reward` est obligatoire. */
  const missions = [
    {
      id: 'm1',
      photo: 'lake',
      title: 'Débroussailler le sentier du Lac des Vaches',
      type: 'sentiers',
      seasons: ['ete', 'automne'],
      duration: 120,
      location: 'Parking des Fontanettes',
      schedule: 'Mardi & jeudi · 9h00',
      spots: 12,
      host: 'Service sentiers de la commune',
      description:
        "Avec l'équipe des sentiers, on dégage la végétation et on remet en place les marches de pierre avant l'arrivée des randonneurs. Gants et outils fournis, prévoir de bonnes chaussures.",
      reward: { title: 'Aller-retour au téléphérique du Mont Bochor', partner: 'Téléphérique du Mont Bochor', category: 'Expérience' },
    },
    {
      id: 'm2',
      photo: 'meadow',
      title: 'Compter les marmottes aux Prioux',
      type: 'biodiversite',
      seasons: ['printemps', 'ete'],
      duration: 90,
      location: 'Hameau des Prioux',
      schedule: 'Tous les matins · 7h30',
      spots: 8,
      host: 'Garde-moniteur du Parc national',
      description:
        "Jumelles en main, vous participez au suivi scientifique des terriers avec un garde du Parc national de la Vanoise. Silence et patience : les marmottes sortent tôt !",
      reward: { title: 'Morceau de Beaufort d’alpage (250 g)', partner: 'Fromagerie du Grand Marchet', category: 'Produit local' },
    },
    {
      id: 'm3',
      photo: 'range',
      title: 'Venir en train jusqu’à la station',
      type: 'mobilite',
      seasons: ['printemps', 'ete', 'automne', 'hiver'],
      duration: 60,
      location: 'Gare de Moûtiers → Office de tourisme',
      schedule: 'À votre arrivée',
      spots: 200,
      host: 'Office de tourisme',
      description:
        "Vous avez choisi le train puis la navette ? Présentez votre billet à l'Office de tourisme dans les 48 h suivant votre arrivée : la montagne vous dit merci.",
      reward: { title: 'Entrée patinoire + location de patins', partner: 'Patinoire olympique de Pralognan', category: 'Expérience' },
    },
    {
      id: 'm4',
      photo: 'sunbeam',
      title: 'Ramasser les déchets à la fonte des neiges',
      type: 'proprete',
      seasons: ['printemps'],
      duration: 90,
      location: 'Sommet du Mont Bochor',
      schedule: 'Samedi · 10h00',
      spots: 20,
      host: 'Association Vanoise Propre',
      description:
        "La neige fond et révèle ce que l'hiver a caché. Sacs, pinces et gants fournis ; la montée en téléphérique est offerte aux participants.",
      reward: { title: 'Crêpe + chocolat chaud', partner: 'Buvette du Bochor', category: 'Gourmandise' },
    },
    {
      id: 'm5',
      photo: 'stars',
      title: 'Relever les traces de faune dans la neige',
      type: 'biodiversite',
      seasons: ['hiver'],
      duration: 120,
      location: 'Bois de la Glière',
      schedule: 'Mercredi · 9h30',
      spots: 10,
      host: 'Guides du Grand Marchet',
      description:
        "En raquettes, apprenez à reconnaître les empreintes de lièvre variable, de renard ou de tétras-lyre, et notez-les sur la fiche d'inventaire du Parc.",
      reward: { title: 'Sortie raquettes à la lanterne (1 place)', partner: 'Guides du Grand Marchet', category: 'Expérience' },
    },
    {
      id: 'm6',
      photo: 'peak',
      title: 'Damer le chemin piéton des Granges',
      type: 'sentiers',
      seasons: ['hiver'],
      duration: 60,
      location: 'Chemin des Granges',
      schedule: 'Après chaque chute de neige',
      spots: 6,
      host: 'Service sentiers de la commune',
      description:
        "Raquettes aux pieds, on tasse la neige fraîche pour rendre le chemin praticable aux familles et aux poussettes. Bonne ambiance garantie.",
      reward: { title: 'Demi-journée de location de skis de fond', partner: 'Vanoise Sports', category: 'Équipement' },
    },
    {
      id: 'm7',
      photo: 'forest',
      title: 'Inventorier les mélèzes remarquables',
      type: 'biodiversite',
      seasons: ['automne'],
      duration: 90,
      location: 'Forêt des Fontanettes',
      schedule: 'Vendredi · 14h00',
      spots: 10,
      host: 'Office national des forêts',
      description:
        "Quand les mélèzes virent à l'or, on mesure, photographie et géolocalise les plus beaux sujets pour l'atlas forestier de la commune.",
      reward: { title: 'Pot de miel de montagne', partner: 'Rucher du Petit Mont Blanc', category: 'Produit local' },
    },
    {
      id: 'm8',
      photo: 'valley',
      title: 'Restaurer un muret en pierre sèche',
      type: 'patrimoine',
      seasons: ['ete', 'automne'],
      duration: 120,
      location: 'Hameau des Granges',
      schedule: 'Samedi · 9h00',
      spots: 8,
      host: 'Association Patrimoine de Pralognan',
      description:
        "Un artisan murailler vous transmet les gestes d'un savoir-faire ancestral. Travail en petit groupe, adapté aux débutants.",
      reward: { title: 'Une tartiflette offerte', partner: 'Restaurant La Grange', category: 'Gourmandise' },
    },
  ];

  /** Le touriste de démonstration. */
  const user = { firstName: 'Camille', code: 'MLZ-U-7F3K', since: '2026-10-04' };

  /**
   * Participations (missions en cours) :
   * - `inscrite`  → le touriste s'est inscrit
   * - `terminee`  → il a déclaré avoir fini, attend la validation d'un pro
   * - `validee`   → un pro a validé, un bon a été émis
   */
  const participations = [
    { id: 'p1', missionId: 'm1', status: 'terminee', date: '2026-10-09' },
    { id: 'p2', missionId: 'm7', status: 'inscrite', date: '2026-10-11' },
    { id: 'p0', missionId: 'm3', status: 'validee', date: '2026-10-04' },
  ];

  /** Bons de récompense : `actif` ou `consomme`. */
  const vouchers = [
    {
      id: 'v1',
      code: 'MLZ-B-PT42',
      missionId: 'm3',
      title: 'Entrée patinoire + location de patins',
      partner: 'Patinoire olympique de Pralognan',
      status: 'actif',
      issuedAt: '2026-10-04',
      usedAt: null,
    },
    {
      id: 'v0',
      code: 'MLZ-B-SF19',
      missionId: 'm6',
      title: 'Demi-journée de location de skis de fond',
      partner: 'Vanoise Sports',
      status: 'consomme',
      issuedAt: '2026-02-14',
      usedAt: '2026-02-15',
    },
  ];

  /** Identifiants de démonstration de l'espace pro. */
  const proDemo = { email: 'pro@meleze.demo', pin: '1234' };

  return { SEASONS, TYPES, missions, user, participations, vouchers, proDemo };
})();
