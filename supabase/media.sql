-- Photos uploaded by users for their sites (Supabase Storage, free tier: 1 GB). Public read, each user writes
-- only in their own folder. Run once in the SQL editor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sites-media', 'sites-media', true, 2000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2000000, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'sites-media');
drop policy if exists "media own write" on storage.objects;
create policy "media own write" on storage.objects for insert to authenticated
  with check (bucket_id = 'sites-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media own delete" on storage.objects;
create policy "media own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'sites-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- a site with edits and a few image links is bigger than the first limit
create or replace function public.publish_site(p_slug text, p_payload jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare s text := p_slug; n int := 0;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if public.plan_level(auth.uid()) < 2 then raise exception 'pro plan required'; end if;
  if pg_column_size(p_payload) > 20000 then raise exception 'payload too large'; end if;
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
