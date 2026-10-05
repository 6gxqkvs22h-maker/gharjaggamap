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

// The site works in one district for now. Every listing is saved with it and nobody picks it.
// To open another district later, set DISTRICT and MAP_AREA in js/config.js.
const DISTRICT = CFG.DISTRICT || 'Kathmandu';
// The address of the home page, so a property can have its own address: /property/<id>
// True when a customer has just come back from Google after pressing "I am interested".
const cameBack = /[?&]interested=1/.test(location.search);
// True when the page is opening straight after a Google sign-in.
const fromAuth = /access_token=|[?&#]code=/.test(location.hash + location.search);
const BASE = location.pathname.replace(/index\.html$/, '').replace(/property\/[\w-]+\/?$/, '') || '/';

/* ---------- what each kind of property asks for ----------
   A category uses one of six forms. Each form lists the size units it allows, whether it can be
   sold, rented or both, and the questions it asks. Nothing else is shown for that category. */
const FACING = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];
const ROADS = ['Blacktopped', 'Concrete', 'Gravel', 'Dirt', 'Highway', 'Other'];
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const floorText = n => n < 0 ? 'Basement' : n === 0 ? 'Ground floor' : ordinal(n) + ' floor';
const FLOORS = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(n => [String(n), floorText(n)]);

// t: num (decimal), int (whole number), sel (pick one), bool (tick), text.
// col: the fact has its own database column. The others are kept together in "details".
const FIELDS = {
  road_width: { label: 'Road width', t: 'num', unit: 'ft', col: 1, ph: '20', max: 500 },
  road_type: { label: 'Road type', t: 'sel', col: 1, opts: ROADS },
  facing: { label: 'Facing', t: 'sel', col: 1, opts: FACING },
  land_shape: { label: 'Land shape', t: 'sel', col: 1, opts: ['Rectangular', 'Square', 'Irregular', 'Other'] },
  land_surface: { label: 'Land surface', t: 'sel', col: 1, opts: ['Flat', 'Slightly sloped', 'Sloped'] },
  frontage: { label: 'Frontage', t: 'num', unit: 'ft', col: 1, ph: '30', max: 5000 },
  road_sides: { label: 'Number of road sides', t: 'sel', col: 1, int: 1, opts: ['1', '2', '3', '4'] },
  bedrooms: { label: 'Bedrooms', t: 'int', col: 1, max: 99 },
  bathrooms: { label: 'Bathrooms', t: 'int', col: 1, max: 99 },
  floors: { label: 'Floors', t: 'num', col: 1, ph: '2.5', max: 99 },
  parking: { label: 'Parking', t: 'sel', col: 1, opts: ['None', 'Bike', 'Car', 'Both'] },
  furnished: { label: 'Furnishing', t: 'sel', col: 1, opts: ['Furnished', 'Semi-furnished', 'Unfurnished'] },
  water: { label: 'Water', t: 'bool', col: 1 },
  electricity: { label: 'Electricity', t: 'bool', col: 1 },
  internet: { label: 'Internet / Wi-Fi', t: 'bool', col: 1 },
  lift: { label: 'Lift', t: 'bool', col: 1 },
  balcony: { label: 'Balcony', t: 'bool', col: 1 },
  suitable_for: { label: 'Suitable for', t: 'sel', col: 1, opts: [] },
  built_year: { label: 'Built year', t: 'int', col: 1, ph: '2078 or 2021', min: 1900, max: 2100, year: 1 },
  kitta_no: { label: 'Kitta number', t: 'text', opt: 1, max: 40 },
  landmark: { label: 'Nearby landmark', t: 'text', ph: 'For example: 200 m from Ring Road', max: 80 },
  drainage: { label: 'Drainage', t: 'bool' },
  kitchens: { label: 'Kitchens', t: 'int', max: 99 },
  living_rooms: { label: 'Living rooms', t: 'int', max: 99 },
  dining: { label: 'Dining room', t: 'bool' },
  terrace: { label: 'Terrace', t: 'bool' },
  solar: { label: 'Solar', t: 'bool' },
  garden: { label: 'Garden', t: 'bool' },
  compound: { label: 'Compound', t: 'bool' },
  quake: { label: 'Earthquake resistant', t: 'bool' },
  rooms: { label: 'Rooms', t: 'int', max: 999 },
  current_use: { label: 'Current use', t: 'text', ph: 'For example: running restaurant', max: 80 },
  floor: { label: 'Floor', t: 'sel', int: 1, opts: FLOORS },
  bathroom: { label: 'Bathroom', t: 'bool' },
  bathroom_type: { label: 'Bathroom', t: 'sel', opts: ['Attached', 'Shared'] },
  kitchen: { label: 'Kitchen', t: 'bool' },
  living_room: { label: 'Living room', t: 'bool' },
  bed: { label: 'Bed included', t: 'bool' },
  security: { label: 'Security', t: 'bool' },
  pets: { label: 'Pet friendly', t: 'bool' }
};
const LAND_UNITS = ['ropani', 'aana', 'paisa', 'daam', 'bigha', 'kattha', 'dhur', 'sqft', 'sqm'];
const PLOT_UNITS = ['ropani', 'aana', 'paisa', 'daam', 'sqft'];
const ROOM_UNITS = ['sqft', 'sqm'];
const KINDS = {
  land: {
    deals: ['sale'], units: LAND_UNITS, unit: 'aana', size: 'Land size', sizePh: '4', perUnit: true, titlePh: '4 Anna land near Ring Road',
    groups: [['Road', ['road_width', 'road_type']],
      ['Land details', ['facing', 'land_shape', 'land_surface', 'frontage', 'road_sides']],
      ['Utilities', ['water', 'electricity', 'drainage']],
      ['Other', ['kitta_no', 'suitable_for', 'landmark']]],
    suit: ['Residential', 'Commercial', 'Both'], card: ['area', 'rate', 'road', 'facing']
  },
  house: {
    deals: ['sale', 'rent'], units: PLOT_UNITS, unit: 'aana', size: 'Land area', sizePh: '4', built: true, titlePh: '5 bedroom house in Sanepa',
    groups: [['House details', ['bedrooms', 'bathrooms', 'kitchens', 'living_rooms', 'floors', 'parking', 'furnished', 'dining', 'balcony', 'terrace']],
      ['Road', ['road_width', 'road_type', 'facing']],
      ['Other', ['built_year', 'landmark', 'water', 'electricity', 'solar', 'internet', 'garden', 'compound', 'quake']]],
    opts: { road_type: ['Blacktopped', 'Concrete', 'Gravel', 'Other'] }, card: ['bedrooms', 'area', 'road', 'facing']
  },
  business: {
    deals: ['sale', 'rent'], units: PLOT_UNITS, unit: 'aana', size: 'Land area', sizePh: '8', built: true, titlePh: 'Office space on New Road',
    sub: ['Property type', ['Commercial building', 'Office', 'Hotel', 'Restaurant', 'Hostel', 'School', 'Warehouse', 'Factory', 'Showroom', 'Other']],
    groups: [['Building', ['floors', 'rooms', 'bathrooms', 'parking', 'furnished', 'kitchen']],
      ['Road', ['road_width', 'road_type', 'facing']],
      ['Use', ['current_use', 'suitable_for']],
      ['Other', ['built_year', 'water', 'electricity', 'internet']]],
    suit: ['Hotel', 'Restaurant', 'Office', 'School', 'Hostel', 'Warehouse', 'Showroom', 'Other'], card: ['area', 'built', 'floors', 'road']
  },
  shutter: {
    deals: ['rent', 'sale'], units: ROOM_UNITS, unit: 'sqft', size: 'Shutter size', sizePh: '350', titlePh: 'Shutter on the main road',
    groups: [['Shutter details', ['floor', 'frontage', 'road_width', 'road_type', 'facing', 'parking', 'bathroom', 'water', 'electricity']],
      ['Suitable business', ['suitable_for']]],
    suit: ['Grocery', 'Restaurant', 'Clothing', 'Office', 'Salon', 'Workshop', 'Showroom', 'Warehouse', 'Other'], suitLabel: 'Suitable business', card: ['area', 'road', 'floor']
  },
  room: {
    deals: ['rent'], units: ROOM_UNITS, unit: 'sqft', size: 'Room size', sizeOpt: true, sizePh: '150', titlePh: 'Single room with attached bathroom',
    sub: ['Room type', ['Single room', 'Double room', 'Studio', 'Room + kitchen', 'Other']],
    groups: [['Room details', ['floor', 'bathroom_type', 'furnished', 'parking', 'kitchen', 'bed', 'water', 'electricity', 'internet']],
      ['Suitable for', ['suitable_for']]],
    suit: ['Student', 'Working professional', 'Couple', 'Family', 'Anyone', 'Other'], card: ['sub', 'bathroom_type', 'parking', 'floor']
  },
  flat: {
    deals: ['rent', 'sale'], units: ROOM_UNITS, unit: 'sqft', size: 'Flat size', sizePh: '950', titlePh: '2 BHK flat near Jhamsikhel',
    sub: ['BHK', ['Studio', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK', 'Other']],
    groups: [['Flat details', ['bedrooms', 'bathrooms', 'floor', 'parking', 'furnished', 'kitchen', 'living_room', 'balcony', 'lift', 'water', 'electricity', 'internet', 'security', 'pets']],
      ['Suitable for', ['suitable_for']]],
    rentOnly: ['pets', 'suitable_for'], suit: ['Family', 'Students', 'Working professionals', 'Couple', 'Anyone', 'Other'], card: ['area', 'floor', 'parking', 'lift', 'furnished']
  }
};
const KIND_NAMES = { land: 'Land', house: 'House', business: 'Business', shutter: 'Shutter', room: 'Room', flat: 'Flat' };
const STATUSES = ['available', 'sold', 'rented', 'unavailable'];
const STATUS_WORD = { available: 'Available', sold: 'Sold', rented: 'Rented', unavailable: 'Unavailable' };

/* ---------- data ---------- */
const DEF_SITE = { name: 'Ghar Jagga Map', tagline: 'Houses, land, flats, rooms and commercial properties for sale and rent in Kathmandu', owner: '', phone: '', whatsapp: '', facebook: '', instagram: '', tiktok: '', about: '', howto: '' };
const DEF_CATS = [
  { id: 'land', label: 'Land', deal: 'sale', color: 2, shape: 1, form: 'land' },
  { id: 'house', label: 'House', deal: 'sale', color: 1, shape: 0, form: 'house' },
  { id: 'business', label: 'Business', deal: 'sale', color: 3, shape: 2, form: 'business' },
  { id: 'shutter', label: 'Shutter', deal: 'rent', color: 4, shape: 3, form: 'shutter' },
  { id: 'room', label: 'Room', deal: 'rent', color: 5, shape: 4, form: 'room' },
  { id: 'flat', label: 'Flat', deal: 'rent', color: 6, shape: 6, form: 'flat' }
];
const state = { site: Object.assign({}, DEF_SITE), cats: DEF_CATS.slice(), listings: [] };

const catOf = id => state.cats.find(c => c.id === id) || { id: id, label: String(id || 'Other'), deal: 'sale', color: 8, shape: 2 };
// Which of the six forms a category uses. Categories made before the update have no "form", so it is worked out.
function kindOf(c) {
  if (c.form && KINDS[c.form]) return c.form;
  if (KINDS[c.id]) return c.id;
  const n = String(c.label || '').toLowerCase();
  if (/flat|apartment/.test(n)) return 'flat';
  if (/shutter|shop/.test(n)) return 'shutter';
  if (/room|hostel/.test(n)) return 'room';
  if (/house|ghar|bungalow/.test(n)) return 'house';
  if (/land|plot|jagga/.test(n)) return 'land';
  return c.deal === 'rent' ? 'room' : c.noRate ? 'business' : 'land';
}
const K_of = l => KINDS[kindOf(catOf(l.type))];
// The questions a form asks for this deal, in order.
function fieldsOf(K, rent) {
  const out = [];
  K.groups.forEach(g => g[1].forEach(k => { if (rent || !(K.rentOnly && K.rentOnly.indexOf(k) >= 0)) out.push(k); }));
  return out;
}
const labelOf = (k, K) => (k === 'suitable_for' && K.suitLabel) || FIELDS[k].label;
const optsOf = (k, K) => (K.opts && K.opts[k]) || (k === 'suitable_for' ? K.suit || [] : FIELDS[k].opts);
// Turns whatever was typed or stored into a clean value, or null when there is nothing to keep.
function cleanVal(f, v) {
  if (v == null || v === '') return null;
  if (f.t === 'bool') return v === true ? true : null;
  if (f.t === 'num' || f.t === 'int') {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    if (!isFinite(n) || n <= 0) return null;
    const m = Math.min(f.max || 1e9, f.t === 'int' ? Math.round(n) : Math.round(n * 100) / 100);
    return f.min && m < f.min ? null : m;
  }
  if (f.t === 'sel' && f.int) { const n = parseInt(v, 10); return isFinite(n) ? n : null; }
  const s = String(v).trim().slice(0, f.max || 60);
  return s || null;
}

function fromRow(r) {
  const deal = r.deal_type === 'rent' || r.deal_type === 'sale' ? r.deal_type : catOf(r.type).deal;
  const det = r.details && typeof r.details === 'object' && !Array.isArray(r.details) ? r.details : {};
  const d = {};
  Object.keys(FIELDS).forEach(k => { const v = cleanVal(FIELDS[k], FIELDS[k].col ? r[k] : det[k]); if (v != null) d[k] = v; });
  let status = STATUSES.indexOf(r.status) >= 0 ? r.status : 'available';
  if (status === 'sold' && deal === 'rent') status = 'rented';
  return {
    id: r.id, type: r.type, deal: deal, sub: String(r.property_subtype || ''), title: r.title || '', price: Number(r.price) || 0, rateMode: !!r.rate_mode,
    area: { v: Number(r.area_value) || 0, u: r.area_unit || 'aana' },
    built: { v: Number(r.built_up_area) || 0, u: r.built_up_area_unit === 'sqm' ? 'sqm' : 'sqft' },
    deposit: Number(r.deposit) || 0, social: okUrl(r.social_post_url) ? r.social_post_url : '', d: d,
    place: r.place || '', district: r.district || '', lat: Number(r.lat), lng: Number(r.lng), desc: r.description || '',
    photos: Array.isArray(r.photos) ? r.photos.filter(okUrl) : [], status: status, featured: r.featured === true, added: r.created_at || ''
  };
}
function toRow(l) {
  const row = {
    id: l.id, type: l.type, deal_type: l.deal, property_subtype: l.sub || null, title: l.title, price: Math.round(l.price) || 0, rate_mode: !!l.rateMode,
    area_value: l.area.v || 0, area_unit: l.area.u,
    built_up_area: l.built && l.built.v > 0 ? l.built.v : null, built_up_area_unit: l.built && l.built.v > 0 ? l.built.u : null,
    deposit: l.deposit > 0 ? Math.round(l.deposit) : null, social_post_url: l.social || null,
    place: l.place, district: l.district, lat: l.lat, lng: l.lng,
    description: l.desc, photos: l.photos, status: l.status, updated_at: new Date().toISOString()
  };
  const det = {};
  Object.keys(FIELDS).forEach(k => { const v = l.d[k]; if (FIELDS[k].col) row[k] = v == null ? null : v; else if (v != null) det[k] = v; });
  row.details = det;
  return row;
}
const catFromRow = r => ({ id: r.id, label: r.label, deal: r.deal === 'rent' ? 'rent' : 'sale', color: r.color || 1, shape: r.shape || 0, noRate: !!r.no_rate, sort: r.sort || 0, form: r.form || '' });

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
  // Land, House, Business, Shutter, Room, Flat first, then the categories the owner added.
  const rank = c => { const i = DEF_CATS.findIndex(d => d.id === c.id); return i >= 0 ? i : 100 + (c.sort || 0); };
  state.cats.sort((x, y) => rank(x) - rank(y));
  state.listings = (res[2].data || []).map(fromRow).filter(l => isFinite(l.lat) && isFinite(l.lng));
}

/* ---------- the area the map covers ---------- */
// The map opens on it and cannot be zoomed out or dragged beyond it.
// To cover more later, add MAP_AREA: [[southLat, westLng], [northLat, eastLng]] to js/config.js.
const AREA = Array.isArray(CFG.MAP_AREA) ? CFG.MAP_AREA : [[27.55, 85.15], [27.85, 85.60]];
const AREA_NAME = CFG.MAP_AREA_NAME || 'the Kathmandu Valley';
const inArea = (lat, lng) => lat >= AREA[0][0] && lat <= AREA[1][0] && lng >= AREA[0][1] && lng <= AREA[1][1];

/* ---------- money and land units ---------- */
// name, square feet in one unit. 1 Ropani = 16 Anna, 1 Anna = 4 Paisa, 1 Paisa = 4 Daam.
const UNITS = {
  ropani: ['Ropani', 5476], aana: ['Anna', 342.25], paisa: ['Paisa', 85.5625], daam: ['Daam', 21.390625],
  bigha: ['Bigha', 72900], kattha: ['Kattha', 3645], dhur: ['Dhur', 182.25], sqft: ['sq ft', 1], sqm: ['sq m', 10.7639]
};
const SHAPES = [
  '<path class="shape" d="M0-10 10-1.5H7V8.5H-7V-1.5H-10Z"/>',
  '<path class="shape" d="M0-9.5 9.5 0 0 9.5-9.5 0Z"/>',
  '<circle class="shape" r="8"/>',
  '<path class="shape" d="M-7.5-7.5H7.5V7.5H-7.5Z"/>',
  '<path class="shape" d="M-7 8.5V-2.5a7 7 0 0 1 14 0V8.5Z"/>',
  '<path class="shape" d="M0-9.5 9.5 7.5H-9.5Z"/>',
  '<path class="shape" d="M0-9.5 8.2-4.7V4.7L0 9.5-8.2 4.7V-4.7Z"/>'
];
const isRent = l => l.deal === 'rent';
const cnum = c => (((c.color || 1) - 1) % 8) + 1;
const cvar = c => 'var(--k' + cnum(c) + ')';
const mvar = c => 'var(--m' + cnum(c) + ')';
const shapeOf = c => SHAPES[(c.shape || 0) % SHAPES.length];
// One drawn icon for each kind of property. The colour comes from the category (--c).
const D = '#0B1210';
const ICONS = {
  land: '<path d="M24 22 5.5 31 24 40l18.5-9z" fill="var(--c)"/><path d="M11 33.7 5.5 36.4 24 45.4l18.5-9-5.5-2.7L24 40z" fill="var(--c)" opacity=".5"/><path d="M14.5 30.4 24 25.8l9.5 4.6M19.5 33 24 30.8l4.5 2.2" fill="none" stroke="' + D + '" stroke-opacity=".35" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M24 23V11.5" fill="none" stroke="var(--c)" stroke-width="2.6" stroke-linecap="round"/><path d="M24 17.5c-.6-5-4.2-7.3-9.2-7.3 0 5.2 3.9 8.3 9.2 7.3zM24 12.5c.6-4.6 3.9-6.8 8.6-6.8 0 4.9-3.7 7.7-8.6 6.8z" fill="var(--c)"/>',
  house: '<path d="M9.5 23.5V41a2.5 2.5 0 0 0 2.5 2.5h24a2.5 2.5 0 0 0 2.5-2.5V23.5L24 11z" fill="var(--c)" opacity=".62"/><path d="M5 24.5 24 8l19 16.5" fill="none" stroke="var(--c)" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="17.5" y="26" width="13" height="13" rx="2.2" fill="' + D + '"/><path d="M24 27.5v10M19 32.5h10" stroke="var(--c)" stroke-width="2.2" stroke-linecap="round"/>',
  business: '<path d="M10 21h28v20a2.5 2.5 0 0 1-2.5 2.5h-23A2.5 2.5 0 0 1 10 41z" fill="var(--c)" opacity=".62"/><path d="M10 6.5h28l4.5 12.5a4.63 4.63 0 0 1-9.25 0 4.63 4.63 0 0 1-9.25 0 4.63 4.63 0 0 1-9.25 0 4.63 4.63 0 0 1-9.25 0z" fill="var(--c)"/>' +
    '<path d="M19 43.5V33a5 5 0 0 1 10 0v10.5z" fill="' + D + '"/>',
  shutter: '<rect x="8.5" y="21" width="31" height="22.5" rx="2" fill="var(--c)" opacity=".62"/><path d="M4.5 20.5 24 7.5l19.5 13v3.2h-39z" fill="var(--c)"/>' +
    '<path d="M13.5 29h21M13.5 33.8h21M13.5 38.6h21" fill="none" stroke="' + D + '" stroke-opacity=".7" stroke-width="2.6" stroke-linecap="round"/>',
  room: '<rect x="11" y="24" width="31" height="9" rx="4.5" fill="var(--c)" opacity=".62"/><rect x="11.5" y="17.5" width="12" height="8" rx="4" fill="var(--c)"/>' +
    '<path d="M7 11v30.5M7 35h34.5v6.5" fill="none" stroke="var(--c)" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>',
  flat: '<path d="M26.5 43V19.5l13 4V43z" fill="var(--c)" opacity=".62"/><path d="M8.5 43V11.5l15-5V43z" fill="var(--c)"/>' +
    '<path d="M13 16.5h6V21h-6zM13 24.5h6V29h-6zM13 32.5h6V37h-6zM30.5 26.5H35V31h-4.5zM30.5 34H35v4.5h-4.5z" fill="' + D + '" fill-opacity=".72"/><path d="M5 43.5h38" stroke="var(--c)" stroke-width="2.6" stroke-linecap="round"/>'
};
const kindIcon = (kind, cls) => '<svg class="kico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 48 48" aria-hidden="true">' + (ICONS[kind] || ICONS.house) + '</svg>';
const catIcon = c => kindIcon(kindOf(c), 'ph-ico');
// A photo that fails to load is replaced by the category icon, so a card never shows an empty box.
const imgTag = (url, c, alt) => '<img src="' + esc(url) + '" alt="' + esc(alt || '') + '" loading="lazy" data-k="' + kindOf(c) + '" data-c="' + cnum(c) + '">';
document.addEventListener('error', e => {
  const t = e.target;
  if (!t || t.tagName !== 'IMG' || !t.dataset.k) return;
  const span = document.createElement('span');
  span.className = t.closest('.fmain') ? 'fnone' : 'noimg';
  span.style.setProperty('--c', 'var(--k' + (parseInt(t.dataset.c, 10) || 1) + ')');
  span.innerHTML = kindIcon(t.dataset.k, 'ph-ico');
  t.replaceWith(span);
}, true);
const catName = c => String(c.label || '').replace(/\s+(for\s+)?rent$/i, '') || 'Property';
// The line a visitor reads first: "Land for sale", "2 BHK Flat for rent", "Office for rent".
function headline(l) {
  const c = catOf(l.type), kind = kindOf(c);
  let what = catName(c);
  if (kind === 'flat' && l.sub && l.sub !== 'Other') what = l.sub === 'Studio' ? 'Studio flat' : l.sub + ' ' + what;
  else if (kind === 'business') what = l.sub && l.sub !== 'Other' ? l.sub : (c.id === 'business' ? 'Commercial property' : what);
  return what + (isRent(l) ? ' for rent' : ' for sale');
}

function groupIN(n) {
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
}
const trimNum = n => String(Math.round(n * 100) / 100);
function fmtNPR(n) {
  if (!isFinite(n) || n <= 0) return 'Price on request';
  if (n >= 1e7) return 'Rs. ' + trimNum(n / 1e7) + ' crore';
  if (n >= 1e5) return 'Rs. ' + trimNum(n / 1e5) + ' lakh';
  return 'Rs. ' + groupIN(n);
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
const sizeNum = (v, u) => (u === 'sqft' || u === 'sqm') && v >= 1000 ? groupIN(v) : trimNum(v);
function areaText(l) {
  if (!l.area || !(l.area.v > 0) || !UNITS[l.area.u]) return '';
  return sizeNum(l.area.v, l.area.u) + ' ' + UNITS[l.area.u][0];
}
function areaSqft(l) {
  if (!l.area || !(l.area.v > 0) || !UNITS[l.area.u] || l.area.u === 'sqft') return '';
  return groupIN(l.area.v * UNITS[l.area.u][1]) + ' sq ft';
}
const builtText = l => l.built && l.built.v > 0 ? sizeNum(l.built.v, l.built.u) + ' ' + UNITS[l.built.u][0] : '';
// Size in square feet, to compare listings measured in different units.
function sizeSqft(l) {
  if (l.area && l.area.v > 0 && UNITS[l.area.u]) return l.area.v * UNITS[l.area.u][1];
  if (l.built && l.built.v > 0) return l.built.v * UNITS[l.built.u][1];
  return 0;
}
// Land is compared by its price per Anna (per Kattha or Dhur when it was measured that way).
const rateUnit = u => u === 'dhur' ? 'dhur' : (u === 'kattha' || u === 'bigha') ? 'kattha' : 'aana';
function rateOf(l) {
  const K = K_of(l);
  if (!K.perUnit || isRent(l) || !(l.price > 0) || !l.area || !(l.area.v > 0) || !UNITS[l.area.u]) return null;
  const u = rateUnit(l.area.u);
  const n = l.area.v * UNITS[l.area.u][1] / UNITS[u][1];
  return { v: l.price / n, u: u, label: UNITS[u][0] };
}
function rateText(l) { const r = rateOf(l); return r ? fmtNPR(r.v) + ' per ' + r.label : ''; }
function priceText(l) {
  if (!(l.price > 0)) return 'Price on request';
  if (isRent(l)) return fmtNPR(l.price) + '/month';
  if (l.rateMode && rateOf(l)) return rateText(l);
  return fmtNPR(l.price);
}
function priceSub(l) {
  if (!(l.price > 0) || isRent(l)) return '';
  if (l.rateMode && rateOf(l)) return 'Total ' + fmtNPR(l.price);
  return rateText(l);
}
const bedsOf = l => l.d.bedrooms || parseInt(l.sub, 10) || 0;
const parkText = v => v === 'Bike' ? 'Bike parking' : v === 'Car' ? 'Car parking' : v === 'Both' ? 'Bike and car parking' : v === 'None' ? 'No parking' : '';
// The short facts on a card, different for each kind of property. Empty ones are left out.
function cardFacts(l) {
  const K = K_of(l), d = l.d, out = [];
  K.card.forEach(k => {
    let t = '';
    if (k === 'area') t = areaText(l);
    else if (k === 'built') t = builtText(l) ? builtText(l) + ' built-up' : '';
    else if (k === 'rate') t = priceSub(l);
    else if (k === 'road') t = d.road_width ? trimNum(d.road_width) + ' ft road' : '';
    else if (k === 'facing') t = d.facing ? d.facing + ' facing' : '';
    else if (k === 'bedrooms') t = d.bedrooms ? d.bedrooms + (d.bedrooms === 1 ? ' bedroom' : ' bedrooms') : '';
    else if (k === 'floors') t = d.floors ? trimNum(d.floors) + (d.floors === 1 ? ' floor' : ' floors') : '';
    else if (k === 'floor') t = d.floor != null ? floorText(d.floor) : '';
    else if (k === 'parking') t = d.parking && d.parking !== 'None' ? (d.parking === 'Both' ? 'Parking' : parkText(d.parking)) : '';
    else if (k === 'lift') t = d.lift ? 'Lift' : '';
    else if (k === 'furnished') t = d.furnished || '';
    else if (k === 'sub') t = l.sub && l.sub !== 'Other' ? l.sub : '';
    else if (k === 'bathroom_type') t = d.bathroom_type ? d.bathroom_type + ' bathroom' : '';
    if (t) out.push(t);
  });
  return out;
}
const placeLine = l => { const p = String(l.place || '').trim(), d = l.district || ''; return p && d && p.toLowerCase().indexOf(d.toLowerCase()) < 0 ? p + ', ' + d : p || d; };

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
// The link to one property's own post or video. Only the address is kept; nothing is fetched from it.
// Returns '' for nothing typed and null when what was typed is not a link.
function postUrl(v) {
  v = String(v || '').trim();
  if (!v) return '';
  const m = v.match(/https?:\/\/\S+/i);
  if (m) v = m[0];
  else if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) v = 'https://' + v;
  else return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.protocol = 'https:';
    return okUrl(u.href) && u.href.length <= 500 ? u.href : null;
  } catch (e) { return null; }
}
function postSite(u) {
  try {
    const h = new URL(u).hostname.replace(/^(www|m|web|vm|vt)\./, '');
    if (/(^|\.)facebook\.com$|^fb\.(watch|com|me)$/.test(h)) return 'Facebook';
    if (/(^|\.)instagram\.com$/.test(h)) return 'Instagram';
    if (/(^|\.)tiktok\.com$/.test(h)) return 'TikTok';
    if (/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) return 'YouTube';
  } catch (e) {}
  return '';
}
const listingUrl = id => location.origin + BASE + 'property/' + id;

/* ---------- view state ---------- */
const filter = { type: 'all', deal: 'all', place: '', sort: 'new', minP: 0, maxP: 0, minSize: 0, beds: 0, road: 0, saved: false };
const placeName = l => String(l.place || '').split(',')[0].trim() || 'Other';
const placeKey = l => placeName(l).toLowerCase();
let budget = null, budgetIds = null, selectedId = null;
let owner = false, busy = false, aiOn = false, aiCtl = null;
let customer = null;          // a visitor who continued with Google: { id, email, name }
let googleOn = CFG.GOOGLE_LOGIN === true;   // found out from Supabase at start, unless set in js/config.js
let myInterest = new Set();   // the properties this customer already told the owner about
let leads = [];               // for the owner: everyone who pressed "I am interested"
let people = [];              // for the owner: every customer who continued with Google
let visits = { today: 0, week: 0, total: 0, ok: false };
const TZ = CFG.TIMEZONE || 'Asia/Kathmandu';
const dayKey = d => { try { return d.toLocaleDateString('en-CA', { timeZone: TZ }); } catch (e) { return d.toISOString().slice(0, 10); } };
const byId = id => state.listings.find(l => l.id === id) || null;
// Visitors never see a listing marked unavailable (the database does not send it to them either).
const shown = () => owner ? state.listings : state.listings.filter(l => l.status !== 'unavailable');
const dlgDetail = $('#dlgDetail'), dlgContact = $('#dlgContact'), dlgEdit = $('#dlgEdit'), dlgSite = $('#dlgSite'), dlgCats = $('#dlgCats'), dlgLogin = $('#dlgLogin'), dlgManage = $('#dlgManage'), dlgConfirm = $('#dlgConfirm'), dlgInterest = $('#dlgInterest'), dlgLeads = $('#dlgLeads'), dlgChat = $('#dlgChat'), dlgProfile = $('#dlgProfile');

// Dialogs can sit on top of each other (Manage listings, then a property, then Contact). This keeps their order.
const stack = [];
function show(d) { if (d.open) return; d.showModal(); stack.push(d); }
function toast(msg) {
  const t = $('#toast');
  // A message must show above an open dialog, so it moves into the top one.
  (stack[stack.length - 1] || document.body).appendChild(t);
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 4200);
}

/* ---------- street map ---------- */
// The public maps use MapTiler's dark street map. The owner's pin-placing map uses the standard one, which is easier to read up close.
// If the dark style cannot be loaded, the map falls back to the standard streets style. Set MAP_STYLE in js/config.js to use another.
function baseLayer(style) {
  if (CFG.MAPTILER_KEY) {
    const url = id => 'https://api.maptiler.com/maps/' + encodeURIComponent(id) + '/256/{z}/{x}/{y}.png?key=' + encodeURIComponent(CFG.MAPTILER_KEY);
    const id = style || CFG.MAP_STYLE || 'streets-v2-dark';
    const layer = L.tileLayer(url(id), {
      maxZoom: 20, attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
    });
    let good = 0, bad = 0, swapped = false;
    layer.on('tileload', () => { good++; });
    layer.on('tileerror', () => { if (!swapped && !good && ++bad >= 4 && id !== 'streets-v2') { swapped = true; layer.setUrl(url('streets-v2')); } });
    return layer;
  }
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
  });
}
const map = L.map('mainMap', { minZoom: 9, maxBounds: L.latLngBounds(AREA).pad(0.12), maxBoundsViscosity: 1, zoomSnap: 0.5 });
// Lock zooming out at the level where the whole area just fits the map box.
function lockZoom(m) { m.setMinZoom(Math.floor(m.getBoundsZoom(AREA, false) * 2) / 2); }
map.attributionControl.setPrefix(false);
baseLayer().addTo(map);
lockZoom(map);
map.fitBounds(AREA);
map.on('resize', () => lockZoom(map));
const markLayer = L.layerGroup().addTo(map);
let mapItems = [];

function pinIcon(l, cls) {
  const c = catOf(l.type);
  return L.divIcon({
    className: 'pin-ico' + (l.status !== 'available' ? ' sold' : '') + (l.id === selectedId ? ' sel' : '') + (cls ? ' ' + cls : ''),
    html: '<span class="pin" style="--c:' + cvar(c) + '">' + kindIcon(kindOf(c)) + '</span>', iconSize: [40, 48], iconAnchor: [20, 47]
  });
}
function addPin(l, at) {
  const label = headline(l) + ': ' + l.title + ', ' + priceText(l);
  L.marker(at || [l.lat, l.lng], { icon: pinIcon(l), title: label, alt: label, zIndexOffset: l.id === selectedId ? 1000 : 0 })
    .on('click', () => openDetail(l.id)).addTo(markLayer);
}
function fitPoints(pts) {
  if (!pts.length) return;
  if (pts.length === 1) { map.setView([pts[0].lat, pts[0].lng], Math.max(map.getZoom(), 16)); return; }
  map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])), { padding: [60, 60], maxZoom: 17 });
}
// Every property gets its own pin. Pins that would sit on top of each other at the
// current zoom are shown as one numbered bubble; tapping it zooms in until they separate.
function drawMap() {
  markLayer.clearLayers();
  const z = map.getZoom();
  const clusters = [];
  mapItems.forEach(l => {
    const p = map.project([l.lat, l.lng], z);
    const c = z >= 18 ? null : clusters.find(k => Math.abs(k.x - p.x) < 36 && Math.abs(k.y - p.y) < 40);
    if (c) { c.items.push(l); const n = c.items.length; c.x += (p.x - c.x) / n; c.y += (p.y - c.y) / n; }
    else clusters.push({ x: p.x, y: p.y, items: [l] });
  });
  clusters.forEach(c => {
    if (c.items.length === 1) { addPin(c.items[0]); return; }
    // Up to six close neighbours are spread in a small ring around their shared spot. Zooming in puts each on its exact place.
    if (c.items.length <= 6) {
      const n = c.items.length, r = Math.max(21, 20 / Math.sin(Math.PI / n));
      c.items.forEach((l, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; addPin(l, map.unproject([c.x + r * Math.cos(a), c.y + r * Math.sin(a)], z)); });
      return;
    }
    const samePlace = c.items.every(l => placeKey(l) === placeKey(c.items[0]));
    const name = samePlace ? placeName(c.items[0]) : '';
    const label = (name ? name + ': ' : '') + c.items.length + ' properties here. Tap to zoom in.';
    L.marker(map.unproject([c.x, c.y], z), { icon: L.divIcon({ className: 'pbub-wrap', html: '<span class="pbub"><b>' + c.items.length + '</b>' + esc(name || 'properties') + '</span>', iconSize: [0, 0] }), title: label, alt: label, zIndexOffset: 500 })
      .on('click', () => {
        const b = L.latLngBounds(c.items.map(l => [l.lat, l.lng]));
        if (b.getNorthEast().equals(b.getSouthWest())) map.setView(b.getCenter(), 18);
        else map.fitBounds(b, { padding: [70, 70], maxZoom: 18 });
      }).addTo(markLayer);
  });
}
map.on('zoomend', drawMap);

/* ---------- GPS: where the visitor is ---------- */
let me = null, meMark = null;
function kmFrom(l) {
  if (!me) return null;
  const R = 6371, d2r = Math.PI / 180, dLat = (l.lat - me.lat) * d2r, dLng = (l.lng - me.lng) * d2r;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(me.lat * d2r) * Math.cos(l.lat * d2r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}
const kmText = k => k == null ? '' : (k < 1 ? Math.round(k * 1000 / 10) * 10 + ' m from you' : (k < 10 ? Math.round(k * 10) / 10 : Math.round(k)) + ' km from you');
function locate(then, quiet) {
  if (!navigator.geolocation) { if (!quiet) toast('This device cannot share its location.'); return; }
  if (!quiet) toast('Finding where you are…');
  navigator.geolocation.getCurrentPosition(p => {
    me = { lat: p.coords.latitude, lng: p.coords.longitude };
    if (!meMark) meMark = L.marker([me.lat, me.lng], { icon: L.divIcon({ className: 'me-wrap', html: '<span class="me-dot"><i></i></span>', iconSize: [0, 0] }), interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(map);
    else meMark.setLatLng([me.lat, me.lng]);
    if (then) then();
    else if (inArea(me.lat, me.lng)) { map.setView([me.lat, me.lng], Math.max(map.getZoom(), 15)); toast('The blue dot is where you are.'); }
    else toast('You are outside ' + AREA_NAME + ', so the map stays here. Distances are still shown.');
    renderList();
  }, () => { if (!quiet) toast('Could not get your location. Allow location for this site in your browser settings.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}
const LocateCtl = L.Control.extend({
  options: { position: 'bottomright' },
  onAdd: function () {
    const b = L.DomUtil.create('button', 'locate-btn');
    b.type = 'button';
    b.setAttribute('aria-label', 'My location');
    b.title = 'My location';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    L.DomEvent.disableClickPropagation(b);
    L.DomEvent.on(b, 'click', () => locate());
    return b;
  }
});
map.addControl(new LocateCtl());

/* ---------- header, legend, footer ---------- */
function renderHeader() {
  const name = state.site.name || DEF_SITE.name;
  $('#siteName').textContent = name;
  $('#menuH').textContent = name;
  const how = postUrl(state.site.howto);
  $('#helpVideo').hidden = !how;
  if (how) { $('#helpVideo').href = how; $('#helpVideo').textContent = 'Watch the video' + (postSite(how) ? ' on ' + postSite(how) : ''); }
  setTitle();
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
function setTitle(l) {
  const name = state.site.name || DEF_SITE.name;
  document.title = l ? l.title + ', ' + priceText(l).replace(/ /g, ' ') + ' | ' + name : name + ': Kathmandu houses, land, flats and rooms';
}
function renderLegend() {}

/* ---------- saved properties (hearts) ----------
   Kept on the visitor's own phone or computer. Nothing is sent anywhere and no account is needed. */
let favs = new Set();
try { const v = JSON.parse(localStorage.getItem('gjm_saved') || '[]'); if (Array.isArray(v)) favs = new Set(v.filter(x => typeof x === 'string')); } catch (e) {}
function keepFavs() { try { localStorage.setItem('gjm_saved', JSON.stringify(Array.from(favs))); } catch (e) {} }
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.4-4.5-7.4-10.1A4.2 4.2 0 0 1 12 7.5a4.2 4.2 0 0 1 7.4 2.7c0 5.6-7.4 10.1-7.4 10.1Z"/></svg>';
const heartBtn = l => '<button class="heart" type="button" data-fav="' + esc(l.id) + '" aria-pressed="' + favs.has(l.id) + '" aria-label="' + (favs.has(l.id) ? 'Remove from saved' : 'Save this property') + '">' + HEART + '</button>';
const savedCount = () => shown().filter(l => favs.has(l.id)).length;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fav]'); if (!b) return;
  const id = b.dataset.fav; if (!/^[\w-]+$/.test(id)) return;
  const on = !favs.has(id);
  if (on) favs.add(id); else favs.delete(id);
  keepFavs();
  document.querySelectorAll('[data-fav="' + id + '"]').forEach(x => { x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-label', on ? 'Remove from saved' : 'Save this property'); });
  if (filter.saved) renderList(); else renderSaved();
  toast(on ? 'Saved on this phone. Find it under Saved.' : 'Removed from saved.');
});
function renderSaved() {
  const n = savedCount();
  $('#savedBtn').textContent = 'Saved' + (n ? ' (' + n + ')' : '');
  $('#savedBtn').setAttribute('aria-pressed', String(!!filter.saved));
  $('#menuSaved').textContent = n ? String(n) : '';
}

/* ---------- home: featured carousel and nearby row ---------- */
const compactPrice = l => !(l.price > 0) ? 'Price on request' : isRent(l) ? fmtNPR(l.price) + '/mo' : fmtNPR(l.price);
const shortName = l => autoTitle(kindOf(catOf(l.type)), l.sub, l.d, areaText(l), '');
const kmShort = l => { const k = kmFrom(l); return k == null ? '' : (k < 1 ? Math.round(k * 100) * 10 + ' m' : (k < 10 ? Math.round(k * 10) / 10 : Math.round(k)) + ' km'); };
const PLACE_ICO = '<svg class="pl" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 38.5S3.5 24.6 3.5 14.6a11.5 11.5 0 0 1 23 0c0 10-11.5 23.9-11.5 23.9Z" fill="currentColor"/><circle cx="15" cy="14.6" r="4.4" fill="var(--bg)"/></svg>';
function renderHome() {
  $('#topChips').innerHTML = '<button class="chip" type="button" data-type="all" aria-pressed="' + (filter.type === 'all') + '">All</button>' + state.cats.map(c =>
    '<button class="chip" type="button" data-type="' + esc(c.id) + '" aria-pressed="' + (filter.type === c.id) + '" style="--c:' + cvar(c) + '">' + kindIcon(kindOf(c)) + esc(catName(c)) + '</button>').join('');
  const pool = shown().filter(l => l.status === 'available' && (filter.type === 'all' || l.type === filter.type));
  // Featured: the listings the owner ticked. Until some are ticked, the newest ones with photos are shown as "Latest".
  let feat = pool.filter(l => l.featured);
  const picked = feat.length > 0;
  if (!picked) feat = pool.filter(l => l.photos.length).concat(pool.filter(l => !l.photos.length)).slice(0, 5);
  feat = feat.slice(0, 8);
  $('#featH').textContent = picked ? 'Featured' : 'Latest';
  $('#fcar').innerHTML = feat.length ? feat.map(l => {
    const c = catOf(l.type), ph = l.photos[0], km = kmShort(l);
    return '<div class="fcard" data-id="' + esc(l.id) + '"><button class="fmain" type="button" data-open aria-label="' + esc(headline(l) + ': ' + l.title + ', ' + priceText(l)) + '">' +
      (ph ? imgTag(ph, c) : '<span class="fnone" style="--c:' + cvar(c) + '">' + catIcon(c) + '</span>') +
      '<span class="fshade"></span>' + (l.featured ? '<span class="fbadge">Featured</span>' : '') +
      '<span class="ftext"><span class="fkind">' + esc(headline(l)) + '</span><span class="fsize">' + esc(shortName(l)) + '</span><span class="fprice">' + esc(compactPrice(l)) + '</span>' +
      '<span class="fmeta"><span>' + PLACE_ICO + esc(placeName(l) === 'Other' ? (l.district || '') : placeName(l)) + '</span>' + (km ? '<span>' + PLACE_ICO + km + ' away</span>' : '') + '</span></span></button>' + heartBtn(l) + '</div>';
  }).join('') : '<p class="fempty">' + (shown().length ? 'Nothing is available in this category right now.' : 'No properties are listed yet.') + '</p>';
  $('#fdots').innerHTML = feat.length > 1 ? feat.map((l, i) => '<i' + (i === 0 ? ' class="on"' : '') + '></i>').join('') : '';
  $('#fcar').scrollLeft = 0;
  $('#fprev').hidden = $('#fnext').hidden = feat.length < 2;
  // Nearby: closest first once the visitor's location is known, otherwise the newest.
  const near = (me ? pool.slice().sort((a, b) => kmFrom(a) - kmFrom(b)) : pool).slice(0, 12);
  $('#nearBox').hidden = near.length < 2;
  $('#nearH').textContent = me ? 'Nearby highlights' : 'More to see';
  $('#nrow').innerHTML = near.map(l => {
    const c = catOf(l.type), ph = l.photos[0], km = kmShort(l);
    return '<div class="ncard" data-id="' + esc(l.id) + '"><button class="nmain" type="button" data-open>' +
      '<span class="nimg" style="--c:' + cvar(c) + '">' + (ph ? imgTag(ph, c) : catIcon(c)) + '</span>' +
      '<span class="ntext"><b>' + esc(shortName(l)) + '</b><span class="nprice">' + esc(compactPrice(l)) + '</span><span class="nplace">' + esc(placeName(l) === 'Other' ? (l.district || '') : placeName(l)) + '</span>' +
      (km ? '<span class="nkm">' + PLACE_ICO + km + '</span>' : '') + '</span></button>' + heartBtn(l) + '</div>';
  }).join('');
}
$('#fcar').addEventListener('scroll', () => {
  const car = $('#fcar'), first = car.querySelector('.fcard'); if (!first) return;
  const i = Math.round(car.scrollLeft / (first.getBoundingClientRect().width + 12));
  $('#fdots').querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i));
}, { passive: true });
const slide = dir => { const car = $('#fcar'), first = car.querySelector('.fcard'); if (first) car.scrollBy({ left: dir * (first.getBoundingClientRect().width + 12), behavior: 'smooth' }); };
$('#fprev').addEventListener('click', () => slide(-1));
$('#fnext').addEventListener('click', () => slide(1));
const openFromRow = e => { const b = e.target.closest('[data-open]'); if (b) openDetail(b.parentNode.dataset.id); };
$('#fcar').addEventListener('click', openFromRow);
$('#nrow').addEventListener('click', openFromRow);
$('#topChips').addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (!b) return; filter.type = b.dataset.type; if (budget) runBudget(); else renderList(); });
function goTo(id) {
  const el = document.getElementById(id); if (!el) return;
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const y = el.getBoundingClientRect().top + window.scrollY - ($('.bar').getBoundingClientRect().height + 14);
  window.scrollTo({ top: y, behavior: calm ? 'auto' : 'smooth' });
}
$('#viewAll').addEventListener('click', () => goTo('allH'));

/* ---------- list ---------- */
function matches(l) {
  if (filter.type !== 'all' && l.type !== filter.type) return false;
  if (filter.deal !== 'all' && l.deal !== filter.deal) return false;
  if (filter.place && placeKey(l) !== filter.place) return false;
  if (filter.minP && !(l.price >= filter.minP)) return false;
  if (filter.maxP && !(l.price > 0 && l.price <= filter.maxP)) return false;
  if (filter.minSize && !(sizeSqft(l) >= filter.minSize * 0.999)) return false;
  if (filter.beds && !(bedsOf(l) >= filter.beds)) return false;
  if (filter.road && !(l.d.road_width >= filter.road)) return false;
  if (filter.saved && !favs.has(l.id)) return false;
  if (budgetIds && !budgetIds.has(l.id)) return false;
  return true;
}
const moreCount = () => [filter.minP, filter.maxP, filter.minSize, filter.beds, filter.road].filter(Boolean).length;
function statusTag(l) {
  if (l.status === 'available') return '';
  return '<span class="tagx sold">' + (l.status === 'unavailable' ? 'Unavailable, hidden from visitors' : STATUS_WORD[l.status]) + '</span>';
}
function badges(l) {
  return '<span class="badge" style="--c:' + cvar(catOf(l.type)) + '">' + esc(headline(l)) + '</span>' + statusTag(l);
}
function renderList() {
  const all = shown();
  const counts = { all: all.length }, deals = { all: all.length, sale: 0, rent: 0 };
  all.forEach(l => { counts[l.type] = (counts[l.type] || 0) + 1; deals[l.deal]++; });
  if (filter.type !== 'all' && !state.cats.some(c => c.id === filter.type)) filter.type = 'all';
  $('#dealChips').innerHTML = [['all', 'All'], ['sale', 'For sale'], ['rent', 'For rent']].map(([k, label]) =>
    '<button class="chip" type="button" data-deal="' + k + '" aria-pressed="' + (filter.deal === k) + '">' + label + '<b>' + deals[k] + '</b></button>').join('');
  $('#typeChips').innerHTML = [['all', 'All types']].concat(state.cats.map(c => [c.id, catName(c)])).map(([k, label]) =>
    '<button class="chip" type="button" data-type="' + esc(k) + '" aria-pressed="' + (filter.type === k) + '">' + esc(label) + '<b>' + (counts[k] || 0) + '</b></button>').join('');
  $('#budgetType').innerHTML = '<option value="all">Anything</option>' + state.cats.map(c => '<option value="' + esc(c.id) + '">' + esc(catName(c)) + '</option>').join('');
  $('#budgetType').value = filter.type;
  $('#budgetQuick').hidden = budgetDeal() === 'rent';

  const places = new Map();
  all.forEach(l => { if (!places.has(placeKey(l))) places.set(placeKey(l), placeName(l)); });
  if (filter.place && !places.has(filter.place)) filter.place = '';
  const sel = $('#placeSel');
  sel.innerHTML = '<option value="">All places</option>' + Array.from(places.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(e => '<option value="' + esc(e[0]) + '">' + esc(e[1]) + '</option>').join('');
  sel.value = filter.place;
  $('#sortSel').value = filter.sort;
  const mc = moreCount();
  $('#moreBtn').textContent = 'More filters' + (mc ? ' (' + mc + ')' : '');

  let arr = all.filter(matches);
  if (filter.sort === 'low') arr = arr.slice().sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
  else if (filter.sort === 'high') arr = arr.slice().sort((a, b) => (b.price || 0) - (a.price || 0));
  else if (filter.sort === 'near' && me) arr = arr.slice().sort((a, b) => kmFrom(a) - kmFrom(b));

  const bits = [];
  if (filter.deal !== 'all') bits.push(filter.deal === 'rent' ? 'for rent' : 'for sale');
  if (filter.place) bits.push('in ' + places.get(filter.place));
  if (filter.saved) bits.push('saved by you');
  if (budget) bits.push('within or near ' + fmtNPR(budget.value));
  if (mc) bits.push(mc === 1 ? '1 more filter' : mc + ' more filters');
  $('#countLine').textContent = arr.length + (arr.length === 1 ? ' property ' : ' properties ') + bits.join(', ');

  const ul = $('#cards');
  if (!arr.length) {
    ul.innerHTML = '<li class="empty"><span>' + (all.length ? (filter.saved && !savedCount() ? 'Nothing saved yet. Tap the heart on a property to keep it here.' : 'Nothing matches these filters yet.') : 'No properties are listed yet, so the map has no pins.' + (owner ? ' Press “+ Add property” in the bar at the bottom to add the first one. Its pin appears on the map as soon as you save.' : ' The owner adds them after pressing “Owner sign in” at the top.')) + '</span>' +
      (all.length ? '<button class="btn small" type="button" data-clear>Show all properties</button>' : '') + '</li>';
  } else {
    ul.innerHTML = arr.map(l => {
      const ph = (l.photos || []).find(okUrl);
      const c = catOf(l.type);
      const facts = cardFacts(l).concat(kmText(kmFrom(l)) || []);
      return '<li class="card' + (l.id === selectedId ? ' sel' : '') + '" data-id="' + esc(l.id) + '">' +
        '<button class="card-main" type="button" data-open>' +
        '<span class="thumb" style="--c:' + cvar(c) + '">' + (ph ? imgTag(ph, c) : catIcon(c)) +
        (l.photos.length > 1 ? '<span class="pcount">' + l.photos.length + ' photos</span>' : '') + '</span>' +
        '<span class="card-body"><span class="card-top">' + badges(l) + '</span>' +
        '<span class="card-title">' + esc(l.title) + '</span>' +
        '<span class="card-price">' + esc(priceText(l)) + '</span>' +
        (facts.length ? '<span class="cfacts">' + facts.map(f => '<span>' + esc(f) + '</span>').join('') + '</span>' : '') +
        (placeLine(l) ? '<span class="card-place">' + esc(placeLine(l)) + '</span>' : '') + '</span></button>' + heartBtn(l) +
        '<div class="card-foot"><button class="btn small" type="button" data-details>View details</button>' +
        '<button class="btn small primary" type="button" data-talk>Contact</button>' +
        (owner ? '<button class="btn small" type="button" data-edit>Edit</button>' : '') + '</div></li>';
    }).join('');
  }
  mapItems = all.filter(matches);
  drawMap();
  renderPlaces();
  renderHome();
  renderSaved();
}
function placeGroups() {
  const m = new Map();
  shown().forEach(l => {
    const k = placeKey(l);
    if (!m.has(k)) m.set(k, { key: k, name: placeName(l), n: 0, pts: [], rates: {} });
    const g = m.get(k);
    if (l.status === 'available') g.n++;
    g.pts.push({ lat: l.lat, lng: l.lng });
    if (l.status === 'available') {
      const r = rateOf(l);
      if (r) { const a = g.rates[r.u] || (g.rates[r.u] = { p: 0, n: 0, k: 0 }); a.p += l.price; a.n += l.price / r.v; a.k++; }
    }
  });
  const out = Array.from(m.values());
  out.forEach(p => {
    const u = Object.keys(p.rates).sort((a, b) => p.rates[b].k - p.rates[a].k)[0];
    p.landRate = u ? { v: p.rates[u].p / p.rates[u].n, u: u, label: UNITS[u][0] } : null;
  });
  return out.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
function renderPlaces() {
  const places = placeGroups();
  $('#placesBox').hidden = !places.length;
  $('#placesList').innerHTML = '<div class="pgroup">' + places.map(p => '<button class="prow" type="button" data-place="' + esc(p.key) + '" aria-pressed="' + (filter.place === p.key) + '"><span class="pn">' + esc(p.name) + '</span><span class="pm">' + p.n + ' available</span>' +
    (p.landRate ? '<span class="pr">Land about ' + esc(fmtNPR(p.landRate.v)) + ' per ' + p.landRate.label + '</span>' : '') + '</button>').join('') + '</div>';
}
const rerun = () => { if (budget) runBudget(); else renderList(); };
function pickPlace(k) {
  filter.place = k;
  rerun();
  if (k) fitPoints(shown().filter(l => placeKey(l) === k)); else map.fitBounds(AREA);
}
$('#placesList').addEventListener('click', e => { const b = e.target.closest('[data-place]'); if (b) pickPlace(filter.place === b.dataset.place ? '' : b.dataset.place); });
$('#placeSel').addEventListener('change', e => pickPlace(e.target.value));
$('#typeChips').addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (!b) return; filter.type = b.dataset.type; rerun(); });
$('#dealChips').addEventListener('click', e => { const b = e.target.closest('[data-deal]'); if (!b) return; filter.deal = b.dataset.deal; rerun(); });
$('#sortSel').addEventListener('change', e => {
  filter.sort = e.target.value;
  if (filter.sort === 'near' && !me) locate(() => {}); else renderList();
});
$('#savedBtn').addEventListener('click', () => { filter.saved = !filter.saved; rerun(); });
$('#moreBtn').addEventListener('click', () => {
  const box = $('#moreBox');
  box.hidden = !box.hidden;
  $('#moreBtn').setAttribute('aria-expanded', String(!box.hidden));
});
function readMore() {
  const err = $('#fl_err');
  err.hidden = true;
  const money = id => { const v = $(id).value.trim(); if (!v) return 0; const p = parseMoney(v, filter.deal === 'rent'); if (!p) { err.textContent = 'Type the price as a number, for example 50 lakh, 1.2 crore or 25000.'; err.hidden = false; return 0; } return p.value; };
  filter.minP = money('#fl_min'); filter.maxP = money('#fl_max');
  const sz = parseFloat($('#fl_size').value);
  filter.minSize = sz > 0 ? sz * UNITS[$('#fl_sizeUnit').value][1] : 0;
  filter.beds = +$('#fl_beds').value || 0;
  filter.road = +$('#fl_road').value || 0;
  rerun();
}
['#fl_min', '#fl_max', '#fl_size', '#fl_sizeUnit', '#fl_beds', '#fl_road'].forEach(s => $(s).addEventListener('change', readMore));
function clearMore() {
  ['#fl_min', '#fl_max', '#fl_size'].forEach(s => { $(s).value = ''; });
  $('#fl_beds').value = '0'; $('#fl_road').value = '0'; $('#fl_err').hidden = true;
  filter.minP = filter.maxP = filter.minSize = filter.beds = filter.road = 0;
}
$('#fl_clear').addEventListener('click', () => { clearMore(); rerun(); });
$('#cards').addEventListener('click', e => {
  if (e.target.closest('[data-clear]')) { filter.type = 'all'; filter.deal = 'all'; filter.place = ''; filter.saved = false; clearMore(); clearBudget(); map.fitBounds(AREA); return; }
  const li = e.target.closest('.card'); if (!li) return;
  const id = li.dataset.id;
  if (e.target.closest('[data-details]')) openDetail(id);
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
// Is the visitor buying or renting? Taken from the Sale / Rent filter, or from a category that only does one.
function budgetDeal() {
  if (filter.deal !== 'all') return filter.deal;
  if (filter.type === 'all') return 'sale';
  const ds = KINDS[kindOf(catOf(filter.type))].deals;
  return ds.length === 1 ? ds[0] : '';
}
function explainBudget(b) {
  const cat = filter.type === 'all' ? null : catOf(filter.type);
  const rent = b.deal === 'rent';
  const money = n => fmtNPR(n) + (rent ? ' a month' : '');
  const pool = shown().filter(l => l.status === 'available' && l.price > 0 && l.deal === b.deal && (!cat || l.type === cat.id) && (!filter.place || placeKey(l) === filter.place));
  const word = (cat ? catName(cat).toLowerCase() + ' listings' : 'properties') + (rent ? ' for rent' : ' for sale');
  const plc = filter.place ? shown().find(l => placeKey(l) === filter.place) : null;
  const where = plc ? ' in ' + placeName(plc) : '';
  const fits = pool.filter(l => l.price <= b.value).sort((a, c) => c.price - a.price);
  const near = pool.filter(l => l.price > b.value && l.price <= b.value * 1.15).sort((a, c) => a.price - c.price);
  const lines = [];
  const pu = l => { const t = rateText(l); return t ? ' (' + t + ')' : ''; };
  if (!pool.length) {
    lines.push('There are no ' + word + where + ' with a price listed here right now.');
    lines.push('Contact me and I will tell you what is coming up.');
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
  if (!rent && (!cat || kindOf(cat) === 'land')) {
    placeGroups().filter(p => p.landRate && (!filter.place || p.key === filter.place)).slice(0, 3).forEach(p => {
      lines.push('In ' + p.name + ', land is about ' + fmtNPR(p.landRate.v) + ' per ' + p.landRate.label + '. Your budget buys about ' + trimNum(Math.round(b.value / p.landRate.v * 10) / 10) + ' ' + p.landRate.label + ' there.');
    });
  }
  if (b.assumed) lines.push('You typed a small number, so it was read as ' + money(b.value) + '.');
  lines.push(rent ? 'Ask me about the deposit and what the rent includes.' : 'These are asking prices. Contact me before you decide.');
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
  filter.type = $('#budgetType').value;
  const fixed = budgetDeal();
  const guess = fixed || KINDS[kindOf(catOf(filter.type))].deals[0];
  const b = parseMoney(text, guess === 'rent');
  const out = $('#budgetText');
  if (!b) {
    budget = null; budgetIds = null;
    out.textContent = '';
    const p = document.createElement('p'); p.className = 'err';
    p.textContent = 'Type your budget as a number, for example 50 lakh, 1.2 crore or 25000 a month.';
    out.appendChild(p);
    $('#budgetOut').hidden = false; $('#aiBox').hidden = true;
    renderList();
    return;
  }
  // A category that can be bought or rented: a small amount means rent, a large one means buying.
  b.deal = fixed || (b.value < 5e5 ? 'rent' : 'sale');
  budget = b;
  runBudget();
}
$('#budgetForm').addEventListener('submit', e => { e.preventDefault(); submitBudget($('#budgetInput').value); });
$('#budgetQuick').addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (!b) return; $('#budgetInput').value = b.dataset.b; submitBudget(b.dataset.b); });
$('#budgetType').addEventListener('change', e => { filter.type = e.target.value; if (budget) submitBudget($('#budgetInput').value); else renderList(); });
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
  const rent = budget.deal === 'rent';
  const rows = shown().filter(l => l.status === 'available').slice(0, 60).map(l => ({
    title: l.title, category: headline(l), deal: isRent(l) ? 'rent per month' : 'sale', price_npr: l.price || null,
    price_per_land_unit: rateText(l), size: [areaText(l), areaSqft(l)].filter(Boolean).join(' = '), place: l.place || '', district: l.district || '',
    notes: cardFacts(l).concat(String(l.desc || '').slice(0, 200)).filter(Boolean).join('. ')
  }));
  aiCtl = new AbortController();
  const ctl = aiCtl;
  btn.disabled = true; stop.hidden = false; out.hidden = false; out.textContent = 'Thinking…'; $('#aiNote').hidden = true;
  try {
    const r = await fetch('/api/explain', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ budget: budget.value, perMonth: rent, looking: (filter.type === 'all' ? 'anything' : catName(catOf(filter.type))) + (rent ? ' to rent' : ' to buy'), district: DISTRICT, want: $('#aiWant').value.trim().slice(0, 300), listings: rows })
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
// Each property has its own address, /property/<id>, so it can be shared.
function setUrl(id) { try { history.replaceState(null, '', id ? BASE + 'property/' + id : BASE); } catch (e) {} }
let detailMap = null;
function dropDetailMap() { if (detailMap) { try { detailMap.remove(); } catch (e) {} detailMap = null; } }
function statusOptions(l) {
  return ['available', isRent(l) ? 'rented' : 'sold', 'unavailable'].map(s => '<option value="' + s + '"' + (l.status === s ? ' selected' : '') + '>' + STATUS_WORD[s] + (s === 'unavailable' ? ' (hidden)' : '') + '</option>').join('');
}
// Every fact that was filled in, in the order of the form. Empty ones are left out.
function detailFacts(l) {
  const K = K_of(l), d = l.d, out = [];
  const landUnit = l.area.u !== 'sqft' && l.area.u !== 'sqm';
  if (K.sub && l.sub) out.push([K.sub[0], l.sub]);
  if (areaText(l)) out.push([K.size, areaText(l) + (landUnit && areaSqft(l) ? ' (' + areaSqft(l) + ')' : '')]);
  if (builtText(l)) out.push(['Built-up area', builtText(l)]);
  if (rateOf(l)) out.push(l.rateMode ? ['Total price', fmtNPR(l.price)] : ['Price per ' + rateOf(l).label, fmtNPR(rateOf(l).v)]);
  if (isRent(l) && l.deposit > 0) out.push(['Deposit', fmtNPR(l.deposit)]);
  fieldsOf(K, isRent(l)).forEach(k => {
    const f = FIELDS[k], v = d[k];
    if (v == null || f.t === 'bool') return;
    let t = String(v);
    if (f.unit) t = trimNum(v) + ' ' + f.unit;
    else if (k === 'floor') t = floorText(v);
    else if (k === 'floors') t = trimNum(v);
    else if (k === 'road_sides') t = v + (v === 1 ? ' side' : ' sides');
    else if (k === 'parking') t = parkText(v) || t;
    out.push([labelOf(k, K), t]);
  });
  if (l.place) out.push(['Place', l.place]);
  if (l.district) out.push(['District', l.district]);
  if (me) out.push(['Distance', kmText(kmFrom(l))]);
  out.push(['Status', STATUS_WORD[l.status]]);
  return out;
}
const featuresOf = l => fieldsOf(K_of(l), isRent(l)).filter(k => FIELDS[k].t === 'bool' && l.d[k] === true).map(k => FIELDS[k].label);
function openDetail(id) {
  const l = byId(id); if (!l) return;
  selectedId = id;
  renderList();
  dropDetailMap();
  const photos = (l.photos || []).filter(okUrl);
  const cat = catOf(l.type);
  const sub = [priceSub(l), !isRent(l) && l.price >= 1e5 && !l.rateMode ? 'Rs. ' + groupIN(l.price) : '', isRent(l) && l.deposit > 0 ? 'Deposit ' + fmtNPR(l.deposit) : ''].filter(Boolean).join(' · ');
  const feats = featuresOf(l);
  let h = '<div class="dlg-head"><div><div class="card-top">' + badges(l) + '</div><h2>' + esc(l.title) + '</h2></div>' +
    '<button class="x" type="button" data-close aria-label="Close">&times;</button></div>';
  h += '<div class="gal"><div class="gal-main' + (photos.length ? '' : ' empty') + '" style="--c:' + cvar(cat) + '" id="galMain">' + (photos.length ? imgTag(photos[0], cat, 'Photo 1 of ' + l.title) : catIcon(cat)) + '</div>';
  h += heartBtn(l);
  if (photos.length > 1) h += '<div class="gal-thumbs">' + photos.map((p, i) => '<button type="button" data-ph="' + i + '" aria-pressed="' + (i === 0) + '" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(p) + '" alt="" loading="lazy"></button>').join('') + '</div>';
  h += '</div>';
  if (l.social) h += '<a class="btn postbtn" href="' + esc(l.social) + '" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>View video / post' + (postSite(l.social) ? ' on ' + postSite(l.social) : '') + '</a>';
  h += '<div><div class="price-big">' + esc(priceText(l)) + '</div>' + (sub ? '<p class="hint mono">' + esc(sub) + '</p>' : '') +
    (placeLine(l) ? '<p class="where">' + esc(placeLine(l)) + '</p>' : '') + '</div>';
  h += '<div class="row detail-actions"><button class="btn primary" type="button" data-talk>Contact</button>' +
    '<a class="btn" href="https://www.google.com/maps/dir/?api=1&amp;destination=' + (+l.lat).toFixed(6) + ',' + (+l.lng).toFixed(6) + '" target="_blank" rel="noopener noreferrer">Get directions</a>' +
    '<button class="btn" type="button" data-share>Share link</button>' +
    (!owner && (googleOn || customer) ? '<button class="btn wide' + (myInterest.has(l.id) ? ' done' : '') + '" type="button" data-interest>' + (myInterest.has(l.id) ? 'Interest sent to the owner' : 'I am interested') + '</button>' : '') + '</div>';
  h += '<dl class="facts">' + detailFacts(l).map(f => '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>').join('') + '</dl>';
  if (feats.length) h += '<div class="feats"><span class="feats-h">It has</span><span class="cfacts">' + feats.map(f => '<span>' + esc(f) + '</span>').join('') + '</span></div>';
  if (l.desc) h += '<p class="desc">' + esc(l.desc) + '</p>';
  h += '<div class="field"><span>Where it is</span><div id="detailMap" class="mapbox dmap"></div></div>' +
    '<div class="row"><button class="btn small" type="button" data-showmap>Show on the big map</button></div>';
  if (owner) h += '<div class="row owner-row"><button class="btn small" type="button" data-edit>Edit</button>' +
    '<label class="inline"><span class="sr">Status</span><select data-status>' + statusOptions(l) + '</select></label>' +
    '<button class="btn small danger" type="button" data-del>Delete</button></div>' +
    '<p class="err" role="alert" data-err hidden></p>';
  const box = $('#detailBody');
  box.innerHTML = h;
  box.dataset.id = id;
  box._photos = photos;
  setUrl(id);
  setTitle(l);
  show(dlgDetail);
  dlgDetail.scrollTop = 0;
  try {
    detailMap = L.map('detailMap', { zoomControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile, minZoom: 11, maxBounds: L.latLngBounds(AREA).pad(0.12) });
    detailMap.attributionControl.setPrefix(false);
    baseLayer().addTo(detailMap);
    detailMap.setView([l.lat, l.lng], 16);
    L.marker([l.lat, l.lng], { icon: pinIcon(l, 'sel'), interactive: false, keyboard: false }).addTo(detailMap);
    const dm = detailMap;
    setTimeout(() => { if (detailMap === dm) dm.invalidateSize(); }, 80);
  } catch (e) { console.error(e); }
}
dlgDetail.addEventListener('close', () => { dropDetailMap(); setUrl(''); setTitle(); });
async function setStatus(id, next, errEl) {
  const l = byId(id);
  if (!l || STATUSES.indexOf(next) < 0 || l.status === next) return false;
  return mutate(errEl, async () => {
    const r = await sb.from('listings').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id).select('id');
    if (r.error) throw r.error;
    if (Array.isArray(r.data) && !r.data.length) throw { code: '42501', message: 'not allowed' };
    l.status = next;
  }, next === 'unavailable' ? 'Hidden from visitors. It is still in Manage listings.' : 'Marked as ' + STATUS_WORD[next].toLowerCase() + '.');
}
$('#detailBody').addEventListener('click', e => {
  const box = $('#detailBody'), id = box.dataset.id, l = byId(id);
  const t = e.target;
  const ph = t.closest('[data-ph]');
  if (ph) {
    const i = +ph.dataset.ph, p = box._photos[i];
    if (p) { $('#galMain').innerHTML = '<img src="' + esc(p) + '" alt="Photo ' + (i + 1) + '">'; box.querySelectorAll('[data-ph]').forEach(b => b.setAttribute('aria-pressed', String(b === ph))); }
    return;
  }
  if (!l) return;
  if (t.closest('[data-talk]')) openContact(id);
  else if (t.closest('[data-share]')) shareLink(l, t.closest('[data-share]'));
  else if (t.closest('[data-interest]')) openInterest(id);
  else if (t.closest('[data-showmap]')) { dlgDetail.close(); if (dlgManage.open) dlgManage.close(); showOnMap(id); }
  else if (t.closest('[data-edit]')) { dlgDetail.close(); openEdit(id); }
  else if (t.closest('[data-del]')) askDelete(id);
});
$('#detailBody').addEventListener('change', async e => {
  const s = e.target.closest('[data-status]'); if (!s) return;
  const box = $('#detailBody'), id = box.dataset.id;
  const ok = await setStatus(id, s.value, box.querySelector('[data-err]'));
  if (ok && dlgDetail.open && byId(id)) openDetail(id); else if (!ok && byId(id)) s.value = byId(id).status;
});

/* ---------- contact ---------- */
function copyText(text, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1600); } };
  try { navigator.clipboard.writeText(text).then(done, () => toast('Press and hold the text to copy it.')); }
  catch (e) { toast('Press and hold the text to copy it.'); }
}
function shareLink(l, btn) {
  const url = listingUrl(l.id);
  if (navigator.share) { navigator.share({ title: l.title, text: l.title + ', ' + priceText(l).replace(/ /g, ' '), url: url }).catch(() => {}); return; }
  copyText(url, btn);
}
function openContact(id) {
  const l = id ? byId(id) : null, s = state.site;
  const msg = l ? 'Hello, I saw "' + l.title + '" (' + priceText(l).replace(/ /g, ' ') + ') on ' + (s.name || DEF_SITE.name) + '. Is it still available? Please send me the details. ' + listingUrl(l.id)
    : 'Hello, I am looking at ' + (s.name || DEF_SITE.name) + ' and would like to know more.';
  $('#contactH').textContent = s.owner ? 'Contact ' + s.owner : 'Contact';
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
    h += '<p class="hint">Full details, papers and site visits are arranged directly with the owner.</p>';
    if (s.phone) h += '<div class="field"><span>Call or text</span><div class="row"><span class="phone" id="phoneText">' + esc(s.phone) + '</span>' +
      (tel.length >= 7 ? '<a class="btn small primary" href="tel:' + esc(tel) + '">Call</a>' : '') + '<button class="btn small" type="button" data-copy="phone">Copy number</button></div></div>';
    if (links.length) h += '<div class="row">' + links.map(a => '<a class="btn' + (a[2] ? ' primary' : '') + '" href="' + esc(a[0]) + '" target="_blank" rel="noopener noreferrer">' + a[1] + '</a>').join('') + '</div>';
    h += '<label class="field" for="msgText"><span>Message you can send</span><textarea id="msgText" class="msgbox" rows="3" readonly></textarea></label>' +
      '<div class="row"><button class="btn small" type="button" data-copy="msg">Copy message</button></div>';
  }
  $('#contactBody').innerHTML = h;
  const ta = $('#msgText'); if (ta) ta.value = msg;
  show(dlgContact);
}
$('#contactBody').addEventListener('click', e => {
  const c = e.target.closest('[data-copy]');
  if (c) { copyText(c.dataset.copy === 'phone' ? state.site.phone : $('#msgText').value, c); return; }
  if (e.target.closest('[data-site]')) { dlgContact.close(); openSite(); }
});
const dlgMenu = $('#dlgMenu'), dlgHelp = $('#dlgHelp');
$('#talkBtn').addEventListener('click', () => { dlgMenu.close(); openContact(null); });
$('#barContact').addEventListener('click', () => openContact(null));
$('#menuBtn').addEventListener('click', () => show(dlgMenu));
$('#askBtn').addEventListener('click', () => openChat());
dlgMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-go]'); if (!b) return;
  const go = b.dataset.go;
  dlgMenu.close();
  if (go === 'help') show(dlgHelp);
  else if (go === 'chat') openChat();
  else if (go === 'saved') { filter.saved = true; rerun(); goTo('allH'); }
  else goTo(go);
});

/* ---------- saving to the database ---------- */
function setBusy(on) {
  busy = on;
  ['#f_save', '#s_save', '#c_save', '#l_save', '#addBtn', '#siteBtn', '#catBtn', '#manageBtn', '#m_add', '#confirmYes'].forEach(s => { const b = $(s); if (b) b.disabled = on; });
  $('#f_save').textContent = on ? 'Saving…' : ($('#f_save').dataset.label || 'Save property');
  $('#s_save').textContent = on ? 'Saving…' : 'Save details';
}
const DB_OLD = 'The database needs its update first. In Supabase open SQL Editor, run database-update.sql, then try again.';
function errText(e) {
  const m = String(e && (e.message || e.error_description || e.error) || ''), code = e && e.code;
  if (code === 'PGRST204' || code === '42703' || code === '23514' || code === '23503' || /schema cache|column .* does not exist|violates check constraint|foreign key/i.test(m)) return DB_OLD;
  if ((e && (code === '42501' || e.status === 401 || e.status === 403 || e.statusCode === '403')) || /row-level security|permission denied|not authorized|not allowed|jwt/i.test(m)) return 'This account is not allowed to change listings. Sign in again as the owner.';
  if (/payload too large|exceeded the maximum|too large|mime type/i.test(m)) return 'A photo could not be uploaded. Remove it and try another one.';
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
// Deletes photo files from storage. Only ever called with photos that no saved listing uses any more.
function removePhotos(urls) {
  const paths = (urls || []).map(photoPath).filter(Boolean);
  if (paths.length) sb.storage.from('photos').remove(paths).then(() => {}, () => {});
}

/* ---------- delete a listing ---------- */
let delId = null;
function askDelete(id) {
  const l = byId(id); if (!l || !owner) return;
  delId = id;
  $('#confirmTitle').textContent = l.title;
  $('#confirmErr').hidden = true;
  show(dlgConfirm);
  $('#confirmNo').focus();
}
$('#confirmNo').addEventListener('click', () => dlgConfirm.close());
$('#confirmYes').addEventListener('click', async () => {
  const id = delId, l = byId(id);
  if (!l) { dlgConfirm.close(); return; }
  // The database decides whether this account may delete (see the rules in supabase/schema.sql).
  const ok = await mutate($('#confirmErr'), async () => {
    const r = await sb.from('listings').delete().eq('id', id).select('id');
    if (r.error) throw r.error;
    if (Array.isArray(r.data) && !r.data.length) throw { code: '42501', message: 'not allowed' };
    removePhotos(l.photos);
    state.listings = state.listings.filter(x => x.id !== id);
    if (selectedId === id) selectedId = null;
  }, 'Listing deleted.');
  if (ok) { dlgConfirm.close(); if (dlgDetail.open && $('#detailBody').dataset.id === id) dlgDetail.close(); }
});

/* ---------- owner sign in ---------- */
function setOwner(on) {
  owner = !!on;
  $('#ownerBar').hidden = !owner;
  document.body.classList.toggle('has-owner', owner);
  renderAccount();
  renderList();
}
// The account lines in the side menu: who is signed in, Continue with Google, Sign out.
function renderAccount() {
  const inNow = owner || !!customer;
  const t = $('#acctText');
  t.textContent = owner ? 'Signed in as the owner.' : customer ? 'Signed in as ' + customer.name + ' (' + customer.email + ').' : '';
  t.hidden = !inNow;
  $('#googleBtn').hidden = inNow || !googleOn;
  $('#profileBtn').hidden = !customer;
  $('#signOutBtn').hidden = !inNow;
  // With Google switched on, the owner signs in with Google like everyone else and is recognised by email.
  // The password sign-in stays reachable at the address /#owner in case Google is ever unavailable.
  $('#loginBtn').hidden = $('#loginLink').hidden = inNow || googleOn;
  $('#leadsBtn').textContent = 'Customers' + (leads.length ? ' (' + leads.length + ')' : '');
}
async function checkOwner() {
  try {
    const s = await sb.auth.getSession();
    const u = s.data && s.data.session && s.data.session.user;
    if (!u) { customer = null; setOwner(false); return 'out'; }
    const r = await sb.rpc('is_admin');
    if (r.error) throw r.error;
    if (r.data === true) {
      customer = null;
      // The owner also gets the listings hidden from visitors, and a warning if the database is not updated yet.
      try { await loadAll(); } catch (e) {}
      Promise.all([sb.from('listings').select('deal_type,details,featured').limit(1), loadLeads(), loadPeople()]).then(p => { $('#dbNote').hidden = !(p[0].error || p[1] || p[2]); }, () => {});
    } else {
      const m = u.user_metadata || {};
      customer = { id: u.id, email: String(u.email || ''), name: String(m.full_name || m.name || String(u.email || '').split('@')[0] || 'Customer').slice(0, 120), phone: '' };
      // Keep the customer's profile up to date (the phone number they added earlier is left as it is), then read it back.
      sb.from('profiles').upsert({ user_id: u.id, email: customer.email, name: customer.name, last_seen: new Date().toISOString() }, { onConflict: 'user_id' }).select('phone')
        .then(q => { if (!q.error && q.data && q.data[0] && customer) customer.phone = String(q.data[0].phone || ''); }, () => {});
      sb.from('interests').select('listing_id').eq('user_id', u.id).then(q => {
        if (!q.error && Array.isArray(q.data)) { myInterest = new Set(q.data.map(x => x.listing_id).filter(Boolean)); if (dlgDetail.open && byId($('#detailBody').dataset.id)) openDetail($('#detailBody').dataset.id); }
      }, () => {});
    }
    setOwner(r.data === true);
    return r.data === true ? 'owner' : 'not_owner';
  } catch (e) { setOwner(false); return 'error'; }
}

/* ---------- customers: Continue with Google, "I am interested" ---------- */
// Google sign-in has to be switched on in Supabase first (see SETUP.md). The site asks Supabase whether it is.
if (CFG.GOOGLE_LOGIN == null) {
  fetch(String(CFG.SUPABASE_URL).replace(/\/$/, '') + '/auth/v1/settings', { headers: { apikey: CFG.SUPABASE_ANON_KEY } })
    .then(r => r.ok ? r.json() : null).then(j => { googleOn = !!(j && j.external && j.external.google); renderAccount(); }).catch(() => {});
}
async function googleSignIn(backTo) {
  try {
    const r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: backTo || location.origin + BASE } });
    if (r.error) throw r.error;
  } catch (e) { console.error(e); toast('Google sign-in could not start. Try again in a moment.'); }
}
// The Google icon on the buttons is shown only when the file img/google.svg exists (see SETUP.md).
document.querySelectorAll('img.gico').forEach(i => { i.addEventListener('load', () => { i.hidden = false; }); i.src = BASE + 'img/google.svg'; });
$('#googleBtn').addEventListener('click', () => googleSignIn());
let intId = null;
function openInterest(id) {
  const l = byId(id); if (!l || owner) return;
  intId = id;
  $('#intAbout').innerHTML = '<span class="hint">Property</span><strong>' + esc(l.title) + '</strong><span>' + esc(priceText(l)) + '</span>';
  $('#intOut').hidden = !!customer;
  $('#intIn').hidden = !customer;
  if (customer) {
    $('#intWho').textContent = 'Sending as ' + customer.name + ' (' + customer.email + '). The owner will reply to you directly.';
    $('#i_err').hidden = true;
    if (!$('#i_phone').value) $('#i_phone').value = customer.phone || '';
    $('#i_save').textContent = myInterest.has(id) ? 'Send again' : 'Send to the owner';
  }
  show(dlgInterest);
}
// After Google, the customer comes back to the same property with the form open.
$('#intGoogle').addEventListener('click', () => googleSignIn(listingUrl(intId) + '?interested=1'));
$('#intForm').addEventListener('submit', async e => {
  e.preventDefault();
  const l = byId(intId), err = $('#i_err'), btn = $('#i_save');
  if (!l || !customer || btn.disabled) return;
  err.hidden = true; btn.disabled = true;
  try {
    const r = await sb.from('interests').upsert({
      listing_id: l.id, listing_title: l.title.slice(0, 120), user_id: customer.id, email: customer.email, name: customer.name,
      phone: $('#i_phone').value.trim().slice(0, 30), message: $('#i_msg').value.trim().slice(0, 500)
    }, { onConflict: 'user_id,listing_id' }).select('id');
    if (r.error) throw r.error;
    const ph = $('#i_phone').value.trim().slice(0, 30);
    if (ph && ph !== customer.phone) { customer.phone = ph; sb.from('profiles').update({ phone: ph }).eq('user_id', customer.id).then(() => {}, () => {}); }
    myInterest.add(l.id);
    dlgInterest.close();
    if (dlgDetail.open && $('#detailBody').dataset.id === l.id) openDetail(l.id);
    toast('Sent. The owner will contact you.');
  } catch (e2) {
    console.error(e2);
    err.textContent = /failed to fetch|network/i.test(String(e2 && e2.message)) ? 'No connection. Check the internet and try again.' : 'Could not send it just now. Press Contact to reach the owner instead.';
    err.hidden = false;
  } finally { btn.disabled = false; }
});

/* ---------- owner: interested customers ---------- */
// Returns true when the table is missing, which means the database update has not been run yet.
async function loadLeads() {
  const r = await sb.from('interests').select('*').order('created_at', { ascending: false });
  if (r.error) { leads = []; renderAccount(); return true; }
  leads = Array.isArray(r.data) ? r.data : [];
  renderAccount();
  return false;
}
// Signed-in customers and the visit count. Returns true when the tables are missing (database update not run yet).
async function loadPeople() {
  const r = await Promise.all([sb.from('profiles').select('*').order('last_seen', { ascending: false }), sb.from('visits').select('*')]);
  people = !r[0].error && Array.isArray(r[0].data) ? r[0].data : [];
  visits = { today: 0, week: 0, total: 0, ok: !r[1].error };
  if (!r[1].error && Array.isArray(r[1].data)) {
    const today = dayKey(new Date()), weekAgo = dayKey(new Date(Date.now() - 6 * 864e5));
    r[1].data.forEach(v => { const n = Number(v.count) || 0, d = String(v.day); visits.total += n; if (d === today) visits.today += n; if (d >= weekAgo && d <= today) visits.week += n; });
  }
  return !!(r[0].error || r[1].error);
}
let ldTab = 'interest';
const shortDate = v => v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const mailHref = (email, subject) => /^[^\s@<>"']+@[^\s@<>"']+$/.test(email || '') ? 'mailto:' + encodeURIComponent(email).replace(/%40/g, '@') + (subject ? '?subject=' + encodeURIComponent(subject) : '') : '';
const telOf = v => { const t = String(v || '').replace(/[^\d+]/g, ''); return t.length >= 7 ? t : ''; };
function renderLeads() {
  $('#statBox').innerHTML = [['Visits today', visits.ok ? groupIN(visits.today) : '–'], ['Last 7 days', visits.ok ? groupIN(visits.week) : '–'], ['All visits', visits.ok ? groupIN(visits.total) : '–'], ['Signed-in customers', groupIN(people.length)]]
    .map(x => '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>').join('');
  $('#ldTabs').innerHTML = [['interest', 'Interested', leads.length], ['people', 'Signed in', people.length]].map(x =>
    '<button class="chip" type="button" data-ld="' + x[0] + '" aria-pressed="' + (ldTab === x[0]) + '">' + x[1] + '<b>' + x[2] + '</b></button>').join('');
  if (ldTab === 'people') {
    $('#leadList').innerHTML = people.length ? people.map(d => {
      const n = leads.filter(x => x.user_id === d.user_id).length, mail = mailHref(d.email), tel = telOf(d.phone);
      return '<li class="mrow lead"><div class="mbody"><strong>' + esc(d.name || d.email || 'Customer') + '</strong>' +
        '<span>' + esc([d.email, d.phone || 'No phone number yet'].filter(Boolean).join(' · ')) + '</span>' +
        '<span class="hint">' + esc('First signed in ' + shortDate(d.created_at) + ' · last seen ' + shortDate(d.last_seen) + (n ? ' · interested in ' + n + (n === 1 ? ' property' : ' properties') : '')) + '</span></div>' +
        '<div class="mact">' + (mail ? '<a class="btn small primary" href="' + esc(mail) + '">Email</a>' : '') + (tel ? '<a class="btn small" href="tel:' + esc(tel) + '">Call</a>' : '') + '</div></li>';
    }).join('') : '<li class="empty">No customer has continued with Google yet.</li>';
    return;
  }
  $('#leadList').innerHTML = leads.length ? leads.map(d => {
    const l = d.listing_id ? byId(d.listing_id) : null, title = (l && l.title) || d.listing_title || 'A property that was deleted';
    const tel = telOf(d.phone), mail = mailHref(d.email, title);
    return '<li class="mrow lead" data-lead="' + esc(d.id) + '"><div class="mbody"><strong>' + esc(d.name || d.email || 'Customer') + '</strong>' +
      '<span>' + esc(title) + '</span>' + (d.message ? '<span class="lmsg">' + esc(d.message) + '</span>' : '') +
      '<span class="hint">' + esc([d.email, d.phone, shortDate(d.created_at)].filter(Boolean).join(' · ')) + '</span></div>' +
      '<div class="mact">' + (mail ? '<a class="btn small primary" href="' + esc(mail) + '">Email</a>' : '') +
      (tel ? '<a class="btn small" href="tel:' + esc(tel) + '">Call</a>' : '') +
      (l ? '<button class="btn small" type="button" data-view="' + esc(l.id) + '">View property</button>' : '') +
      '<button class="btn small danger" type="button" data-rmlead>Remove</button></div></li>';
  }).join('') : '<li class="empty">Nobody has pressed “I am interested” yet. Customers see that button on a property once Google sign-in is switched on in Supabase.</li>';
}
$('#leadsBtn').addEventListener('click', async () => { $('#ld_err').hidden = true; renderLeads(); show(dlgLeads); await Promise.all([loadLeads(), loadPeople()]); renderLeads(); });
$('#ldTabs').addEventListener('click', e => { const b = e.target.closest('[data-ld]'); if (!b) return; ldTab = b.dataset.ld; renderLeads(); });
$('#leadList').addEventListener('click', async e => {
  const v = e.target.closest('[data-view]');
  if (v) { openDetail(v.dataset.view); return; }
  if (!e.target.closest('[data-rmlead]')) return;
  const id = e.target.closest('[data-lead]').dataset.lead;
  await mutate($('#ld_err'), async () => {
    const r = await sb.from('interests').delete().eq('id', id).select('id');
    if (r.error) throw r.error;
    leads = leads.filter(x => x.id !== id);
  }, 'Removed.');
  renderLeads(); renderAccount();
});

/* ---------- customer: my profile ---------- */
$('#profileBtn').addEventListener('click', () => {
  if (!customer) return;
  dlgMenu.close();
  $('#profFacts').innerHTML = '<div><dt>Name</dt><dd>' + esc(customer.name) + '</dd></div><div><dt>Email</dt><dd>' + esc(customer.email) + '</dd></div>';
  $('#p_phone').value = customer.phone || '';
  $('#p_err').hidden = true;
  show(dlgProfile);
});
$('#profForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#p_err'), btn = $('#p_save'), ph = $('#p_phone').value.trim().slice(0, 30);
  if (!customer || btn.disabled) return;
  if (ph && !telOf(ph)) { err.textContent = 'That phone number looks too short. Type it with all its digits, for example 98XXXXXXXX.'; err.hidden = false; return; }
  err.hidden = true; btn.disabled = true;
  try {
    const r = await sb.from('profiles').upsert({ user_id: customer.id, email: customer.email, name: customer.name, phone: ph, last_seen: new Date().toISOString() }, { onConflict: 'user_id' }).select('phone');
    if (r.error) throw r.error;
    customer.phone = ph;
    dlgProfile.close();
    toast(ph ? 'Phone number saved.' : 'Phone number removed.');
  } catch (e2) { console.error(e2); err.textContent = 'Could not save it just now. Try again in a moment.'; err.hidden = false; }
  finally { btn.disabled = false; }
});

/* ---------- visit count ---------- */
// One count per phone or computer per day. Nothing about the visitor is stored, only the day's total.
function countVisit() {
  if (owner) return;
  const today = dayKey(new Date());
  try { if (localStorage.getItem('gjm_visit') === today) return; localStorage.setItem('gjm_visit', today); } catch (e) { return; }
  sb.rpc('log_visit').then(() => {}, () => {});
}

/* ---------- ask about properties (chat) ----------
   Works without any key: it searches the listings by type, place, budget and bedrooms.
   When GEMINI_API_KEY is added in Vercel, /api/chat answers instead and this search stays as the backup. */
const chat = { ai: false, msgs: [], busy: false };
function chatLabels() {
  $('#askLabel').textContent = chat.ai ? 'Ask AI' : 'Ask';
  $('#askBtn').setAttribute('aria-label', chat.ai ? 'Ask AI about properties' : 'Ask about properties');
  $('#chatH').textContent = $('#menuAsk').textContent = chat.ai ? 'Ask AI about properties' : 'Ask about properties';
}
chatLabels();
fetch('/api/chat').then(r => r.ok ? r.json() : null).then(j => { chat.ai = !!(j && j.enabled); chatLabels(); }).catch(() => {});
const KIND_WORDS = [['flat', /flat|apartment|bhk|फ्ल्याट/], ['room', /room|kotha|कोठा/], ['shutter', /shutter|sutter|सटर|shop/], ['business', /business|office|commercial|hotel|restaurant|warehouse|व्यापार/], ['house', /house|ghar|घर|bungalow/], ['land', /land|jagga|जग्गा|plot|ropani|anna|aana/]];
// Words that carry no question of their own. If nothing else is left after the type, place, budget and bedrooms
// are taken out, the listings can answer the message without calling the AI.
const FILLER = new Set(('i we you me my our us a an the is are am was be do does did have has had any some there here this that it its of to in at on for with and or ' +
  'please pls kindly show find get give tell see search list want need looking look searching like would could can may will ' +
  'price prices priced cost costs rate rates budget amount money rs npr rupees rupee under below upto up within less than max maximum about around ' +
  'property properties listing listings place available availability one ones something anything what which where how much many kind type sale sell selling buy buying rent rental renting month monthly per ' +
  'crore crores cr lakh lakhs lac lacs k thousand hajar anna aana ropani sqft sq ft bhk bed beds bedroom bedrooms ' +
  'ma ko ka ki lai cha chha xa ho kati kun chahiyo chaiyo chahiyeko khojdai khojeko dekhau dekhaunu malai hajur sir dai didi bhai bhada kinna bikri ' +
  'छ मा को का कति चाहियो मलाई देखाउनुस् भाडा किन्न बिक्री सम्म').split(' '));
const GREET = /^(hi+|hello+|hey+|namaste|namaskar|नमस्ते|नमस्कार|good (morning|afternoon|evening))[\s!.,]*$/;
const THANKS = /^(thanks?|thank you|thx|ok(ay)?|dhanyabad|धन्यवाद|great|nice|good|fine)[\s!.,]*$/;
const CONTACT_Q = /\b(contact|phone|number|call|whatsapp|viber|owner|agent|broker|meet|visit|appointment|sampark|सम्पर्क)\b/;
const flat = t => String(t).replace(/ /g, ' ');
function findListings(q) {
  const s = ' ' + String(q).toLowerCase() + ' ';
  const w = {};
  if (/rent|bhada|भाडा|kiraya|per month|monthly/.test(s)) w.deal = 'rent'; else if (/\bbuy|\bsale|\bsell|kinna|किन्न|bikri|बिक्री|purchase/.test(s)) w.deal = 'sale';
  w.kind = (KIND_WORDS.find(k => k[1].test(s)) || [])[0] || '';
  const names = Array.from(new Set(shown().map(placeName))).filter(n => n.length >= 3 && n !== 'Other').sort((a, b) => b.length - a.length);
  w.place = names.find(n => s.indexOf(n.toLowerCase()) >= 0) || '';
  const bhk = /(\d)\s*(?:bhk|bed)/.exec(s); w.beds = bhk ? +bhk[1] : 0;
  const m = /(?:rs\.?|npr|under|below|upto|up to|budget|within|less than|max|सम्म)\s*([\d,.]+\s*(?:crores?|cr|lakhs?|lacs?|करोड|लाख|k\b|thousand|hajar)?)|([\d,.]+\s*(?:crores?|cr|lakhs?|lacs?|करोड|लाख|k\b|thousand|hajar))|(\d{5,})/.exec(s);
  const rentish = w.deal === 'rent' || (!w.deal && (w.kind === 'room' || w.kind === 'shutter'));
  const money = m ? parseMoney(m[1] || m[2] || m[3], rentish) : null;
  w.max = money ? money.value : 0;
  w.sort = /\b(cheap|cheapest|lowest|sasto|sasta|सस्तो)\b/.test(s) ? 'low' : /\b(newest|latest|recent|naya|नयाँ)\b/.test(s) ? 'new' : '';
  if (!w.deal && w.max) w.deal = w.max < 5e5 ? 'rent' : 'sale';
  if (!w.kind && !w.deal && !w.place && !w.beds && !w.max && !w.sort) return null;
  let arr = shown().filter(l => l.status === 'available' && (!w.kind || kindOf(catOf(l.type)) === w.kind) && (!w.deal || l.deal === w.deal) &&
    (!w.place || placeName(l) === w.place) && (!w.beds || bedsOf(l) >= w.beds) && (!w.max || (l.price > 0 && l.price <= w.max * 1.05)));
  if (w.sort === 'low') arr = arr.slice().sort((x, y) => (x.price || Infinity) - (y.price || Infinity));
  else if (w.max) arr = arr.slice().sort((x, y) => y.price - x.price);
  const what = (w.beds ? w.beds + '+ bedroom ' : '') + (w.kind ? (w.kind === 'business' ? 'commercial properties' : w.kind === 'land' ? 'land' : KIND_NAMES[w.kind].toLowerCase() + 's') : 'properties');
  w.words = what + (w.deal ? (w.deal === 'rent' ? ' for rent' : ' for sale') : '') + (w.place ? ' in ' + w.place : '') + (w.max ? ' up to ' + flat(fmtNPR(w.max)) + (w.deal === 'rent' ? ' a month' : '') : '');
  // What is left of the message once everything understood above is taken out.
  let left = s;
  if (m) left = left.replace(m[0], ' ');
  if (w.place) left = left.split(w.place.toLowerCase()).join(' ');
  const rest = (left.match(/[a-zऀ-ॿ]+/g) || []).filter(t => !FILLER.has(t) && !KIND_WORDS.some(k => k[1].test(t)) && !/^(cheap|cheapest|lowest|sasto|sasta|newest|latest|recent|naya|lands|houses|flats|rooms|shutters|plots|offices|shops)$/.test(t));
  return { want: w, items: arr, rest: rest };
}
const HELP_TEXT = 'I can look up the properties here by type, place and budget. Try “land under 1 crore in Sanepa”, “2 BHK flat for rent” or “room in Kupondole”. For anything else, press Contact.';
const sayOne = l => l.title + ' at ' + flat(priceText(l));
// When a budget is being compared, the total price is the number that matters, not the price per Anna.
const sayTotal = l => l.title + ' at ' + flat(fmtNPR(l.price)) + (l.deal === 'rent' ? ' a month' : '');
// Answers from the listings alone, in full sentences. When nothing fits, it offers the nearest thing instead of a dead end.
function localAnswer(q, f) {
  f = f || findListings(q);
  if (!f) return { text: HELP_TEXT, ids: [] };
  const w = f.want, items = f.items, n = items.length, ids = arr => arr.slice(0, 5).map(l => l.id);
  if (n) {
    const priced = items.filter(l => l.price > 0), oneDeal = priced.every(l => l.deal === priced[0].deal);
    let t = (n === 1 ? 'Yes, there is 1 match for ' : 'Yes, there are ' + n + ' matches for ') + w.words + '. ';
    if (n === 1) t += 'It is ' + (w.max ? sayTotal(items[0]) : sayOne(items[0])) + '.';
    else if (w.sort === 'low' && priced.length) t += 'The lowest price is ' + sayOne(priced[0]) + '.';
    else if (w.max && priced.length) t += 'The closest to your budget is ' + sayTotal(priced[0]) + '.';
    else if (priced.length > 1 && oneDeal) {
      const lo = Math.min.apply(null, priced.map(l => l.price)), hi = Math.max.apply(null, priced.map(l => l.price));
      t += lo === hi ? 'They are all ' + flat(fmtNPR(lo)) + '.' : 'Prices go from ' + flat(fmtNPR(lo)) + ' to ' + flat(fmtNPR(hi)) + (priced[0].deal === 'rent' ? ' a month.' : '.');
    }
    return { text: t + (n > 5 ? ' Here are 5 of them.' : '') + (n === 1 ? ' Tap it to open it.' : ' Tap one to open it.'), ids: ids(items), local: true };
  }
  const pool = shown().filter(l => l.status === 'available' && (!w.kind || kindOf(catOf(l.type)) === w.kind) && (!w.deal || l.deal === w.deal) && (!w.beds || bedsOf(l) >= w.beds));
  if (w.max) {
    const over = pool.filter(l => (!w.place || placeName(l) === w.place) && l.price > w.max).sort((x, y) => x.price - y.price);
    if (over.length) return { text: 'Nothing ' + (w.place ? 'in ' + w.place + ' ' : '') + 'fits ' + flat(fmtNPR(w.max)) + (w.deal === 'rent' ? ' a month' : '') + ' right now. The lowest is ' + sayTotal(over[0]) + ', which is ' + flat(fmtNPR(over[0].price - w.max)) + ' more. It is worth asking if the price can come down.', ids: ids(over.slice(0, 3)), local: true };
  }
  if (w.place) {
    const other = pool.filter(l => !w.max || (l.price > 0 && l.price <= w.max * 1.05));
    if (other.length) return { text: 'There is nothing like that in ' + w.place + ' right now. ' + (other.length === 1 ? 'There is 1 in another place.' : 'There are ' + other.length + ' in other places.') + ' Tap one to open it.', ids: ids(other), local: true };
  }
  return { text: 'Nothing listed right now matches ' + w.words + '. Press Contact and the owner can tell you what is coming up.', ids: [], local: true };
}
// Messages that need no AI at all: a greeting, a thank-you, how to reach the owner, and any search the listings fully answer.
function quickAnswer(q) {
  const s = q.trim().toLowerCase();
  if (GREET.test(s)) return { text: 'Namaste. Tell me what you are looking for: the kind of property, the place and your budget.', ids: [] };
  if (THANKS.test(s)) return { text: 'You are welcome. Ask me anything else about the properties, or press Contact to reach the owner.', ids: [] };
  const f = findListings(q);
  if (CONTACT_Q.test(s)) return { text: 'To talk to the owner or arrange a visit, press “Contact the owner” below.' + (f && f.items.length ? ' These match what you mentioned.' : ''), ids: f ? f.items.slice(0, 3).map(l => l.id) : [] };
  if (f && !f.rest.length) return localAnswer(q, f);
  return null;
}
// Each phone or computer gets a fair share of AI answers per day, so one visitor cannot use up the free quota for everyone.
const AI_PER_DAY = CFG.AI_PER_DAY > 0 ? CFG.AI_PER_DAY : 15;
function aiLeft(use) {
  try {
    const today = dayKey(new Date());
    let v = JSON.parse(localStorage.getItem('gjm_ai') || 'null');
    if (!v || v.d !== today) v = { d: today, n: 0 };
    if (v.n >= AI_PER_DAY) return false;
    if (use) { v.n++; localStorage.setItem('gjm_ai', JSON.stringify(v)); }
    return true;
  } catch (e) { return true; }
}
chat.cache = new Map();
function renderChat() {
  const log = $('#chatLog');
  log.innerHTML = chat.msgs.map(m => '<div class="msg ' + (m.role === 'bot' ? 'bot' : 'me') + '"><p>' + esc(m.text) + '</p>' +
    (m.ids && m.ids.length ? '<div class="mres">' + m.ids.map(id => { const l = byId(id); return l ? '<button class="btn small" type="button" data-view="' + esc(id) + '"><b>' + esc(l.title) + '</b><span>' + esc(compactPrice(l)) + (placeName(l) !== 'Other' ? ' · ' + esc(placeName(l)) : '') + '</span></button>' : ''; }).join('') + '</div>' : '') +
    (m.ai ? '<small>Written by AI. It can make mistakes, so confirm the details with the owner.</small>' : m.local ? '<small>Found in the listings on this site.</small>' : '') + '</div>').join('') +
    (chat.busy ? '<div class="msg bot wait"><p>Looking…</p></div>' : '') +
    '<div class="row"><button class="btn small" type="button" data-contact>Contact the owner</button></div>';
  log.scrollTop = log.scrollHeight;
}
function openChat() {
  if (!chat.msgs.length) chat.msgs.push({ role: 'bot', text: 'Namaste. Ask me about the properties listed here, for example “land under 1 crore in Sanepa” or “2 BHK flat for rent”.' });
  renderChat();
  show(dlgChat);
}
async function ask(q) {
  chat.msgs.push({ role: 'me', text: q });
  chat.busy = true; renderChat();
  // 1. The listings answer it by themselves when the message is a plain search. No AI call is spent.
  let out = quickAnswer(q);
  const key = q.trim().toLowerCase().replace(/\s+/g, ' ');
  // 2. The same question asked again gets the answer it got before.
  if (!out && chat.cache.has(key)) out = chat.cache.get(key);
  // 3. Everything else goes to the AI, if it is connected and this visitor still has answers left today.
  if (!out && chat.ai && aiLeft(true)) {
    try {
      const rows = shown().filter(l => l.status === 'available').slice(0, 60).map(l => ({
        title: l.title, kind: headline(l), price: flat(priceText(l)), size: areaText(l), place: placeLine(l),
        facts: cardFacts(l).concat(featuresOf(l)).join(', '), notes: String(l.desc || '').slice(0, 200)
      }));
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: state.site.name || DEF_SITE.name, messages: chat.msgs.slice(-8).map(m => ({ role: m.role, text: m.text })), listings: rows }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.text) {
        const low = j.text.toLowerCase();
        let ids = shown().filter(l => l.title.length > 5 && low.indexOf(l.title.toLowerCase()) >= 0).slice(0, 5).map(l => l.id);
        if (!ids.length) { const f = findListings(q); if (f) ids = f.items.slice(0, 3).map(l => l.id); }
        out = { text: j.text, ids: ids, ai: true };
        chat.cache.set(key, out);
      }
    } catch (e) {}
  }
  // 4. No AI key, the limit is reached, or the AI did not answer: the listings answer as well as they can.
  if (!out) out = localAnswer(q);
  chat.busy = false;
  chat.msgs.push({ role: 'bot', text: out.text, ids: out.ids, ai: !!out.ai, local: !!out.local });
  if (chat.msgs.length > 40) chat.msgs = chat.msgs.slice(-40);
  renderChat();
}
$('#chatForm').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('#chatIn').value.trim().slice(0, 300);
  if (!q || chat.busy) return;
  $('#chatIn').value = '';
  ask(q);
});
$('#chatLog').addEventListener('click', e => {
  const v = e.target.closest('[data-view]');
  if (v) openDetail(v.dataset.view);
  else if (e.target.closest('[data-contact]')) openContact(null);
});

const openLogin = () => { if (dlgMenu.open) dlgMenu.close(); $('#l_err').hidden = true; $('#l_pass').value = ''; show(dlgLogin); };
$('#loginLink').addEventListener('click', openLogin);
$('#loginBtn').addEventListener('click', openLogin);
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
    if (who === 'owner') { dlgLogin.close(); renderAll(); toast('Signed in. Owner tools are at the bottom.'); }
    else { await sb.auth.signOut(); bad(who === 'not_owner' ? 'This account is not set as the site owner yet. Run database-update.sql in Supabase, then sign in again.' : 'Signed in, but the owner check failed. Run database-update.sql in Supabase first.'); }
  } catch (e2) { bad('Could not sign in. Check your connection and try again.'); }
  finally { setBusy(false); }
});
$('#signOutBtn').addEventListener('click', async () => {
  try { await sb.auth.signOut(); } catch (e) {}
  state.listings = state.listings.filter(l => l.status !== 'unavailable');
  customer = null; myInterest = new Set(); leads = []; people = [];
  if (dlgMenu.open) dlgMenu.close();
  setOwner(false); toast('Signed out.');
});
$('#addBtn').addEventListener('click', () => openEdit(null));
$('#siteBtn').addEventListener('click', openSite);

/* ---------- manage listings ---------- */
let mTab = 'all';
function renderManage() {
  const all = state.listings;
  const n = { all: all.length, available: 0, sold: 0, rented: 0, unavailable: 0 };
  all.forEach(l => { n[l.status]++; });
  $('#mTabs').innerHTML = [['all', 'All']].concat(STATUSES.map(s => [s, STATUS_WORD[s]])).map(([k, label]) =>
    '<button class="chip" type="button" data-tab="' + k + '" aria-pressed="' + (mTab === k) + '">' + label + '<b>' + n[k] + '</b></button>').join('');
  const arr = all.filter(l => mTab === 'all' || l.status === mTab);
  $('#mList').innerHTML = arr.length ? arr.map(l => {
    const ph = (l.photos || []).find(okUrl), c = catOf(l.type);
    return '<li class="mrow" data-id="' + esc(l.id) + '">' +
      '<span class="thumb" style="--c:' + cvar(c) + '">' + (ph ? imgTag(ph, c) : catIcon(c)) + '</span>' +
      '<div class="mbody"><span class="card-top">' + badges(l) + '</span><strong>' + esc(l.title) + '</strong>' +
      '<span class="mprice">' + esc(priceText(l)) + '</span>' + (placeLine(l) ? '<span class="hint">' + esc(placeLine(l)) + '</span>' : '') + '</div>' +
      '<div class="mact"><button class="btn small" type="button" data-view>View</button><button class="btn small" type="button" data-edit>Edit</button>' +
      '<label class="inline"><span class="sr">Change status of ' + esc(l.title) + '</span><select data-status>' + statusOptions(l) + '</select></label>' +
      '<button class="btn small" type="button" data-feat aria-pressed="' + !!l.featured + '">' + (l.featured ? 'Featured: on' : 'Featured: off') + '</button>' +
      '<button class="btn small danger" type="button" data-del>Delete</button></div></li>';
  }).join('') : '<li class="empty">' + (all.length ? 'No listings with this status.' : 'No listings yet. Press “+ Add property”.') + '</li>';
}
$('#manageBtn').addEventListener('click', () => { $('#m_err').hidden = true; renderManage(); show(dlgManage); });
$('#m_add').addEventListener('click', () => openEdit(null));
$('#mTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; mTab = b.dataset.tab; renderManage(); });
$('#mList').addEventListener('click', e => {
  const li = e.target.closest('.mrow'); if (!li) return;
  const id = li.dataset.id;
  if (e.target.closest('[data-view]')) openDetail(id);
  else if (e.target.closest('[data-edit]')) openEdit(id);
  else if (e.target.closest('[data-del]')) askDelete(id);
  else if (e.target.closest('[data-feat]')) {
    const l = byId(id); if (!l) return;
    const next = !l.featured;
    mutate($('#m_err'), async () => {
      const r = await sb.from('listings').update({ featured: next, updated_at: new Date().toISOString() }).eq('id', id).select('id');
      if (r.error) throw r.error;
      if (Array.isArray(r.data) && !r.data.length) throw { code: '42501', message: 'not allowed' };
      l.featured = next;
    }, next ? 'Added to the Featured carousel.' : 'Removed from the Featured carousel.');
  }
});
$('#mList').addEventListener('change', async e => {
  const s = e.target.closest('[data-status]'); if (!s) return;
  const id = s.closest('.mrow').dataset.id;
  const ok = await setStatus(id, s.value, $('#m_err'));
  if (!ok) renderManage();
});

/* ---------- add or edit a property ---------- */
let draft = null, mini = null, miniMark = null;
const PHOTO_NOTE = 'You can pick several at once. The first photo is the cover. Photos are made smaller automatically so the site stays fast.';
function ensureMini() {
  if (mini) return;
  mini = L.map('miniMap', { minZoom: 9, maxBounds: L.latLngBounds(AREA).pad(0.12), maxBoundsViscosity: 1 });
  mini.attributionControl.setPrefix(false);
  baseLayer('streets-v2').addTo(mini);
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
  if (!inArea(lat, lng)) {
    err.textContent = 'That spot is outside ' + AREA_NAME + ', the area this site covers. Check the numbers: latitude first, then longitude.';
    err.hidden = false;
    return;
  }
  err.hidden = true;
  draft.lat = +lat.toFixed(6); draft.lng = +lng.toFixed(6);
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
// Photo tiles: move earlier, move later, remove. Photos already saved stay exactly as they are until Save is pressed.
function renderDraftPhotos() {
  const n = draft.photos.length;
  $('#f_photoList').innerHTML = draft.photos.map((p, i) => '<div class="ph"><img src="' + esc(p.url || p.preview) + '" alt="Photo ' + (i + 1) + '">' + (i === 0 ? '<span class="cover">Cover</span>' : '') +
    '<div class="ph-bar"><button type="button" data-mv="-1" data-i="' + i + '" aria-label="Move photo ' + (i + 1) + ' earlier"' + (i === 0 ? ' disabled' : '') + '>&larr;</button>' +
    '<button type="button" data-mv="1" data-i="' + i + '" aria-label="Move photo ' + (i + 1) + ' later"' + (i === n - 1 ? ' disabled' : '') + '>&rarr;</button>' +
    '<button type="button" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">&times;</button></div></div>').join('');
  $('#f_photoNote').textContent = n ? n + ' of 10 photos. ' + (n > 1 ? 'Use the arrows to change the order. ' : '') + 'The first photo is the cover.' : PHOTO_NOTE;
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
const formKind = () => draft && draft.type ? kindOf(catOf(draft.type)) : '';
function fieldHtml(k, K) {
  const f = FIELDS[k], id = 'x_' + k, v = draft.d[k], label = esc(labelOf(k, K)) + (f.opt ? ' (optional)' : '');
  if (f.t === 'bool') return '<label class="tick" for="' + id + '"><input type="checkbox" id="' + id + '" data-k="' + k + '"' + (v === true ? ' checked' : '') + '><span>' + label + '</span></label>';
  if (f.t === 'sel') {
    const opts = optsOf(k, K).map(o => Array.isArray(o) ? o : [o, o]);
    if (v != null && v !== '' && !opts.some(o => o[0] === String(v))) opts.push([String(v), String(v)]);
    return '<label class="field" for="' + id + '"><span>' + label + '</span><select id="' + id + '" data-k="' + k + '"><option value="">Not set</option>' +
      opts.map(o => '<option value="' + esc(o[0]) + '"' + (v != null && String(v) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>';
  }
  const input = '<input type="text" id="' + id + '" data-k="' + k + '" value="' + esc(v == null ? '' : v) + '"' + (f.t === 'text' ? ' maxlength="' + (f.max || 60) + '"' : ' inputmode="' + (f.t === 'int' ? 'numeric' : 'decimal') + '"') +
    (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + ' autocomplete="off">';
  return '<label class="field' + (f.t === 'text' ? ' wide' : '') + '" for="' + id + '"><span>' + label + (f.year ? ' (BS or AD)' : '') + '</span>' + (f.unit ? '<span class="unitbox">' + input + '<em>' + f.unit + '</em></span>' : input) + '</label>';
}
// Builds the questions for the chosen category and deal. Answers already typed are kept in draft.d.
function renderDyn(K, rent) {
  $('#f_dyn').innerHTML = K.groups.map(g => {
    const keys = g[1].filter(k => rent || !(K.rentOnly && K.rentOnly.indexOf(k) >= 0));
    if (!keys.length) return '';
    const inputs = keys.filter(k => FIELDS[k].t !== 'bool'), ticks = keys.filter(k => FIELDS[k].t === 'bool');
    return '<h3 class="sect">' + esc(g[0]) + '</h3>' +
      (inputs.length ? '<div class="grid2">' + inputs.map(k => fieldHtml(k, K)).join('') + '</div>' : '') +
      (ticks.length ? '<div class="ticks">' + ticks.map(k => fieldHtml(k, K)).join('') + '</div>' : '');
  }).join('');
}
function placeMini() {
  if (!mini || $('#f_body').hidden) return;
  mini.invalidateSize();
  lockZoom(mini);
  if (draft._placed) return;
  draft._placed = true;
  if (draft.lat != null && draft.lng != null) { mini.setView([draft.lat, draft.lng], 17); setMiniMark(draft.lat, draft.lng); }
  else { const c = map.getCenter(); if (map.getZoom() >= 13) mini.setView(c, map.getZoom()); else mini.fitBounds(AREA); }
}
// Shows the right questions for the chosen category and deal, and hides everything else.
function applyKind() {
  const kind = formKind(), K = KINDS[kind];
  if (K && K.deals.indexOf(draft.deal) < 0) draft.deal = K.deals.length === 1 ? K.deals[0] : null;
  $('#f_dealBox').hidden = !K;
  $('#f_deals').innerHTML = K ? ['sale', 'rent'].filter(d => K.deals.indexOf(d) >= 0).map(d =>
    '<label><input type="radio" name="f_deal" id="f_deal_' + d + '" value="' + d + '"' + (draft.deal === d ? ' checked' : '') + '><span>' + (d === 'sale' ? 'For sale' : 'For rent') + '</span></label>').join('') : '';
  const ready = !!(K && draft.deal);
  $('#f_body').hidden = !ready;
  $('#f_stepHint').hidden = ready;
  $('#f_stepHint').textContent = K ? 'Choose For sale or For rent.' : 'Choose what it is. The form then shows only the questions for that kind of property.';
  if (!ready) return;
  const rent = draft.deal === 'rent';
  $('#f_subBox').hidden = !K.sub;
  if (K.sub) {
    $('#f_subLabel').textContent = K.sub[0];
    const cur = K.sub[1].indexOf(draft.sub) >= 0 ? draft.sub : '';
    $('#f_sub').innerHTML = '<option value="">Choose</option>' + K.sub[1].map(o => '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
  }
  // Size units depend on the category: land units for land, only sq ft and sq m for a flat, shutter or room.
  const unitSel = $('#f_unit'), was = unitSel.value || draft.area.u;
  unitSel.innerHTML = K.units.map(u => '<option value="' + u + '">' + UNITS[u][0] + '</option>').join('');
  if (K.units.indexOf(was) >= 0) unitSel.value = was;
  else if (draft.id && draft.keepUnit === was && draft.keepType === draft.type && kind !== 'flat') {
    // A listing saved before this update may use a unit this form no longer offers. It is kept so nothing is lost.
    unitSel.insertAdjacentHTML('beforeend', '<option value="' + was + '">' + UNITS[was][0] + '</option>');
    unitSel.value = was;
  } else { unitSel.value = K.unit; $('#f_area').value = ''; }
  $('#f_sizeLabel').textContent = K.size + (K.sizeOpt ? ' (optional)' : '');
  $('#f_area').placeholder = K.sizePh || '';
  $('#f_builtBox').hidden = !K.built;
  $('#f_depositBox').hidden = !rent;
  const per = !!K.perUnit && !rent;
  if (!per) $('#f_pmode').value = 'total';
  $('#f_pmode').hidden = !per;
  $('#f_pricePair').classList.toggle('one', !per);
  $('#f_title').placeholder = 'For example: ' + K.titlePh;
  const st = $('#f_status'), sv = st.value || draft.status;
  st.innerHTML = [['available', 'Available'], rent ? ['rented', 'Rented'] : ['sold', 'Sold'], ['unavailable', 'Unavailable (hidden from visitors)']].map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('');
  st.value = sv === 'sold' || sv === 'rented' ? (rent ? 'rented' : 'sold') : sv === 'unavailable' ? sv : 'available';
  renderDyn(K, rent);
  readPrice();
  setTimeout(placeMini, 60);
}
function openEdit(id) {
  const l = id ? byId(id) : null;
  draft = l ? JSON.parse(JSON.stringify(l)) : { id: null, type: null, deal: null, sub: '', title: '', price: 0, rateMode: false, area: { v: 0, u: 'aana' }, built: { v: 0, u: 'sqft' }, deposit: 0, social: '', d: {}, place: '', district: DISTRICT, lat: null, lng: null, desc: '', photos: [], status: 'available' };
  draft.photos = (draft.photos || []).filter(okUrl).map(u => ({ url: u }));
  draft.keepType = draft.type; draft.keepUnit = l && l.area.v > 0 && UNITS[l.area.u] ? l.area.u : '';
  $('#editH').textContent = l ? 'Edit property' : 'Add property';
  $('#f_save').dataset.label = l ? 'Update property' : 'Save property';
  $('#f_save').textContent = $('#f_save').dataset.label;
  $('#f_types').innerHTML = state.cats.map((c, i) => '<label><input type="radio" name="f_type" id="f_type_' + i + '" value="' + esc(c.id) + '"' + (c.id === draft.type ? ' checked' : '') + '><span style="--c:' + cvar(c) + '">' + kindIcon(kindOf(c)) + esc(catName(c)) + '</span></label>').join('');
  $('#f_title').value = l ? draft.title || '' : '';
  $('#f_unit').innerHTML = '';
  $('#f_area').value = draft.area && draft.area.v > 0 ? trimNum(draft.area.v) : '';
  const rate = l && draft.rateMode ? rateOf(l) : null;
  $('#f_pmode').value = rate ? 'unit' : 'total';
  $('#f_price').value = draft.price > 0 ? String(rate ? Math.round(rate.v) : draft.price) : '';
  $('#f_built').value = draft.built && draft.built.v > 0 ? trimNum(draft.built.v) : '';
  $('#f_builtUnit').value = draft.built && draft.built.u === 'sqm' ? 'sqm' : 'sqft';
  $('#f_deposit').value = draft.deposit > 0 ? String(draft.deposit) : '';
  $('#f_place').value = draft.place || '';
  $('#f_district').textContent = DISTRICT;
  $('#f_desc').value = draft.desc || '';
  $('#f_social').value = draft.social || '';
  $('#f_status').innerHTML = '';
  $('#f_featured').checked = !!draft.featured;
  $('#f_photos').value = '';
  $('#f_err').hidden = true;
  $('#f_coords').value = draft.lat != null && draft.lng != null ? (+draft.lat).toFixed(5) + ', ' + (+draft.lng).toFixed(5) : '';
  $('#placeList').innerHTML = Array.from(new Set(state.listings.map(placeName))).sort().map(n => '<option value="' + esc(n) + '"></option>').join('');
  renderDraftPhotos();
  show(dlgEdit);
  ensureMini();
  setMiniMark(null);
  applyKind();
  dlgEdit.scrollTop = 0;
}
function readPrice() {
  const K = KINDS[formKind()]; if (!K || !draft.deal) return;
  const rent = draft.deal === 'rent';
  const unit = UNITS[$('#f_unit').value] ? $('#f_unit').value : K.unit;
  const ru = rateUnit(unit);
  $('#f_priceLabel').textContent = rent ? 'Monthly rent (Rs.)' : K.perUnit ? 'Price (Rs.)' : 'Total price (Rs.)';
  $('#f_price').placeholder = rent ? '35000' : '65 lakh, 1.35 crore or 6500000';
  $('#f_pmode').options[1].textContent = 'per ' + UNITS[ru][0];
  const v = $('#f_price').value.trim(), out = $('#f_priceRead');
  if (!v) { out.textContent = 'Leave the price empty to show “Price on request”.'; return; }
  const p = parseMoney(v, rent);
  if (!p) { out.textContent = rent ? 'Type the rent as a number, for example 35000.' : 'Type the price as a number, for example 65 lakh or 6500000.'; return; }
  if (rent) { out.textContent = 'Shows as ' + fmtNPR(p.value) + '/month.'; return; }
  if ($('#f_pmode').value === 'unit') {
    const av = parseFloat($('#f_area').value), n = av * UNITS[unit][1] / UNITS[ru][1];
    out.textContent = av > 0 ? 'Shows as ' + fmtNPR(p.value) + ' per ' + UNITS[ru][0] + '. Total works out to ' + fmtNPR(p.value * n) + ' for ' + trimNum(av) + ' ' + UNITS[unit][0] + '.' : 'Add the land size so the total price can be worked out.';
    return;
  }
  out.textContent = 'Shows as ' + fmtNPR(p.value) + ' (Rs. ' + groupIN(p.value) + ').';
}
['#f_price', '#f_area', '#f_unit', '#f_pmode'].forEach(s => { $(s).addEventListener('input', readPrice); $(s).addEventListener('change', readPrice); });
$('#f_types').addEventListener('change', e => { if (e.target.name === 'f_type') { draft.type = e.target.value; applyKind(); } });
$('#f_deals').addEventListener('change', e => { if (e.target.name === 'f_deal') { draft.deal = e.target.value; applyKind(); } });
$('#f_sub').addEventListener('change', e => { draft.sub = e.target.value; });
const keepDyn = e => { const el = e.target.closest('[data-k]'); if (el) draft.d[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; };
$('#f_dyn').addEventListener('input', keepDyn);
$('#f_dyn').addEventListener('change', keepDyn);
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
$('#f_photoList').addEventListener('click', e => {
  const rm = e.target.closest('[data-rm]'), mv = e.target.closest('[data-mv]');
  if (rm) {
    const gone = draft.photos.splice(+rm.dataset.rm, 1)[0];
    // A photo uploaded during this edit but never saved is removed from storage. Saved photos are only removed after Save.
    if (gone && gone.fresh) removePhotos([gone.url]);
  } else if (mv) {
    const i = +mv.dataset.i, j = i + (+mv.dataset.mv);
    if (j < 0 || j >= draft.photos.length) return;
    const t = draft.photos[i]; draft.photos[i] = draft.photos[j]; draft.photos[j] = t;
  } else return;
  renderDraftPhotos();
});
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
  renderDraftPhotos();
  if (bad) note.textContent = bad + (bad === 1 ? ' photo' : ' photos') + ' could not be read. Use JPG or PNG photos.';
  else if (skipped) note.textContent = 'Only 10 photos fit on one listing. The rest were left out.';
});
function autoTitle(kind, sub, d, areaTxt, place) {
  let t;
  if (kind === 'land') t = (areaTxt ? areaTxt + ' land' : 'Land');
  else if (kind === 'house') t = d.bedrooms ? d.bedrooms + ' bedroom house' : 'House';
  else if (kind === 'flat') t = sub && sub !== 'Other' ? (sub === 'Studio' ? 'Studio flat' : sub + ' flat') : 'Flat';
  else if (kind === 'room') t = sub && sub !== 'Other' ? sub : 'Room';
  else if (kind === 'shutter') t = areaTxt ? areaTxt + ' shutter' : 'Shutter';
  else t = sub && sub !== 'Other' ? sub : 'Commercial property';
  return (t + (place ? ' in ' + place : '')).slice(0, 90);
}
$('#editForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#f_err');
  const bad = m => { err.textContent = m; err.hidden = false; };
  const kind = formKind(), K = KINDS[kind];
  if (!K) return bad('Choose what it is first: land, house, flat and so on.');
  if (!draft.deal) return bad('Choose For sale or For rent.');
  const cat = catOf(draft.type), rent = draft.deal === 'rent';
  const areaRaw = $('#f_area').value.trim(), av = parseFloat(areaRaw.replace(/,/g, ''));
  if (areaRaw && !(av > 0)) return bad(K.size + ' must be a number, for example ' + (K.sizePh || '4') + '.');
  const unit = UNITS[$('#f_unit').value] ? $('#f_unit').value : K.unit;
  const pv = $('#f_price').value.trim();
  const price = pv ? parseMoney(pv, rent) : { value: 0 };
  if (!price) return bad(rent ? 'The rent could not be read. Type a number such as 35000.' : 'The price could not be read. Type a number such as 65 lakh or 6500000.');
  const perMode = !!K.perUnit && !rent && $('#f_pmode').value === 'unit' && price.value > 0;
  if (perMode && !(av > 0)) return bad('Add the land size so the total price can be worked out from the price per ' + UNITS[rateUnit(unit)][0] + '.');
  const builtRaw = K.built ? $('#f_built').value.trim() : '', bv = parseFloat(builtRaw.replace(/,/g, ''));
  if (builtRaw && !(bv > 0)) return bad('Built-up area must be a number, for example 2400.');
  const depRaw = rent ? $('#f_deposit').value.trim() : '';
  const dep = depRaw ? parseMoney(depRaw, true) : { value: 0 };
  if (!dep) return bad('The deposit could not be read. Type a number such as 70000.');
  const social = postUrl($('#f_social').value);
  if (social === null) return bad('The post link could not be read. Paste the full link from Facebook, Instagram or TikTok. It starts with https://');
  // Only the facts that belong to this category and deal are saved. Anything else is cleared.
  const d = {};
  for (const k of fieldsOf(K, rent)) {
    const f = FIELDS[k], raw = draft.d[k], v = cleanVal(f, raw);
    if ((f.t === 'num' || f.t === 'int') && raw != null && String(raw).trim() !== '' && v == null) {
      return bad(f.year ? 'Built year must be a year, for example 2078 or 2021.' : labelOf(k, K) + ' must be a number' + (f.ph ? ', for example ' + f.ph : '') + '.');
    }
    if (v != null) d[k] = v;
  }
  const c = parseCoords($('#f_coords').value);
  if (c && (draft.lat == null || Math.abs(c.lat - draft.lat) > 0.00002 || Math.abs(c.lng - draft.lng) > 0.00002)) setDraftSpot(c.lat, c.lng, true, true);
  if (draft.lat == null || draft.lng == null) return bad('Tap the map or paste the location so the pin can be placed.');
  const old = draft.id ? byId(draft.id) : null;
  const id = draft.id || uuid();
  const place = $('#f_place').value.trim();
  const sub = K.sub && K.sub[1].indexOf($('#f_sub').value) >= 0 ? $('#f_sub').value : '';
  const area = { v: av > 0 ? av : 0, u: unit };
  const total = perMode ? Math.round(price.value * av * UNITS[unit][1] / UNITS[rateUnit(unit)][1]) : price.value;
  const title = $('#f_title').value.trim() || autoTitle(kind, sub, d, areaText({ area: area }), place.split(',')[0].trim());
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
      ph.url = pub.data.publicUrl; ph.fresh = true;
    }
    const item = {
      id: id, type: cat.id, deal: draft.deal, sub: sub, title: title, price: total, rateMode: perMode, area: area,
      built: { v: K.built && bv > 0 ? bv : 0, u: $('#f_builtUnit').value === 'sqm' ? 'sqm' : 'sqft' }, deposit: dep.value, social: social, d: d,
      place: place, district: DISTRICT, lat: draft.lat, lng: draft.lng, desc: $('#f_desc').value.trim(), photos: urls,
      status: STATUSES.indexOf($('#f_status').value) >= 0 ? $('#f_status').value : 'available'
    };
    const row = toRow(item);
    // "featured" is only sent when it is on or being switched off, so saving still works before the database has that column.
    item.featured = $('#f_featured').checked;
    if (item.featured || (old && old.featured)) row.featured = item.featured;
    // Editing changes the saved row; it never adds a second copy. Adding inserts one new row.
    const r = old ? await sb.from('listings').update(row).eq('id', id).select() : await sb.from('listings').insert(row).select();
    if (r.error) throw r.error;
    if (old && Array.isArray(r.data) && !r.data.length) throw { code: '42501', message: 'not allowed' };
    const saved = r.data && r.data[0] ? fromRow(r.data[0]) : fromRow(Object.assign({ created_at: old ? old.added : new Date().toISOString() }, row));
    saved.featured = item.featured;
    draft.photos.forEach(ph => { ph.fresh = false; });
    if (old) { removePhotos(old.photos.filter(u => urls.indexOf(u) < 0)); state.listings = state.listings.map(x => x.id === id ? saved : x); }
    else state.listings.unshift(saved);
  }, old ? 'Listing updated.' : 'Listing published.');
  if (ok) dlgEdit.close();
});
// Closing the form without saving: photos uploaded during a failed save are not left behind in storage.
dlgEdit.addEventListener('close', () => { if (draft) { removePhotos(draft.photos.filter(p => p.fresh).map(p => p.url)); draft.photos.forEach(p => { p.fresh = false; }); } });

/* ---------- categories ---------- */
function renderCats() {
  $('#catList').innerHTML = state.cats.map(c => {
    const n = state.listings.filter(l => l.type === c.id).length;
    return '<li style="--c:' + cvar(c) + '">' + kindIcon(kindOf(c)) + '<span class="cn">' + esc(catName(c)) + '</span><span class="hint">' + KIND_NAMES[kindOf(c)] + ' form · ' + n + (n === 1 ? ' listing' : ' listings') + '</span>' +
      (n === 0 && !DEF_CATS.some(d => d.id === c.id) ? '<button class="btn small" type="button" data-rmcat="' + esc(c.id) + '">Remove</button>' : '') + '</li>';
  }).join('');
}
$('#catBtn').addEventListener('click', () => { $('#c_name').value = ''; $('#c_form').value = 'land'; $('#c_err').hidden = true; renderCats(); show(dlgCats); });
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
  const form = KINDS[$('#c_form').value] ? $('#c_form').value : 'land';
  const used = state.cats.map(c => c.color || 1);
  let color = 1; while (used.indexOf(color) >= 0 && color < 8) color++;
  const row = { id: 'c' + Date.now().toString(36), label: name, deal: KINDS[form].deals[0], color: color, shape: state.cats.length % SHAPES.length, no_rate: form !== 'land', sort: state.cats.reduce((m, c) => Math.max(m, c.sort || 0), 0) + 1, form: form };
  const ok = await mutate(err, async () => {
    const r = await sb.from('categories').insert(row);
    if (r.error) throw r.error;
    state.cats.push(catFromRow(row));
  }, 'Category added.');
  if (ok) { $('#c_name').value = ''; renderCats(); }
});

/* ---------- site settings ---------- */
function openSite() {
  const s = state.site;
  $('#s_name').value = s.name || ''; $('#s_owner').value = s.owner || ''; $('#s_tag').value = s.tagline || '';
  $('#s_phone').value = s.phone || ''; $('#s_whatsapp').value = s.whatsapp || '';
  $('#s_fb').value = s.facebook || ''; $('#s_ig').value = s.instagram || ''; $('#s_tt').value = s.tiktok || '';
  $('#s_about').value = s.about || '';
  $('#s_howto').value = s.howto || '';
  $('#s_err').hidden = true;
  show(dlgSite);
}
$('#siteForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#s_err');
  const v = id => $(id).value.trim();
  const fields = [['facebook', v('#s_fb'), 'Facebook'], ['instagram', v('#s_ig'), 'Instagram'], ['tiktok', v('#s_tt'), 'TikTok']];
  for (const f of fields) if (f[1] && !socialUrl(f[0], f[1])) { err.textContent = 'The ' + f[2] + ' link could not be read. Paste the full link or just the page name.'; err.hidden = false; return; }
  const wa = v('#s_whatsapp');
  if (wa && !waUrl(wa)) { err.textContent = 'The WhatsApp number looks too short. Include the country code, for example 97798XXXXXXXX.'; err.hidden = false; return; }
  const how = postUrl(v('#s_howto'));
  if (how === null) { err.textContent = 'The “How to use” video link could not be read. Paste the full link. It starts with https://'; err.hidden = false; return; }
  const next = { howto: how, name: v('#s_name') || DEF_SITE.name, owner: v('#s_owner'), tagline: v('#s_tag'), phone: v('#s_phone'), whatsapp: wa, facebook: fields[0][1], instagram: fields[1][1], tiktok: fields[2][1], about: v('#s_about') };
  const ok = await mutate(err, async () => {
    const r = await sb.from('site').upsert({ id: 1, data: next, updated_at: new Date().toISOString() });
    if (r.error) throw r.error;
    state.site = Object.assign({}, DEF_SITE, next);
  }, 'Site settings saved.');
  if (ok) dlgSite.close();
});

/* ---------- dialogs: close buttons and backdrop ---------- */
[dlgDetail, dlgContact, dlgEdit, dlgSite, dlgCats, dlgLogin, dlgManage, dlgMenu, dlgHelp, dlgInterest, dlgLeads, dlgChat, dlgProfile].forEach(d => {
  d.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { d.close(); return; }
    if (e.target === d && (d === dlgDetail || d === dlgContact || d === dlgMenu || d === dlgHelp || d === dlgChat)) d.close();
  });
});
[dlgDetail, dlgContact, dlgEdit, dlgSite, dlgCats, dlgLogin, dlgManage, dlgConfirm, dlgMenu, dlgHelp, dlgInterest, dlgLeads, dlgChat, dlgProfile].forEach(d => {
  d.addEventListener('close', () => {
    const i = stack.indexOf(d); if (i >= 0) stack.splice(i, 1);
    const t = $('#toast'); if (t.parentNode === d) (stack[stack.length - 1] || document.body).appendChild(t);
  });
});

/* ---------- boot ---------- */
function renderAll() { renderHeader(); renderLegend(); renderList(); if (dlgManage.open) renderManage(); }
function openFromUrl() {
  const m = /property\/([\w-]+)\/?$/.exec(location.pathname) || /^#p-([\w-]+)$/.exec(location.hash || '');
  if (!m) return;
  const l = byId(m[1]);
  if (l) { map.setView([l.lat, l.lng], 16); openDetail(l.id); }
  else { setUrl(''); toast('That property is no longer listed. Here is everything that is available.'); }
}
renderHeader(); renderLegend();
(async function boot() {
  try { await loadAll(); }
  catch (e) {
    console.error(e);
    $('#cards').innerHTML = '<li class="empty">The listings could not be loaded. If this is a new site, the database is not set up yet: run database-update.sql in Supabase (SQL Editor), then reload. Otherwise check your connection and reload.</li>';
    renderHeader(); renderLegend();
    checkOwner();
    return;
  }
  renderAll();
  // The owner may be opening a hidden listing, so wait for the sign-in check before giving up on the address.
  if (/property\/[\w-]+\/?$/.test(location.pathname) || /^#p-/.test(location.hash || '')) {
    const m = /property\/([\w-]+)\/?$/.exec(location.pathname) || /^#p-([\w-]+)$/.exec(location.hash);
    const after = () => { if (cameBack && customer && dlgDetail.open) openInterest($('#detailBody').dataset.id); };
    if (m && byId(m[1])) { openFromUrl(); checkOwner().then(after).then(countVisit); } else checkOwner().then(openFromUrl).then(after).then(countVisit);
  } else checkOwner().then(() => {
    countVisit();
    if (location.hash === '#owner' && !owner) openLogin();
    if (fromAuth && owner) toast('Signed in as the owner. Owner tools are at the bottom.');
    else if (fromAuth && customer) toast('Signed in as ' + customer.name + '.');
  });
  // GPS when the map opens: show the blue dot, keep the whole area in view.
  locate(() => {}, true);
  fetch('/api/explain').then(r => r.ok ? r.json() : null).then(j => { aiOn = !!(j && j.enabled); if (aiOn && budget) $('#aiBox').hidden = false; }).catch(() => {});
})();
})();
