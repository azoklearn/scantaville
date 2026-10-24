-- ScanTaVille · admin dashboard v2. Run once in Supabase -> SQL Editor (safe to re-run), after schema.sql.
-- Works whether or not sites.sql / coach.sql / payments.sql were run: those tables are read only when they exist.
-- Every function re-checks is_admin() on the server.

-- the whole dashboard in one call
create or replace function public.admin_dashboard() returns json
language plpgsql stable security definer set search_path = public, auth as $$
declare
  has_sites boolean := to_regclass('public.sites') is not null;
  has_coach boolean := to_regclass('public.coach') is not null;
  has_whop  boolean := to_regclass('public.whop_events') is not null;
  sites_j json := '{}'; coach_j json := '{}'; whop_j json := '{}'; feed_extra json := '[]';
  base json;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  if has_sites then
    execute $q$ select json_build_object(
      'published', (select count(*) from sites where published),
      'published_7d', (select count(*) from sites where published and created_at > now() - interval '7 days'),
      'by_day', (select coalesce(json_agg(json_build_object('day', d, 'n', n) order by d), '[]') from (select created_at::date d, count(*) n from sites where created_at > now() - interval '30 days' group by 1) t)
    ) $q$ into sites_j;
  end if;
  if has_coach then
    execute $q$ select json_build_object(
      'users', (select count(*) from coach where data ? 'plan' and data->'plan' <> 'null'::jsonb),
      'avg_goal', (select round(avg((data->'plan'->>'goal')::numeric)) from coach where (data->'plan'->>'goal') ~ '^[0-9]+(\.[0-9]+)?$'),
      'journal_notes', (select coalesce(sum(jsonb_array_length(data->'journal')), 0) from coach where jsonb_typeof(data->'journal') = 'array')
    ) $q$ into coach_j;
  end if;
  if has_whop then
    execute $q$ select json_build_object(
      'by_status', (select coalesce(json_object_agg(status, n), '{}') from (select status, count(*) n from whop_events where created_at > now() - interval '30 days' group by 1) t),
      'to_fix', (select count(*) from whop_events where status in ('pending', 'unmatched') and plan is not null and (plan_until is null or plan_until > now())),
      'payments_30d', (select count(*) from whop_events where status = 'applied' and type in ('membership.activated', 'membership.went_valid') and created_at > now() - interval '30 days')
    ) $q$ into whop_j;
    execute $q$ select coalesce(json_agg(x order by x.at desc), '[]') from (
      select w.created_at at, case when w.type like '%deactivated%' or w.type like '%invalid%' then 'churn' else 'payment' end kind,
             coalesce(w.email, p.email, 'e-mail inconnu') who, w.plan detail, w.status
      from whop_events w left join profiles p on p.id = w.applied_to
      where w.type in ('membership.activated', 'membership.went_valid', 'membership.deactivated', 'membership.went_invalid')
      order by w.created_at desc limit 15) x $q$ into feed_extra;
  end if;

  select json_build_object(
    'now', now(),
    'users', (select count(*) from profiles),
    'users_today', (select count(*) from profiles where created_at > now() - interval '1 day'),
    'users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'users_prev_7d', (select count(*) from profiles where created_at between now() - interval '14 days' and now() - interval '7 days'),
    'users_30d', (select count(*) from profiles where created_at > now() - interval '30 days'),
    'active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'admins', (select count(*) from profiles where is_admin),
    -- paying = active plan, admins excluded (their plan is a gift)
    'paying', (select count(*) from profiles where plan <> 'free' and not is_admin and (plan_until is null or plan_until > now())),
    'paying_by_plan', (select coalesce(json_object_agg(plan, n), '{}') from (select plan, count(*) n from profiles where plan <> 'free' and not is_admin and (plan_until is null or plan_until > now()) group by plan) t),
    'mrr', (select coalesce(round(sum(case plan when 'm1' then 19.9 when 'm3' then 29.9 / 3 when 'y1' then 79.0 / 12 else 0 end), 2), 0)
            from profiles where plan <> 'free' and not is_admin and (plan_until is null or plan_until > now())),
    'expired', (select count(*) from profiles where plan <> 'free' and plan_until is not null and plan_until < now()),
    'expiring', (select coalesce(json_agg(json_build_object('email', email, 'plan', plan, 'until', plan_until) order by plan_until), '[]')
                 from profiles where plan <> 'free' and not is_admin and plan_until between now() and now() + interval '7 days'),
    'signups_by_day', (select coalesce(json_agg(json_build_object('day', d, 'n', n) order by d), '[]')
                       from (select created_at::date d, count(*) n from profiles where created_at > now() - interval '30 days' group by 1) t),
    'funnel', json_build_object(
      'signed_up', (select count(*) from profiles where not is_admin),
      'tracked', (select count(distinct user_id) from pipeline),
      'won', (select count(distinct user_id) from pipeline where status = 'won'),
      'paying', (select count(*) from profiles where plan <> 'free' and not is_admin and (plan_until is null or plan_until > now()))),
    'pipeline', (select coalesce(json_object_agg(status, n), '{}') from (select status, count(*) n from pipeline group by status) t),
    'pipeline_7d', (select count(*) from pipeline where updated_at > now() - interval '7 days'),
    'top_cities', (select coalesce(json_agg(json_build_object('city', city, 'n', n, 'won', won) order by n desc), '[]')
                   from (select coalesce(city, '—') city, count(*) n, count(*) filter (where status = 'won') won from pipeline group by 1 order by 2 desc limit 8) t),
    'waitlist', (select count(*) from waitlist),
    'reports', (select count(*) from reports),
    'feed', (select coalesce(json_agg(x order by x.at desc), '[]') from (
              (select created_at at, 'signup' kind, email who, plan detail, null::text status from profiles order by created_at desc limit 15)
              union all
              (select updated_at, 'won', p.email, x.name || coalesce(' · ' || x.city, ''), null from pipeline x join profiles p on p.id = x.user_id where x.status = 'won' order by x.updated_at desc limit 10)
             ) x)
  ) into base;

  return (base::jsonb || jsonb_build_object('sites', sites_j, 'coach', coach_j, 'whop', whop_j, 'feed_whop', feed_extra))::json;
end $$;

-- users, with what they do
create or replace function public.admin_users_v2(p_search text default '', p_filter text default 'all', p_limit int default 300) returns json
language plpgsql stable security definer set search_path = public, auth as $$
declare
  has_sites boolean := to_regclass('public.sites') is not null;
  has_coach boolean := to_regclass('public.coach') is not null;
  has_funnel boolean := to_regprocedure('public.funnel_last_step(uuid)') is not null;
  res json;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  execute format($q$
    select coalesce(json_agg(r order by r.created_at desc), '[]') from (
      select p.id, p.email, p.plan, p.plan_until, p.created_at, p.is_admin, u.last_sign_in_at,
             (p.plan <> 'free' and (p.plan_until is null or p.plan_until > now())) as active,
             (select count(*) from pipeline x where x.user_id = p.id) tracked,
             (select count(*) from pipeline x where x.user_id = p.id and x.status <> 'todo') contacted,
             (select count(*) from pipeline x where x.user_id = p.id and x.status = 'won') won,
             %s sites,
             %s goal,
             %s last_step
      from profiles p left join auth.users u on u.id = p.id
      where ($1 = '' or p.email ilike '%%' || $1 || '%%')
        and case $2 when 'paying' then p.plan <> 'free' and not p.is_admin and (p.plan_until is null or p.plan_until > now())
                    when 'free' then p.plan = 'free' or (p.plan_until is not null and p.plan_until < now())
                    when 'expired' then p.plan <> 'free' and p.plan_until < now()
                    when 'active' then u.last_sign_in_at > now() - interval '7 days'
                    else true end
      order by p.created_at desc limit %s) r $q$,
    case when has_sites then '(select count(*) from sites s where s.user_id = p.id and s.published)' else '0' end,
    case when has_coach then '(select (c.data->''plan''->>''goal'') from coach c where c.user_id = p.id)' else 'null' end,
    case when has_funnel then 'public.funnel_last_step(p.id)' else 'null' end,
    least(greatest(p_limit, 1), 1000))
  into res using coalesce(p_search, ''), coalesce(p_filter, 'all');
  return res;
end $$;

-- one user, everything
create or replace function public.admin_user_detail(p_id uuid) returns json
language plpgsql stable security definer set search_path = public, auth as $$
declare res jsonb; extra json;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'profile', (select row_to_json(t) from (select p.email, p.plan, p.plan_until, p.created_at, p.is_admin, u.last_sign_in_at from profiles p left join auth.users u on u.id = p.id where p.id = p_id) t),
    'pipeline', (select coalesce(json_agg(json_build_object('name', name, 'city', city, 'status', status, 'at', updated_at) order by updated_at desc), '[]') from pipeline where user_id = p_id)
  ) into res;
  if to_regclass('public.sites') is not null then
    execute 'select coalesce(json_agg(json_build_object(''slug'', slug, ''name'', payload->>''n'', ''at'', created_at) order by created_at desc), ''[]'') from sites where user_id = $1 and published' into extra using p_id;
    res := res || jsonb_build_object('sites', extra);
  end if;
  if to_regclass('public.coach') is not null then
    execute 'select json_build_object(''plan'', data->''plan'', ''notes'', case when jsonb_typeof(data->''journal'') = ''array'' then jsonb_array_length(data->''journal'') else 0 end) from coach where user_id = $1' into extra using p_id;
    res := res || jsonb_build_object('coach', extra);
  end if;
  if to_regclass('public.whop_events') is not null then
    execute 'select coalesce(json_agg(json_build_object(''type'', type, ''plan'', plan, ''status'', status, ''at'', created_at) order by created_at desc), ''[]'') from whop_events where applied_to = $1 or lower(email) = lower((select email from profiles where id = $1))' into extra using p_id;
    res := res || jsonb_build_object('payments', extra);
  end if;
  return res::json;
end $$;

revoke all on function public.admin_dashboard(), public.admin_users_v2(text, text, int), public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_dashboard(), public.admin_users_v2(text, text, int), public.admin_user_detail(uuid) to authenticated;
