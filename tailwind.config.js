/**
 * Mélèze — configuration Tailwind
 *
 * Palette "sauge & lin" : vert sauge clair, beiges naturels, olive foncé
 * pour le texte. Les couleurs sémantiques (surface, ink, brand…) pointent
 * vers des variables CSS (src/input.css) : un seul jeu de classes sert au
 * thème clair et au thème sombre.
 */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // Jetons sémantiques (suivent le thème)
        surface: v('surface'), // fond de page (lin)
        card: v('card'), // cartes
        sunk: v('sunk'), // zones en creux
        tint: v('tint'), // fond sauge très clair (sections, encadrés)
        ink: v('ink'), // texte principal
        muted: v('muted'), // texte secondaire
        line: v('line'), // bordures
        brand: v('brand'), // action principale (vert sauge soutenu)
        'on-brand': v('on-brand'),
        'brand-ink': v('brand-ink'), // vert lisible en texte
        ok: v('ok'),
        danger: v('danger'),

        // Palette brute (fixe, quel que soit le thème)
        sand: { 50: '#FAF7F1', 100: '#F3EEE4', 200: '#EAE2D3', 300: '#DDD1BB', 400: '#C9B897' },
        sage: { 100: '#E5EADC', 200: '#D2DBC4', 300: '#B7C4A5', 400: '#9AAB88', 500: '#7F9370', 600: '#5F7A53', 700: '#4B6142' },
        olive: { 700: '#46543F', 800: '#38432F', 900: '#2B3427', 950: '#1D231A' },
      },
      fontFamily: {
        // Polices auto-hébergées (fonts/), repli système.
        serif: ['Newsreader', 'Georgia', 'ui-serif', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      maxWidth: { app: '70rem' },
    },
  },
  plugins: [],
};
