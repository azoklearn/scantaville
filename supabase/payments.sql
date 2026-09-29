-- ScanTaVille · Whop payments. Run once in Supabase -> SQL Editor (safe to re-run).
--
-- Every webhook event is logged in whop_events, so a payment can no longer vanish:
--   applied   the plan was put on an account (matched by Whop user id, then by e-mail)
--   pending   no account with that e-mail yet: applied automatically when it signs up, or claimed from the profile page
--   unmatched Whop sent no e-mail (the webhook lacks the member:email:read permission): assign it from the admin page
--   ignored   an event we do not act on (unknown plan, other event type)
-- Nobody reads this table directly (RLS on, no policy): only the webhook (service role) and the functions below.

alter table public.profiles add column if not exists whop_user_id text;
alter table public.profiles add column if not exists whop_membership_id text;
alter table public.profiles add column if not exists whop_manage_url text;
create index if not exists profiles_email_lower on public.profiles (lower(email));
create index if not exists profiles_whop_user on public.profiles (whop_user_id);

create table if not exists public.whop_events (
  id             bigserial primary key,
  webhook_id     text unique,                    -- Whop retries an event with the same id: processed once
  type           text not null,
  email          text,
  whop_user_id   text,
  membership_id  text,
  whop_plan      text,
  plan           text,                           -- m1 / m3 / y1 once mapped
  plan_until     timestamptz,
  manage_url     text,
  status         text not null default 'received' check (status in ('received', 'applied', 'pending', 'unmatched', 'ignored', 'error')),
  note           text,
  applied_to     uuid references auth.users (id) on delete set null,
  payload        jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists whop_events_email on public.whop_events (lower(email));
alter table public.whop_events enable row level security;
revoke all on public.whop_events from anon, authenticated;

-- puts one event's plan on one account
create or replace function public.whop_apply_event(p_event bigint, p_user uuid, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare e public.whop_events;
begin
  select * into e from public.whop_events where id = p_event for update;
  if e.id is null or e.plan is null then return null; end if;
  update public.profiles set plan = e.plan, plan_until = e.plan_until,
    whop_user_id = coalesce(e.whop_user_id, whop_user_id), whop_membership_id = coalesce(e.membership_id, whop_membership_id),
    whop_manage_url = coalesce(e.manage_url, whop_manage_url)
  where id = p_user;
  update public.whop_events set status = 'applied', applied_to = p_user, note = coalesce(p_note, note) where id = p_event;
  return e.plan;
end $$;
revoke all on function public.whop_apply_event(bigint, uuid, text) from public, anon, authenticated;

-- someone paid before creating the account: the plan is waiting for them at sign-up
create or replace function public.whop_claim_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev bigint;
begin
  if new.email is null then return new; end if;
  select id into ev from public.whop_events
   where status = 'pending' and plan is not null and lower(email) = lower(new.email) and (plan_until is null or plan_until > now())
   order by created_at desc limit 1;
  if ev is not null then perform public.whop_apply_event(ev, new.id, 'appliqué à l''inscription'); end if;
  return new;
end $$;
drop trigger if exists on_profile_claim_whop on public.profiles;
create trigger on_profile_claim_whop after insert on public.profiles for each row execute function public.whop_claim_on_signup();

-- profile page: "I paid with another e-mail" -> the signed-in user claims a waiting payment made with that e-mail
create or replace function public.claim_whop_purchase(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare ev bigint;
begin
  if auth.uid() is null then raise exception 'sign in'; end if;
  select id into ev from public.whop_events
   where status in ('pending', 'unmatched') and plan is not null and email is not null and lower(email) = lower(trim(p_email))
     and (plan_until is null or plan_until > now()) and created_at > now() - interval '60 days'
   order by created_at desc limit 1;
  if ev is null then return null; end if;
  return public.whop_apply_event(ev, auth.uid(), 'réclamé depuis le profil');
end $$;
revoke all on function public.claim_whop_purchase(text) from public, anon;
grant execute on function public.claim_whop_purchase(text) to authenticated;

-- admin page: the payment log, and assigning a payment to an account by e-mail
create or replace function public.admin_whop_events(p_limit int default 100) returns table (
  id bigint, created_at timestamptz, type text, email text, whop_user_id text, plan text, plan_until timestamptz, status text, note text, applied_email text
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select w.id, w.created_at, w.type, w.email, w.whop_user_id, w.plan, w.plan_until, w.status, w.note, p.email
    from public.whop_events w left join public.profiles p on p.id = w.applied_to
    order by w.created_at desc limit least(greatest(p_limit, 1), 500);
end $$;

create or replace function public.admin_assign_whop_event(p_event bigint, p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(p_email)) limit 1;
  if uid is null then raise exception 'no account'; end if;
  return public.whop_apply_event(p_event, uid, 'attribué à la main');
end $$;
revoke all on function public.admin_whop_events(int), public.admin_assign_whop_event(bigint, text) from public, anon;
grant execute on function public.admin_whop_events(int), public.admin_assign_whop_event(bigint, text) to authenticated;
