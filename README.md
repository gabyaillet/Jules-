# Mélèze

> « Une heure pour la montagne, une expérience en retour. »
> Application web éco-conçue (PWA, mobile first) pour **Pralognan-la-Vanoise**, inspirée de CopenPay.

Les visiteurs réalisent des **missions utiles** d’une à deux heures (venir sans voiture, aider au marché,
nettoyer les sentiers…). Ils prennent une **photo** dans l’application, une **IA la vérifie** en quelques
secondes, et un **bon** offert par un partenaire local arrive aussitôt dans « Mon espace ».

| Qui | Ce qu’il fait |
|---|---|
| **Touriste** | Choisit une mission → *Je participe* → dans **Mon espace** : *Prendre la photo* (caméra intégrée) → l’IA valide ou explique quoi corriger → le **bon** (code `MLZ-B-XXXX`) s’affiche → devant le partenaire : *Utiliser mon bon* → « Bon utilisé » avec la date et l’heure. Aucun compte à créer : tout est lié au navigateur. Facultatif : *Gardez vos bons : ajoutez votre e-mail*, puis *Retrouver mes bons* sur un autre téléphone. |
| **Partenaire** | Pied de page → **Espace partenaires** → e-mail → code à 6 chiffres reçu par e-mail → *Mes missions* (en ligne / retirées, *Retirer*) et *Créer une mission* (mission, **photo attendue**, contrepartie). Seules les adresses ajoutées par l’équipe Mélèze (table `partners`) peuvent publier. |

## Mise en service

Le site est statique (GitHub Pages : https://gabyaillet.github.io/Jules-/). Il s’appuie sur deux services :

- **Supabase** : base de données, comptes (touristes anonymes, partenaires par code e-mail) et fonction
  `verify-photo` ;
- **Anthropic** : l’IA Claude, appelée **uniquement** par la fonction `verify-photo` (la clé ne quitte jamais le serveur).

Toute la procédure, pas à pas et sans code à écrire, est dans **[`supabase/README.md`](supabase/README.md)** :
base de données, réglages des e-mails (modèles avec `{{ .Token }}`, SMTP), connexion anonyme, partenaires,
clé Anthropic, déploiement de la fonction, secrets, missions de départ, vérifications, coûts et entretien.

Côté application, il n’y a que **`js/config.js`** : l’adresse du projet Supabase et sa clé **publique**
(*anon* ou *publishable*). Elles sont faites pour être visibles : la sécurité repose sur les règles d’accès
de la base (RLS). Ne jamais y mettre la clé `service_role` / `secret` ni la clé Anthropic.
Si ces deux valeurs sont vides, toutes les pages affichent un état **« Bientôt disponible »** et
l’application n’appelle aucun serveur.

> `js/config.js` est **déjà rempli** avec le projet Supabase de Mélèze (`ezvtjhzcvxftevinzsvl`). Faites les
> étapes 2 à 7 de `supabase/README.md` **sur ce projet** (pas de second projet), et ne publiez ce fichier sur
> GitHub Pages qu’une fois la base et la fonction en place : sinon le site affiche « Missions indisponibles »
> au lieu de « Bientôt disponible ».

## Lancer l’application en local

Pas de build requis : le CSS compilé est déjà dans `dist/`.

```bash
python3 -m http.server 5173   # ou : npm run serve
# → http://localhost:5173
```

- La caméra du navigateur n’est accessible qu’en **https** ou sur **localhost**.
- La fonction `verify-photo` n’accepte que les origines listées dans son secret `ALLOWED_ORIGINS` : pour vérifier
  des photos depuis `http://localhost:5173`, ajoutez cette adresse (voir `supabase/README.md`, étape 7).
- Ouvrir `index.html` en `file://` affiche les pages, mais sans mode hors-ligne ni caméra intégrée.

## Architecture

```
Jules-/
├── index.html              Coquille : en-tête, <main id="app">, pied de page, barre d’onglets mobile, scripts
├── src/input.css           Source Tailwind + jetons de couleur (thèmes clair / sombre) + composants
├── dist/styles.css         CSS compilé et purgé (≈ 45 ko, ≈ 9 ko gzip)
├── fonts/                  Bricolage Grotesque + Source Sans 3 (woff2 latin, auto-hébergées, licence OFL)
├── img/, video/            Photos des missions, vidéo de l’accueil (ordinateur uniquement)
├── js/
│   ├── data.js             Listes fixes : saisons, types, catégories, durées, limites de saisie (= contraintes SQL)
│   ├── photos.js           Photothèque (Unsplash ou fichiers locaux) + vidéo de l’accueil
│   ├── config.js           Adresse et clé PUBLIQUE du projet Supabase
│   ├── vendor/
│   │   └── supabase.min.js supabase-js 2.117.3 (build navigateur UMD, licence MIT, en-tête conservé)
│   ├── api.js              Meleze.api : le SEUL fichier qui parle au serveur (Supabase)
│   ├── store.js            Copie locale des données du serveur (chargement, hors connexion, actions)
│   ├── ui.js               Échappement, icônes SVG, photos responsives, réduction des photos, toasts, états
│   ├── camera.js           Appareil photo intégré (feuille plein écran, caméra arrière, repli fichier)
│   ├── views/              home · catalogue · wallet · pro · legal → render() + actions + forms
│   └── app.js              Routeur par hash, délégation d’événements, thème, service worker
├── supabase/               Serveur : schéma SQL + règles d’accès, fonction verify-photo, missions de départ, mode d’emploi
├── sw.js                   Service worker (hors-ligne) — n’intercepte jamais les appels au serveur
└── manifest.webmanifest    Installation PWA
```

### Pages

| Adresse | Page |
|---|---|
| `#/` | Accueil (missions de la saison en avant, « Comment ça marche », questions) |
| `#/missions` | Catalogue, filtres Saison / Type ; `?focus=<id>` amène une mission à l’écran |
| `#/wallet` | Mon espace : missions en cours (photo à prendre), bons, e-mail facultatif, « Supprimer mes données » |
| `#/pro`, `#/pro/creer` | Espace partenaires (toute autre sous-adresse revient sur `#/pro`) |
| `#/mentions-legales` | Mentions légales, crédits, données personnelles |

### Principes

- **JavaScript natif, sans framework ni bundler** : scripts classiques (`window.Meleze`), vues `render(state) → HTML`,
  un seul écouteur `click` / `submit` / `change` pour toute l’app (attributs `data-action`, `data-form`, `data-change`).
  Toute donnée affichée passe par `ui.esc()` (aucune injection HTML possible depuis une saisie ou le serveur).
- **Un seul point d’accès au serveur** : `js/api.js`. Il traduit les lignes SQL en objets des vues et chaque
  erreur en une phrase française courte (réseau, session, code faux, essais épuisés, service saturé…).
- **Deux sessions séparées** dans le navigateur : `meleze-tourist` (compte **anonyme**, créé seulement à la première
  inscription à une mission, jamais pour une simple visite) et `meleze-partner` (connexion par code). Une connexion
  partenaire ne touche jamais la session touriste sur le même appareil.
- **Le serveur fait foi** : le store garde la dernière version reçue (missions, participations, bons) dans
  `localStorage` (`meleze:cache:v1`) pour la lecture **hors connexion** ; toute action passe par le serveur
  (sans réseau : « Connexion nécessaire »). Les anciennes données locales (`meleze:state:v1…v3`) sont effacées au démarrage.
- **Vérification photo** : la photo est prise dans l’app (caméra arrière), réduite à 1024 px (JPEG ~0,8, sans
  métadonnées ni position GPS), envoyée à la fonction `verify-photo` quand le touriste appuie sur « Valider la
  photo » (et de nouveau seulement s’il choisit « Réessayer l’envoi » après une panne), qui la fait vérifier par Claude
  puis émet le bon. Aucune image n’est enregistrée. 5 essais par mission ; un essai n’est pas décompté si l’IA est
  indisponible. Pas d’import depuis la galerie : le champ fichier (`capture="environment"`) n’apparaît que si la
  caméra est inaccessible (navigateur sans caméra, page non sécurisée, accès refusé).
- **Bons** : créés uniquement par le serveur après une photo validée ; « Utiliser mon bon » (devant le partenaire)
  les marque utilisés une seule fois (fonction SQL `use_voucher`).
- **E-mail facultatif du touriste** : « Gardez vos bons » ajoute l’adresse au compte anonyme (code à 6 chiffres,
  même identifiant, bons conservés) ; « Retrouver mes bons » ouvre ce compte sur un autre appareil. Si l’appareil
  contient des missions ou des bons non sauvegardés, l’app prévient avant de changer de compte.

### Bibliothèque embarquée

`js/vendor/supabase.min.js` = **`@supabase/supabase-js` 2.117.3**, fichier `dist/umd/supabase.js` du paquet npm
(intégrité npm `sha512-K+f8PimXDunPWQ63CKRXaF5pbVPJxmfw5ryAnh0s9S9PkwcuqBjiSpIaqpF7KLDljeYwXIL85ST8QxaO0+XuvA==`),
précédé de sa licence MIT. Version **épinglée** : aucune dépendance chargée depuis un CDN. Pour la mettre à jour :

```bash
npm pack @supabase/supabase-js@<version>     # dans un dossier temporaire
tar xzf supabase-supabase-js-<version>.tgz   # → package/dist/umd/supabase.js
```

puis remplacer le contenu de `js/vendor/supabase.min.js` sous l’en-tête (en mettant à jour la version et
l’intégrité), et changer `VERSION` dans `sw.js`.

## Mentions légales

Page `#/mentions-legales`, dans `js/views/legal.js`. **À compléter** : l’objet `EDITEUR` en haut du fichier
(nom, statut, adresse, e-mail, téléphone, SIRET, directeur·rice de la publication, crédits des photos et de la
vidéo, téléphone de l’hébergeur, **région des données Supabase** `regionDonnees`, **service d’envoi des e-mails**
`envoiEmails`). Tant qu’un champ est vide, la page affiche « À compléter ».
`CONSERVATION_MOIS` (12) est la durée de conservation que l’éditeur s’engage à tenir : la requête d’entretien
mensuel est dans `supabase/README.md`. La partie « Données personnelles » décrit le fonctionnement réel
(Supabase, Anthropic, GitHub) : à relire avant la mise en ligne, idéalement avec un juriste.

## Photos

Les trois photos des missions sont des fichiers locaux fournis par le client (`img/sentiers.webp`,
`img/covoiturage.webp`, `img/marche.webp`) ; `img/sentiers.webp` porte le crédit **© Randozone.com**.
Droits d’usage à confirmer avec le client. Les autres paysages viennent d’**Unsplash** (licence Unsplash :
gratuite, usage commercial autorisé), chargés depuis `images.unsplash.com` au bon format et à la bonne taille.

**Pour utiliser de vraies photos de Pralognan** : déposez-les dans `img/` (idéalement en `.webp`, 1600 px de
large, < 250 ko), puis dans `js/photos.js` remplacez l’identifiant par le chemin :
`lake: { src: 'img/lac-des-vaches.webp', alt: '…' }`.
Une mission utilise la photo de sa colonne `photo` (clé de la photothèque, ex. `sentiers`), sinon la photo de
son type (`Meleze.photos.byType`). Si une photo ne charge pas, un fond gris neutre prend le relais.

La vidéo de l’accueil (ordinateur uniquement) se remplace en gardant le nom `video/hero.mp4` (voir `js/photos.js`).

## Choix d’éco-conception (Green IT)

- **0 framework, 0 traqueur, 0 cookie** ; une seule bibliothèque embarquée (supabase-js, ≈ 56 ko gzip, mise en
  cache) ; icônes en SVG inline.
- Photos **compressées (AVIF/WebP)**, **responsives** (`srcset`) et **chargées à la demande** ; la vidéo de
  l’accueil n’est jamais téléchargée sur mobile, ni en mode « économie de données » ou « moins d’animations ».
- Photo de vérification réduite **dans le téléphone** avant l’envoi (≈ 100 à 250 ko au lieu de plusieurs Mo),
  jamais stockée ; caméra coupée dès qu’elle ne sert plus.
- 2 polices variables **auto-hébergées**, sous-ensemble latin uniquement.
- CSS Tailwind **compilé et purgé** (pas de CDN Tailwind exécuté sur le téléphone).
- **Fond blanc** pour tout le monde (choix de design) ; un **mode sombre** quasi noir (économe sur OLED) reste
  disponible via le bouton de l’en-tête.
- Contrastes élevés et cibles tactiles ≥ 44 px : lisible **en plein soleil, avec des gants**.
- Service worker « réseau d’abord » : on voit toujours la dernière version, et l’app reste consultable
  **hors-ligne** (dernières missions et bons enregistrés) après la première visite.

## Direction artistique

Base blanche, grands titres gras quasi noirs (`#0F1412`), gris neutres et **un seul vert** (`#178350`) ;
**aucune couleur pastel**. Titres en Bricolage Grotesque, texte en Source Sans 3.

- Accueil : sur ordinateur, vidéo plein écran (photo HD pendant le chargement) ; sur mobile, le titre puis
  directement les missions. Contreparties sur un **bandeau vert plein** en tuiles blanches ; appel final sur un
  **bandeau noir** dont le mot **VANOISE** est rempli par une photo (`background-clip: text`).
- **Photos arrondies, blocs carrés** : seules les photos sont arrondies (24 px ; 32 px pour les grandes ; 16 px
  pour les vignettes). Tuiles, cartes, encadrés, bons et formulaires sont carrés.
- **Pancartes carrées** (`.tag.tag-sign`, `.sticker`) pour les types de mission ; **pilules** pour les statuts,
  filtres et boutons (`.btn`, `.btn-primary`, `.tag`).
- **Pas d’icônes décoratives** : seules restent la flèche des boutons principaux, le « + » des accordéons,
  le bouton clair/sombre et l’état des messages.

| Rôle | Couleur |
|---|---|
| Fond de page, cartes | `#FFFFFF` |
| Gris très clair (champs, encadrés, repli photo) | `#F4F4F3` |
| Filets, bordures discrètes | `#E4E5E4` |
| Texte, titres, bandeau final | `#0F1412` (≈ 19:1 sur blanc) |
| Texte secondaire | `#5E6360` (≈ 6:1 sur blanc) |
| Vert unique (boutons, bandeau, bons, succès) | `#178350` (4,8:1 sur blanc, blanc dessus 4,8:1) |
| Vert au survol / appui | `#126B41` |
| Alertes (photo refusée, erreurs) | `#B42318` |
| Mode sombre : vert en texte et filets | `#5CCB93` (aplats verts inchangés : `#178350`) |
| Mode sombre : fond de page | `#0D100F` |

## Modifier les styles

```bash
npm install
npm run dev     # recompile dist/styles.css à chaque modification
npm run build   # version minifiée, à relancer après tout changement de classes dans js/ ou index.html
```

## Tests

- Fonction `verify-photo` (faux clients Anthropic et Supabase) : voir `supabase/README.md`, section *Tests*.
- Application : chaque fichier passe `node --check` ; les parcours (touriste, photo, bons, e-mail, partenaire,
  caméra refusée, hors connexion, service worker) ont été vérifiés avec Playwright contre un faux serveur
  Supabase en mémoire. Rien ne remplace un essai réel une fois le projet Supabase et la clé Anthropic branchés
  (`supabase/README.md`, étape 10).

## Limites connues

- **Bon utilisé sur la confiance** : c’est le touriste qui appuie sur « Utiliser mon bon » devant le partenaire ;
  celui-ci voit « Bon utilisé » avec la date et l’heure. Pas d’outil de contrôle côté partenaire. Un bon n’est
  présenté comme « à utiliser » ou « utilisé » qu’après avoir été relu sur le serveur pendant la visite : la copie
  hors connexion s’affiche en gris (« Connexion nécessaire pour vérifier ce bon »).
- **Adresse partagée** : sur `gabyaillet.github.io`, les sessions sont lisibles par tout autre site GitHub Pages
  du même compte. Un domaine propre est recommandé avant l’ouverture au public (`supabase/README.md`, étape 3.4).
- **Vérification par IA** : tolérante (cadrage, lumière), elle peut se tromper dans les deux sens ; 5 essais par
  mission, un seul bon par mission, 20 vérifications par jour et par touriste, plafond global quotidien côté
  serveur. Ces compteurs ne repartent pas de zéro après une désinscription ou « Supprimer mes données ».
- **Compte anonyme lié au navigateur** : sans e-mail ajouté, effacer les données du navigateur fait perdre les bons.
- « **Supprimer mes données** » efface participations et bons et anonymise le journal des vérifications (gardé
  30 jours pour les limites), mais pas l’adresse e-mail éventuelle : elle est supprimée sur demande par l’équipe
  (Supabase → Authentication → Users). L’app le rappelle avant la suppression.
- **Pas encore de CAPTCHA** à la création des comptes anonymes : une personne qui crée beaucoup de comptes peut
  atteindre le plafond global du jour pour tout le monde (voir `supabase/README.md`, étape 3.5).
- **Photos génériques** : paysages alpins, pas tous de Pralognan ; à remplacer (voir *Photos*).
