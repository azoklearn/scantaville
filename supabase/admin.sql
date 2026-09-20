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
