// /api/translate.js
// Translates text via DeepL API

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

function getBaseUrl() {
  return DEEPL_API_KEY && DEEPL_API_KEY.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2'
    : 'https://api.deepl.com/v2';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!DEEPL_API_KEY) {
    return res.status(500).json({ error: 'DEEPL_API_KEY not set in environment variables.' });
  }

  const { text, source_lang, target_lang } = req.body;

  if (!text || !target_lang) {
    return res.status(400).json({ error: 'Missing required fields: text, target_lang' });
  }

  try {
    const body = { text: [text], target_lang };
    if (source_lang && source_lang !== 'auto') body.source_lang = source_lang;

    const response = await fetch(`${getBaseUrl()}/translate`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'DeepL API error' });
    }

    return res.status(200).json({
      translation: data.translations[0].text,
      detected_source_language: data.translations[0].detected_source_language,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
