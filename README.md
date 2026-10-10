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
| **Touriste** | Accueil → *Découvrir les missions* → filtrer (Saison / Type) → *Je participe* → **Wallet** → *J'ai terminé ma mission* |
| **Pro** | Pied de page → lien discret **Espace partenaires** → `pro@meleze.demo` / PIN **`1234`** |
| **Scanner** | Puce *QR de Camille* → **Valider la mission** (le bon apparaît dans le wallet) · Puce *Bon PT42* → **Consommer le bon** (il est grisé, impossible de le réutiliser) · un code inconnu affiche une erreur |
| **Création** | Onglet *Créer une mission* → mission + **contrepartie obligatoire** → *Publier* → visible aussitôt dans le catalogue avec le badge « Nouveau » |

Les données de démonstration sont stockées dans `localStorage`. Pour repartir de zéro, utilisez le lien
*Réinitialiser les données de démo* en bas du wallet.

## Architecture

```
Jules-/
├── index.html            Coquille : en-tête, <main id="app">, pied de page, barre d'onglets mobile
├── src/input.css         Source Tailwind + jetons de couleur (thèmes clair / sombre) + composants
├── dist/styles.css       CSS compilé et purgé (≈ 43 ko, ≈ 8 ko gzip)
├── fonts/                Instrument Serif + Inter (woff2 latin, auto-hébergées, licence OFL)
├── tailwind.config.js    Palette Mélèze (sapin, or du mélèze, neige, minéral)
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
Si une photo ne charge pas (hors-ligne, lien mort), un dégradé vert sapin prend le relais.

## Choix d'éco-conception (Green IT)

- **0 framework, 0 traqueur, 0 dépendance JS** ; icônes en SVG inline.
- Photos **compressées (q=60, AVIF/WebP)**, **responsives** (`srcset`) et **chargées à la demande**
  (`loading="lazy"`) : seule la photo d'accueil est chargée d'emblée. Elles sont ensuite gardées en cache par le service worker.
- 2 familles de polices **auto-hébergées**, sous-ensemble latin uniquement (~90 ko au total, mises en cache).
- CSS Tailwind **compilé et purgé** (pas de CDN Tailwind de ~300 ko exécuté sur le téléphone).
- **Fond neige doux `#F4F1EA`** (jamais de blanc pur) et **mode sombre** quasi noir, économe sur les écrans OLED.
- Contrastes élevés et boutons ≥ 48 px : lisible **en plein soleil, avec des gants**.
- `prefers-reduced-motion` respecté (bandeau des partenaires, scanner, apparitions).
- Service worker : l'app reste utilisable **hors-ligne** après la première visite.

## Direction artistique

Inspirée d'accordion.net.au : photo plein écran, très grands titres éditoriaux (Instrument Serif, avec
des mots en italique or), petites photos arrondies glissées dans le texte, cartes photo aux coins très
arrondis, boutons pilule, bandeau défilant des partenaires, FAQ en accordéon et pied de page géant.

| Jeton | Couleur |
|---|---|
| Vert sapin profond | `#14231C` / `#1B3A2D` |
| Or d'automne (mélézin) | `#D6A045` / `#C8892B` (texte : `#8A5A14`) |
| Blanc neige (doux, fond) | `#F4F1EA` / `#FAF8F3` |
| Gris minéral | `#4A4F4C` / `#7A7F7B` / `#C9CBC5` |

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
