-- =============================================================================
-- Mélèze — missions de départ (FACULTATIF)
--
-- ⚠ À n'exécuter qu'avec l'accord des partenaires concernés : ces trois missions
--   engagent l'Office de tourisme, les commerçants du marché, les gardes du Parc
--   et les partenaires qui offrent les récompenses (patinoire, fromagerie,
--   téléphérique). Sans leur accord écrit, ne lancez pas ce script.
--
-- Avant de l'exécuter :
--   1. Remplacez « remplacez-moi@exemple.fr » ci-dessous (une seule fois) par
--      l'e-mail du compte partenaire qui « possèdera » ces missions (lui seul
--      pourra les retirer depuis l'espace pro).
--   2. Ce compte doit exister dans Authentication > Users (le partenaire s'est
--      connecté une fois, ou vous l'avez créé avec « Add user ») ET figurer
--      dans la table « partners ».
--   3. Collez le script dans Supabase > SQL Editor puis « Run ».
--
-- Ré-exécutable : une mission qui existe déjà (même titre) n'est pas recréée.
-- =============================================================================

do $$
declare
  v_email constant text := lower('remplacez-moi@exemple.fr');  -- ← à remplacer
  v_user uuid;
begin
  if v_email = 'remplacez-moi@exemple.fr' then
    raise exception 'Remplacez d’abord « remplacez-moi@exemple.fr » par l’e-mail du partenaire (ligne v_email).';
  end if;

  select id into v_user from auth.users where lower(email) = v_email limit 1;
  if v_user is null then
    raise exception 'Aucun compte avec l’e-mail % dans Authentication > Users. Créez-le (« Add user ») ou demandez au partenaire de se connecter une fois.', v_email;
  end if;

  if not exists (select 1 from public.partners where email = v_email) then
    raise exception 'L’e-mail % n’est pas dans la table « partners ». Ajoutez-le d’abord (Table Editor > partners).', v_email;
  end if;

  -- 1. Mobilité douce
  insert into public.missions
    (created_by, org, title, type, seasons, duration_min, duration_label, location, schedule, spots,
     description, photo_hint, reward_title, reward_partner, reward_category, photo)
  select
    v_user,
    'Office de tourisme',
    'Venir en transport en commun ou en covoiturage',
    'mobilite',
    array['printemps', 'ete', 'automne', 'hiver'],
    0,
    'Le temps du trajet',
    'Votre trajet jusqu’à Pralognan',
    'Justificatif à envoyer dans les 48 h après votre arrivée',
    null,
    'Train jusqu’à Moûtiers puis car, ou covoiturage : laissez la voiture individuelle au garage. Depuis votre espace, envoyez une photo de votre billet de train ou de car, de votre réservation de covoiturage, ou une photo de vous à deux (ou plus) dans la voiture.',
    'Votre billet de train ou de bus, votre réservation de covoiturage, ou vous et votre passager dans la voiture.',
    'Entrée patinoire + location de patins',
    'Patinoire de Pralognan',
    'Expérience',
    'covoiturage'
  where not exists (
    select 1 from public.missions where title = 'Venir en transport en commun ou en covoiturage'
  );

  -- 2. Vie du village
  insert into public.missions
    (created_by, org, title, type, seasons, duration_min, duration_label, location, schedule, spots,
     description, photo_hint, reward_title, reward_partner, reward_category, photo)
  select
    v_user,
    'Les commerçants du marché',
    'Aider à monter le marché du village',
    'village',
    array['ete', 'hiver'],
    90,
    null,
    'Place du village',
    'Jour de marché · 7h00',
    6,
    'Avec les commerçants, on monte les tentes, on installe les tables et les stands avant l’arrivée des visiteurs. Aucune expérience demandée, juste de l’énergie le matin.',
    'Vous en train d’aider à monter les stands du marché.',
    'Morceau de Beaufort d’alpage (250 g)',
    'Fromagerie du Grand Marchet',
    'Produit local',
    'marche'
  where not exists (
    select 1 from public.missions where title = 'Aider à monter le marché du village'
  );

  -- 3. Sentiers & nature
  insert into public.missions
    (created_by, org, title, type, seasons, duration_min, duration_label, location, schedule, spots,
     description, photo_hint, reward_title, reward_partner, reward_category, photo)
  select
    v_user,
    'Gardes du Parc national de la Vanoise',
    'Nettoyer les sentiers avec les gardes du Parc',
    'nature',
    array['printemps', 'ete', 'automne'],
    120,
    null,
    'Parking des Fontanettes',
    'Mardi et jeudi · 9h00',
    12,
    'Avec les gardes du Parc national, on ramasse les déchets, on dégage les branches tombées et on remet en place les marches de pierre. Gants et sacs fournis, prévoyez de bonnes chaussures.',
    'Les déchets que vous avez ramassés sur le sentier.',
    'Aller-retour au téléphérique du Mont Bochor',
    'Téléphérique du Mont Bochor',
    'Expérience',
    'sentiers'
  where not exists (
    select 1 from public.missions where title = 'Nettoyer les sentiers avec les gardes du Parc'
  );
end;
$$;
