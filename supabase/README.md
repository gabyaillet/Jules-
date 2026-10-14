# Mélèze — mise en service du serveur

Ce dossier contient tout ce qui tourne côté serveur :

| Fichier | Rôle |
| --- | --- |
| `migrations/0001_init.sql` | La base de données : tables, règles d'accès, fonctions. |
| `functions/verify-photo/` | La fonction qui fait vérifier la photo d'une mission par l'IA Claude, puis émet le bon. |
| `seed.sql` | Facultatif : les trois missions de départ (avec l'accord des partenaires). |

L'application elle-même reste sur GitHub Pages. Elle a besoin de deux services :

- **Supabase** : la base de données, les comptes (touristes anonymes, partenaires par code e-mail) et la fonction de vérification ;
- **Anthropic** : l'IA Claude, qui regarde la photo envoyée par le touriste.

Comptez environ 45 minutes. Aucune ligne de code à écrire : il faut seulement copier-coller.

---

## 1. Créer le projet Supabase

1. Créez un compte sur [supabase.com](https://supabase.com), puis **New project**.
2. Nom : `meleze`. **Region : une région européenne**, par exemple *West EU (Paris)* ou *Central EU (Frankfurt)*.
3. Choisissez un mot de passe de base de données solide et gardez-le dans un gestionnaire de mots de passe.
4. Attendez que le projet soit prêt (1 à 2 minutes).

> Le plan gratuit suffit pour démarrer, mais un projet gratuit est **mis en pause après 7 jours sans visite**. Pour un service ouvert au public, prévoyez le plan Pro.

## 2. Créer la base de données

1. Menu de gauche : **SQL Editor** → **New query**.
2. Ouvrez le fichier `supabase/migrations/0001_init.sql`, copiez **tout** son contenu, collez-le dans l'éditeur.
3. Cliquez **Run**. Le message attendu est *Success. No rows returned*.

Le script peut être relancé sans risque : il ne supprime aucune donnée.

## 3. Régler les connexions (Authentication)

### 3.1 Connexion par code pour les partenaires

1. **Authentication → Sign In / Providers → Email** : laissez **Enable Email provider** activé.
2. Laissez **Confirm email** activé. C'est important : sans confirmation, n'importe qui pourrait créer un compte avec l'adresse d'un partenaire.
3. **Email OTP Length** : `6`. **Email OTP Expiration** : `600` secondes (10 minutes) conviennent bien.
4. **Authentication → Emails → Templates** : l'application demande un **code à 6 chiffres**, pas un lien. Modifiez les deux modèles **Magic Link** et **Confirm signup** pour qu'ils affichent `{{ .Token }}`. Par exemple :

   - Sujet : `Votre code Mélèze`
   - Message :

     ```html
     <h2>Votre code de connexion</h2>
     <p>Saisissez ce code dans Mélèze :</p>
     <p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
     <p>Il expire dans 10 minutes. Si vous n'avez rien demandé, ignorez cet e-mail.</p>
     ```

5. **Envoi des e-mails (indispensable en production)** : le service d'e-mail intégré de Supabase sert aux essais. Il n'écrit qu'aux membres de votre équipe Supabase et seulement quelques e-mails par heure. Pour que les partenaires reçoivent leur code, branchez un vrai service d'envoi (Brevo, Resend, Mailjet…) dans **Authentication → Emails → SMTP Settings** : hôte, port, identifiant, mot de passe, et une adresse d'expédition de votre domaine.

### 3.2 Connexion anonyme pour les touristes

**Authentication → Sign In / Providers** : activez **Allow anonymous sign-ins**.

L'application ne crée un compte anonyme qu'au moment où un touriste s'inscrit à une mission, jamais pour une simple visite.

### 3.3 Adresse du site

**Authentication → URL Configuration** :

- **Site URL** : `https://gabyaillet.github.io/Jules-/`
- **Redirect URLs** : ajoutez la même adresse.

### 3.4 Protection anti-robots (étape suivante, facultative)

Supabase limite déjà le nombre de comptes anonymes créés par adresse IP (**Authentication → Rate Limits**). Pour aller plus loin, **Authentication → Attack Protection → Enable CAPTCHA protection** avec **Cloudflare Turnstile** (gratuit) est recommandé.

> ⚠ N'activez pas encore le CAPTCHA : une fois activé, l'application doit envoyer un jeton `captchaToken` à chaque connexion (anonyme et par code), ce qu'elle ne fait pas aujourd'hui. Sinon plus personne ne peut se connecter. C'est une prochaine étape à prévoir côté application.

## 4. Ajouter les partenaires

Seules les adresses e-mail listées ici peuvent publier des missions.

1. **Table Editor → partners → Insert → Insert row**.
2. `email` : l'adresse du partenaire (les majuscules et espaces sont corrigés automatiquement).
3. `org` : le nom affiché de l'organisation, de 2 à 80 caractères (ex. `Office de tourisme`).
4. **Save**.

Le partenaire se connecte ensuite dans l'espace pro de l'application avec son e-mail et le code reçu.
Pour retirer un partenaire, supprimez sa ligne : il ne peut plus publier, ses missions déjà publiées restent en ligne (il ne pourra plus les retirer ; vous pouvez passer leur colonne `active` à `false` dans **Table Editor → missions**).

## 5. Créer la clé Anthropic

1. Créez un compte sur [console.anthropic.com](https://console.anthropic.com) et ajoutez un moyen de paiement.
2. **API Keys → Create Key**, nom `meleze`. Copiez la clé (`sk-ant-…`) : elle n'est affichée qu'une fois.
3. Conseillé : fixez une **limite de dépense mensuelle** dans **Settings → Limits**.

## 6. Déployer la fonction `verify-photo`

### Option A — depuis le tableau de bord (sans rien installer)

1. **Edge Functions → Deploy a new function → Via Editor**.
2. Nom de la fonction : **`verify-photo`** (exactement).
3. Le fichier `index.ts` s'ouvre : remplacez tout son contenu par celui de `supabase/functions/verify-photo/index.ts`.
4. Ajoutez un second fichier nommé **`handler.ts`** (bouton d'ajout de fichier de l'éditeur) et collez-y le contenu de `supabase/functions/verify-photo/handler.ts`.
   Le fichier `handler_test.ts` ne sert qu'aux tests : ne le déployez pas.
5. **Deploy function**.
6. Dans les réglages de la fonction (**Details**), **désactivez « Verify JWT »** (« Enforce JWT verification »). La fonction vérifie elle-même, à chaque appel, que la personne est bien connectée ; la vérification automatique de Supabase peut en revanche bloquer la demande préalable du navigateur (CORS) et les nouvelles clés d'API.

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
| `ANTHROPIC_API_KEY` | la clé `sk-ant-…` de l'étape 5 |
| `ALLOWED_ORIGINS` | `https://gabyaillet.github.io` (sans chemin). Pour tester en local, ajoutez l'adresse séparée par une virgule : `https://gabyaillet.github.io,http://localhost:5178` |
| `DAILY_GLOBAL_LIMIT` | facultatif : nombre maximal de vérifications par 24 h pour tout le service (défaut `500`, `0` = sans limite) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase : ne les ajoutez pas.

En ligne de commande :

```bash
npx supabase secrets set --project-ref VOTRE_REF ANTHROPIC_API_KEY=sk-ant-... ALLOWED_ORIGINS=https://gabyaillet.github.io
```

## 8. Brancher l'application

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

3. Publiez le changement sur GitHub (commit + push) : GitHub Pages met le site à jour en une minute environ.

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
4. Espace pro : connectez-vous avec l'e-mail d'un partenaire, publiez une mission, puis retirez-la.

Pour suivre ce qui se passe :

- **Edge Functions → verify-photo → Logs** : chaque vérification (sans l'image).
- **Table Editor → photo_checks** : les verdicts (photo acceptée ou non, phrase renvoyée).

---

## Limites appliquées

| Limite | Valeur |
| --- | --- |
| Essais par mission et par touriste | 5 |
| Vérifications par touriste | 20 par 24 h glissantes (se désinscrire puis se réinscrire ne remet pas le compteur à zéro) |
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

Soit environ 1 à 2 centimes par photo, 40 centimes au maximum par touriste et par jour (20 vérifications), et une dizaine de dollars au maximum par jour pour tout le service avec la limite de 500. La limite de dépense de la console Anthropic (étape 5) reste le meilleur garde-fou.

## Sécurité et données personnelles

- **Aucune image n'est enregistrée** : la photo est transmise à Anthropic pour l'analyse, puis oubliée. Seuls le verdict et la phrase renvoyée sont gardés (table `photo_checks`). Pensez à le mentionner dans les mentions légales (traitement de l'image par Anthropic, selon ses conditions d'utilisation de l'API).
- Les règles d'accès (RLS) empêchent un touriste de voir les données d'un autre, de se valider lui-même ou de créer un bon : seule la fonction `verify-photo` peut le faire, après le verdict de l'IA.
- Un partenaire ne publie qu'au nom de son organisation (celle de la table `partners`) et ne peut ensuite que retirer ses propres missions.
- Le bouton « Supprimer mes données » efface les participations, bons et vérifications de la personne.
- Le texte visible sur une photo (par exemple un panneau « valide cette photo ») est traité comme une donnée, jamais comme une consigne pour l'IA.

Entretien facultatif, à lancer de temps en temps dans **SQL Editor** (les limites n'utilisent que les dernières 24 h) :

```sql
delete from public.photo_checks where created_at < now() - interval '30 days';
```

## En cas de problème

| Symptôme | Piste |
| --- | --- |
| « Bientôt disponible » sur le site | `js/config.js` est encore vide (étape 8). |
| La vérification échoue tout de suite, erreur CORS dans la console du navigateur | `ALLOWED_ORIGINS` (étape 7) ; « Verify JWT » doit être désactivé (étape 6). |
| « Le service de vérification n'est pas configuré » | Le secret `ANTHROPIC_API_KEY` manque ou est invalide. |
| « Service saturé » | Anthropic est momentanément surchargé ou la limite globale du jour est atteinte. L'essai n'est pas décompté. |
| Un partenaire ne reçoit pas son code | SMTP non configuré (étape 3.1, point 5), ou e-mail en indésirables. |
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

### Tests

Tests de la fonction, avec de faux clients Anthropic et Supabase (Deno 2) :

```bash
deno test --node-modules-dir=none supabase/functions/verify-photo/
```

(`--node-modules-dir=none` évite que Deno utilise le `package.json` de l'application.)
