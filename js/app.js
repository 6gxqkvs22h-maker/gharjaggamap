(function () {
'use strict';

/* ---------- helpers ---------- */
const CFG = window.SITE_CONFIG || {};
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const okUrl = p => typeof p === 'string' && /^https:\/\/[^\s"'<>]+$/.test(p);
const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });

function fatal(msg) { const f = $('#fatal'); f.textContent = msg; f.hidden = false; }
if (!window.L) { fatal('The map could not be loaded. Check your connection and reload the page.'); return; }
if (!window.supabase || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) { fatal('The site could not reach its database. Check your connection and reload the page.'); return; }
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

/* ---------- data ---------- */
const DEF_SITE = { name: 'Ghar Jagga Map', tagline: 'Houses and land for sale, shutters and rooms for rent across Nepal', owner: '', phone: '', whatsapp: '', facebook: '', instagram: '', tiktok: '', about: '' };
const DEF_CATS = [
  { id: 'house', label: 'House', deal: 'sale', color: 1, shape: 0 },
  { id: 'land', label: 'Land', deal: 'sale', color: 2, shape: 1 },
  { id: 'business', label: 'Business', deal: 'sale', color: 3, shape: 2, noRate: true },
  { id: 'shutter', label: 'Shutter rent', deal: 'rent', color: 4, shape: 3 },
  { id: 'room', label: 'Room rent', deal: 'rent', color: 5, shape: 4 }
];
const state = { site: Object.assign({}, DEF_SITE), cats: DEF_CATS.slice(), listings: [] };

const fromRow = r => ({
  id: r.id, type: r.type, title: r.title || '', price: Number(r.price) || 0, rateMode: !!r.rate_mode,
  area: { v: Number(r.area_value) || 0, u: r.area_unit || 'aana' }, place: r.place || '', district: r.district || '',
  lat: Number(r.lat), lng: Number(r.lng), desc: r.description || '',
  photos: Array.isArray(r.photos) ? r.photos.filter(okUrl) : [], status: r.status === 'sold' ? 'sold' : 'available', added: r.created_at || ''
});
const toRow = l => ({
  id: l.id, type: l.type, title: l.title, price: Math.round(l.price) || 0, rate_mode: !!l.rateMode,
  area_value: l.area.v || 0, area_unit: l.area.u, place: l.place, district: l.district, lat: l.lat, lng: l.lng,
  description: l.desc, photos: l.photos, status: l.status, updated_at: new Date().toISOString()
});
const catFromRow = r => ({ id: r.id, label: r.label, deal: r.deal === 'rent' ? 'rent' : 'sale', color: r.color || 1, shape: r.shape || 0, noRate: !!r.no_rate, sort: r.sort || 0 });

async function loadAll() {
  const res = await Promise.all([
    sb.from('site').select('data').eq('id', 1).limit(1),
    sb.from('categories').select('*').order('sort', { ascending: true }),
    sb.from('listings').select('*').order('created_at', { ascending: false })
  ]);
  const bad = res.find(r => r.error);
  if (bad) throw bad.error;
  const site = res[0].data && res[0].data[0] && res[0].data[0].data;
  state.site = Object.assign({}, DEF_SITE, site && typeof site === 'object' ? site : {});
  state.cats = (res[1].data || []).map(catFromRow);
  if (!state.cats.length) state.cats = DEF_CATS.slice();
  state.listings = (res[2].data || []).map(fromRow).filter(l => isFinite(l.lat) && isFinite(l.lng));
}

/* ---------- Nepal districts (to name the district a pin falls in) ---------- */
const NEPAL = { latMin: 26.3, latMax: 30.5, lngMin: 80.0, lngMax: 88.25 };
const NEPAL_BOUNDS = [[NEPAL.latMin, NEPAL.lngMin], [NEPAL.latMax, NEPAL.lngMax]];
const DISTRICTS = (window.NEPAL_GEO || []).map(g => {
  const rings = g.r.map(str => {
    const a = str.split(' ').map(Number), pts = [];
    let x = 0, y = 0;
    for (let i = 0; i + 1 < a.length; i += 2) { x += a[i]; y += a[i + 1]; pts.push([80 + x / 1000, 26 + y / 1000]); }
    return pts;
  });
  let c = null, bestA = 0;
  rings.forEach(r => {
    let A = 0, cx = 0, cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
      A += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
    }
    if (Math.abs(A) > bestA) { bestA = Math.abs(A); c = [cx / (3 * A), cy / (3 * A)]; }
  });
  return { name: g.n, prov: g.p, rings, c: c || rings[0][0] };
});
const districtByName = n => DISTRICTS.find(d => d.name === n) || null;
function inRing(lon, lat, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function districtAt(lon, lat) {
  for (const d of DISTRICTS) for (const r of d.rings) if (inRing(lon, lat, r)) return d;
  let best = null, bd = Infinity;
  DISTRICTS.forEach(d => { const dx = (d.c[0] - lon) * 0.88, dy = d.c[1] - lat, q = dx * dx + dy * dy; if (q < bd) { bd = q; best = d; } });
  return best;
}
const inNepalBox = (lat, lng) => lat >= NEPAL.latMin && lat <= NEPAL.latMax && lng >= NEPAL.lngMin && lng <= NEPAL.lngMax;

/* ---------- money and land units ---------- */
const UNITS = { aana: ['anna', 342.25], ropani: ['ropani', 5476], bigha: ['bigha', 72900], kattha: ['kattha', 3645], dhur: ['dhur', 182.25], sqm: ['sq m', 10.7639], sqft: ['sq ft', 1] };
const SHAPES = [
  '<path class="shape" d="M0-10 10-1.5H7V8.5H-7V-1.5H-10Z"/>',
  '<path class="shape" d="M0-9.5 9.5 0 0 9.5-9.5 0Z"/>',
  '<circle class="shape" r="8"/>',
  '<path class="shape" d="M-7.5-7.5H7.5V7.5H-7.5Z"/>',
  '<path class="shape" d="M-7 8.5V-2.5a7 7 0 0 1 14 0V8.5Z"/>',
  '<path class="shape" d="M0-9.5 9.5 7.5H-9.5Z"/>',
  '<path class="shape" d="M0-9.5 8.2-4.7V4.7L0 9.5-8.2 4.7V-4.7Z"/>'
];
const catOf = id => state.cats.find(c => c.id === id) || { id: id, label: String(id || 'Other'), deal: 'sale', color: 8, shape: 2 };
const isRent = l => catOf(l.type).deal === 'rent';
const cnum = c => (((c.color || 1) - 1) % 8) + 1;
const cvar = c => 'var(--k' + cnum(c) + ')';
const mvar = c => 'var(--m' + cnum(c) + ')';
const shapeOf = c => SHAPES[(c.shape || 0) % SHAPES.length];
const catIcon = c => '<svg class="ph-ico" viewBox="-13 -13 26 26" aria-hidden="true">' + shapeOf(c) + '</svg>';
const soldWord = l => isRent(l) ? 'Rented out' : 'Sold';

function groupIN(n) {
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
}
const trimNum = n => String(Math.round(n * 100) / 100);
function fmtNPR(n) {
  if (!isFinite(n) || n <= 0) return 'Price on request';
  if (n >= 1e7) return 'रू ' + trimNum(n / 1e7) + ' crore';
  if (n >= 1e5) return 'रू ' + trimNum(n / 1e5) + ' lakh';
  return 'रू ' + groupIN(n);
}
function parseMoney(str, rent) {
  if (!str) return null;
  const s = String(str).toLowerCase()
    .replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d)))
    .replace(/,/g, '').replace(/\brs\.?|\bnpr\b|रू|रु/g, ' ');
  const re = /(\d+(?:\.\d+)?)\s*(crores?|cr|karod|करोड|lakhs?|lacs?|लाख|l\b|hajar|thousand|हजार|k\b)?/g;
  let m, total = 0, any = false, hadUnit = false;
  while ((m = re.exec(s))) {
    any = true;
    const v = parseFloat(m[1]), u = m[2] || '';
    let mult = 1;
    if (/^(crores?|cr|karod|करोड)$/.test(u)) mult = 1e7;
    else if (/^(lakhs?|lacs?|लाख|l)$/.test(u)) mult = 1e5;
    else if (/^(hajar|thousand|हजार|k)$/.test(u)) mult = 1e3;
    if (u) hadUnit = true;
    total += v * mult;
  }
  if (!any || !(total > 0)) return null;
  let assumed = false;
  if (!hadUnit && total < 1000) { total *= rent ? 1e3 : 1e5; assumed = true; }
  return { value: Math.round(total), assumed };
}
function areaText(l) {
  if (!l.area || !(l.area.v > 0) || !UNITS[l.area.u]) return '';
  return trimNum(l.area.v) + ' ' + UNITS[l.area.u][0];
}
function areaSqft(l) {
  if (!l.area || !(l.area.v > 0) || !UNITS[l.area.u] || l.area.u === 'sqft') return '';
  return groupIN(l.area.v * UNITS[l.area.u][1]) + ' sq ft';
}
// Price per anna (or per dhur / kattha in the Terai) for things sold by land size.
function rateOf(l) {
  const c = catOf(l.type);
  if (c.deal !== 'sale' || c.noRate || !(l.price > 0) || !l.area || !(l.area.v > 0) || !UNITS[l.area.u]) return null;
  const u = l.area.u === 'dhur' ? 'dhur' : (l.area.u === 'kattha' || l.area.u === 'bigha') ? 'kattha' : 'aana';
  const n = l.area.v * UNITS[l.area.u][1] / UNITS[u][1];
  return { v: l.price / n, u: u, label: UNITS[u][0] };
}
function rateText(l) { const r = rateOf(l); return r ? fmtNPR(r.v) + ' per ' + r.label : ''; }
function priceText(l) {
  if (!(l.price > 0)) return 'Price on request';
  if (isRent(l)) return fmtNPR(l.price) + ' a month';
  if (l.rateMode && rateOf(l)) return rateText(l);
  return fmtNPR(l.price);
}
function priceSub(l) {
  if (!(l.price > 0) || isRent(l)) return '';
  if (l.rateMode && rateOf(l)) return 'Total ' + fmtNPR(l.price);
  return rateText(l);
}

/* ---------- links ---------- */
function socialUrl(kind, v) {
  v = String(v || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) {
    try { const u = new URL(v); if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''; u.protocol = 'https:'; return u.href; } catch (e) { return ''; }
  }
  if (/^[\w.-]+\.[a-z]{2,}\//i.test(v)) return socialUrl(kind, 'https://' + v);
  const h = v.replace(/^@/, '').replace(/[^\w.\-]/g, '');
  if (!h) return '';
  if (kind === 'facebook') return 'https://www.facebook.com/' + h;
  if (kind === 'instagram') return 'https://www.instagram.com/' + h;
  if (kind === 'tiktok') return 'https://www.tiktok.com/@' + h;
  return '';
}
function waUrl(num, text) {
  const d = String(num || '').replace(/\D/g, '');
  if (d.length < 8) return '';
  return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
}
const SOCIALS = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['tiktok', 'TikTok']];
const listingUrl = id => location.origin + location.pathname + '#p-' + id;

/* ---------- view state ---------- */
const filter = { type: 'all', district: '', place: '', sort: 'new' };
const placeName = l => String(l.place || '').split(',')[0].trim() || l.district || 'Other';
const placeKey = l => (placeName(l) + '|' + (l.district || '')).toLowerCase();
let budget = null, budgetIds = null, selectedId = null;
let owner = false, busy = false, aiOn = false, aiCtl = null;
const byId = id => state.listings.find(l => l.id === id) || null;
const dlgDetail = $('#dlgDetail'), dlgContact = $('#dlgContact'), dlgEdit = $('#dlgEdit'), dlgSite = $('#dlgSite'), dlgCats = $('#dlgCats'), dlgLogin = $('#dlgLogin');

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 4200);
}

/* ---------- street map ---------- */
function baseLayer() {
  if (CFG.MAPTILER_KEY) {
    return L.tileLayer('https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=' + encodeURIComponent(CFG.MAPTILER_KEY), {
      maxZoom: 20, attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
    });
  }
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
  });
}
const map = L.map('mainMap', { minZoom: 6, maxBounds: L.latLngBounds(NEPAL_BOUNDS).pad(0.5), zoomSnap: 0.5 });
map.attributionControl.setPrefix(false);
baseLayer().addTo(map);
map.fitBounds(NEPAL_BOUNDS);
const markLayer = L.layerGroup().addTo(map);
let mapItems = [];

function pinIcon(l, cls) {
  const c = catOf(l.type);
  return L.divIcon({
    className: 'pin-ico' + (l.status === 'sold' ? ' sold' : '') + (l.id === selectedId ? ' sel' : '') + (cls ? ' ' + cls : ''),
    html: '<svg viewBox="-13 -13 26 26" style="--c:' + mvar(c) + '">' + shapeOf(c) + '</svg>', iconSize: [30, 30], iconAnchor: [15, 15]
  });
}
function addPin(l) {
  const label = catOf(l.type).label + ': ' + l.title + ', ' + priceText(l);
  L.marker([l.lat, l.lng], { icon: pinIcon(l), title: label, alt: label, zIndexOffset: l.id === selectedId ? 1000 : 0 })
    .on('click', () => openDetail(l.id)).addTo(markLayer);
}
function fitPoints(pts) {
  if (!pts.length) return;
  if (pts.length === 1) { map.setView([pts[0].lat, pts[0].lng], Math.max(map.getZoom(), 16)); return; }
  map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])), { padding: [60, 60], maxZoom: 17 });
}
// Far out the map shows one bubble per district, closer in one per place, and close up every pin.
function drawMap() {
  markLayer.clearLayers();
  const z = map.getZoom();
  if (z >= 13.5) { mapItems.forEach(addPin); return; }
  const groups = new Map();
  mapItems.forEach(l => {
    if (l.status === 'sold') return;
    const k = z < 10 ? 'd|' + (l.district || 'Other') : 'p|' + placeKey(l);
    if (!groups.has(k)) groups.set(k, { name: z < 10 ? (l.district || 'Other') : placeName(l), items: [] });
    groups.get(k).items.push(l);
  });
  groups.forEach(g => {
    if (g.items.length === 1) { addPin(g.items[0]); return; }
    const lat = g.items.reduce((s, l) => s + l.lat, 0) / g.items.length, lng = g.items.reduce((s, l) => s + l.lng, 0) / g.items.length;
    const label = g.name + ': ' + g.items.length + ' available. Zoom in.';
    L.marker([lat, lng], { icon: L.divIcon({ className: 'pbub-wrap', html: '<span class="pbub"><b>' + g.items.length + '</b>' + esc(g.name) + '</span>', iconSize: [0, 0] }), title: label, alt: label, zIndexOffset: 500 })
      .on('click', () => { const b = L.latLngBounds(g.items.map(l => [l.lat, l.lng])); if (z < 10) map.fitBounds(b.pad(0.3), { maxZoom: 13 }); else fitPoints(g.items); })
      .addTo(markLayer);
  });
}
map.on('zoomend', drawMap);

/* ---------- header, legend, footer ---------- */
function renderHeader() {
  const name = state.site.name || DEF_SITE.name;
  $('#siteName').textContent = name;
  document.title = name;
  $('#siteTag').textContent = state.site.tagline || '';
  $('#siteTag').hidden = !state.site.tagline;
  const nav = $('#socialNav');
  nav.textContent = '';
  SOCIALS.forEach(([k, label]) => {
    const u = socialUrl(k, state.site[k]);
    if (!u) return;
    const a = document.createElement('a');
    a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label;
    nav.appendChild(a);
  });
  nav.hidden = !nav.children.length;
  const about = $('#aboutText');
  about.textContent = state.site.about || '';
  about.hidden = !state.site.about;
}
function renderLegend() {
  $('#legend').innerHTML = state.cats.map(c => '<span style="--c:' + mvar(c) + '"><svg viewBox="-12 -12 24 24">' + shapeOf(c) + '</svg>' + esc(c.label) + '</span>').join('') +
    '<span class="legend-note">Tap a number to zoom in. Tap a pin for details.</span>';
}

/* ---------- list ---------- */
function matches(l) {
  if (filter.type !== 'all' && l.type !== filter.type) return false;
  if (filter.district && l.district !== filter.district) return false;
  if (filter.place && placeKey(l) !== filter.place) return false;
  if (budgetIds && !budgetIds.has(l.id)) return false;
  return true;
}
function badges(l) {
  const c = catOf(l.type);
  return '<span class="badge" style="--c:' + cvar(c) + '">' + esc(c.label) + '</span>' +
    (l.status === 'sold' ? '<span class="tagx sold">' + soldWord(l) + '</span>' : '');
}
function renderList() {
  const all = state.listings;
  const counts = { all: all.length };
  all.forEach(l => { counts[l.type] = (counts[l.type] || 0) + 1; });
  if (filter.type !== 'all' && !state.cats.some(c => c.id === filter.type)) filter.type = 'all';
  $('#typeChips').innerHTML = [['all', 'All']].concat(state.cats.map(c => [c.id, c.label])).map(([k, label]) =>
    '<button class="chip" type="button" data-type="' + esc(k) + '" aria-pressed="' + (filter.type === k) + '">' + esc(label) + '<b>' + (counts[k] || 0) + '</b></button>').join('');
  $('#budgetType').innerHTML = '<option value="all">Anything to buy</option>' + state.cats.map(c => '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>').join('');
  $('#budgetQuick').hidden = filter.type !== 'all' && catOf(filter.type).deal === 'rent';

  const names = Array.from(new Set(all.map(l => l.district).filter(Boolean)));
  if (filter.district && names.indexOf(filter.district) < 0) names.push(filter.district);
  names.sort();
  const sel = $('#districtSel');
  sel.innerHTML = '<option value="">All districts</option>' + names.map(n => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
  sel.value = filter.district;
  $('#sortSel').value = filter.sort;
  $('#budgetType').value = filter.type;

  let arr = all.filter(matches);
  if (filter.sort === 'low') arr = arr.slice().sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
  else if (filter.sort === 'high') arr = arr.slice().sort((a, b) => (b.price || 0) - (a.price || 0));

  const bits = [];
  const pl = filter.place ? all.find(l => placeKey(l) === filter.place) : null;
  if (pl) bits.push('in ' + placeName(pl));
  if (filter.district) bits.push('in ' + filter.district + ' district');
  if (budget) bits.push('within or near ' + fmtNPR(budget.value));
  $('#countLine').textContent = arr.length + (arr.length === 1 ? ' property ' : ' properties ') + bits.join(', ');

  const ul = $('#cards');
  if (!arr.length) {
    ul.innerHTML = '<li class="empty"><span>' + (all.length ? 'Nothing matches these filters yet.' : 'No properties are listed yet.' + (owner ? ' Use “Add property” below to add the first one.' : ' Check back soon.')) + '</span>' +
      (all.length ? '<button class="btn small" type="button" data-clear>Show all properties</button>' : '') + '</li>';
  } else {
    ul.innerHTML = arr.map(l => {
      const ph = (l.photos || []).find(okUrl);
      const c = catOf(l.type);
      const meta = [areaText(l), [l.place, l.district].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
      return '<li class="card' + (l.id === selectedId ? ' sel' : '') + '" data-id="' + esc(l.id) + '">' +
        '<button class="card-main" type="button" data-open>' +
        '<span class="thumb" style="--c:' + cvar(c) + '">' + (ph ? '<img src="' + esc(ph) + '" alt="" loading="lazy">' : catIcon(c)) + '</span>' +
        '<span class="card-body"><span class="card-top">' + badges(l) + '</span>' +
        '<span class="card-title">' + esc(l.title) + '</span>' +
        '<span class="card-price">' + esc(priceText(l)) + '</span>' +
        (priceSub(l) ? '<span class="card-rate">' + esc(priceSub(l)) + '</span>' : '') +
        (meta ? '<span class="card-meta">' + esc(meta) + '</span>' : '') + '</span></button>' +
        '<div class="card-foot"><button class="btn small" type="button" data-showmap>Show on map</button>' +
        '<button class="btn small primary" type="button" data-talk>Talk to me</button>' +
        (owner ? '<button class="btn small" type="button" data-edit>Edit</button>' : '') + '</div></li>';
    }).join('');
  }
  mapItems = all.filter(matches);
  drawMap();
  renderPlaces();
}
function placeGroups() {
  const byD = new Map();
  state.listings.forEach(l => {
    const d = l.district || 'Other', k = placeKey(l);
    if (!byD.has(d)) byD.set(d, new Map());
    const m = byD.get(d);
    if (!m.has(k)) m.set(k, { key: k, name: placeName(l), n: 0, pts: [], rates: {} });
    const g = m.get(k);
    if (l.status !== 'sold') g.n++;
    g.pts.push({ lat: l.lat, lng: l.lng });
    if (l.type === 'land' && l.status !== 'sold') {
      const r = rateOf(l);
      if (r) { const a = g.rates[r.u] || (g.rates[r.u] = { p: 0, n: 0, k: 0 }); a.p += l.price; a.n += l.price / r.v; a.k++; }
    }
  });
  const out = Array.from(byD.entries()).map(e => ({ district: e[0], places: Array.from(e[1].values()) }));
  out.forEach(g => {
    g.places.forEach(p => {
      const u = Object.keys(p.rates).sort((a, b) => p.rates[b].k - p.rates[a].k)[0];
      p.landRate = u ? { v: p.rates[u].p / p.rates[u].n, u: u, label: UNITS[u][0] } : null;
    });
    g.places.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  });
  return out.sort((a, b) => b.places.reduce((s, p) => s + p.n, 0) - a.places.reduce((s, p) => s + p.n, 0) || a.district.localeCompare(b.district));
}
function renderPlaces() {
  const groups = placeGroups();
  $('#placesBox').hidden = !groups.length;
  $('#placesList').innerHTML = groups.map(g => '<div class="pgroup"><span class="pd">' + esc(g.district) + '</span>' +
    g.places.map(p => '<button class="prow" type="button" data-place="' + esc(p.key) + '" aria-pressed="' + (filter.place === p.key) + '"><span class="pn">' + esc(p.name) + '</span><span class="pm">' + p.n + ' available</span>' +
      (p.landRate ? '<span class="pr">Land about ' + esc(fmtNPR(p.landRate.v)) + ' per ' + p.landRate.label + '</span>' : '') + '</button>').join('') + '</div>').join('');
}
const rerun = () => { if (budget) runBudget(); else renderList(); };
$('#placesList').addEventListener('click', e => {
  const b = e.target.closest('[data-place]'); if (!b) return;
  const k = b.dataset.place;
  filter.place = filter.place === k ? '' : k;
  filter.district = '';
  rerun();
  if (filter.place) fitPoints(state.listings.filter(l => placeKey(l) === k)); else map.fitBounds(NEPAL_BOUNDS);
});
$('#typeChips').addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (!b) return; filter.type = b.dataset.type; rerun(); });
$('#districtSel').addEventListener('change', e => {
  filter.district = e.target.value; filter.place = '';
  rerun();
  if (filter.district) fitPoints(state.listings.filter(l => l.district === filter.district)); else map.fitBounds(NEPAL_BOUNDS);
});
$('#sortSel').addEventListener('change', e => { filter.sort = e.target.value; renderList(); });
$('#cards').addEventListener('click', e => {
  if (e.target.closest('[data-clear]')) { filter.type = 'all'; filter.district = ''; filter.place = ''; clearBudget(); map.fitBounds(NEPAL_BOUNDS); return; }
  const li = e.target.closest('.card'); if (!li) return;
  const id = li.dataset.id;
  if (e.target.closest('[data-showmap]')) showOnMap(id);
  else if (e.target.closest('[data-talk]')) openContact(id);
  else if (e.target.closest('[data-edit]')) openEdit(id);
  else if (e.target.closest('[data-open]')) openDetail(id);
});
function showOnMap(id) {
  const l = byId(id); if (!l) return;
  selectedId = id;
  renderList();
  map.setView([l.lat, l.lng], Math.max(map.getZoom(), 16));
  const box = $('#mainMap');
  const r = box.getBoundingClientRect();
  if (r.top < 0 || r.bottom > window.innerHeight) {
    const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
  }
}

/* ---------- budget helper ---------- */
function explainBudget(b) {
  const cat = filter.type === 'all' ? null : catOf(filter.type);
  const rent = !!cat && cat.deal === 'rent';
  const money = n => fmtNPR(n) + (rent ? ' a month' : '');
  const pool = state.listings.filter(l => l.status !== 'sold' && l.price > 0 && (cat ? l.type === cat.id : !isRent(l)) && (!filter.district || l.district === filter.district) && (!filter.place || placeKey(l) === filter.place));
  const word = cat ? cat.label.toLowerCase() + ' listings' : 'properties for sale';
  const plc = filter.place ? state.listings.find(l => placeKey(l) === filter.place) : null;
  const where = plc ? ' in ' + placeName(plc) : filter.district ? ' in ' + filter.district : '';
  const fits = pool.filter(l => l.price <= b.value).sort((a, c) => c.price - a.price);
  const near = pool.filter(l => l.price > b.value && l.price <= b.value * 1.15).sort((a, c) => a.price - c.price);
  const lines = [];
  const pu = l => { const t = rateText(l); return t ? ' (' + t + ')' : ''; };
  if (!pool.length) {
    lines.push('There are no ' + word + where + ' with a price listed here right now.');
    lines.push('Talk to me and I will tell you what is coming up.');
  } else if (fits.length) {
    lines.push('With ' + money(b.value) + ' you can afford ' + fits.length + ' of the ' + pool.length + ' ' + word + where + '.');
    const top = fits[0], left = b.value - top.price;
    lines.push('Closest to your budget: ' + top.title + ' at ' + money(top.price) + pu(top) + '. ' +
      (rent ? (left > 0 ? 'That is ' + fmtNPR(left) + ' a month under your budget.' : 'That uses all of your budget.')
        : (left >= 1e5 ? 'You keep about ' + fmtNPR(left) + ' for registration, fees and moving.' : 'That uses almost all of your budget, so plan extra money for registration and fees.')));
    if (fits.length > 1) { const low = fits[fits.length - 1]; lines.push('Lowest price that fits: ' + low.title + ' at ' + money(low.price) + pu(low) + '.'); }
  } else {
    const cheap = pool.slice().sort((a, c) => a.price - c.price)[0];
    lines.push('Nothing listed' + where + ' fits ' + money(b.value) + ' yet.');
    lines.push('The lowest price is ' + cheap.title + ' at ' + money(cheap.price) + '. That is ' + fmtNPR(cheap.price - b.value) + ' more than your budget.');
  }
  if (near.length) {
    const n = near[0];
    lines.push((near.length === 1 ? 'One more is' : near.length + ' more are') + ' just above your budget. ' + n.title + ' costs ' + money(n.price) + ', which is ' + fmtNPR(n.price - b.value) + ' more. It is worth asking if the price can come down.');
  }
  if (!rent && (!cat || cat.id === 'land')) {
    const spots = [];
    placeGroups().forEach(g => g.places.forEach(p => { if (p.landRate && (!filter.place || p.key === filter.place) && (!filter.district || g.district === filter.district)) spots.push(p); }));
    spots.slice(0, 3).forEach(p => {
      lines.push('In ' + p.name + ', land is about ' + fmtNPR(p.landRate.v) + ' per ' + p.landRate.label + '. Your budget buys about ' + trimNum(Math.round(b.value / p.landRate.v * 10) / 10) + ' ' + p.landRate.label + ' there.');
    });
  }
  if (b.assumed) lines.push('You typed a small number, so it was read as ' + money(b.value) + '.');
  lines.push(rent ? 'Ask me about the deposit and what the rent includes.' : 'These are asking prices. Talk to me before you decide.');
  return { lines, fits, near };
}
function runBudget() {
  if (!budget) return;
  const r = explainBudget(budget);
  budgetIds = new Set(r.fits.concat(r.near).map(l => l.id));
  const box = $('#budgetText');
  box.textContent = '';
  r.lines.forEach((t, i) => { const p = document.createElement('p'); if (i === 0) p.className = 'lead'; p.textContent = t; box.appendChild(p); });
  $('#budgetOut').hidden = false;
  $('#aiBox').hidden = !aiOn;
  resetAi();
  renderList();
}
function clearBudget() {
  budget = null; budgetIds = null;
  $('#budgetOut').hidden = true;
  $('#budgetInput').value = '';
  resetAi();
  renderList();
}
function submitBudget(text) {
  const pick = $('#budgetType').value;
  const b = parseMoney(text, pick !== 'all' && catOf(pick).deal === 'rent');
  const out = $('#budgetText');
  if (!b) {
    budget = null; budgetIds = null;
    out.textContent = '';
    const p = document.createElement('p'); p.className = 'err';
    p.textContent = 'Type your budget as a number, for example 50 lakh, 1.2 crore or 5000000.';
    out.appendChild(p);
    $('#budgetOut').hidden = false; $('#aiBox').hidden = true;
    renderList();
    return;
  }
  budget = b;
  filter.type = pick;
  runBudget();
}
$('#budgetForm').addEventListener('submit', e => { e.preventDefault(); submitBudget($('#budgetInput').value); });
$('#budgetQuick').addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (!b) return; $('#budgetInput').value = b.dataset.b; submitBudget(b.dataset.b); });
$('#budgetType').addEventListener('change', e => { filter.type = e.target.value; rerun(); });
$('#budgetClear').addEventListener('click', clearBudget);

/* ---------- optional AI explanation (needs the /api/explain function and a key, see SETUP.md) ---------- */
function resetAi() {
  if (aiCtl) { try { aiCtl.abort(); } catch (e) {} aiCtl = null; }
  $('#aiText').hidden = true; $('#aiText').textContent = '';
  $('#aiNote').hidden = true; $('#aiStop').hidden = true; $('#aiBtn').disabled = false;
}
$('#aiBtn').addEventListener('click', async () => {
  if (!aiOn || !budget) return;
  const out = $('#aiText'), btn = $('#aiBtn'), stop = $('#aiStop');
  const rent = filter.type !== 'all' && catOf(filter.type).deal === 'rent';
  const rows = state.listings.filter(l => l.status !== 'sold').slice(0, 60).map(l => ({
    title: l.title, category: catOf(l.type).label, deal: isRent(l) ? 'rent per month' : 'sale', price_npr: l.price || null,
    price_per_land_unit: rateText(l), size: [areaText(l), areaSqft(l)].filter(Boolean).join(' = '), place: l.place || '', district: l.district || '', notes: String(l.desc || '').slice(0, 200)
  }));
  aiCtl = new AbortController();
  const ctl = aiCtl;
  btn.disabled = true; stop.hidden = false; out.hidden = false; out.textContent = 'Thinking…'; $('#aiNote').hidden = true;
  try {
    const r = await fetch('/api/explain', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ budget: budget.value, perMonth: rent, looking: filter.type === 'all' ? 'anything to buy' : catOf(filter.type).label, district: filter.district, want: $('#aiWant').value.trim().slice(0, 300), listings: rows })
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.text) throw new Error(j && j.error || 'failed');
    out.textContent = j.text;
    $('#aiNote').hidden = false;
  } catch (e) {
    if (e && e.name === 'AbortError') { out.hidden = true; }
    else out.textContent = 'The AI could not answer just now. The matches above still work.';
  } finally {
    if (aiCtl === ctl) aiCtl = null;
    btn.disabled = false; stop.hidden = true;
  }
});
$('#aiStop').addEventListener('click', () => { if (aiCtl) aiCtl.abort(); });

/* ---------- property details ---------- */
function setHash(id) { try { history.replaceState(null, '', id ? '#p-' + id : location.pathname + location.search); } catch (e) {} }
function openDetail(id) {
  const l = byId(id); if (!l) return;
  selectedId = id;
  renderList();
  const photos = (l.photos || []).filter(okUrl);
  const D = districtByName(l.district);
  const cat = catOf(l.type);
  const sub = [priceSub(l), !isRent(l) && l.price >= 1e5 ? 'रू ' + groupIN(l.price) : ''].filter(Boolean).join(' · ');
  const facts = [];
  if (areaText(l)) facts.push(['Size', areaText(l) + (areaSqft(l) ? ' (' + areaSqft(l) + ')' : '')]);
  if (rateText(l)) facts.push(['Price per ' + rateOf(l).label, rateText(l)]);
  if (l.place) facts.push(['Place', l.place]);
  if (l.district) facts.push(['District', l.district + (D ? ', ' + D.prov + ' Province' : '')]);
  facts.push(['Status', l.status === 'sold' ? soldWord(l) : 'Available']);
  let h = '<div class="dlg-head"><div><div class="card-top">' + badges(l) + '</div><h2>' + esc(l.title) + '</h2></div>' +
    '<button class="x" type="button" data-close aria-label="Close">&times;</button></div>';
  h += '<div class="gal"><div class="gal-main" style="--c:' + cvar(cat) + '" id="galMain">' + (photos.length ? '<img src="' + esc(photos[0]) + '" alt="Photo 1 of ' + esc(l.title) + '">' : catIcon(cat)) + '</div>';
  if (photos.length > 1) h += '<div class="gal-thumbs">' + photos.map((p, i) => '<button type="button" data-ph="' + i + '" aria-pressed="' + (i === 0) + '" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(p) + '" alt="" loading="lazy"></button>').join('') + '</div>';
  h += '</div>';
  h += '<div><div class="price-big">' + esc(priceText(l)) + '</div>' + (sub ? '<p class="hint mono">' + esc(sub) + '</p>' : '') + '</div>';
  h += '<dl class="facts">' + facts.map(f => '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>').join('') + '</dl>';
  if (l.desc) h += '<p class="desc">' + esc(l.desc) + '</p>';
  h += '<div class="row"><button class="btn primary" type="button" data-talk>Talk to me about this</button>' +
    '<a class="btn" href="https://www.google.com/maps?q=' + (+l.lat).toFixed(6) + ',' + (+l.lng).toFixed(6) + '" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>' +
    '<button class="btn" type="button" data-showmap>Show on this map</button>' +
    '<button class="btn" type="button" data-share>Copy link</button></div>';
  if (owner) h += '<div class="row owner-row"><button class="btn small" type="button" data-edit>Edit</button>' +
    '<button class="btn small" type="button" data-sold>' + (l.status === 'sold' ? 'Mark as available' : isRent(l) ? 'Mark as rented out' : 'Mark as sold') + '</button>' +
    '<button class="btn small danger" type="button" data-del>Delete</button>' +
    '<span class="row" data-confirm hidden><strong>Delete this listing?</strong><button class="btn small danger" type="button" data-del-yes>Yes, delete</button><button class="btn small" type="button" data-del-no>Keep it</button></span></div>' +
    '<p class="err" role="alert" data-err hidden></p>';
  const box = $('#detailBody');
  box.innerHTML = h;
  box.dataset.id = id;
  box._photos = photos;
  setHash(id);
  if (!dlgDetail.open) dlgDetail.showModal();
}
dlgDetail.addEventListener('close', () => setHash(''));
$('#detailBody').addEventListener('click', async e => {
  const box = $('#detailBody'), id = box.dataset.id, l = byId(id);
  const t = e.target;
  const ph = t.closest('[data-ph]');
  if (ph) {
    const i = +ph.dataset.ph, p = box._photos[i];
    if (p) { $('#galMain').innerHTML = '<img src="' + esc(p) + '" alt="Photo ' + (i + 1) + '">'; box.querySelectorAll('[data-ph]').forEach(b => b.setAttribute('aria-pressed', String(b === ph))); }
    return;
  }
  if (!l) return;
  const errEl = box.querySelector('[data-err]');
  if (t.closest('[data-talk]')) openContact(id);
  else if (t.closest('[data-share]')) copyText(listingUrl(id), t.closest('[data-share]'));
  else if (t.closest('[data-showmap]')) { dlgDetail.close(); showOnMap(id); }
  else if (t.closest('[data-edit]')) { dlgDetail.close(); openEdit(id); }
  else if (t.closest('[data-sold]')) {
    const next = l.status === 'sold' ? 'available' : 'sold';
    const ok = await mutate(errEl, async () => {
      const r = await sb.from('listings').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id);
      if (r.error) throw r.error;
      l.status = next;
    }, next === 'sold' ? 'Marked as ' + soldWord(l).toLowerCase() + '.' : 'Marked as available.');
    if (ok) dlgDetail.close();
  }
  else if (t.closest('[data-del]')) { box.querySelector('[data-confirm]').hidden = false; }
  else if (t.closest('[data-del-no]')) { box.querySelector('[data-confirm]').hidden = true; }
  else if (t.closest('[data-del-yes]')) {
    const ok = await mutate(errEl, async () => {
      const r = await sb.from('listings').delete().eq('id', id);
      if (r.error) throw r.error;
      removePhotos(l.photos);
      state.listings = state.listings.filter(x => x.id !== id);
    }, 'Listing deleted.');
    if (ok) dlgDetail.close();
  }
});

/* ---------- contact ---------- */
function copyText(text, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1600); } };
  try { navigator.clipboard.writeText(text).then(done, () => toast('Press and hold the text to copy it.')); }
  catch (e) { toast('Press and hold the text to copy it.'); }
}
function openContact(id) {
  const l = id ? byId(id) : null, s = state.site;
  const msg = l ? 'Hello, I saw "' + l.title + '" (' + priceText(l) + ') on ' + (s.name || DEF_SITE.name) + '. Is it still available? Please send me the details. ' + listingUrl(l.id)
    : 'Hello, I am looking at ' + (s.name || DEF_SITE.name) + ' and would like to know more.';
  $('#contactH').textContent = s.owner ? 'Talk to ' + s.owner : 'Talk to me';
  const links = [];
  const wa = waUrl(s.whatsapp, msg);
  if (wa) links.push([wa, 'Message on WhatsApp', true]);
  SOCIALS.forEach(([k, label]) => { const u = socialUrl(k, s[k]); if (u) links.push([u, label, false]); });
  const tel = String(s.phone || '').replace(/[^\d+]/g, '');
  const has = !!(s.phone || links.length);
  let h = '';
  if (l) h += '<div class="about-box"><span class="hint">You are asking about</span><strong>' + esc(l.title) + '</strong><span>' + esc(priceText(l)) + '</span></div>';
  if (!has) {
    h += '<p>Contact details are not added yet.</p>';
    if (owner) h += '<div class="row"><button class="btn primary" type="button" data-site>Add my phone and social links</button></div>';
  } else {
    h += '<p class="hint">Full details, papers and site visits are arranged directly with me.</p>';
    if (s.phone) h += '<div class="field"><span>Call or text</span><div class="row"><span class="phone" id="phoneText">' + esc(s.phone) + '</span>' +
      (tel.length >= 7 ? '<a class="btn small primary" href="tel:' + esc(tel) + '">Call</a>' : '') + '<button class="btn small" type="button" data-copy="phone">Copy number</button></div></div>';
    if (links.length) h += '<div class="row">' + links.map(a => '<a class="btn' + (a[2] ? ' primary' : '') + '" href="' + esc(a[0]) + '" target="_blank" rel="noopener noreferrer">' + a[1] + '</a>').join('') + '</div>';
    h += '<label class="field" for="msgText"><span>Message you can send</span><textarea id="msgText" class="msgbox" rows="3" readonly></textarea></label>' +
      '<div class="row"><button class="btn small" type="button" data-copy="msg">Copy message</button></div>';
  }
  $('#contactBody').innerHTML = h;
  const ta = $('#msgText'); if (ta) ta.value = msg;
  if (!dlgContact.open) dlgContact.showModal();
}
$('#contactBody').addEventListener('click', e => {
  const c = e.target.closest('[data-copy]');
  if (c) { copyText(c.dataset.copy === 'phone' ? state.site.phone : $('#msgText').value, c); return; }
  if (e.target.closest('[data-site]')) { dlgContact.close(); openSite(); }
});
$('#talkBtn').addEventListener('click', () => openContact(null));

/* ---------- saving to the database ---------- */
function setBusy(on) {
  busy = on;
  ['#f_save', '#s_save', '#c_save', '#l_save', '#addBtn', '#siteBtn', '#catBtn'].forEach(s => { const b = $(s); if (b) b.disabled = on; });
  $('#f_save').textContent = on ? 'Saving…' : 'Save and publish';
  $('#s_save').textContent = on ? 'Saving…' : 'Save and publish';
}
function errText(e) {
  const m = String(e && (e.message || e.error_description || e.error) || '');
  if ((e && (e.code === '42501' || e.status === 401 || e.status === 403 || e.statusCode === '403')) || /row-level security|permission denied|not authorized|jwt/i.test(m)) return 'This account is not allowed to edit. Sign in again as the owner.';
  if (/payload too large|exceeded the maximum|too large/i.test(m)) return 'A photo is too large to upload. Remove it and try a smaller one.';
  if (/failed to fetch|network/i.test(m)) return 'No connection. Check the internet and try again.';
  return 'Could not save. Try again in a moment.';
}
async function mutate(errEl, work, okMsg) {
  if (busy) return false;
  if (errEl) errEl.hidden = true;
  setBusy(true);
  try {
    await work();
    renderAll();
    toast(okMsg || 'Saved.');
    return true;
  } catch (e) {
    console.error(e);
    const m = errText(e);
    if (errEl) { errEl.textContent = m; errEl.hidden = false; } else toast(m);
    return false;
  } finally { setBusy(false); }
}
function photoPath(url) { const i = String(url).indexOf('/object/public/photos/'); return i < 0 ? '' : decodeURIComponent(String(url).slice(i + 22).split('?')[0]); }
function removePhotos(urls) {
  const paths = (urls || []).map(photoPath).filter(Boolean);
  if (paths.length) sb.storage.from('photos').remove(paths).then(() => {}, () => {});
}

/* ---------- owner sign in ---------- */
function setOwner(on) {
  owner = !!on;
  $('#ownerBar').hidden = !owner;
  $('#loginLink').hidden = owner;
  document.body.classList.toggle('has-owner', owner);
  renderList();
}
async function checkOwner() {
  try {
    const s = await sb.auth.getSession();
    if (!s.data || !s.data.session) { setOwner(false); return 'out'; }
    const r = await sb.rpc('is_admin');
    if (r.error) throw r.error;
    setOwner(r.data === true);
    return r.data === true ? 'owner' : 'not_owner';
  } catch (e) { setOwner(false); return 'error'; }
}
$('#loginLink').addEventListener('click', () => { $('#l_err').hidden = true; $('#l_pass').value = ''; dlgLogin.showModal(); });
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#l_err'), email = $('#l_email').value.trim(), pass = $('#l_pass').value;
  const bad = m => { err.textContent = m; err.hidden = false; };
  if (!email || !pass) return bad('Type your email and password.');
  if (busy) return;
  setBusy(true);
  try {
    const r = await sb.auth.signInWithPassword({ email: email, password: pass });
    if (r.error) return bad(/invalid/i.test(r.error.message || '') ? 'The email or password is not right.' : 'Could not sign in. Check your connection and try again.');
    const who = await checkOwner();
    if (who === 'owner') { dlgLogin.close(); toast('Signed in. Owner tools are at the bottom.'); }
    else { await sb.auth.signOut(); bad(who === 'not_owner' ? 'This account is not set as the site owner yet. Do the “make yourself the owner” step in SETUP.md.' : 'Signed in, but the owner check failed. Run the database setup file first.'); }
  } catch (e2) { bad('Could not sign in. Check your connection and try again.'); }
  finally { setBusy(false); }
});
$('#signOutBtn').addEventListener('click', async () => { try { await sb.auth.signOut(); } catch (e) {} setOwner(false); toast('Signed out.'); });
$('#addBtn').addEventListener('click', () => openEdit(null));
$('#siteBtn').addEventListener('click', openSite);

/* ---------- add or edit a property ---------- */
let draft = null, mini = null, miniMark = null;
function ensureMini() {
  if (mini) return;
  mini = L.map('miniMap', { minZoom: 6, maxBounds: L.latLngBounds(NEPAL_BOUNDS).pad(0.5) });
  mini.attributionControl.setPrefix(false);
  baseLayer().addTo(mini);
  mini.on('click', e => setDraftSpot(e.latlng.lat, e.latlng.lng, false, false));
}
function setMiniMark(lat, lng) {
  if (lat == null) { if (miniMark) { mini.removeLayer(miniMark); miniMark = null; } return; }
  if (!miniMark) {
    miniMark = L.marker([lat, lng], { draggable: true, icon: L.divIcon({ className: 'pin-ico pick', html: '<svg viewBox="-13 -20 26 26"><path class="shape" d="M0 5C-3-4-9-7-9-13a9 9 0 0 1 18 0c0 6-6 9-9 18Z"/></svg>', iconSize: [34, 34], iconAnchor: [17, 33] }), title: 'Drag to the exact spot' }).addTo(mini);
    miniMark.on('dragend', () => { const p = miniMark.getLatLng(); setDraftSpot(p.lat, p.lng, false, false); });
  } else miniMark.setLatLng([lat, lng]);
}
function setDraftSpot(lat, lng, fromInput, move) {
  const err = $('#f_err');
  if (!inNepalBox(lat, lng)) {
    err.textContent = 'That spot is outside Nepal. Check the numbers: latitude first (about 26 to 30), then longitude (about 80 to 88).';
    err.hidden = false;
    return;
  }
  err.hidden = true;
  const D = districtAt(lng, lat);
  draft.lat = +lat.toFixed(6); draft.lng = +lng.toFixed(6); draft.district = D ? D.name : '';
  $('#f_district').textContent = D ? D.name + ', ' + D.prov + ' Province' : 'Not placed yet';
  if (!fromInput) $('#f_coords').value = draft.lat.toFixed(5) + ', ' + draft.lng.toFixed(5);
  setMiniMark(draft.lat, draft.lng);
  if (move) mini.setView([draft.lat, draft.lng], Math.max(mini.getZoom(), 17));
}
function parseCoords(str) {
  const s = String(str || '');
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ||
    s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
  return isFinite(lat) && isFinite(lng) ? { lat, lng } : null;
}
function renderDraftPhotos() {
  $('#f_photoList').innerHTML = draft.photos.map((p, i) => '<div class="ph"><img src="' + esc(p.url || p.preview) + '" alt="Photo ' + (i + 1) + '"><button type="button" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">&times;</button></div>').join('');
}
function fileToBlob(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? res(b) : rej(new Error('encode')), 'image/jpeg', 0.8);
      } catch (e) { URL.revokeObjectURL(url); rej(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
    img.src = url;
  });
}
function openEdit(id) {
  const l = id ? byId(id) : null;
  draft = l ? JSON.parse(JSON.stringify(l)) : { id: null, type: state.cats.some(c => c.id === 'land') ? 'land' : state.cats[0].id, title: '', price: 0, area: { v: 0, u: 'aana' }, place: '', district: '', lat: null, lng: null, desc: '', photos: [], status: 'available' };
  draft.photos = (draft.photos || []).filter(okUrl).map(u => ({ url: u }));
  $('#editH').textContent = l ? 'Edit property' : 'Add property';
  $('#f_types').innerHTML = state.cats.map((c, i) => '<label><input type="radio" name="f_type" id="f_type_' + i + '" value="' + esc(c.id) + '"' + (c.id === draft.type ? ' checked' : '') + '><span>' + esc(c.label) + '</span></label>').join('');
  if (!$('input[name="f_type"]:checked')) { const first = $('input[name="f_type"]'); if (first) first.checked = true; }
  $('#f_title').value = draft.title || '';
  $('#f_area').value = draft.area && draft.area.v > 0 ? trimNum(draft.area.v) : '';
  $('#f_unit').value = draft.area && UNITS[draft.area.u] ? draft.area.u : 'aana';
  const perMode = !!draft.rateMode && !isRent(draft) && draft.area && draft.area.v > 0 && draft.price > 0;
  $('#f_pmode').value = perMode ? 'unit' : 'total';
  $('#f_price').value = draft.price > 0 ? String(perMode ? Math.round(draft.price / draft.area.v) : draft.price) : '';
  $('#f_place').value = draft.place || '';
  $('#f_desc').value = draft.desc || '';
  $('#f_sold').checked = draft.status === 'sold';
  $('#f_photos').value = '';
  $('#f_err').hidden = true;
  $('#f_photoNote').textContent = 'Photos are made smaller automatically so the site stays fast.';
  $('#placeList').innerHTML = Array.from(new Set(state.listings.map(placeName))).sort().map(n => '<option value="' + esc(n) + '"></option>').join('');
  readPrice();
  renderDraftPhotos();
  dlgEdit.showModal();
  ensureMini();
  setMiniMark(null);
  if (draft.lat != null && draft.lng != null) {
    const D = districtByName(draft.district);
    $('#f_district').textContent = draft.district ? draft.district + (D ? ', ' + D.prov + ' Province' : '') : 'Not placed yet';
    $('#f_coords').value = (+draft.lat).toFixed(5) + ', ' + (+draft.lng).toFixed(5);
  } else {
    $('#f_district').textContent = 'Not placed yet';
    $('#f_coords').value = '';
  }
  setTimeout(() => {
    mini.invalidateSize();
    if (draft.lat != null && draft.lng != null) { mini.setView([draft.lat, draft.lng], 17); setMiniMark(draft.lat, draft.lng); }
    else { const c = map.getCenter(); if (map.getZoom() >= 11) mini.setView(c, map.getZoom()); else mini.fitBounds(NEPAL_BOUNDS); }
  }, 60);
  dlgEdit.scrollTop = 0;
}
function formCat() { const el = $('input[name="f_type"]:checked'); return catOf(el ? el.value : 'land'); }
function readPrice() {
  const rent = formCat().deal === 'rent';
  const unit = UNITS[$('#f_unit').value] ? $('#f_unit').value : 'aana';
  $('#f_priceLabel').textContent = rent ? 'Rent per month in rupees' : 'Price in rupees';
  $('#f_pmode').hidden = rent;
  $('#f_pmode').options[1].textContent = 'per ' + UNITS[unit][0];
  $('#f_soldLabel').textContent = rent ? 'Already rented out' : 'Already sold';
  const v = $('#f_price').value.trim(), out = $('#f_priceRead');
  if (!v) { out.textContent = 'Leave the price empty to show “Price on request”.'; return; }
  const p = parseMoney(v, rent);
  if (!p) { out.textContent = rent ? 'Type the rent as a number, for example 18000.' : 'Type the price as a number, for example 45 lakh or 6500000.'; return; }
  if (rent) { out.textContent = 'Rent will show as ' + fmtNPR(p.value) + ' a month.'; return; }
  if ($('#f_pmode').value === 'unit') {
    const av = parseFloat($('#f_area').value);
    out.textContent = av > 0 ? 'Total price works out to ' + fmtNPR(p.value * av) + ' (' + trimNum(av) + ' ' + UNITS[unit][0] + ' at ' + fmtNPR(p.value) + ' each).' : 'Add the size so the total price can be worked out.';
    return;
  }
  out.textContent = 'Price will show as ' + fmtNPR(p.value) + ' (रू ' + groupIN(p.value) + ').';
}
['#f_price', '#f_area', '#f_unit', '#f_pmode', '#f_types'].forEach(s => { $(s).addEventListener('input', readPrice); $(s).addEventListener('change', readPrice); });
$('#f_coords').addEventListener('change', () => {
  const c = parseCoords($('#f_coords').value);
  if (c) setDraftSpot(c.lat, c.lng, true, true);
  else if ($('#f_coords').value.trim()) { $('#f_err').textContent = 'Could not read that location. Paste two numbers like 27.71720, 85.32400.'; $('#f_err').hidden = false; }
});
$('#f_here').addEventListener('click', () => {
  const err = $('#f_err'), btn = $('#f_here');
  if (!navigator.geolocation) { err.textContent = 'This device cannot share its location. Tap the map instead.'; err.hidden = false; return; }
  btn.disabled = true; btn.textContent = 'Finding you…';
  navigator.geolocation.getCurrentPosition(
    p => { btn.disabled = false; btn.textContent = 'Use where I am standing now'; setDraftSpot(p.coords.latitude, p.coords.longitude, false, true); },
    () => { btn.disabled = false; btn.textContent = 'Use where I am standing now'; err.textContent = 'Could not get your location. Allow location for this site, or tap the map instead.'; err.hidden = false; },
    { enableHighAccuracy: true, timeout: 15000 });
});
$('#f_photoList').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; draft.photos.splice(+b.dataset.rm, 1); renderDraftPhotos(); });
$('#f_photos').addEventListener('change', async e => {
  const files = Array.from(e.target.files || []);
  const note = $('#f_photoNote');
  let bad = 0, skipped = 0;
  note.textContent = 'Preparing photos…';
  for (const f of files) {
    if (draft.photos.length >= 10) { skipped++; continue; }
    try { const b = await fileToBlob(f); draft.photos.push({ blob: b, preview: URL.createObjectURL(b) }); renderDraftPhotos(); } catch (err) { bad++; }
  }
  e.target.value = '';
  note.textContent = bad ? bad + (bad === 1 ? ' photo' : ' photos') + ' could not be read. Use JPG or PNG photos.' :
    skipped ? 'Only 10 photos fit on one listing. The rest were left out.' : 'Photos are made smaller automatically so the site stays fast.';
});
$('#editForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#f_err');
  const bad = m => { err.textContent = m; err.hidden = false; };
  const title = $('#f_title').value.trim();
  if (!title) return bad('Add a title so buyers know what this is.');
  const cat = formCat(), rent = cat.deal === 'rent';
  const av = parseFloat($('#f_area').value);
  const pv = $('#f_price').value.trim();
  const price = pv ? parseMoney(pv, rent) : { value: 0 };
  if (!price) return bad('The price could not be read. Type a number such as 45 lakh or 6500000.');
  const perMode = !rent && $('#f_pmode').value === 'unit' && price.value > 0;
  if (perMode && !(av > 0)) return bad('Add the size so the total price can be worked out from the price per unit.');
  const c = parseCoords($('#f_coords').value);
  if (c && (draft.lat == null || Math.abs(c.lat - draft.lat) > 0.00002 || Math.abs(c.lng - draft.lng) > 0.00002)) setDraftSpot(c.lat, c.lng, true, true);
  if (draft.lat == null || draft.lng == null) return bad('Tap the map or paste the location so the pin can be placed.');
  const old = draft.id ? byId(draft.id) : null;
  const id = draft.id || uuid();
  const ok = await mutate(err, async () => {
    const urls = [];
    for (let i = 0; i < draft.photos.length && i < 10; i++) {
      const ph = draft.photos[i];
      if (ph.url) { urls.push(ph.url); continue; }
      const path = id + '/' + Date.now().toString(36) + '-' + i + '.jpg';
      const up = await sb.storage.from('photos').upload(path, ph.blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
      if (up.error) throw up.error;
      const pub = sb.storage.from('photos').getPublicUrl(path);
      urls.push(pub.data.publicUrl);
      ph.url = pub.data.publicUrl;
    }
    const item = {
      id: id, type: cat.id, title: title, price: perMode ? Math.round(price.value * av) : price.value, rateMode: perMode,
      area: { v: av > 0 ? av : 0, u: $('#f_unit').value }, place: $('#f_place').value.trim(), district: draft.district,
      lat: draft.lat, lng: draft.lng, desc: $('#f_desc').value.trim(), photos: urls, status: $('#f_sold').checked ? 'sold' : 'available'
    };
    const r = await sb.from('listings').upsert(toRow(item)).select();
    if (r.error) throw r.error;
    const saved = r.data && r.data[0] ? fromRow(r.data[0]) : Object.assign({ added: new Date().toISOString() }, item);
    if (old) { removePhotos(old.photos.filter(u => urls.indexOf(u) < 0)); state.listings = state.listings.map(x => x.id === id ? saved : x); }
    else state.listings.unshift(saved);
  }, old ? 'Listing updated.' : 'Listing published.');
  if (ok) dlgEdit.close();
});

/* ---------- categories ---------- */
function renderCats() {
  $('#catList').innerHTML = state.cats.map(c => {
    const n = state.listings.filter(l => l.type === c.id).length;
    return '<li style="--c:' + cvar(c) + '"><svg viewBox="-12 -12 24 24" aria-hidden="true">' + shapeOf(c) + '</svg><span class="cn">' + esc(c.label) + '</span><span class="hint">' + (c.deal === 'rent' ? 'For rent' : 'For sale') + ' · ' + n + (n === 1 ? ' listing' : ' listings') + '</span>' +
      (n === 0 && state.cats.length > 1 ? '<button class="btn small" type="button" data-rmcat="' + esc(c.id) + '">Remove</button>' : '') + '</li>';
  }).join('');
}
$('#catBtn').addEventListener('click', () => { $('#c_name').value = ''; $('#c_deal_sale').checked = true; $('#c_err').hidden = true; renderCats(); dlgCats.showModal(); });
$('#catList').addEventListener('click', async e => {
  const b = e.target.closest('[data-rmcat]'); if (!b) return;
  const id = b.dataset.rmcat;
  const ok = await mutate($('#c_err'), async () => {
    const r = await sb.from('categories').delete().eq('id', id);
    if (r.error) throw r.error;
    state.cats = state.cats.filter(c => c.id !== id);
  }, 'Category removed.');
  if (ok) renderCats();
});
$('#catForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#c_err');
  const bad = m => { err.textContent = m; err.hidden = false; };
  const name = $('#c_name').value.trim().replace(/\s+/g, ' ');
  if (!name) return bad('Type a name for the new category.');
  if (state.cats.some(c => c.label.toLowerCase() === name.toLowerCase())) return bad('There is already a category with that name.');
  if (state.cats.length >= 12) return bad('Twelve categories is the most this page can show clearly. Remove one first.');
  const used = state.cats.map(c => c.color || 1);
  let color = 1; while (used.indexOf(color) >= 0 && color < 8) color++;
  const row = { id: 'c' + Date.now().toString(36), label: name, deal: $('#c_deal_rent').checked ? 'rent' : 'sale', color: color, shape: state.cats.length % SHAPES.length, no_rate: false, sort: state.cats.reduce((m, c) => Math.max(m, c.sort || 0), 0) + 1 };
  const ok = await mutate(err, async () => {
    const r = await sb.from('categories').insert(row);
    if (r.error) throw r.error;
    state.cats.push(catFromRow(row));
  }, 'Category added.');
  if (ok) { $('#c_name').value = ''; renderCats(); }
});

/* ---------- site details ---------- */
function openSite() {
  const s = state.site;
  $('#s_name').value = s.name || ''; $('#s_owner').value = s.owner || ''; $('#s_tag').value = s.tagline || '';
  $('#s_phone').value = s.phone || ''; $('#s_whatsapp').value = s.whatsapp || '';
  $('#s_fb').value = s.facebook || ''; $('#s_ig').value = s.instagram || ''; $('#s_tt').value = s.tiktok || '';
  $('#s_about').value = s.about || '';
  $('#s_err').hidden = true;
  dlgSite.showModal();
}
$('#siteForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#s_err');
  const v = id => $(id).value.trim();
  const fields = [['facebook', v('#s_fb'), 'Facebook'], ['instagram', v('#s_ig'), 'Instagram'], ['tiktok', v('#s_tt'), 'TikTok']];
  for (const f of fields) if (f[1] && !socialUrl(f[0], f[1])) { err.textContent = 'The ' + f[2] + ' link could not be read. Paste the full link or just the page name.'; err.hidden = false; return; }
  const wa = v('#s_whatsapp');
  if (wa && !waUrl(wa)) { err.textContent = 'The WhatsApp number looks too short. Include the country code, for example 97798XXXXXXXX.'; err.hidden = false; return; }
  const next = { name: v('#s_name') || DEF_SITE.name, owner: v('#s_owner'), tagline: v('#s_tag'), phone: v('#s_phone'), whatsapp: wa, facebook: fields[0][1], instagram: fields[1][1], tiktok: fields[2][1], about: v('#s_about') };
  const ok = await mutate(err, async () => {
    const r = await sb.from('site').upsert({ id: 1, data: next, updated_at: new Date().toISOString() });
    if (r.error) throw r.error;
    state.site = Object.assign({}, DEF_SITE, next);
  }, 'Site details saved.');
  if (ok) dlgSite.close();
});

/* ---------- dialogs: close buttons and backdrop ---------- */
[dlgDetail, dlgContact, dlgEdit, dlgSite, dlgCats, dlgLogin].forEach(d => {
  d.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { d.close(); return; }
    if (e.target === d && (d === dlgDetail || d === dlgContact)) d.close();
  });
});

/* ---------- boot ---------- */
function renderAll() { renderHeader(); renderLegend(); renderList(); }
renderHeader(); renderLegend();
(async function boot() {
  try { await loadAll(); }
  catch (e) {
    console.error(e);
    $('#cards').innerHTML = '<li class="empty">The listings could not be loaded. If this is a new site, run the database setup file first. Otherwise check your connection and reload.</li>';
    renderHeader(); renderLegend();
    checkOwner();
    return;
  }
  renderAll();
  const m = /^#p-([\w-]+)$/.exec(location.hash || '');
  if (m && byId(m[1])) { const l = byId(m[1]); map.setView([l.lat, l.lng], 16); openDetail(m[1]); }
  checkOwner();
  fetch('/api/explain').then(r => r.ok ? r.json() : null).then(j => { aiOn = !!(j && j.enabled); if (aiOn && budget) $('#aiBox').hidden = false; }).catch(() => {});
})();
})();
