-- OPTIONAL: 14 made-up example listings, so you can see how the site looks when it is full.
-- Every title starts with "Example:". Paste into Supabase > SQL Editor and press Run.
-- Run setup-all.sql first.

insert into public.listings (type, title, price, rate_mode, area_value, area_unit, place, district, lat, lng, description, status) values
  ('shutter', 'Example: Shutter on the main road, Kupondole', 35000, false, 300, 'sqft', 'Kupondole', 'Lalitpur', 27.6858, 85.3171, 'Example text. Ground floor shutter with attached toilet, good for a shop or office.', 'available'),
  ('room', 'Example: 2 rooms with kitchen, Sanepa', 18000, false, 0, 'sqft', 'Sanepa', 'Lalitpur', 27.6829, 85.3061, 'Example text. First floor, water included, bike parking.', 'available'),
  ('land', 'Example: 3 anna plot in a quiet lane, Sanepa', 13500000, true, 3, 'aana', 'Sanepa', 'Lalitpur', 27.6838, 85.3052, 'Example text. 12 ft pitched road, walled on three sides.', 'available'),
  ('house', 'Example: 3-bedroom house with garden, Sanepa', 42000000, false, 5, 'aana', 'Sanepa', 'Lalitpur', 27.6821, 85.3078, 'Example text. Two storeys, parking for two cars, 5 minutes walk to the ring road.', 'available'),
  ('house', 'Example: New house in a housing colony, Bhaisepati', 29500000, false, 4, 'aana', 'Bhaisepati', 'Lalitpur', 27.6512, 85.3035, 'Example text. 4 bedrooms, 20 ft road, 24-hour security in the colony.', 'available'),
  ('land', 'Example: 5 anna corner plot, Bhaisepati', 17500000, false, 5, 'aana', 'Bhaisepati', 'Lalitpur', 27.6478, 85.3069, 'Example text. Corner plot touching two roads, mountain view to the north.', 'available'),
  ('business', 'Example: Clothing shop on the main road, Kupondole', 3500000, false, 450, 'sqft', 'Kupondole', 'Lalitpur', 27.6862, 85.3163, 'Example text. Sold with fittings and stock, rented shutter on the main road.', 'available'),
  ('house', 'Example: 2.5-storey family house, Budhanilkantha', 36000000, false, 4, 'aana', 'Budhanilkantha', 'Kathmandu', 27.7765, 85.3622, 'Example text. 5 bedrooms, parking for one car, 13 ft road, facing east.', 'available'),
  ('land', 'Example: Plot near the Lakeside road, Pokhara', 15000000, false, 6, 'aana', 'Lakeside', 'Kaski', 28.2096, 83.959, 'Example text. Flat plot, 16 ft road on one side, water and electricity at the boundary.', 'available'),
  ('land', 'Example: Residential plot, Itahari', 6500000, false, 10, 'dhur', 'Itahari', 'Sunsari', 26.6646, 87.2718, 'Example text. Planned housing area, 20 ft gravel road.', 'available'),
  ('business', 'Example: Running cafe for sale, Jhamsikhel', 2800000, false, 1200, 'sqft', 'Jhamsikhel', 'Lalitpur', 27.6773, 85.3082, 'Example text. Sold with furniture, kitchen equipment and the remaining lease on a rented space.', 'available'),
  ('house', 'Example: Two-storey house, Butwal', 12500000, false, 8, 'dhur', 'Butwal', 'Rupandehi', 27.6866, 83.4323, 'Example text. 4 bedrooms, shutter on the ground floor, 5 minutes from the highway.', 'available'),
  ('land', 'Example: Farmland near Bharatpur', 4800000, false, 2, 'kattha', 'Bharatpur', 'Chitawan', 27.67, 84.43, 'Example text. Level farmland with canal water, motorable road to the plot.', 'available'),
  ('business', 'Example: Hardware shop with stock, Biratnagar', 5500000, false, 0, 'sqft', 'Biratnagar main road', 'Morang', 26.4525, 87.2718, 'Example text. Price includes stock and shelves. Rented shop on the main road.', 'sold');

-- To remove all the examples later, run this one line:
-- delete from public.listings where title like 'Example:%';
