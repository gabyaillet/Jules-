# Mélèze — V2

> « Une heure pour la montagne, une expérience en retour. »
> Application web éco-conçue (PWA, mobile first) pour **Pralognan-la-Vanoise**, inspirée de CopenPay.

Les touristes réalisent des missions utiles. Pour l’instant, trois missions :

1. **Venir en transport en commun ou en covoiturage** : validée par un **justificatif photo** (billet de train ou de car,
   réservation de covoiturage, photo à deux dans la voiture), vérifié par l’Office de tourisme ;
2. **Aider à monter le marché du village** (tentes, tables, stands) : validée par **QR code** ;
3. **Nettoyer les sentiers avec les gardes du Parc national de la Vanoise** : validée par **QR code**.

Chaque participation a **son propre QR code** : le touriste le montre au référent à la fin de la mission, le référent
le scanne et valide, et un **bon de récompense** arrive aussitôt dans « Mon espace » (téléphérique, patinoire, Beaufort…).

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
| **Touriste** | Accueil → *Voir les missions* → filtrer (Saison / Type) → *Je participe* → **Mon espace** : la carte de la mission affiche **son QR code** (à montrer au référent). Pour la mission transport : *Envoyer mon justificatif* (photo du billet ou de la réservation), puis *Remplacer la photo* si besoin |
| **Pro** | Pied de page → lien discret **Espace partenaires** → `pro@meleze.demo` / PIN **`1234`** |
| **Scanner** | *Activer la caméra* et présenter le QR d’une mission (sur un autre écran), ou utiliser les puces de démo : puce *QR · Sentiers* → **Valider la mission** (le bon apparaît dans « Mon espace » ; un second scan affiche « Mission déjà validée ») · puce *Bon PT42* → **Consommer le bon** (il est grisé, impossible de le réutiliser) · un code inconnu affiche une erreur |
| **Justificatifs** | Onglet *Justificatifs* (pastille = nombre en attente) → le billet de démo de Gab → **Valider** (le bon patinoire part dans « Mon espace ») ou **Refuser** avec un motif (le touriste voit le motif et peut renvoyer une photo) |
| **Création** | Onglet *Créer une mission* → mission + mode de validation (QR code sur place ou justificatif photo) + **contrepartie obligatoire** → *Publier* → visible aussitôt dans le catalogue avec le badge « Nouveau » |

La caméra du navigateur n’est accessible qu’en **https** (ou sur `localhost`) : en `file://` ou sur une adresse
IP du réseau local, l’espace pro propose la saisie du code et les puces de démo.

Les données de démonstration sont stockées dans `localStorage`. Pour repartir de zéro, utilisez le lien
*Réinitialiser les données de démo* en bas de « Mon espace ».

## Architecture

```
Jules-/
├── index.html            Coquille : en-tête, <main id="app">, pied de page, barre d'onglets mobile
├── src/input.css         Source Tailwind + jetons de couleur (thèmes clair / sombre) + composants
├── dist/styles.css       CSS compilé et purgé (≈ 35 ko, ≈ 7 ko gzip)
├── fonts/                Bricolage Grotesque + Source Sans 3 (woff2 latin, auto-hébergées, licence OFL)
├── tailwind.config.js    Palette Mélèze (blanc, quasi-noir, gris, un accent vert #178350)
├── js/
│   ├── data.js           Données de démonstration (3 missions, participations, bons, identifiants pro)
│   ├── photos.js         Photothèque (Unsplash ou fichiers locaux) — à remplacer par vos photos
│   ├── store.js          État + persistance + règles métier (inscrire, envoyer un justificatif,
│   │                     valider / refuser, consommer un bon, créer une mission)
│   ├── ui.js             Icônes SVG, photos responsives, vrais QR codes (SVG), compression
│   │                     des photos envoyées, toasts, formatage
│   ├── scanner.js        Lecture des QR par la caméra (BarcodeDetector, sinon jsQR chargé à la demande)
│   ├── vendor/
│   │   ├── qrcode.min.js qrcode-generator (Kazuhiko Arase, licence MIT) : génération des QR
│   │   └── jsQR.min.js   jsQR 1.4.0 (Cosmo Wolfe, licence Apache 2.0) : lecture caméra, chargé
│   │                     seulement à la première activation du scanner
│   ├── views/            home · catalogue · wallet · pro  → render() + actions + forms + changes
│   └── app.js            Routeur par hash, délégation d'événements, thème, service worker
├── sw.js                 Cache hors-ligne (couverture réseau aléatoire en altitude)
└── manifest.webmanifest  Installation PWA
```

- **JavaScript natif, sans framework** : les vues sont des fonctions `render(state) → HTML`, un seul écouteur
  `click`, un seul `submit` et un seul `change` pour toute l'app (attributs `data-action` / `data-form` / `data-change`).
- **Un QR par participation** : code `MLZ-P-XXXX` (participation) ou `MLZ-B-XXXX` (bon), sans 0/O/1/I.
  Le scanner reconnaît les deux et adapte l’écran : valider la mission, ou consommer le bon (une seule fois).
- **Justificatifs photo** : compressés dans le téléphone (JPEG ~1280 px, sans métadonnées EXIF) avant d’être enregistrés.
- **Scripts classiques** (pas de modules ES) pour que l'app s'ouvre sans serveur.
- Toutes les saisies des pros passent par `ui.esc()` avant affichage (pas d'injection HTML).
- Pour brancher une vraie API en V2, il suffit de réécrire `store.js` en gardant les mêmes fonctions.

## Photos

Les trois photos des missions et la photo des mots géants « MONTAGNE » / « VANOISE » sont des fichiers
locaux fournis par le client (`img/sentiers.webp`, `img/covoiturage.webp`, `img/marche.webp`) ;
`img/sentiers.webp` porte le crédit **© Randozone.com** (tenu hors des lettres par le cadrage).
Droits d’usage à confirmer avec le client, ainsi que les originaux en haute définition
(`img/sentiers.webp` ne fait que 533 × 800 px : agrandie dans les mots géants, sa texture est un peu floue
sur grand écran ; idéalement ≥ 2400 px de large, en vérifiant que le © reste dans les 7 % du bas).
Les autres paysages viennent d’**Unsplash** (licence Unsplash : gratuite, usage commercial
autorisé), chargés depuis `images.unsplash.com` au bon format (AVIF/WebP) et à la bonne taille.

**Pour utiliser de vraies photos de Pralognan** (Office de tourisme, photographe local…) :
1. déposez-les dans un dossier `img/` (idéalement en `.webp`, 1600 px de large, < 250 ko) ;
2. dans `js/photos.js`, remplacez l'identifiant par le chemin : `lake: { src: 'img/lac-des-vaches.webp', alt: '…' }`.

Chaque mission choisit sa photo via le champ `photo` dans `js/data.js` (sinon une photo par type).
Si une photo ne charge pas (hors-ligne, lien mort), un fond gris neutre prend le relais.

## Choix d'éco-conception (Green IT)

- **0 framework, 0 traqueur** ; deux petites bibliothèques libres embarquées (génération et lecture de QR),
  la seconde n’est téléchargée que par les pros qui activent la caméra ; icônes en SVG inline.
- Photos **compressées (q=60, AVIF/WebP)**, **responsives** (`srcset`) et **chargées à la demande**
  (`loading="lazy"`) : seule la photo d'accueil est chargée d'emblée. Elles sont ensuite gardées en cache par le service worker.
- 2 polices variables **auto-hébergées**, sous-ensemble latin uniquement (~70 ko au total, mises en cache).
- CSS Tailwind **compilé et purgé** (pas de CDN Tailwind de ~300 ko exécuté sur le téléphone).
- **Fond blanc** pour tout le monde (choix de design). Sur écran OLED, le blanc consomme plus
  qu'un fond sombre : un **mode sombre** quasi noir reste disponible via le bouton de l'en-tête (choix mémorisé).
- Contrastes élevés et boutons ≥ 48 px : lisible **en plein soleil, avec des gants**.
- Quasiment aucune animation (seule la ligne du scanner bouge) ; `prefers-reduced-motion` respecté.
- Service worker « réseau d'abord » : on voit toujours la dernière version, et l'app reste utilisable **hors-ligne** après la première visite.

## Direction artistique

Concept **A · Typo-photo**, retenu par le client : base blanche, grands titres gras quasi noirs
(`#0F1412`), gris neutres et **un seul accent vert** (`#178350`) ; **aucune couleur pastel**.
- Le mot géant **MONTAGNE** du titre d’accueil est rempli par une photo des sommets de la Vanoise
  (`img/sentiers.webp`, `background-clip: text`), multipliée sur un gris moyen pour rester lisible ;
  repli en couleur unie si la photo ne charge pas ou si le navigateur ne sait pas découper le fond.
- Les contreparties sont présentées sur un **bandeau vert plein**, en tuiles blanches carrées.
- La page se termine sur un **bandeau noir** dont le mot **VANOISE** est rempli par la même photo.
- Quelques étiquettes inclinées façon autocollant posées sur les photos ; boutons pilule.

Règles de sobriété :
- **Pas d'icônes décoratives** : la typographie porte l'information (seules restent la flèche des
  boutons principaux, le « + » des accordéons, le bouton clair/sombre et l’état des messages).
- **Photos douces, blocs graphiques** : seules les photos sont arrondies (24 px ; 32 px pour les grandes
  photos sur ordinateur ; 16 px pour les vignettes). Boutons, filtres et étiquettes sont en pilule.
  Tout le reste (tuiles de couleur, cartes, encadrés, bons, formulaires, surlignage) est carré.

| Rôle | Couleur |
|---|---|
| Fond de page, cartes | `#FFFFFF` |
| Gris très clair (champs, encadrés, repli photo) | `#F4F4F3` |
| Filets, bordures discrètes | `#E4E5E4` |
| Texte, titres, bandeau final | `#0F1412` (quasi noir, ≈ 19:1 sur blanc) |
| Texte secondaire | `#5E6360` (≈ 6:1 sur blanc) |
| Accent vert unique (boutons, bandeau, texte vert) | `#178350` (4,8:1 sur blanc, blanc dessus 4,8:1) |
| Vert au survol / appui | `#126B41` |
| Alertes (refus, bon déjà utilisé) | `#B42318` |
| Mode sombre : vert en texte et filets | `#5CCB93` (aplats verts inchangés : `#178350`) |
| Mode sombre : fond de page | `#0D100F` |

Typographies : **Bricolage Grotesque** (titres, grotesque grasse et expressive) et **Source Sans 3** (texte, très lisible au soleil).

## Modifier les styles

```bash
npm install
npm run dev     # recompile dist/styles.css à chaque modification
npm run build   # version minifiée avant mise en ligne
```

## Limites connues de la V2

- **Pas de serveur** : la démo est stockée dans le `localStorage` du navigateur. Rien n’est partagé **entre appareils** :
  le téléphone du touriste et celui du référent ne voient pas les mêmes données. Sur un même ordinateur, deux onglets
  (touriste et pro) restent synchronisés. Pour un vrai déploiement, il faut réécrire `store.js` sur une API.
- **Justificatifs photo** : gardés dans le navigateur (quelques centaines de ko chacun). Si le stockage est plein,
  la photo n’est conservée que pour la session en cours et le touriste en est averti.
- **Anti-triche** : un bon n’est émis qu’une fois par participation, et un bon consommé ne peut pas resservir.
  Pour le transport, l’écran Justificatifs signale les validations précédentes du participant, mais rien n’empêche
  encore de se réinscrire : à encadrer en V3 (une fois par séjour, comptes réels).
- **Photos génériques** : ce sont des paysages alpins, pas Pralognan ; à remplacer (voir *Photos*).
- **Connexion pro simulée** : pas de comptes réels.
