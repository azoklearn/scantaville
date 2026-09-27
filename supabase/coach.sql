-- "Mon plan" (plan.html): each user's plan, journal de bord, contacts per day and roadmap, as one JSON document.
-- Run once in Supabase -> SQL Editor.
create table if not exists public.coach (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint coach_size check (octet_length(data::text) < 300000)
);
alter table public.coach enable row level security;
drop policy if exists "own coach" on public.coach;
create policy "own coach" on public.coach for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.coach to authenticated;
