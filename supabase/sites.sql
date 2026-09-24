-- Published sites: a Pro user puts a mock-up online for a shop that said yes. Served at scantaville.fr/site/<slug>.
create table if not exists public.sites (
  slug        text primary key check (slug ~ '^[a-z0-9-]{3,80}$'),
  user_id     uuid not null references auth.users (id) on delete cascade,
  payload     jsonb not null,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists sites_user on public.sites (user_id);
alter table public.sites enable row level security;
drop policy if exists "own sites" on public.sites;
create policy "own sites" on public.sites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.sites to authenticated;

-- Publishing is a Pro feature: the server checks the plan, not only the app.
create or replace function public.publish_site(p_slug text, p_payload jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare s text := p_slug; n int := 0;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if public.plan_level(auth.uid()) < 2 then raise exception 'pro plan required'; end if;
  if pg_column_size(p_payload) > 8000 then raise exception 'payload too large'; end if;
  loop
    begin
      insert into public.sites (slug, user_id, payload) values (s, auth.uid(), p_payload)
      on conflict (slug) do update set payload = excluded.payload, updated_at = now() where sites.user_id = auth.uid();
      if found then return s; end if;
    exception when unique_violation then null; end;
    n := n + 1; s := p_slug || '-' || n;
    if n > 50 then raise exception 'no free slug'; end if;
  end loop;
end $$;
grant execute on function public.publish_site(text, jsonb) to authenticated;

-- Anyone can open a published site (that is the point). Only the payload leaves, never the owner.
create or replace function public.site_get(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select payload from public.sites where slug = p_slug and published
$$;
grant execute on function public.site_get(text) to anon, authenticated;

create or replace function public.my_sites() returns table (slug text, name text, city text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select slug, payload->>'n', payload->>'c', created_at from public.sites where user_id = auth.uid() order by created_at desc
$$;
grant execute on function public.my_sites() to authenticated;
