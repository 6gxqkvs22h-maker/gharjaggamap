# Ghar Jagga Map: setup

A plain website (no build step): a street map of Kathmandu with your listings, stored in your Supabase project.
Do the steps in order. Steps 1 to 4 get the site live. Steps 5 to 7 can wait.

Your Supabase address and public key are already in `js/config.js`.

## 1. Set up the database (Supabase)

1. Open your project at supabase.com.
2. Left menu: **SQL Editor**, then **New query**.
3. Open `supabase/schema.sql` from this folder, copy everything, paste it, and press **Run**.
   You should see "Success". It creates the tables, the six categories (Land, House, Business, Shutter, Room, Flat)
   and the photo storage.

The same file is also the **update**. Whenever a new version of the site says the database needs its update,
run `supabase/schema.sql` again. It only adds what is missing and never deletes or changes a saved listing.
Run it BEFORE you upload the new site files.

## 2. Make yourself the owner

1. Left menu: **Authentication**, then **Users**, then **Add user**.
2. Type your email and a strong password. Tick **Auto Confirm User**. Create it.
3. Go back to **SQL Editor**, **New query**. Paste `supabase/make-owner.sql`,
   replace `PUT-YOUR-EMAIL-HERE` with the same email, and press **Run**.
   The result should show one row with your email.

Only this account can add, change or delete listings. Visitors can only read.

## 3. Put the files on GitHub

1. On github.com create a new repository (for example `gharjagga`). Private is fine.
2. Upload everything inside this folder, keeping the folders as they are:
   `index.html`, `vercel.json`, `css/`, `js/`, `vendor/`, `api/`, `supabase/`, `SETUP.md`.

## 4. Deploy on Vercel

1. On vercel.com: **Add New**, **Project**, and import the repository.
2. Framework preset: **Other**. Leave build settings empty. Press **Deploy**.
3. Open the address Vercel gives you (something like `gharjagga.vercel.app`).
4. Scroll to the bottom, press **Owner sign in**, and sign in with the email and password from step 2.
   The owner bar appears at the bottom. Add your first property, then open **Site settings**
   to add your phone, WhatsApp, Facebook, Instagram and TikTok.

## 5. Nicer street map (MapTiler)

Without a key the site uses the standard OpenStreetMap tiles, which are fine for a small site.

1. Create a free account at maptiler.com and copy your API key.
2. In `js/config.js`, paste it between the quotes after `MAPTILER_KEY:` and save (commit) the file.
3. In MapTiler, limit the key to your website address so nobody else can use it.

## 6. Your own address (DigitalPlat + Cloudflare)

DigitalPlat only gives you the name. The DNS records live at Cloudflare.

1. Register your name in the DigitalPlat dashboard (for example `yourname.dpdns.org`).
2. At cloudflare.com: **Add a site**, type that name, choose the Free plan.
   Cloudflare shows two nameservers.
3. In DigitalPlat, open the domain and enter those two nameservers.
4. In Vercel: your project, **Settings**, **Domains**, add the name.
   Vercel shows the DNS record it needs (an A record or a CNAME).
5. In Cloudflare, **DNS**, add exactly that record. Turn the orange cloud OFF (DNS only),
   so Vercel can issue the HTTPS certificate.
6. Wait until Vercel shows the domain as valid. This can take from a few minutes to a day.

Check the DigitalPlat dashboard for the renewal date. A free name must be renewed there or it stops working.

## 7. Optional: AI explanation in the budget helper

The budget helper already works without AI. This adds an "Ask AI to explain" button.
This part has NOT been tested against Google's live service.

1. Get a free key at aistudio.google.com.
2. In Vercel: **Settings**, **Environment Variables**, add `GEMINI_API_KEY` with that key.
3. Optional: add `GEMINI_MODEL` with the model name shown in AI Studio.
4. Redeploy. If the button does not appear or answers fail, remove the key; nothing else is affected.

## Using the site

- **Add a property:** Owner sign in, **+ Add property**. Choose what it is (Land, House, Business, Shutter, Room, Flat),
  then For sale or For rent. The form then asks only the questions for that kind of property.
  Land can be priced as a total or per Anna. Flats, shutters and rooms are measured only in sq ft or sq m.
  On your phone at the property, press **Use where I am standing now** to place the pin.
- **Photos:** up to 10 per listing. Pick several at once, use the arrows to change the order (the first is the cover),
  the cross removes one. They are shrunk before upload.
- **Video:** paste the link of your Facebook, Instagram or TikTok post into **Social media post / video link**.
  Visitors get a **View video / post** button that opens your post. The video itself stays on the social site.
- **Home page:** a dark map with a pin for every property, then category buttons, a **Featured** carousel and a
  **Nearby** row. Switch **Featured** on for a listing in Manage listings (or tick it in the form) to put it in the
  carousel. Until you pick some, the newest listings are shown there under "Latest".
- **Hearts:** visitors tap the heart to save a property. It is kept on their own phone; no account is needed.
- **How to use:** the button at the top opens a short guide. Paste a video link in **Site settings** and the guide
  gets a "Watch the video" button.
- **Map style:** the map uses MapTiler's dark street map. To use another, add `MAP_STYLE: 'streets-v2'` to `js/config.js`.
- **Manage listings:** every listing with View, Edit, Delete and its status. **Sold**, **Rented** and **Unavailable**
  keep the listing; Unavailable hides it from visitors. **Delete** removes it and its photos for good.
- **Places:** write the place name the same way every time (Sanepa, Bhaisepati) so they are counted together.
- **District:** every listing is saved as Kathmandu. To open another district later, add `DISTRICT: 'Lalitpur'`
  (and a `MAP_AREA`) to `js/config.js`.
- **Categories:** the **Categories** button adds your own and lets you choose which of the six forms it uses.
- **Share a listing:** open it and press **Share link**. Each property has its own address, `/property/...`
  (this needs the `vercel.json` file, which is included).
- Supabase's free plan has a storage limit; check **Storage** in the Supabase dashboard now and then.

## Good to know

- `js/config.js` holds only public values. Never put a `service_role` or `secret` key in any file here.
- Supabase may pause a free project that gets no visits for a while. If the site shows
  "listings could not be loaded", open the Supabase dashboard and resume the project.
- Map data is from OpenStreetMap contributors. Keep the credit line on the map.
- The map library in `vendor/leaflet` is Leaflet 1.9.4 (BSD 2-Clause licence).
