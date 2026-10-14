# Mélèze — mise en service du serveur

Ce dossier contient tout ce qui tourne côté serveur :

| Fichier | Rôle |
| --- | --- |
| `migrations/0001_init.sql` | La base de données : tables, règles d'accès, fonctions. |
| `functions/verify-photo/` | La fonction qui fait vérifier la photo d'une mission par l'IA Claude, puis émet le bon. |
| `seed.sql` | Facultatif : les trois missions de départ (avec l'accord des partenaires). |

L'application elle-même reste sur GitHub Pages. Elle a besoin de deux services :

- **Supabase** : la base de données, les comptes (touristes anonymes, qui peuvent ajouter leur e-mail pour garder leurs bons ; partenaires par code e-mail) et la fonction de vérification ;
- **Anthropic** : l'IA Claude, qui regarde la photo envoyée par le touriste.

Comptez environ 45 minutes. Aucune ligne de code à écrire : il faut seulement copier-coller.

> **Le projet Supabase existe déjà.** `js/config.js` pointe vers le projet de Mélèze
> (`https://ezvtjhzcvxftevinzsvl.supabase.co`). Faites les étapes 2 à 7 **sur ce projet** : ne créez pas
> de second projet (sautez « New project » à l'étape 1, mais vérifiez sa région et son plan).
> Tant que la base (étape 2) et la fonction (étapes 6 et 7) ne sont pas en place sur ce projet, ne publiez
> pas `js/config.js` sur GitHub Pages : le site afficherait « Missions indisponibles » au lieu de
> « Bientôt disponible ». Publiez-le en dernier (étape 8), ou videz ses deux valeurs d'ici là.

---

## 1. Créer le projet Supabase

1. Créez un compte sur [supabase.com](https://supabase.com), puis **New project** (déjà fait pour Mélèze : voir l'encadré ci-dessus).
2. Nom : `meleze`. **Region : une région européenne**, par exemple *West EU (Paris)* ou *Central EU (Frankfurt)*.
3. Choisissez un mot de passe de base de données solide et gardez-le dans un gestionnaire de mots de passe.
4. Attendez que le projet soit prêt (1 à 2 minutes).

> Le plan gratuit suffit pour démarrer, mais un projet gratuit est **mis en pause après 7 jours sans visite**. Pour un service ouvert au public, prévoyez le plan Pro.

## 2. Créer la base de données

1. Menu de gauche : **SQL Editor** → **New query**.
2. Ouvrez le fichier `supabase/migrations/0001_init.sql`, copiez **tout** son contenu, collez-le dans l'éditeur.
3. Cliquez **Run**. Le message attendu est *Success. No rows returned*.

Le script peut être relancé sans risque : il ne supprime aucune donnée. Si la base a été créée avec une version précédente du script, relancez-le après chaque mise à jour du dépôt : il ajoute ce qui manque (colonnes, table `mission_rewards`, règles) sans rien perdre.

## 3. Régler les connexions (Authentication)

### 3.1 Connexion par code pour les partenaires

1. **Authentication → Sign In / Providers → Email** : laissez **Enable Email provider** activé.
2. Laissez **Confirm email** activé. C'est important : sans confirmation, n'importe qui pourrait créer un compte avec l'adresse d'un partenaire.
3. **Email OTP Length** : `6`. **Email OTP Expiration** : `600` secondes (10 minutes) conviennent bien.
4. **Authentication → Emails → Templates** : l'application demande un **code à 6 chiffres**, pas un lien. Modifiez les trois modèles **Magic Link**, **Confirm signup** et **Change Email Address** pour qu'ils affichent `{{ .Token }}` (le code ; `{{ .ConfirmationURL }}` est inutile). Par exemple :

   - Sujet : `Votre code Mélèze`
   - Message :

     ```html
     <h2>Votre code de connexion</h2>
     <p>Saisissez ce code dans Mélèze :</p>
     <p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
     <p>Il expire dans 10 minutes. Si vous n'avez rien demandé, ignorez cet e-mail.</p>
     ```

   Pour **Change Email Address**, le message peut dire « Confirmez votre adresse » : c'est le code qu'un touriste reçoit quand il ajoute son e-mail pour garder ses bons (voir 3.3).

5. **Envoi des e-mails (indispensable en production)** : le service d'e-mail intégré de Supabase sert aux essais. Il n'écrit qu'aux membres de votre équipe Supabase et seulement quelques e-mails par heure. Pour que les partenaires et les touristes reçoivent leur code, branchez un vrai service d'envoi (Brevo, Resend, Mailjet…) dans **Authentication → Emails → SMTP Settings** : hôte, port, identifiant, mot de passe, et une adresse d'expédition de votre domaine. Ensuite, **Authentication → Rate Limits** : réglez le nombre d'e-mails envoyés par heure selon la fréquentation attendue. Indiquez ce service dans les mentions légales (`envoiEmails` dans `js/views/legal.js`).

### 3.2 Connexion anonyme pour les touristes

**Authentication → Sign In / Providers** : activez **Allow anonymous sign-ins**.

L'application ne crée un compte anonyme qu'au moment où un touriste s'inscrit à une mission, jamais pour une simple visite.

### 3.3 Garder ses bons avec un e-mail (touristes)

Un touriste reste anonyme par défaut. Dans « Mon espace », il peut ajouter son e-mail (« Gardez vos bons ») : il reçoit un code à 6 chiffres, et son compte anonyme devient un compte permanent **sans changer d'identifiant** (ses missions et ses bons restent). Sur un autre téléphone, ou si le navigateur a effacé ses données, « Retrouver mes bons » lui envoie un code de connexion.

Réglages nécessaires (en plus de 3.1 et 3.2) :

1. Modèles **Change Email Address** (ajout de l'adresse) et **Magic Link** (« Retrouver mes bons ») avec `{{ .Token }}` : voir 3.1, point 4.
2. **Authentication → Sign In / Providers → Email → Secure email change** : peut rester activé. Un compte anonyme n'a pas encore d'adresse : le code part seulement à la nouvelle adresse.
3. SMTP personnalisé (3.1, point 5) : sans lui, les touristes ne reçoivent pas leur code.

« Retrouver mes bons » ne crée jamais de compte : une adresse inconnue reçoit le message « Aucun bon n'est enregistré avec cette adresse ». Si le téléphone contient déjà des missions ou des bons non sauvegardés, l'application prévient avant de changer de compte.

### 3.4 Adresse du site

**Authentication → URL Configuration** :

- **Site URL** : `https://gabyaillet.github.io/Jules-/`
- **Redirect URLs** : ajoutez la même adresse.

> **Recommandé avant l'ouverture au public : une adresse à part.** Le navigateur range les sessions
> (touristes et partenaires) par *origine* (`https://gabyaillet.github.io`), pas par chemin : tout autre site
> GitHub Pages de ce compte (`gabyaillet.github.io/autre-projet/`) pourrait lire la session d'un partenaire
> et publier ou retirer des missions à sa place, et appeler `verify-photo` depuis une origine autorisée.
> Donnez à Mélèze son propre domaine (par exemple `meleze.fr`, réglé dans **GitHub → Settings → Pages →
> Custom domain**), puis mettez cette adresse dans **Site URL**, **Redirect URLs** et `ALLOWED_ORIGINS`
> (étape 7). D'ici là, ne publiez aucun autre contenu ni script tiers sur `gabyaillet.github.io`.

### 3.5 Protection anti-robots (étape suivante, facultative)

Supabase limite déjà le nombre de comptes anonymes créés par adresse IP (**Authentication → Rate Limits**). Pour aller plus loin, **Authentication → Attack Protection → Enable CAPTCHA protection** avec **Cloudflare Turnstile** (gratuit) est recommandé.

> ⚠ N'activez pas encore le CAPTCHA : une fois activé, l'application doit envoyer un jeton `captchaToken` à chaque connexion (anonyme et par code), ce qu'elle ne fait pas aujourd'hui. Sinon plus personne ne peut se connecter. C'est une prochaine étape à prévoir côté application.

**Risque connu tant qu'il n'y a pas de CAPTCHA.** Chaque compte anonyme a droit à 20 vérifications par jour ; la limite globale (`DAILY_GLOBAL_LIMIT`, 500 par défaut) protège votre facture Anthropic. Une seule personne qui crée une trentaine de comptes anonymes peut donc atteindre cette limite globale : tous les touristes voient alors « Service très demandé aujourd'hui » pendant au plus 24 h (coût pour vous : quelques dollars, pas plus). En attendant le CAPTCHA :

- **Authentication → Rate Limits → anonymous sign-ins** : baissez le nombre de comptes anonymes par heure et par adresse IP (par exemple 10 ; gardez de la marge pour le Wi-Fi partagé d'un hôtel ou d'un office de tourisme) ;
- surveillez **Table Editor → photo_checks** et les journaux de `verify-photo` (événement `global_limit`) ; si la limite est atteinte sans raison, relevez temporairement `DAILY_GLOBAL_LIMIT`.

## 4. Ajouter les partenaires

Seules les adresses e-mail listées ici peuvent publier des missions.

1. **Table Editor → partners → Insert → Insert row**.
2. `email` : l'adresse du partenaire (les majuscules et espaces sont corrigés automatiquement).
3. `org` : le nom affiché de l'organisation, de 2 à 80 caractères (ex. `Office de tourisme`).
4. **Save**.

Le partenaire se connecte ensuite dans l'espace pro de l'application avec son e-mail et le code reçu.
Pour retirer un partenaire, supprimez sa ligne : il ne peut plus publier, ses missions déjà publiées restent en ligne (il ne pourra plus les retirer ; vous pouvez passer leur colonne `active` à `false` dans **Table Editor → missions**).

> ⚠ **Ne supprimez jamais une ligne de la table `missions`** : cela effacerait aussi les participations et les **bons des touristes** liés à cette mission, même ceux pas encore utilisés. Pour arrêter une mission, passez sa colonne `active` à `false`.
>
> **Supprimer le compte d'un partenaire** (demande RGPD) : 1. supprimez sa ligne dans `partners` ; 2. passez ses missions à `active = false` (sauf si son organisation continue : vous pouvez alors les confier à un autre compte partenaire en changeant `created_by`) ; 3. supprimez le compte dans **Authentication → Users**. Ses missions restent dans la base sans propriétaire (`created_by` vide) et les bons déjà reçus par les touristes restent valables.

## 5. Contrats avec les prestataires (RGPD)

Mélèze confie des données personnelles à plusieurs prestataires. Pour chacun, **acceptez ou signez son accord de traitement des données** (en anglais *Data Processing Addendum*, « DPA »), sur son site ou dans les réglages de votre compte, et gardez-en une copie :

- **Supabase** (base de données, comptes, fonction) ;
- **Anthropic** (vérification des photos) ;
- **GitHub** (hébergement du site) ;
- le **service d'envoi des e-mails** choisi à l'étape 3.1 (point 5).

Ces accords précisent aussi ce qui encadre les transferts de données vers les États-Unis (en général les clauses contractuelles types de la Commission européenne). Reportez-le ensuite dans `js/views/legal.js` : champ `transferts` de l'objet `EDITEUR` (la page affiche « À compléter » tant qu'il est vide), avec `envoiEmails` et `regionDonnees`. Faites relire la page par un juriste.

## 5 bis. Créer la clé Anthropic

1. Créez un compte sur [console.anthropic.com](https://console.anthropic.com) et ajoutez un moyen de paiement.
2. **API Keys → Create Key**, nom `meleze`. Copiez la clé (`sk-ant-…`) : elle n'est affichée qu'une fois.
3. Conseillé : fixez une **limite de dépense mensuelle** dans **Settings → Limits**.

## 6. Déployer la fonction `verify-photo`

### Option A — depuis le tableau de bord (sans rien installer)

1. **Edge Functions → Deploy a new function → Via Editor** (ou, si la fonction existe déjà, ouvrez **verify-photo → Code**).
2. Nom de la fonction : **`verify-photo`** (exactement).
3. Le fichier `index.ts` s'ouvre : remplacez **tout** son contenu par celui de **`supabase/dashboard/verify-photo.ts`** (la fonction complète en un seul fichier). S'il existe un fichier `handler.ts` dans l'éditeur, supprimez-le : il ne sert plus.
4. **Deploy function**.
5. Dans les réglages de la fonction (**Details**), **désactivez « Verify JWT »** (« Enforce JWT verification »). La fonction vérifie elle-même, à chaque appel, que la personne est bien connectée ; la vérification automatique de Supabase peut en revanche bloquer la demande préalable du navigateur (CORS) et les nouvelles clés d'API.

> `supabase/dashboard/verify-photo.ts` est fabriqué à partir de `supabase/functions/verify-photo/` (index.ts + handler.ts) par `node supabase/dashboard/build.mjs` : relancez cette commande après toute modification de la fonction, puis recollez le fichier.
>
> Si les journaux de la fonction (**Logs**) affichent `worker boot error … does not provide an export named 'createHandler'`, c'est que l'ancien fichier `handler.ts` n'avait pas le bon contenu : recollez le fichier unique ci-dessus.

### Option B — en ligne de commande

Depuis la racine du dépôt, avec Node.js installé :

```bash
npx supabase login
npx supabase functions deploy verify-photo --project-ref VOTRE_REF --no-verify-jwt
```

`VOTRE_REF` est l'identifiant du projet (la partie `abcdefgh` de `https://abcdefgh.supabase.co`). Si la commande réclame Docker, ajoutez `--use-api`.

## 7. Donner ses secrets à la fonction

**Edge Functions → Secrets** (ou **Project Settings → Edge Functions**), ajoutez :

| Nom | Valeur |
| --- | --- |
| `ANTHROPIC_API_KEY` | la clé `sk-ant-…` de l'étape 5 bis |
| `ALLOWED_ORIGINS` | `https://gabyaillet.github.io` (sans chemin ; votre propre domaine si vous en avez un, voir 3.4). Pour tester en local (`npm run serve`, port 5173), ajoutez l'adresse séparée par une virgule : `https://gabyaillet.github.io,http://localhost:5173` |
| `DAILY_GLOBAL_LIMIT` | facultatif : nombre maximal de vérifications par 24 h pour tout le service (défaut `500`, `0` = sans limite) |

`SUPABASE_URL` et les clés d'API du projet (nouvelles clés `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`, ou anciennes `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`) sont fournis automatiquement par Supabase : ne les ajoutez pas. La fonction utilise les nouvelles clés quand elles existent.

En ligne de commande :

```bash
npx supabase secrets set --project-ref VOTRE_REF ANTHROPIC_API_KEY=sk-ant-... ALLOWED_ORIGINS=https://gabyaillet.github.io
```

## 8. Brancher l'application

`js/config.js` contient **déjà** l'adresse et la clé publique du projet de Mélèze (`ezvtjhzcvxftevinzsvl`). Vérifiez seulement qu'elles correspondent au projet où vous avez fait les étapes 2 à 7, puis publiez (point 3). Pour un autre projet :

1. **Project Settings → API** (ou bouton **Connect** en haut du tableau de bord), copiez :
   - **Project URL** (ex. `https://abcdefgh.supabase.co`) ;
   - la clé publique **anon** (ou **publishable**, `sb_publishable_…`).
2. Collez-les dans `js/config.js` :

   ```js
   Meleze.config = {
     supabaseUrl: 'https://abcdefgh.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi…',
   };
   ```

3. Publiez le changement sur GitHub (commit + push) **une fois les étapes 2 à 7 terminées** : GitHub Pages met le site à jour en une minute environ.

> ⚠ Ne mettez **jamais** dans `js/config.js` la clé `service_role` / `secret` ni la clé Anthropic. Ces deux valeurs publiques sont faites pour être visibles : la sécurité repose sur les règles d'accès de la base.

## 9. Missions de départ (facultatif)

`seed.sql` crée les trois missions historiques (covoiturage, marché, sentiers).
**À n'exécuter qu'avec l'accord écrit des partenaires concernés** (organisateurs et partenaires qui offrent les récompenses).

1. Le compte qui « possèdera » ces missions doit exister : soit le partenaire s'est connecté une fois dans l'espace pro, soit vous le créez dans **Authentication → Users → Add user → Create new user** (cochez *Auto Confirm User*). Son e-mail doit aussi être dans la table `partners`.
2. Dans `seed.sql`, remplacez `remplacez-moi@exemple.fr` par cet e-mail.
3. Collez le script dans **SQL Editor** → **Run**. Relancé, il ne crée pas de doublon.

## 10. Vérifier que tout fonctionne

1. Ouvrez le site : les missions publiées s'affichent.
2. Inscrivez-vous à une mission, envoyez une photo qui correspond : un bon apparaît dans votre espace.
3. Envoyez une photo sans rapport : elle est refusée avec une phrase qui explique quoi changer.
4. « Mon espace » → « Gardez vos bons » : ajoutez votre e-mail avec le code reçu. Dans un autre navigateur, « Retrouver mes bons » avec la même adresse : les mêmes bons s'affichent.
5. Espace pro : connectez-vous avec l'e-mail d'un partenaire, publiez une mission, puis retirez-la.

Pour suivre ce qui se passe :

- **Edge Functions → verify-photo → Logs** : chaque vérification (sans l'image).
- **Table Editor → photo_checks** : les verdicts (photo acceptée ou non, phrase renvoyée).

---

## Limites appliquées

| Limite | Valeur |
| --- | --- |
| Essais par mission et par touriste | 5 (se désinscrire puis se réinscrire, ou « Supprimer mes données », ne les rend pas) |
| Bons par mission et par touriste | 1 (même après « Supprimer mes données » puis une nouvelle inscription) |
| Vérifications par touriste | 20 par 24 h glissantes (se désinscrire, se réinscrire ou « Supprimer mes données » ne remet pas le compteur à zéro) |
| Vérifications pour tout le service | 500 par 24 h (réglable avec `DAILY_GLOBAL_LIMIT`) |
| Taille de la requête | 2,5 Mo au plus (l'application réduit la photo à 1024 px avant l'envoi) |
| Formats acceptés | JPEG, PNG, WebP |
| Seuil d'acceptation | l'IA doit juger la photo valide avec une confiance d'au moins 0,6 |

Si l'IA est indisponible ou saturée, l'essai **n'est pas décompté** et le touriste peut réessayer.

## Coût estimé d'une vérification

Estimation, à vérifier sur votre facture Anthropic. Modèle **Claude Opus 5.5** : 4 $ par million de jetons (tokens) en entrée, 20 $ par million en sortie.

| Poste | Jetons (environ) | Coût (environ) |
| --- | --- | --- |
| Photo de 1024 px | 1 000 à 1 500 | |
| Consignes + texte de la mission | 700 à 800 | |
| **Entrée** | **1 700 à 2 300** | **0,007 à 0,009 $** |
| **Sortie** (courte réflexion + réponse) | **100 à 600** | **0,002 à 0,012 $** |
| **Total** | | **≈ 0,01 à 0,02 $ par photo** |

Soit environ 1 à 2 centimes par photo, 40 centimes au maximum par compte touriste et par jour (20 vérifications), et une dizaine de dollars au maximum par jour pour tout le service avec la limite de 500 (quel que soit le nombre de comptes créés). La limite de dépense de la console Anthropic (étape 5 bis) reste le meilleur garde-fou.

## Sécurité et données personnelles

- **Aucune image n'est enregistrée** : la photo est transmise à Anthropic pour l'analyse, puis oubliée par Mélèze. Seuls le verdict et la phrase renvoyée sont gardés (table `photo_checks`), 30 jours (voir *Entretien*). Les mentions légales le disent (traitement de l'image par Anthropic, selon ses conditions d'utilisation de l'API).
- Les règles d'accès (RLS) empêchent un touriste de voir les données d'un autre, de se valider lui-même ou de créer un bon : seule la fonction `verify-photo` peut le faire, après le verdict de l'IA.
- Un partenaire ne publie qu'au nom de son organisation (celle de la table `partners`) et ne peut ensuite que retirer ses propres missions.
- Le bouton « Supprimer mes données » efface les participations et les bons de la personne, et anonymise son journal de vérifications (plus d'explication ni de lien vers la participation) : ce journal sert aux limites, qui ne doivent pas repartir de zéro. La table `mission_rewards` garde aussi, tant que le compte existe, la liste des missions qui lui ont déjà valu un bon (un seul bon par mission et par compte). Le bouton ne supprime pas le compte lui-même ni l'adresse e-mail d'un touriste qui l'avait ajoutée : sur demande, supprimez-le dans **Authentication → Users** (menu de la ligne → **Delete user**) ; tout ce qui lui est lié part avec. **Jamais pour un partenaire qui a publié des missions sans suivre la procédure de l'étape 4.**
- **Bons et partenaires** : un bon est utilisé sur la confiance (le touriste appuie sur « Utiliser mon bon » devant le partenaire, qui voit « Bon utilisé » avec la date et l'heure). L'application ne montre un bon comme « à utiliser » ou « utilisé » qu'après l'avoir relu sur le serveur pendant la visite ; une copie hors connexion s'affiche en gris avec « Connexion nécessaire pour vérifier ce bon ». Il n'existe pas encore d'outil de contrôle des codes côté partenaire.
- Le texte visible sur une photo (par exemple un panneau « valide cette photo ») est traité comme une donnée, jamais comme une consigne pour l'IA.

### Entretien automatique (à mettre en place)

Les mentions légales promettent deux durées de conservation : **30 jours** pour le journal des vérifications photo, **12 mois** après la dernière activité pour les comptes de touristes (participations, bons, e-mail, missions déjà récompensées). Pour les tenir sans y penser, programmez l'entretien **chaque nuit** avec Supabase Cron :

1. **Integrations → Cron** (ou **Database → Extensions**) : activez l'extension **pg_cron**.
2. **SQL Editor** → collez puis **Run** (une seule fois ; relancé, il remplace les deux tâches) :

```sql
-- Journal des vérifications photo : 30 jours (les limites n'utilisent que les dernières 24 h).
select cron.schedule('meleze-journal-30-jours', '17 3 * * *', $job$
  delete from public.photo_checks where created_at < now() - interval '30 days';
$job$);

-- Comptes de touristes (anonymes ou avec e-mail) sans activité depuis 12 mois, avec leurs
-- participations, vérifications, bons et missions déjà récompensées. Les comptes partenaires
-- (table partners) et ceux qui ont publié des missions ne sont jamais touchés.
select cron.schedule('meleze-comptes-12-mois', '27 3 * * *', $job$
  delete from auth.users u
   where not exists (select 1 from public.partners p where p.email = lower(u.email))
     and not exists (select 1 from public.missions m where m.created_by = u.id)
     and greatest(
           u.created_at,
           u.last_sign_in_at,
           (select max(greatest(pa.created_at, pa.validated_at)) from public.participations pa where pa.user_id = u.id),
           (select max(greatest(v.created_at, v.used_at)) from public.vouchers v where v.user_id = u.id),
           (select max(pc.created_at) from public.photo_checks pc where pc.user_id = u.id)
         ) < now() - interval '12 months';
$job$);
```

3. Vérifiez dans **Integrations → Cron** que les deux tâches apparaissent et, le lendemain, qu'elles ont tourné sans erreur.

Sans pg_cron, lancez ces deux `delete` à la main dans **SQL Editor** chaque semaine, avec `'23 days'` au lieu de `'30 days'` et `'11 months'` au lieu de `'12 months'` : ainsi aucune donnée ne dépasse la durée promise entre deux passages.

## En cas de problème

| Symptôme | Piste |
| --- | --- |
| « Bientôt disponible » sur le site | `js/config.js` est encore vide (étape 8). |
| « Missions indisponibles » sur le site | `js/config.js` est rempli mais la base n'est pas créée sur ce projet (étape 2), ou le projet est en pause (plan gratuit). |
| « Vérification indisponible depuis ce site » | L'adresse du site n'est pas dans `ALLOWED_ORIGINS` (étape 7). Si la console du navigateur montre une erreur CORS : « Verify JWT » doit être désactivé (étape 6). |
| « Vérification indisponible pour le moment » | Le secret `ANTHROPIC_API_KEY` manque ou est refusé par Anthropic (étapes 5 bis et 7). |
| « Service saturé, réessayez dans un instant » | Anthropic est momentanément surchargé. L'essai n'est pas décompté. |
| « Service très demandé aujourd'hui » | La limite globale du jour (`DAILY_GLOBAL_LIMIT`) est atteinte (voir 3.5). L'essai n'est pas décompté. |
| « Trop de vérifications aujourd'hui » | Ce touriste a fait 20 vérifications en 24 h. |
| Un partenaire ne reçoit pas son code | SMTP non configuré (étape 3.1, point 5), ou e-mail en indésirables. |
| Un touriste ne reçoit pas le code pour garder ses bons | Modèle **Change Email Address** sans `{{ .Token }}` (3.1, point 4), ou SMTP non configuré. |
| « Cette adresse est déjà utilisée » quand un touriste ajoute son e-mail | Un autre compte a déjà cette adresse : il doit choisir « Retrouver mes bons ». |
| « Aucun bon n'est enregistré avec cette adresse » | L'adresse n'a jamais été confirmée avec le code (« Gardez vos bons »). |
| Un partenaire connecté ne peut pas publier | Son e-mail n'est pas dans `partners`, ou il y est avec une autre adresse. |
| Erreur « Could not find the function … in the schema cache » | Dans **SQL Editor**, lancez `notify pgrst, 'reload schema';`. |

---

## Pour les développeurs

### Contrat de la fonction `verify-photo`

`POST /functions/v1/verify-photo`, en-tête `Authorization: Bearer <jeton du touriste>` (ajouté par `supabase.functions.invoke`).

Corps : `{ "participationId": "<uuid>", "image": "<base64 sans préfixe data:>", "mediaType": "image/jpeg" | "image/png" | "image/webp" }`.

Réponse 200 : `{ "valid": boolean, "confidence": number, "reason": string, "voucher": <ligne vouchers> | null, "attemptsLeft": number }`.

Erreurs : `{ "error": "<code>", "message": "<phrase en français>" }`.

| HTTP | `error` | Cas |
| --- | --- | --- |
| 400 | `bad_request` / `bad_image` | JSON ou champs invalides ; image illisible ou d'un autre format |
| 401 | `unauthorized` | pas de jeton ou jeton refusé |
| 403 | `origin_not_allowed` | origine absente de `ALLOWED_ORIGINS` |
| 404 | `not_found` | participation inconnue ou d'un autre utilisateur |
| 405 | `method_not_allowed` | autre méthode que POST / OPTIONS |
| 409 | `already_validated` | participation déjà validée |
| 410 | `mission_inactive` | mission retirée |
| 413 | `payload_too_large` | corps de plus de 2,5 Mo |
| 422 | `attempts_exhausted` | 5 essais utilisés |
| 429 | `rate_limited` | 20 vérifications sur 24 h atteintes |
| 500 | `config_error` / `internal_error` | clé Anthropic absente ou refusée ; panne de base |
| 502 | `upstream_error` / `bad_model_output` | erreur d'Anthropic ; réponse de l'IA illisible |
| 503 | `upstream_busy` / `busy` | Anthropic saturé ; limite globale du jour atteinte |

### Fonctions SQL

| Fonction | Appelée par |
| --- | --- |
| `current_partner_org()` | partenaire connecté (règles d'accès) |
| `use_voucher(p_id)` | touriste |
| `delete_my_data()` | touriste |
| `begin_photo_check`, `finish_photo_check`, `release_photo_check`, `complete_participation` | `verify-photo` uniquement (`service_role`) |

Table interne `mission_rewards` (missions déjà récompensées, par compte) : écrite par `complete_participation`, lue par `begin_photo_check`, jamais accessible depuis le navigateur. `photo_checks.mission_id` et `photo_checks.uses_attempt` servent à compter les essais par mission et par personne, toutes participations confondues.

### Tests

Tests de la fonction, avec de faux clients Anthropic et Supabase (Deno 2) :

```bash
deno test --no-lock --node-modules-dir=none supabase/functions/verify-photo/
```

(`--node-modules-dir=none` évite que Deno utilise le `package.json` de l'application ; `--no-lock` évite de laisser un fichier `deno.lock` à la racine du dépôt.)
