/* ==========================================================================
   Mélèze — référentiels (saisons, types de mission, libellés, limites)
   Les missions, participations et bons viennent du serveur (js/api.js) :
   ce fichier ne contient plus aucune donnée, seulement les listes fixes
   partagées par les vues et les règles de saisie.
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

  /**
   * `color` : pastille du type (sur les photos et en étiquette). Plus de
   * fond pastel : une pastille quasi noire, le type se distingue par son nom
   * et par son numéro (`num`).
   */
  const TYPES = [
    { id: 'mobilite', num: '01', label: 'Mobilité douce', color: 'bg-ink text-surface' },
    { id: 'village', num: '02', label: 'Vie du village', color: 'bg-ink text-surface' },
    { id: 'nature', num: '03', label: 'Sentiers & nature', color: 'bg-ink text-surface' },
  ];

  /** Catégories de contrepartie proposées aux partenaires. */
  const CATEGORIES = ['Expérience', 'Produit local', 'Gourmandise', 'Équipement'];

  /** Durées proposées à la création (minutes). 0 = variable. */
  const DURATIONS = [30, 45, 60, 90, 120, 150, 180];

  /** Nombre d'essais photo par participation (vérifié aussi par le serveur). */
  const MAX_ATTEMPTS = 5;

  /**
   * Limites de saisie d'une mission : les MÊMES que les contraintes SQL
   * (supabase/migrations/0001_init.sql). Le serveur reste juge : ces règles
   * servent seulement à prévenir le partenaire avant l'envoi.
   */
  const LIMITS = {
    title: { min: 3, max: 120 },
    durationMin: { min: 0, max: 600 },
    durationLabel: { max: 60 },
    location: { min: 1, max: 120 },
    schedule: { max: 160 },
    spots: { min: 1, max: 500 },
    description: { min: 1, max: 1500 },
    photoHint: { min: 5, max: 300 },
    rewardTitle: { min: 1, max: 120 },
    rewardPartner: { min: 1, max: 80 },
    rewardCategory: { min: 1, max: 40 },
  };

  return { SEASONS, TYPES, CATEGORIES, DURATIONS, MAX_ATTEMPTS, LIMITS };
})();
