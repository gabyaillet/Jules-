-- =============================================================================
-- Mélèze — schéma initial de la base (Supabase / Postgres)
--
-- À exécuter UNE fois dans Supabase > SQL Editor (copier-coller, puis « Run »).
-- Le script est ré-exécutable : le relancer ne casse rien et ne perd aucune donnée.
--
-- Principes :
-- - Toutes les tables ont la sécurité par ligne (RLS) activée.
-- - Les droits sont donnés explicitement (GRANT) : rien n'est modifiable depuis
--   le navigateur sauf ce qui est listé ici.
-- - Un touriste (connexion anonyme) s'inscrit et se désinscrit ; il ne peut ni
--   valider une mission, ni créer un bon : seule la fonction « verify-photo »
--   (clé service_role) le fait, après la vérification de la photo.
-- - Un partenaire (connexion par code e-mail) publie des missions au nom de son
--   organisation, uniquement si son e-mail figure dans la table « partners ».
-- - Aucune image n'est jamais enregistrée.
-- =============================================================================

begin;

grant usage on schema public to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Partenaires (ajoutés à la main par le propriétaire, dans le Table Editor)
-- -----------------------------------------------------------------------------
create table if not exists public.partners (
  email      text primary key check (email = lower(email) and position('@' in email) > 1),
  org        text not null check (char_length(org) between 2 and 80),
  created_at timestamptz not null default now()
);

-- Confort : l'e-mail est mis en minuscules et les espaces sont retirés à la
-- saisie, pour que « Marie@Exemple.fr » fonctionne aussi.
create or replace function public.partners_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(btrim(new.email));
  new.org := btrim(new.org);
  return new;
end;
$$;

drop trigger if exists partners_normalize on public.partners;
create trigger partners_normalize
  before insert or update on public.partners
  for each row execute function public.partners_normalize();

alter table public.partners enable row level security;

revoke all on table public.partners from anon, authenticated;
grant select on table public.partners to authenticated;
grant all on table public.partners to service_role;

drop policy if exists partners_select_own on public.partners;
create policy partners_select_own on public.partners
  for select to authenticated
  using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

-- Organisation du partenaire connecté, ou null (visiteur, touriste anonyme,
-- e-mail absent de « partners »).
create or replace function public.current_partner_org()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.org
    from public.partners p
   where coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and p.email = lower(nullif(auth.jwt() ->> 'email', ''))
   limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Missions
-- -----------------------------------------------------------------------------
create table if not exists public.missions (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  org             text not null check (char_length(org) between 1 and 80),
  title           text not null check (char_length(btrim(title)) >= 3 and char_length(title) <= 120),
  type            text not null check (type in ('mobilite', 'village', 'nature')),
  seasons         text[] not null check (
                    cardinality(seasons) >= 1
                    and seasons <@ array['printemps', 'ete', 'automne', 'hiver']::text[]
                  ),
  duration_min    integer not null default 0 check (duration_min between 0 and 600),
  duration_label  text check (duration_label is null or char_length(duration_label) <= 60),
  location        text not null check (char_length(btrim(location)) >= 1 and char_length(location) <= 120),
  schedule        text check (schedule is null or char_length(schedule) <= 160),
  spots           integer check (spots is null or spots between 1 and 500),
  description     text not null check (char_length(btrim(description)) >= 1 and char_length(description) <= 1500),
  photo_hint      text not null check (char_length(btrim(photo_hint)) >= 5 and char_length(photo_hint) <= 300),
  reward_title    text not null check (char_length(btrim(reward_title)) >= 1 and char_length(reward_title) <= 120),
  reward_partner  text not null check (char_length(btrim(reward_partner)) >= 1 and char_length(reward_partner) <= 80),
  reward_category text not null check (char_length(btrim(reward_category)) >= 1 and char_length(reward_category) <= 40),
  photo           text check (photo is null or photo ~ '^[a-z0-9_-]{1,40}$'),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists missions_active_created_idx on public.missions (active, created_at desc);
create index if not exists missions_created_by_idx on public.missions (created_by);

-- Confort : les champs facultatifs envoyés vides deviennent null.
create or replace function public.missions_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.duration_label := nullif(btrim(new.duration_label), '');
  new.schedule := nullif(btrim(new.schedule), '');
  new.photo := nullif(btrim(new.photo), '');
  return new;
end;
$$;

drop trigger if exists missions_normalize on public.missions;
create trigger missions_normalize
  before insert on public.missions
  for each row execute function public.missions_normalize();

-- -----------------------------------------------------------------------------
-- Participations (un touriste inscrit à une mission)
-- -----------------------------------------------------------------------------
create table if not exists public.participations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mission_id   uuid not null references public.missions (id) on delete cascade,
  status       text not null default 'inscrite' check (status in ('inscrite', 'validee')),
  attempts     integer not null default 0 check (attempts >= 0),
  last_check   jsonb,
  created_at   timestamptz not null default now(),
  validated_at timestamptz,
  unique (user_id, mission_id)
);

create index if not exists participations_mission_idx on public.participations (mission_id);

-- -----------------------------------------------------------------------------
-- Bons de récompense (créés uniquement par complete_participation)
-- Le contenu de la récompense est copié au moment de la validation : le bon
-- reste valable même si la mission est ensuite retirée.
-- -----------------------------------------------------------------------------
create table if not exists public.vouchers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  participation_id uuid not null unique references public.participations (id) on delete cascade,
  mission_id       uuid references public.missions (id) on delete set null,
  code             text not null unique check (code ~ '^MLZ-B-[A-HJ-NP-Z2-9]{4}$'),
  reward_title     text not null,
  reward_partner   text not null,
  reward_category  text not null,
  created_at       timestamptz not null default now(),
  used_at          timestamptz
);

create index if not exists vouchers_user_idx on public.vouchers (user_id);

-- -----------------------------------------------------------------------------
-- Vérifications de photo (journal, sans aucune image)
-- - Une ligne est réservée (pending = true) AVANT l'appel à l'IA, puis complétée :
--   les limites (essais par mission, vérifications par jour) tiennent donc même
--   si plusieurs envois partent en même temps.
-- - participation_id passe à null si le touriste se désinscrit : la ligne reste
--   comptée dans la limite quotidienne (se désinscrire puis se réinscrire ne
--   remet pas le compteur du jour à zéro). « Supprimer mes données » l'efface.
-- -----------------------------------------------------------------------------
create table if not exists public.photo_checks (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  participation_id uuid references public.participations (id) on delete set null,
  valid            boolean not null default false,
  confidence       real,
  reason           text,
  pending          boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists photo_checks_user_created_idx on public.photo_checks (user_id, created_at desc);
create index if not exists photo_checks_created_idx on public.photo_checks (created_at desc);
create index if not exists photo_checks_participation_idx on public.photo_checks (participation_id);

-- -----------------------------------------------------------------------------
-- Sécurité par ligne et droits
-- -----------------------------------------------------------------------------
alter table public.missions enable row level security;
alter table public.participations enable row level security;
alter table public.vouchers enable row level security;
alter table public.photo_checks enable row level security;

revoke all on table public.missions, public.participations, public.vouchers, public.photo_checks
  from anon, authenticated;

-- Missions : tout le monde lit les missions actives ; un partenaire publie ;
-- il ne peut ensuite modifier que la colonne « active » (« Retirer »).
grant select on table public.missions to anon, authenticated;
grant insert on table public.missions to authenticated;
grant update (active) on table public.missions to authenticated;

-- Participations : le touriste lit, s'inscrit, se désinscrit. Jamais d'UPDATE.
grant select, insert, delete on table public.participations to authenticated;

-- Bons et vérifications : lecture seule de ses propres lignes.
grant select on table public.vouchers to authenticated;
grant select on table public.photo_checks to authenticated;

grant all on table public.missions, public.participations, public.vouchers, public.photo_checks
  to service_role;

-- Missions
drop policy if exists missions_select_active on public.missions;
create policy missions_select_active on public.missions
  for select to anon, authenticated
  using (active);

drop policy if exists missions_select_own on public.missions;
create policy missions_select_own on public.missions
  for select to authenticated
  using (created_by = (select auth.uid()));

-- Un touriste continue de voir une mission à laquelle il a participé, même
-- retirée. (Fonction security definer : évite une boucle entre les règles de
-- « missions » et de « participations ».)
create or replace function public.has_joined_mission(p_mission uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.participations p
     where p.mission_id = p_mission
       and p.user_id = auth.uid()
  );
$$;

drop policy if exists missions_select_joined on public.missions;
create policy missions_select_joined on public.missions
  for select to authenticated
  using (public.has_joined_mission(id));

drop policy if exists missions_insert_partner on public.missions;
create policy missions_insert_partner on public.missions
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select public.current_partner_org()) is not null
    and org = (select public.current_partner_org())
  );

drop policy if exists missions_update_own on public.missions;
create policy missions_update_own on public.missions
  for update to authenticated
  using (created_by = (select auth.uid()) and (select public.current_partner_org()) is not null)
  with check (created_by = (select auth.uid()) and (select public.current_partner_org()) is not null);

-- Participations
drop policy if exists participations_select_own on public.participations;
create policy participations_select_own on public.participations
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists participations_insert_own on public.participations;
create policy participations_insert_own on public.participations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'inscrite'
    and attempts = 0
    and last_check is null
    and validated_at is null
    and exists (select 1 from public.missions m where m.id = mission_id and m.active)
  );

drop policy if exists participations_delete_own on public.participations;
create policy participations_delete_own on public.participations
  for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'inscrite');

-- Bons
drop policy if exists vouchers_select_own on public.vouchers;
create policy vouchers_select_own on public.vouchers
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Vérifications de photo
drop policy if exists photo_checks_select_own on public.photo_checks;
create policy photo_checks_select_own on public.photo_checks
  for select to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Fonctions
-- -----------------------------------------------------------------------------

-- Code de bon lisible : MLZ-B-XXXX, sans I ni O (même alphabet que l'app).
create or replace function public.generate_voucher_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 caractères
  bytes bytea := uuid_send(gen_random_uuid());                  -- octets 0..5 aléatoires
  code text := 'MLZ-B-';
begin
  for i in 0..3 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- Valide une participation et émet son bon, en une seule transaction.
-- Réservée à la fonction verify-photo (service_role).
-- Renvoie null si la participation n'est plus « inscrite » (déjà validée).
create or replace function public.complete_participation(p_participation uuid, p_verdict jsonb)
returns public.vouchers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part public.participations%rowtype;
  v_mission public.missions%rowtype;
  v_voucher public.vouchers%rowtype;
  v_constraint text;
begin
  select * into v_part
    from public.participations
   where id = p_participation
   for update;
  if not found then
    raise exception 'Participation introuvable.' using errcode = 'P0002';
  end if;
  if v_part.status <> 'inscrite' then
    return null;
  end if;

  select * into v_mission from public.missions where id = v_part.mission_id;
  if not found then
    raise exception 'Mission introuvable.' using errcode = 'P0002';
  end if;

  update public.participations
     set status = 'validee',
         validated_at = now(),
         last_check = p_verdict
   where id = p_participation;

  for i in 1..20 loop
    begin
      insert into public.vouchers
        (user_id, participation_id, mission_id, code, reward_title, reward_partner, reward_category)
      values
        (v_part.user_id, v_part.id, v_part.mission_id, public.generate_voucher_code(),
         v_mission.reward_title, v_mission.reward_partner, v_mission.reward_category)
      returning * into v_voucher;
      return v_voucher;
    exception when unique_violation then
      -- Code déjà pris : on retire un nouveau code. Toute autre violation remonte.
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint is distinct from 'vouchers_code_key' or i = 20 then
        raise;
      end if;
    end;
  end loop;
  return null;
end;
$$;

-- Le touriste présente son bon au partenaire et le marque comme utilisé.
create or replace function public.use_voucher(p_id uuid)
returns public.vouchers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_voucher public.vouchers%rowtype;
begin
  if v_uid is null then
    raise exception 'Vous n’êtes pas connecté.' using errcode = '42501';
  end if;

  update public.vouchers
     set used_at = now()
   where id = p_id
     and user_id = v_uid
     and used_at is null
  returning * into v_voucher;

  if not found then
    if exists (select 1 from public.vouchers where id = p_id and user_id = v_uid) then
      raise exception 'Ce bon a déjà été utilisé.' using errcode = 'P0001';
    end if;
    raise exception 'Bon introuvable.' using errcode = 'P0002';
  end if;
  return v_voucher;
end;
$$;

-- « Supprimer mes données » : efface les participations, bons et vérifications
-- de la personne connectée (les missions publiées par un partenaire restent).
create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Vous n’êtes pas connecté.' using errcode = '42501';
  end if;
  delete from public.photo_checks where user_id = v_uid;
  delete from public.participations where user_id = v_uid; -- supprime aussi les bons (cascade)
  delete from public.vouchers where user_id = v_uid;
end;
$$;

-- Réserve une vérification de photo avant l'appel à l'IA (service_role).
-- Contrôles, dans l'ordre : participation de cet utilisateur, encore
-- « inscrite », essais restants, mission active, limite par personne sur 24 h,
-- limite globale sur 24 h (0 = pas de limite). Renvoie
-- { ok: true, check_id, title, photo_hint, attempts, max_attempts }
-- ou { ok: false, error: 'not_found' | 'already_validated' | 'attempts_exhausted'
--      | 'mission_inactive' | 'rate_limited' | 'global_limit' }.
create or replace function public.begin_photo_check(
  p_participation uuid,
  p_user uuid,
  p_max_attempts integer default 5,
  p_user_daily_limit integer default 20,
  p_global_daily_limit integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part public.participations%rowtype;
  v_mission public.missions%rowtype;
  v_count integer;
  v_check bigint;
begin
  select * into v_part
    from public.participations
   where id = p_participation
   for update;
  if not found or v_part.user_id is distinct from p_user then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_part.status <> 'inscrite' then
    return jsonb_build_object('ok', false, 'error', 'already_validated');
  end if;
  if v_part.attempts >= p_max_attempts then
    return jsonb_build_object('ok', false, 'error', 'attempts_exhausted',
                              'attempts', v_part.attempts, 'max_attempts', p_max_attempts);
  end if;

  select * into v_mission from public.missions where id = v_part.mission_id;
  if not found or not v_mission.active then
    return jsonb_build_object('ok', false, 'error', 'mission_inactive');
  end if;

  -- Un seul calcul de quota à la fois par personne (puis pour tout le service).
  perform pg_advisory_xact_lock(hashtextextended('meleze:photo-check:' || p_user::text, 0));
  select count(*) into v_count
    from public.photo_checks
   where user_id = p_user
     and created_at > now() - interval '24 hours';
  if v_count >= p_user_daily_limit then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if coalesce(p_global_daily_limit, 0) > 0 then
    perform pg_advisory_xact_lock(hashtextextended('meleze:photo-check:global', 0));
    select count(*) into v_count
      from public.photo_checks
     where created_at > now() - interval '24 hours';
    if v_count >= p_global_daily_limit then
      return jsonb_build_object('ok', false, 'error', 'global_limit');
    end if;
  end if;

  update public.participations
     set attempts = attempts + 1
   where id = p_participation;

  insert into public.photo_checks (user_id, participation_id)
  values (p_user, p_participation)
  returning id into v_check;

  return jsonb_build_object(
    'ok', true,
    'check_id', v_check,
    'title', v_mission.title,
    'photo_hint', v_mission.photo_hint,
    'attempts', v_part.attempts + 1,
    'max_attempts', p_max_attempts
  );
end;
$$;

-- Enregistre le verdict de l'IA (service_role). Si la photo est refusée, le
-- verdict est aussi gardé dans participations.last_check.
create or replace function public.finish_photo_check(
  p_check bigint,
  p_valid boolean,
  p_confidence real,
  p_reason text,
  p_verdict jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part uuid;
begin
  update public.photo_checks
     set pending = false,
         valid = coalesce(p_valid, false),
         confidence = p_confidence,
         reason = left(p_reason, 300)
   where id = p_check
  returning participation_id into v_part;

  if not coalesce(p_valid, false) and v_part is not null then
    update public.participations
       set last_check = p_verdict
     where id = v_part
       and status = 'inscrite';
  end if;
end;
$$;

-- Annule une réservation quand l'IA n'a pas pu répondre (service_role) :
-- l'essai est rendu au touriste. Avec p_count_in_quota = true, la ligne reste
-- comptée dans la limite quotidienne (l'appel a coûté quelque chose).
create or replace function public.release_photo_check(
  p_check bigint,
  p_count_in_quota boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part uuid;
begin
  if p_count_in_quota then
    update public.photo_checks
       set pending = false,
           valid = false,
           reason = 'Vérification interrompue.'
     where id = p_check
       and pending
    returning participation_id into v_part;
  else
    delete from public.photo_checks
     where id = p_check
       and pending
    returning participation_id into v_part;
  end if;

  if v_part is not null then
    update public.participations
       set attempts = greatest(attempts - 1, 0)
     where id = v_part
       and status = 'inscrite';
  end if;
end;
$$;

-- Droits d'exécution : rien pour « public » ni « anon » par défaut.
revoke execute on function public.partners_normalize() from public, anon, authenticated;
revoke execute on function public.missions_normalize() from public, anon, authenticated;
revoke execute on function public.generate_voucher_code() from public, anon, authenticated;

revoke execute on function public.current_partner_org() from public, anon;
grant execute on function public.current_partner_org() to authenticated, service_role;

revoke execute on function public.has_joined_mission(uuid) from public, anon;
grant execute on function public.has_joined_mission(uuid) to authenticated, service_role;

revoke execute on function public.use_voucher(uuid) from public, anon;
grant execute on function public.use_voucher(uuid) to authenticated;

revoke execute on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

revoke execute on function public.complete_participation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_participation(uuid, jsonb) to service_role;

revoke execute on function public.begin_photo_check(uuid, uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.begin_photo_check(uuid, uuid, integer, integer, integer) to service_role;

revoke execute on function public.finish_photo_check(bigint, boolean, real, text, jsonb) from public, anon, authenticated;
grant execute on function public.finish_photo_check(bigint, boolean, real, text, jsonb) to service_role;

revoke execute on function public.release_photo_check(bigint, boolean) from public, anon, authenticated;
grant execute on function public.release_photo_check(bigint, boolean) to service_role;

commit;
