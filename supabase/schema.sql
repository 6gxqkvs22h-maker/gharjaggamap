-- Ghar Jagga Map: database setup.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- It is safe to run more than once.

-- 1. Tables ---------------------------------------------------------------

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.site (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  label text not null,
  deal text not null default 'sale' check (deal in ('sale', 'rent')),
  color int not null default 1,
  shape int not null default 0,
  no_rate boolean not null default false,
  sort int not null default 0
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  type text not null references public.categories (id) on update cascade,
  title text not null,
  price bigint not null default 0,          -- total price in rupees, or rent per month
  rate_mode boolean not null default false, -- true when the owner typed a price per anna
  area_value numeric not null default 0,
  area_unit text not null default 'aana',   -- aana, ropani, bigha, kattha, dhur, sqm, sqft
  place text not null default '',
  district text not null default '',
  lat double precision not null,
  lng double precision not null,
  description text not null default '',
  photos jsonb not null default '[]'::jsonb,
  status text not null default 'available' check (status in ('available', 'sold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_created_idx on public.listings (created_at desc);

-- 2. Who is the owner -----------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- 3. Rules: everyone can read, only the owner can change ---------------------

alter table public.admins enable row level security;
alter table public.site enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;

drop policy if exists "admins read own row" on public.admins;
create policy "admins read own row" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "site public read" on public.site;
create policy "site public read" on public.site for select using (true);
drop policy if exists "site owner write" on public.site;
create policy "site owner write" on public.site
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories for select using (true);
drop policy if exists "categories owner write" on public.categories;
create policy "categories owner write" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "listings public read" on public.listings;
create policy "listings public read" on public.listings for select using (true);
drop policy if exists "listings owner write" on public.listings;
create policy "listings owner write" on public.listings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.site, public.categories, public.listings to anon, authenticated;
grant insert, update, delete on public.site, public.categories, public.listings to authenticated;
grant select on public.admins to authenticated;

-- 4. Starting content -----------------------------------------------------

insert into public.site (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

insert into public.categories (id, label, deal, color, shape, no_rate, sort) values
  ('house',    'House',        'sale', 1, 0, false, 1),
  ('land',     'Land',         'sale', 2, 1, false, 2),
  ('business', 'Business',     'sale', 3, 2, true,  3),
  ('shutter',  'Shutter rent', 'rent', 4, 3, false, 4),
  ('room',     'Room rent',    'rent', 5, 4, false, 5)
on conflict (id) do nothing;

-- 5. Photo storage --------------------------------------------------------

insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "photos public read" on storage.objects;
create policy "photos public read" on storage.objects
  for select using (bucket_id = 'photos');

drop policy if exists "photos owner insert" on storage.objects;
create policy "photos owner insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos' and public.is_admin());

drop policy if exists "photos owner update" on storage.objects;
create policy "photos owner update" on storage.objects
  for update to authenticated using (bucket_id = 'photos' and public.is_admin());

drop policy if exists "photos owner delete" on storage.objects;
create policy "photos owner delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and public.is_admin());
