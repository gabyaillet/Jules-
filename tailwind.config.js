/**
 * Mélèze — configuration Tailwind
 *
 * Concept A « Typo-photo » : base blanche, typographie grasse quasi noire,
 * gris neutres et UNE seule couleur d'accent saturée (vert forêt #0E5A3A).
 * Aucune couleur pastel. Les couleurs sémantiques (surface, ink, accent…)
 * pointent vers des variables CSS (src/input.css) : un seul jeu de classes
 * sert aux thèmes clair et sombre.
 */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // Jetons sémantiques (suivent le thème)
        surface: v('surface'), // fond de page (blanc)
        card: v('card'), // cartes
        sunk: v('sunk'), // gris neutre très clair (champs, encadrés)
        ink: v('ink'), // texte principal (quasi noir)
        muted: v('muted'), // texte secondaire (gris)
        line: v('line'), // bordures
        brand: v('brand'), // boutons principaux (vert forêt)
        'on-brand': v('on-brand'),
        'brand-ink': v('brand-ink'), // vert lisible en texte (liens, accents)
        accent: v('accent'), // l'accent unique
        ok: v('ok'),
        danger: v('danger'),

        // Couleurs fixes, quel que soit le thème
        forest: '#0E5A3A', // vert forêt : l'unique accent (8,3:1 sur blanc)
        night: '#0F1412', // quasi noir
      },
      fontFamily: {
        // Polices auto-hébergées (fonts/), repli système.
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      maxWidth: { app: '76rem' },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
