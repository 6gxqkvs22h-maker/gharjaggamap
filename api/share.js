// Gives every shared property link (/property/<id>) its own preview: the cover photo, title and price.
// WhatsApp, Facebook, Messenger and similar apps read these tags without running the site, so they are added on the server.
// It reads the public Supabase address and key from js/config.js, the same ones the website uses. Nothing secret is needed.
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = n => {
  n = Math.round(Number(n) || 0);
  if (n >= 1e7) return 'Rs. ' + +(n / 1e7).toFixed(2) + ' crore';
  if (n >= 1e5) return 'Rs. ' + +(n / 1e5).toFixed(2) + ' lakh';
  return 'Rs. ' + n.toLocaleString('en-IN');
};
module.exports = async (req, res) => {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const origin = 'https://' + host;
  const send = html => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600'); return res.status(200).send(html); };
  let html;
  try { html = await (await fetch(origin + '/index.html')).text(); } catch (e) { res.statusCode = 302; res.setHeader('Location', '/'); return res.end(); }
  try {
    const m = /^[\w-]{1,64}$/.exec(String(req.query && req.query.id || ''));
    if (!m) return send(html);
    const cfg = await (await fetch(origin + '/js/config.js')).text();
    const url = (/SUPABASE_URL:\s*'([^']+)'/.exec(cfg) || [])[1], key = (/SUPABASE_ANON_KEY:\s*'([^']+)'/.exec(cfg) || [])[1];
    if (!url || !key) return send(html);
    const r = await fetch(url + '/rest/v1/listings?select=title,price,place,district,photos,status,type&id=eq.' + encodeURIComponent(m[0]) + '&limit=1', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    const row = r.ok ? (await r.json())[0] : null;
    if (!row || !row.title) return send(html);
    const photo = (Array.isArray(row.photos) ? row.photos : []).find(u => /^https:\/\//i.test(String(u)));
    const title = String(row.title).slice(0, 110) + ' | Ghar Jagga Map';
    const where = [row.place, row.district].filter(Boolean).join(', ');
    const desc = [money(row.price), where].filter(Boolean).join(' · ') + '. See photos, map and contact the owner on Ghar Jagga Map.';
    const page = origin + '/property/' + m[0];
    const set = (re, tag) => { html = re.test(html) ? html.replace(re, tag) : html.replace('</head>', tag + '\n</head>'); };
    set(/<meta property="og:title"[^>]*>/, '<meta property="og:title" content="' + esc(title) + '">');
    set(/<meta property="og:description"[^>]*>/, '<meta property="og:description" content="' + esc(desc) + '">');
    set(/<meta property="og:url"[^>]*>/, '<meta property="og:url" content="' + esc(page) + '">');
    set(/<meta name="description"[^>]*>/, '<meta name="description" content="' + esc(desc) + '">');
    html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + esc(title) + '</title>');
    if (photo) {
      html = html.replace(/<meta property="og:image:(type|width|height|alt)"[^>]*>\s*/g, '');
      set(/<meta property="og:image"[^>]*>/, '<meta property="og:image" content="' + esc(photo) + '">');
      set(/<meta name="twitter:image"[^>]*>/, '<meta name="twitter:image" content="' + esc(photo) + '">');
    }
    return send(html);
  } catch (e) { return send(html); }
};
