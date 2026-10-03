# Ghar Jagga Map: setup

A plain website (no build step): a street map of Nepal with your listings, stored in your Supabase project.
Do the steps in order. Steps 1 to 4 get the site live. Steps 5 to 7 can wait.

Your Supabase address and public key are already in `js/config.js`.

## 1. Set up the database (Supabase)

1. Open your project at supabase.com.
2. Left menu: **SQL Editor**, then **New query**.
3. Open `supabase/schema.sql` from this folder, copy everything, paste it, and press **Run**.
   You should see "Success". It creates the tables, the five starting categories and the photo storage.

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
   `index.html`, `css/`, `js/`, `vendor/`, `api/`, `supabase/`, `SETUP.md`.

## 4. Deploy on Vercel

1. On vercel.com: **Add New**, **Project**, and import the repository.
2. Framework preset: **Other**. Leave build settings empty. Press **Deploy**.
3. Open the address Vercel gives you (something like `gharjagga.vercel.app`).
4. Scroll to the bottom, press **Owner sign in**, and sign in with the email and password from step 2.
   The owner bar appears at the bottom. Add your first property, then open **Site details and contacts**
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

- **Add a property:** Owner sign in, **+ Add property**. Type the price as a total or per anna.
  On your phone at the property, press **Use where I am standing now** to place the pin.
- **Places:** write the place name the same way every time (Sanepa, Bhaisepati) so they are counted together.
- **Categories:** the **Categories** button adds your own, for sale or for rent.
- **Share a listing:** open it and press **Copy link**, then paste the link in a Facebook, Instagram or TikTok post.
- **Photos:** up to 10 per listing. They are shrunk before upload. Supabase's free plan has a storage limit;
  check **Storage** in the Supabase dashboard now and then.

## Good to know

- `js/config.js` holds only public values. Never put a `service_role` or `secret` key in any file here.
- Supabase may pause a free project that gets no visits for a while. If the site shows
  "listings could not be loaded", open the Supabase dashboard and resume the project.
- Map data is from OpenStreetMap contributors. Keep the credit line on the map.
- The map library in `vendor/leaflet` is Leaflet 1.9.4 (BSD 2-Clause licence).
