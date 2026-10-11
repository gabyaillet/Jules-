/**
 * Mélèze — configuration Tailwind
 *
 * Style "CopenPay" : fond blanc, typographie grasse noire, touches de vert
 * lime vif et une couleur pastel par type de mission. Les couleurs
 * sémantiques (surface, ink, brand…) pointent vers des variables CSS
 * (src/input.css) : un seul jeu de classes sert aux thèmes clair et sombre.
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
        sunk: v('sunk'), // gris très clair (sections, champs)
        tint: v('tint'), // vert lime très clair (encadrés "récompense")
        ink: v('ink'), // texte principal (quasi noir)
        muted: v('muted'), // texte secondaire
        line: v('line'), // bordures
        brand: v('brand'), // boutons principaux (noir)
        'on-brand': v('on-brand'),
        'brand-ink': v('brand-ink'), // vert lisible en texte (liens)
        ok: v('ok'),
        danger: v('danger'),

        // Palette vive (fixe, quel que soit le thème)
        lime: { 200: '#E4FBB8', 300: '#D2F58E', 400: '#BFEF5F' }, // surlignage, accents
        pine: { 600: '#1F8A50', 700: '#16703F', 900: '#0F2A1B' }, // vert montagne
        // Une couleur pastel par type de mission
        sun: '#FFE2A6', // vie du village
        leaf: '#D6F2B5', // sentiers & nature
        sky: '#CDE6FF', // mobilité douce
        coral: '#FFD3C7', // alertes (refus, bon déjà utilisé)
        lilac: '#E6DCFF', // patrimoine
        night: '#121614', // noir doux
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
