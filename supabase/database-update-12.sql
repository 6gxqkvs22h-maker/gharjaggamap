-- Update 12: people can send a request to have their property added. Run this once in Supabase > SQL Editor > New query > Run.
-- It is safe to run again.

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (char_length(phone) between 5 and 30),
  email text check (email is null or char_length(email) <= 120),
  category text not null check (char_length(category) <= 60),
  payload jsonb not null check (pg_column_size(payload) < 80000),
  status text not null default 'new' check (status in ('new', 'approved', 'rejected')),
  listing_id text
);
alter table public.requests enable row level security;

drop policy if exists "requests anyone add" on public.requests;
create policy "requests anyone add" on public.requests
  for insert to anon, authenticated
  with check (status = 'new' and listing_id is null and (user_id is null or user_id = auth.uid()));

drop policy if exists "requests owner read" on public.requests;
create policy "requests owner read" on public.requests
  for select to authenticated using (public.is_admin());

drop policy if exists "requests owner change" on public.requests;
create policy "requests owner change" on public.requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "requests owner remove" on public.requests;
create policy "requests owner remove" on public.requests
  for delete to authenticated using (public.is_admin());

-- Visitors may upload photos for a request, only inside the "requests" folder of the photo storage.
drop policy if exists "photos request insert" on storage.objects;
create policy "photos request insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = 'requests');
