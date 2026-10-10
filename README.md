# Mélèze — V1

> « Une heure pour la montagne, une expérience en retour. »
> Application web éco-conçue (PWA, mobile first) pour **Pralognan-la-Vanoise**, inspirée de CopenPay.

Les touristes réalisent des missions utiles de 1 à 2 h (sentiers, comptages naturalistes, arrivée en train…).
En échange, les commerçants leur offrent une expérience ou un produit local (téléphérique, patinoire, Beaufort…).

## Lancer l'application

Pas de build requis pour tester : le CSS compilé est déjà dans `dist/`.

- **Le plus simple** : double-cliquer sur `index.html` (fonctionne en `file://`, sans le mode hors-ligne).
- **Mode PWA complet** (service worker, installation sur l'écran d'accueil) :
  ```bash
  python3 -m http.server 5173   # ou : npm run serve
  # → http://localhost:5173
  ```

## Parcours de test

| Rôle | Étapes |
|---|---|
| **Touriste** | Accueil → *Voir les missions* → filtrer (Saison / Type) → *Je participe* → **Mon espace** → *J’ai terminé* |
| **Pro** | Pied de page → lien discret **Espace partenaires** → `pro@meleze.demo` / PIN **`1234`** |
| **Scanner** | Puce *QR de Camille* → **Valider la mission** (le bon apparaît dans « Mon espace ») · Puce *Bon PT42* → **Consommer le bon** (il est grisé, impossible de le réutiliser) · un code inconnu affiche une erreur |
| **Création** | Onglet *Créer une mission* → mission + **contrepartie obligatoire** → *Publier* → visible aussitôt dans le catalogue avec le badge « Nouveau » |

Les données de démonstration sont stockées dans `localStorage`. Pour repartir de zéro, utilisez le lien
*Réinitialiser les données de démo* en bas de « Mon espace ».

## Architecture

```
Jules-/
├── index.html            Coquille : en-tête, <main id="app">, pied de page, barre d'onglets mobile
├── src/input.css         Source Tailwind + jetons de couleur (thèmes clair / sombre) + composants
├── dist/styles.css       CSS compilé et purgé (≈ 35 ko, ≈ 7 ko gzip)
├── fonts/                Bricolage Grotesque + Source Sans 3 (woff2 latin, auto-hébergées, licence OFL)
├── tailwind.config.js    Palette Mélèze (blanc, noir, lime, pastels par type de mission)
├── js/
│   ├── data.js           Données de démonstration (missions, touriste, bons, identifiants pro)
│   ├── photos.js         Photothèque (Unsplash ou fichiers locaux) — à remplacer par vos photos
│   ├── store.js          État + persistance + règles métier (inscrire, valider, consommer, créer)
│   ├── ui.js             Icônes SVG, photos responsives, QR simulé, toasts, formatage
│   ├── views/            home · catalogue · wallet · pro  → render() + actions + forms
│   └── app.js            Routeur par hash, délégation d'événements, thème, service worker
├── sw.js                 Cache hors-ligne (couverture réseau aléatoire en altitude)
└── manifest.webmanifest  Installation PWA
```

- **JavaScript natif, sans framework** : les vues sont des fonctions `render(state) → HTML`, un seul écouteur
  `click` et un seul `submit` pour toute l'app (attributs `data-action` / `data-form`).
- **Scripts classiques** (pas de modules ES) pour que l'app s'ouvre sans serveur.
- Toutes les saisies des pros passent par `ui.esc()` avant affichage (pas d'injection HTML).
- Pour brancher une vraie API en V2, il suffit de réécrire `store.js` en gardant les mêmes fonctions.

## Photos

Les photos sont des paysages de montagne **Unsplash** (licence Unsplash : gratuite, usage commercial
autorisé), chargées depuis `images.unsplash.com` au bon format (AVIF/WebP) et à la bonne taille.

**Pour utiliser de vraies photos de Pralognan** (Office de tourisme, photographe local…) :
1. déposez-les dans un dossier `img/` (idéalement en `.webp`, 1600 px de large, < 250 ko) ;
2. dans `js/photos.js`, remplacez l'identifiant par le chemin : `lake: { src: 'img/lac-des-vaches.webp', alt: '…' }`.

Chaque mission choisit sa photo via le champ `photo` dans `js/data.js` (sinon une photo par type).
Si une photo ne charge pas (hors-ligne, lien mort), un fond vert pastel prend le relais.

## Choix d'éco-conception (Green IT)

- **0 framework, 0 traqueur, 0 dépendance JS** ; icônes en SVG inline.
- Photos **compressées (q=60, AVIF/WebP)**, **responsives** (`srcset`) et **chargées à la demande**
  (`loading="lazy"`) : seule la photo d'accueil est chargée d'emblée. Elles sont ensuite gardées en cache par le service worker.
- 2 polices variables **auto-hébergées**, sous-ensemble latin uniquement (~70 ko au total, mises en cache).
- CSS Tailwind **compilé et purgé** (pas de CDN Tailwind de ~300 ko exécuté sur le téléphone).
- **Fond blanc** pour tout le monde (choix de design, à la manière de CopenPay). Sur écran OLED, le blanc consomme plus
  qu'un fond sombre : un **mode sombre** quasi noir reste disponible via le bouton de l'en-tête (choix mémorisé).
- Contrastes élevés et boutons ≥ 48 px : lisible **en plein soleil, avec des gants**.
- Quasiment aucune animation (seule la ligne du scanner bouge) ; `prefers-reduced-motion` respecté.
- Service worker « réseau d'abord » : on voit toujours la dernière version, et l'app reste utilisable **hors-ligne** après la première visite.

## Direction artistique

Inspirée de **CopenPay** (Copenhague) : fond blanc, grands titres gras en noir, un mot clé surligné
en vert lime comme au feutre, blocs de couleurs pastel, photos en grille « bento », quelques
étiquettes inclinées façon autocollant, boutons pilule noirs.

Règles de sobriété :
- **Pas d'icônes décoratives** : la typographie porte l'information (seules restent la flèche des
  boutons principaux, le « + » des accordéons et le bouton clair/sombre).
- **Arrondis dosés** : pilules pour les boutons, filtres et étiquettes ; arrondi léger (12 px) pour
  les photos, cartes et tuiles ; les grands blocs pleine largeur, la FAQ et la barre d'onglets restent droits.

| Rôle | Couleur |
|---|---|
| Fond | `#FFFFFF` · gris très clair `#F5F5F1` |
| Texte / boutons | `#121614` (noir doux) · secondaire `#5A605C` |
| Vert lime (surlignage, accents) | `#D2F58E` / `#BFEF5F` |
| Vert montagne (grand bloc, liens) | `#16703F` / `#1F8A50` |
| Sentiers | `#FFE2A6` (or) |
| Biodiversité | `#D6F2B5` (vert tendre) |
| Mobilité douce | `#CDE6FF` (bleu ciel) |
| Propreté | `#FFD3C7` (corail) |
| Patrimoine & entraide | `#E6DCFF` (lilas) |

Typographies : **Bricolage Grotesque** (titres, grotesque grasse et expressive) et **Source Sans 3** (texte, très lisible au soleil).

## Modifier les styles

```bash
npm install
npm run dev     # recompile dist/styles.css à chaque modification
npm run build   # version minifiée avant mise en ligne
```

## Limites connues de la V1

- Le **QR code est simulé** : le motif est unique par code, mais une caméra ne peut pas le lire.
  En V2 : un encodeur QR (ex. `qrcode-generator`) et un vrai scan caméra (`BarcodeDetector` / `getUserMedia`).
- **Photos génériques** : ce sont des paysages alpins, pas Pralognan ; à remplacer (voir *Photos*).
- **Connexion pro simulée** : pas de comptes réels. Les données restent dans le navigateur, sans synchronisation entre appareils.
