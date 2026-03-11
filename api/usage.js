// /api/usage.js
// Returns current character usage for the DeepL account

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
    const response = await fetch(`${getBaseUrl()}/usage`, {
      headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}` },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'DeepL API error' });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
