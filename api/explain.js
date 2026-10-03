// Optional AI explanation for the budget helper. Runs on Vercel as a serverless function.
// It stays switched off until you add GEMINI_API_KEY in Vercel > Project > Settings > Environment Variables.
// GEMINI_MODEL is optional; set it to the model name shown in Google AI Studio if the default stops working.
// NOTE: this file has not been tested against the live Google API. The site works fully without it.

const lakh = n => {
  n = Number(n) || 0;
  if (n >= 1e7) return (Math.round(n / 1e5) / 100) + ' crore';
  if (n >= 1e5) return (Math.round(n / 1e3) / 100) + ' lakh';
  return String(Math.round(n));
};

module.exports = async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (req.method === 'GET') return res.status(200).json({ enabled: !!key });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!key) return res.status(501).json({ error: 'not_configured' });

  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const budget = Number(b.budget);
  const listings = Array.isArray(b.listings) ? b.listings.slice(0, 60) : [];
  if (!(budget > 0) || !listings.length) return res.status(400).json({ error: 'bad_request' });
  const text = v => String(v == null ? '' : v).slice(0, 300);
  const rows = listings.map(l => ({
    title: text(l.title), category: text(l.category), deal: text(l.deal), price_npr: Number(l.price_npr) || null,
    price_per_land_unit: text(l.price_per_land_unit), size: text(l.size), place: text(l.place), district: text(l.district), notes: text(l.notes)
  }));

  const prompt =
    'You help a visitor on a small real-estate website in Nepal choose a property that fits their money.\n' +
    'Use ONLY the listings below. Prices are in Nepali rupees (1 lakh = 100,000 and 1 crore = 10,000,000). ' +
    'In Nepal buyers compare land by its price per anna (hills) or per dhur or kattha (Terai).\n\n' +
    'Visitor budget: NPR ' + Math.round(budget) + ' (' + lakh(budget) + ')' + (b.perMonth ? ' per month' : '') + '.\n' +
    'Looking for: ' + text(b.looking || 'anything to buy') + (b.district ? ' in ' + text(b.district) + ' district' : '') + '.\n' +
    'What the visitor says they want it for: ' + (b.want ? JSON.stringify(text(b.want)) : '(not given)') + '\n\n' +
    'Listings (JSON):\n' + JSON.stringify(rows) + '\n\n' +
    'Write under 130 words in very simple words and short sentences that a first-time buyer understands. No jargon, no markdown, no bullet symbols. ' +
    'Say which one to three listings fit best and why, how much money is left over, and one thing to check before buying, such as road access or ownership papers. ' +
    'If nothing fits, say so kindly and name the cheapest option. Do not invent listings, prices, taxes or legal facts. ' +
    'End by telling them to talk to the owner for details. If the visitor wrote in Nepali, answer in Nepali.';

  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 500 } })
    });
    const j = await r.json().catch(() => null);
    const parts = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    const out = Array.isArray(parts) ? parts.map(p => p.text || '').join('').trim() : '';
    if (!r.ok || !out) return res.status(502).json({ error: 'ai_failed' });
    return res.status(200).json({ text: out });
  } catch (e) {
    return res.status(502).json({ error: 'ai_failed' });
  }
};
