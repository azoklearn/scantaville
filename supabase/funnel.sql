-- ScanTaVille · how far people get in the quiz. Run once in Supabase -> SQL Editor (safe to re-run).
-- The browser writes one row per screen reached (session = random id per quiz run). Nobody can read the table
-- directly: only the admin functions below, which check is_admin().

create table if not exists public.funnel_events (
  id          bigserial primary key,
  session     text not null check (char_length(session) between 8 and 64),
  step        text not null check (char_length(step) between 1 and 40),
  idx         int  not null default 0,
  user_id     uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists funnel_events_session on public.funnel_events (session);
create index if not exists funnel_events_user on public.funnel_events (user_id);
create index if not exists funnel_events_created on public.funnel_events (created_at);
alter table public.funnel_events enable row level security;
drop policy if exists "write own funnel" on public.funnel_events;
create policy "write own funnel" on public.funnel_events for insert to anon, authenticated
  with check (user_id is not distinct from auth.uid());
grant insert on public.funnel_events to anon, authenticated;
grant usage on sequence public.funnel_events_id_seq to anon, authenticated;

-- drop-off: how many quiz runs reached each screen, over the last p_days days
create or replace function public.admin_funnel(p_days int default 30) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return json_build_object(
    'sessions', (select count(distinct session) from funnel_events where created_at > now() - make_interval(days => p_days)),
    'steps', (select coalesce(json_agg(json_build_object('step', step, 'idx', idx, 'n', n) order by idx), '[]') from (
      select step, min(idx) idx, count(distinct session) n from funnel_events
      where created_at > now() - make_interval(days => p_days) group by step) t),
    'last', (select coalesce(json_agg(json_build_object('step', step, 'n', n) order by n desc), '[]') from (
      select step, count(*) n from (
        select distinct on (session) session, step from funnel_events
        where created_at > now() - make_interval(days => p_days) order by session, idx desc, created_at desc) s
      group by step) t)
  );
end $$;

-- furthest screen reached by one account (its own runs, before and after signing up)
create or replace function public.funnel_last_step(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select step from funnel_events
  where session in (select session from funnel_events where user_id = p_user)
  order by idx desc, created_at desc limit 1
$$;

revoke all on function public.admin_funnel(int), public.funnel_last_step(uuid) from public, anon, authenticated;
grant execute on function public.admin_funnel(int) to authenticated;
