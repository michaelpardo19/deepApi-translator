// /api/languages.js
// Returns supported source and target languages from DeepL

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

function getBaseUrl() {
  return DEEPL_API_KEY && DEEPL_API_KEY.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2'
    : 'https://api.deepl.com/v2';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!DEEPL_API_KEY) {
    return res.status(500).json({ error: 'DEEPL_API_KEY not set in environment variables.' });
  }

  try {
    const [srcRes, tgtRes] = await Promise.all([
      fetch(`${getBaseUrl()}/languages?type=source`, {
        headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}` },
      }),
      fetch(`${getBaseUrl()}/languages?type=target`, {
        headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}` },
      }),
    ]);

    if (!srcRes.ok || !tgtRes.ok) {
      const err = await (srcRes.ok ? tgtRes : srcRes).json().catch(() => ({}));
      return res.status(502).json({ error: err.message || 'DeepL API error fetching languages.' });
    }

    const source = await srcRes.json();
    const target = await tgtRes.json();

    return res.status(200).json({ source, target });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
