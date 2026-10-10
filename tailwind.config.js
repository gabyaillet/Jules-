/**
 * Mélèze — configuration Tailwind
 *
 * Les couleurs "sémantiques" (surface, ink, brand…) pointent vers des
 * variables CSS définies dans src/input.css. Ainsi, un seul jeu de classes
 * sert à la fois au thème clair (fond neige doux, jamais #FFF) et au thème
 * sombre (économe sur les écrans OLED), sans dupliquer les `dark:`.
 */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // Jetons sémantiques (suivent le thème)
        surface: v('surface'), // fond de page
        card: v('card'), // cartes
        sunk: v('sunk'), // zones en creux (champs, pistes)
        ink: v('ink'), // texte principal
        muted: v('muted'), // texte secondaire
        line: v('line'), // bordures
        brand: v('brand'), // action principale
        'on-brand': v('on-brand'),
        accent: v('accent'), // or du mélèze
        'on-accent': v('on-accent'),
        'accent-ink': v('accent-ink'), // or lisible en texte
        ok: v('ok'),
        danger: v('danger'),

        // Palette brute "Mélèze" (fixe, quel que soit le thème)
        fir: { 50: '#EEF2EE', 100: '#DDE6DF', 600: '#2F5E49', 700: '#234A39', 800: '#1B3A2D', 900: '#12261E', 950: '#0B1611' },
        larch: { 100: '#F3E3C0', 300: '#E6C27A', 400: '#D9A441', 500: '#C8892B', 600: '#A86E1C', 700: '#8A5A14' },
        snow: { 50: '#FAF8F3', 100: '#F4F1EA', 200: '#EBE7DD' },
        mineral: { 300: '#C9CBC5', 500: '#7A7F7B', 700: '#4A4F4C' },
      },
      fontFamily: {
        // Polices système uniquement : 0 octet téléchargé.
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', 'ui-serif', 'serif'],
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem' },
      maxWidth: { app: '72rem' },
    },
  },
  plugins: [],
};
