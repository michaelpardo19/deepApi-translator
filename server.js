require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

// DeepL Free API uses api-free.deepl.com
// DeepL Pro API uses api.deepl.com
// We detect automatically based on the key suffix ":fx" = Free
function getDeepLBaseUrl() {
  if (DEEPL_API_KEY && DEEPL_API_KEY.endsWith(':fx')) {
    return 'https://api-free.deepl.com/v2';
  }
  return 'https://api.deepl.com/v2';
}

// Multer setup for document uploads (temp storage)
const upload = multer({
  dest: path.join(__dirname, 'uploads/'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────
// GET /api/languages — list supported languages
// ─────────────────────────────────────────
app.get('/api/languages', async (req, res) => {
  if (!DEEPL_API_KEY || DEEPL_API_KEY === 'your_api_key_here') {
    return res.status(500).json({ error: 'API key not configured. Edit your .env file.' });
  }

  try {
    const [sourceLangs, targetLangs] = await Promise.all([
      fetch(`${getDeepLBaseUrl()}/languages?type=source`, {
        headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}` },
      }),
      fetch(`${getDeepLBaseUrl()}/languages?type=target`, {
        headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}` },
      }),
    ]);

    const source = await sourceLangs.json();
    const target = await targetLangs.json();

    res.json({ source, target });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch languages: ' + err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/translate — translate text
// ─────────────────────────────────────────
app.post('/api/translate', async (req, res) => {
  if (!DEEPL_API_KEY || DEEPL_API_KEY === 'your_api_key_here') {
    return res.status(500).json({ error: 'API key not configured. Edit your .env file.' });
  }

  const { text, source_lang, target_lang } = req.body;

  if (!text || !target_lang) {
    return res.status(400).json({ error: 'Missing required fields: text, target_lang' });
  }

  try {
    const body = {
      text: [text],
      target_lang: target_lang,
    };
    if (source_lang && source_lang !== 'auto') {
      body.source_lang = source_lang;
    }

    const response = await fetch(`${getDeepLBaseUrl()}/translate`, {
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

    res.json({
      translation: data.translations[0].text,
      detected_source_language: data.translations[0].detected_source_language,
    });
  } catch (err) {
    res.status(500).json({ error: 'Translation failed: ' + err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/translate-document — upload & translate a document
// ─────────────────────────────────────────
app.post('/api/translate-document', upload.single('file'), async (req, res) => {
  if (!DEEPL_API_KEY || DEEPL_API_KEY === 'your_api_key_here') {
    return res.status(500).json({ error: 'API key not configured. Edit your .env file.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { source_lang, target_lang } = req.body;

  if (!target_lang) {
    return res.status(400).json({ error: 'target_lang is required' });
  }

  try {
    // Step 1: Upload document to DeepL
    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path), req.file.originalname);
    form.append('target_lang', target_lang);
    if (source_lang && source_lang !== 'auto') {
      form.append('source_lang', source_lang);
    }

    const uploadRes = await fetch(`${getDeepLBaseUrl()}/document`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      fs.unlinkSync(req.file.path);
      return res.status(uploadRes.status).json({ error: uploadData.message || 'Upload failed' });
    }

    const { document_id, document_key } = uploadData;

    // Step 2: Poll for completion
    let status = 'translating';
    let attempts = 0;
    const maxAttempts = 60; // max ~60 seconds

    while (status === 'translating' || status === 'queued') {
      await new Promise((r) => setTimeout(r, 1500));
      attempts++;

      const statusRes = await fetch(`${getDeepLBaseUrl()}/document/${document_id}`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_key }),
      });

      const statusData = await statusRes.json();
      status = statusData.status;

      if (status === 'error') {
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: statusData.error_message || 'Translation error' });
      }

      if (attempts >= maxAttempts) {
        fs.unlinkSync(req.file.path);
        return res.status(408).json({ error: 'Translation timed out. Try again.' });
      }
    }

    // Step 3: Download translated document
    const downloadRes = await fetch(`${getDeepLBaseUrl()}/document/${document_id}/result`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ document_key }),
    });

    fs.unlinkSync(req.file.path); // clean up temp file

    if (!downloadRes.ok) {
      return res.status(500).json({ error: 'Failed to download translated document' });
    }

    // Stream file back to client
    const originalName = req.file.originalname;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const translatedName = `${baseName}_${target_lang}${ext}`;

    res.setHeader('Content-Disposition', `attachment; filename="${translatedName}"`);
    res.setHeader('Content-Type', downloadRes.headers.get('content-type') || 'application/octet-stream');
    downloadRes.body.pipe(res);

  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Document translation failed: ' + err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/usage — check account usage
// ─────────────────────────────────────────
app.get('/api/usage', async (req, res) => {
  if (!DEEPL_API_KEY || DEEPL_API_KEY === 'your_api_key_here') {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch(`${getDeepLBaseUrl()}/usage`, {
      headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}` },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ensure uploads directory exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

app.listen(PORT, () => {
  console.log(`\n✅ DeepL Translator running at http://localhost:${PORT}`);
  console.log(`\n⚠️  Make sure your .env file has DEEPL_API_KEY set.`);
  console.log(`   Copy .env.example to .env and add your key.\n`);
});
