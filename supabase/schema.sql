-- Ghar Jagga Map: database setup AND update.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- It is safe to run more than once. It only ADDS things: it never deletes a listing,
-- never renames a column and never changes a price, photo or location you already saved.

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

-- 1b. Update 2: category-by-category details ----------------------------------
-- Existing columns are reused: "type" is the category, "price" is the total price or the
-- monthly rent, "area_value" + "area_unit" is the land area (land, house, business) or the
-- size in sq ft / sq m (flat, shutter, room). Only what was missing is added below.

alter table public.categories add column if not exists form text;  -- which form a category uses: land, house, business, shutter, room, flat

alter table public.listings
  add column if not exists deal_type text,                 -- sale or rent (was fixed per category before)
  add column if not exists property_subtype text,          -- "2 BHK", "Single room", "Office" ...
  add column if not exists social_post_url text,           -- link to the Facebook / Instagram / TikTok post of this property
  add column if not exists road_width numeric,             -- feet
  add column if not exists road_type text,
  add column if not exists facing text,
  add column if not exists land_shape text,
  add column if not exists land_surface text,
  add column if not exists frontage numeric,               -- feet
  add column if not exists road_sides smallint,
  add column if not exists built_up_area numeric,
  add column if not exists built_up_area_unit text,        -- sqft or sqm
  add column if not exists bedrooms smallint,
  add column if not exists bathrooms smallint,
  add column if not exists floors numeric,                  -- 2.5 floors is common
  add column if not exists parking text,
  add column if not exists furnished text,
  add column if not exists water boolean,
  add column if not exists electricity boolean,
  add column if not exists internet boolean,
  add column if not exists lift boolean,
  add column if not exists balcony boolean,
  add column if not exists deposit bigint,
  add column if not exists suitable_for text,
  add column if not exists built_year smallint,
  add column if not exists details jsonb not null default '{}'::jsonb;  -- smaller facts: kitta number, landmark, which floor, kitchen ...

-- Old listings took sale / rent from their category. Copy that onto each listing once.
update public.listings l set deal_type = c.deal
  from public.categories c
  where c.id = l.type and l.deal_type is null;

-- Statuses: available, sold, rented, unavailable (hidden from visitors, not deleted).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.listings'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%status%' or pg_get_constraintdef(oid) ilike '%deal_type%')
  loop
    execute format('alter table public.listings drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.listings
  add constraint listings_status_check check (status in ('available', 'sold', 'rented', 'unavailable')),
  add constraint listings_deal_type_check check (deal_type is null or deal_type in ('sale', 'rent'));

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

-- Visitors see everything except listings the owner marked "unavailable".
drop policy if exists "listings public read" on public.listings;
create policy "listings public read" on public.listings
  for select using (status <> 'unavailable' or public.is_admin());
drop policy if exists "listings owner write" on public.listings;
create policy "listings owner write" on public.listings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.site, public.categories, public.listings to anon, authenticated;
grant insert, update, delete on public.site, public.categories, public.listings to authenticated;
grant select on public.admins to authenticated;

-- 4. Starting content -----------------------------------------------------

insert into public.site (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

insert into public.categories (id, label, deal, color, shape, no_rate, sort, form) values
  ('land',     'Land',     'sale', 2, 1, false, 1, 'land'),
  ('house',    'House',    'sale', 1, 0, false, 2, 'house'),
  ('business', 'Business', 'sale', 3, 2, true,  3, 'business'),
  ('shutter',  'Shutter',  'rent', 4, 3, false, 4, 'shutter'),
  ('room',     'Room',     'rent', 5, 4, false, 5, 'room')
on conflict (id) do nothing;

-- Update 2: sale or rent is now chosen per listing, so the names no longer say "rent".
update public.categories set label = 'Shutter' where id = 'shutter' and label = 'Shutter rent';
update public.categories set label = 'Room'    where id = 'room'    and label = 'Room rent';
update public.categories set form = id where form is null and id in ('land', 'house', 'business', 'shutter', 'room', 'flat');
-- A category you added yourself for flats keeps its listings and gets the flat form.
update public.categories set form = 'flat' where form is null and label ilike '%flat%';
update public.categories set label = 'Flat' where form = 'flat' and lower(label) in ('flat rent', 'flat for rent', 'flats');

-- The Flat category, unless you already have one.
insert into public.categories (id, label, deal, color, shape, no_rate, sort, form)
select 'flat', 'Flat', 'rent', 6, 6, true, 6, 'flat'
where not exists (select 1 from public.categories where form = 'flat');

-- 5. Photo storage --------------------------------------------------------

insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do update set public = true;

-- Only photos up to 8 MB can be stored (the site shrinks them to well under 1 MB before upload).
update storage.buckets
  set file_size_limit = 8388608, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'photos';

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
