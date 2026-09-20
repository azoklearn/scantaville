-- ScanTaVille · Supabase schema. Paste in the SQL editor of the project (or `supabase db push`), once.
-- Safe to re-run: everything is "if not exists" / "create or replace".
--
-- What lives here, and why:
--   profiles   the user's plan. THE source of truth for what is unlocked. Written only by the server (payment webhook).
--   leads      the shops. No direct read access at all: they are served by city_leads(), which hides the details of
--              the shops a plan has not unlocked. This is what makes the paywall real (the static JSON cannot).
--   pipeline   each user's follow-up (contacté, RDV, signé), synced across devices.
--   reports    "il a déjà un site" / "confirmé sans site": the shared, verified dataset.
--   waitlist   e-mails collected by the paywall while payments are not open.

-- ─────────────────────────────────────────── profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  plan        text not null default 'free' check (plan in ('free', 'm1', 'm3', 'y1')),
  plan_until  timestamptz,                      -- null = no end date
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
-- no insert / update / delete policy: users can never change their own plan.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- 0 free · 1 Essentiel · 2 Pro · 3 Illimité. An expired plan counts as free.
create or replace function public.plan_level(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case plan when 'm1' then 1 when 'm3' then 2 when 'y1' then 3 else 0 end
    from public.profiles where id = p_user and (plan_until is null or plan_until > now())
  ), 0)
$$;

-- Called by the payment webhook (service role only): set_plan('client@mail.fr', 'm3', now() + interval '3 months')
create or replace function public.set_plan(p_email text, p_plan text, p_until timestamptz) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set plan = p_plan, plan_until = p_until where lower(email) = lower(p_email);
end $$;
revoke all on function public.set_plan(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.set_plan(text, text, timestamptz) to service_role;

-- ─────────────────────────────────────────── leads (filled by scripts/push-to-supabase.mjs)
create table if not exists public.leads (
  id           text not null,                   -- OSM id, e.g. n123456
  city_insee   text not null,
  name         text not null,
  trade        text not null,
  tier         text not null check (tier in ('gold', 'social', 'silver')),
  lat          double precision not null,
  lon          double precision not null,
  addr         text,
  phone        text,
  hours        text,
  email        text,
  social       jsonb not null default '{}'::jsonb,
  cuisine      text,
  siret        text,
  domain       text,
  unlock_rank  int not null,                    -- 0 = first shop unlocked in its city (round-robin across trades)
  primary key (city_insee, id)
);
create index if not exists leads_city_rank on public.leads (city_insee, unlock_rank);
alter table public.leads enable row level security;   -- and NO policy: nobody reads this table directly.

-- Every pin of the city, but the details only for the shops the caller's plan unlocks.
-- Limits must match LIMITS.leadsPerCity in js/plans.mjs.
create or replace function public.city_leads(p_insee text)
returns table (id text, trade text, tier text, lat double precision, lon double precision, locked boolean,
               name text, addr text, phone text, hours text, email text, social jsonb, cuisine text, siret text, domain text)
language sql stable security definer set search_path = public as $$
  with lim as (
    select case public.plan_level(auth.uid()) when 0 then 0 when 1 then 20 when 2 then 100 else 2147483647 end as n
  )
  select l.id, l.trade, l.tier, l.lat, l.lon,
         (l.tier = 'silver' or l.unlock_rank >= lim.n) as locked,
         case when l.tier <> 'silver' and l.unlock_rank < lim.n then l.name    end,
         case when l.tier <> 'silver' and l.unlock_rank < lim.n then l.addr    end,
         case when l.tier <> 'silver' and l.unlock_rank < lim.n then l.phone   end,
         case when l.tier <> 'silver' and l.unlock_rank < lim.n then l.hours   end,
         case when l.tier <> 'silver' and l.unlock_rank < lim.n then l.email   end,
         case when l.tier <> 'silver' and l.unlock_rank < lim.n then l.social  else '{}'::jsonb end,
         case when l.tier <> 'silver' and l.unlock_rank < lim.n then l.cuisine end,
         case when l.tier <> 'silver' and l.unlock_rank < lim.n then l.siret   end,
         case when l.tier <> 'silver' and l.unlock_rank < lim.n then l.domain  end
  from public.leads l, lim
  where l.city_insee = p_insee and l.tier <> 'silver'
  order by l.unlock_rank
$$;
grant execute on function public.city_leads(text) to anon, authenticated;

-- ─────────────────────────────────────────── pipeline
create table if not exists public.pipeline (
  user_id     uuid not null references auth.users (id) on delete cascade,
  lead_id     text not null,
  city_insee  text,
  city        text,
  name        text,
  status      text not null check (status in ('todo', 'contacted', 'meeting', 'won', 'lost')),
  updated_at  timestamptz not null default now(),
  primary key (user_id, lead_id)
);
alter table public.pipeline enable row level security;
drop policy if exists "own pipeline" on public.pipeline;
create policy "own pipeline" on public.pipeline for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────── reports ("il a déjà un site")
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  city_insee  text not null,
  lead_id     text not null,
  kind        text not null check (kind in ('has_site', 'no_site')),
  created_at  timestamptz not null default now(),
  unique (user_id, city_insee, lead_id)
);
alter table public.reports enable row level security;
drop policy if exists "write own reports" on public.reports;
create policy "write own reports" on public.reports for insert with check (auth.uid() = user_id);
drop policy if exists "read own reports" on public.reports;
create policy "read own reports" on public.reports for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────── waitlist
create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) < 200),
  plan        text,
  created_at  timestamptz not null default now()
);
alter table public.waitlist enable row level security;
drop policy if exists "anyone can join" on public.waitlist;
create policy "anyone can join" on public.waitlist for insert to anon, authenticated with check (true);
-- no select policy: only you (dashboard / service role) can read the list.

-- ─────────────────────────────────────────── grants
-- Some projects do not give the API roles default privileges on tables created from the SQL editor:
-- without these lines the import answers "permission denied for table leads". Row-level security still applies
-- to anon / authenticated; service_role (import script, webhook) bypasses it by design.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.pipeline to authenticated;
grant select, insert on public.reports to authenticated;
grant insert on public.waitlist to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;

-- ─────────────────────────────────────────── admin (admin.html)
-- Make yourself admin once, from the SQL editor:  update public.profiles set is_admin = true where email = 'toi@mail.fr';
-- Every admin function re-checks is_admin on the server: hiding the page is not what protects the data.
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.admin_overview() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return json_build_object(
    'users',        (select count(*) from profiles),
    'users_7d',     (select count(*) from profiles where created_at > now() - interval '7 days'),
    'users_today',  (select count(*) from profiles where created_at > now() - interval '1 day'),
    'paying',       (select count(*) from profiles where plan <> 'free' and (plan_until is null or plan_until > now())),
    'by_plan',      (select coalesce(json_object_agg(plan, n), '{}'::json) from (select plan, count(*) n from profiles where plan_until is null or plan_until > now() or plan = 'free' group by plan) t),
    'waitlist',     (select count(*) from waitlist),
    'pipeline',     (select coalesce(json_object_agg(status, n), '{}'::json) from (select status, count(*) n from pipeline group by status) t),
    'reports',      (select count(*) from reports),
    'signups_by_day', (select coalesce(json_agg(json_build_object('day', d, 'n', n) order by d), '[]'::json)
                       from (select date_trunc('day', created_at)::date d, count(*) n from profiles where created_at > now() - interval '30 days' group by 1) t)
  );
end $$;

create or replace function public.admin_users(p_search text default '', p_limit int default 200)
returns table (id uuid, email text, plan text, plan_until timestamptz, created_at timestamptz, last_sign_in_at timestamptz, won bigint, tracked bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id, p.email, p.plan, p.plan_until, p.created_at, u.last_sign_in_at,
           (select count(*) from public.pipeline x where x.user_id = p.id and x.status = 'won'),
           (select count(*) from public.pipeline x where x.user_id = p.id)
    from public.profiles p left join auth.users u on u.id = p.id
    where p_search = '' or p.email ilike '%' || p_search || '%'
    order by p.created_at desc limit least(greatest(p_limit, 1), 1000);
end $$;

create or replace function public.admin_waitlist(p_limit int default 200)
returns table (email text, plan text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select w.email, w.plan, w.created_at from public.waitlist w order by w.created_at desc limit least(greatest(p_limit, 1), 1000);
end $$;

-- give or remove a plan by hand (support, gifts, a payment the webhook missed)
create or replace function public.admin_set_plan(p_email text, p_plan text, p_until timestamptz) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_plan not in ('free', 'm1', 'm3', 'y1') then raise exception 'unknown plan'; end if;
  update public.profiles set plan = p_plan, plan_until = p_until where lower(email) = lower(p_email);
end $$;

revoke all on function public.admin_overview(), public.admin_users(text, int), public.admin_waitlist(int), public.admin_set_plan(text, text, timestamptz) from public, anon;
grant execute on function public.is_admin(), public.admin_overview(), public.admin_users(text, int), public.admin_waitlist(int), public.admin_set_plan(text, text, timestamptz) to authenticated;
