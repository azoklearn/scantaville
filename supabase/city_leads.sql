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
