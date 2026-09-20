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
    select case public.plan_level(auth.uid()) when 0 then 5 when 1 then 20 when 2 then 100 else 2147483647 end as n
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
