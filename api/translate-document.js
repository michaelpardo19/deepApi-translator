// /api/translate-document.js
// Handles document upload → DeepL translation → download
// Uses formidable to parse multipart in memory (no disk writes — Vercel compatible)

import formidable from 'formidable';
import fs from 'fs';

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

function getBaseUrl() {
  return DEEPL_API_KEY && DEEPL_API_KEY.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2'
    : 'https://api.deepl.com/v2';
}

// Vercel requires this to disable the default body parser for file uploads
export const config = {
  api: { bodyParser: false },
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10 MB
      keepExtensions: true,
    });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

  let tempFilePath = null;

  try {
    // ── 1. Parse the uploaded file ──
    const { fields, files } = await parseForm(req);

    const fileEntry = files.file;
    const file = Array.isArray(fileEntry) ? fileEntry[0] : fileEntry;

    if (!file) {
      return res.status(400).json({ error: 'No file received.' });
    }

    tempFilePath = file.filepath;

    const target_lang = Array.isArray(fields.target_lang)
      ? fields.target_lang[0]
      : fields.target_lang;
    const source_lang = Array.isArray(fields.source_lang)
      ? fields.source_lang[0]
      : fields.source_lang;

    if (!target_lang) {
      return res.status(400).json({ error: 'target_lang is required.' });
    }

    const originalName = file.originalFilename || 'document';

    // ── 2. Upload document to DeepL ──
    const uploadForm = new FormData();
    const fileBuffer = fs.readFileSync(tempFilePath);
    const blob = new Blob([fileBuffer], { type: file.mimetype || 'application/octet-stream' });
    uploadForm.append('file', blob, originalName);
    uploadForm.append('target_lang', target_lang);
    if (source_lang && source_lang !== 'auto') {
      uploadForm.append('source_lang', source_lang);
    }

    const uploadRes = await fetch(`${getBaseUrl()}/document`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}` },
      body: uploadForm,
    });

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      return res.status(uploadRes.status).json({
        error: uploadData.message || 'Failed to upload document to DeepL.',
      });
    }

    const { document_id, document_key } = uploadData;

    // ── 3. Poll until translation is done ──
    let status = 'queued';
    let attempts = 0;
    const maxAttempts = 60;

    while (status === 'queued' || status === 'translating') {
      await sleep(1500);
      attempts++;

      const statusRes = await fetch(`${getBaseUrl()}/document/${document_id}`, {
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
        return res.status(500).json({
          error: statusData.error_message || 'DeepL returned an error during translation.',
        });
      }

      if (attempts >= maxAttempts) {
        return res.status(408).json({ error: 'Translation timed out. Please try again.' });
      }
    }

    // ── 4. Download the translated document ──
    const downloadRes = await fetch(`${getBaseUrl()}/document/${document_id}/result`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ document_key }),
    });

    if (!downloadRes.ok) {
      return res.status(500).json({ error: 'Failed to download translated document from DeepL.' });
    }

    // ── 5. Stream the translated file back to the browser ──
    const ext = originalName.includes('.') ? originalName.split('.').pop() : '';
    const baseName = originalName.includes('.')
      ? originalName.slice(0, originalName.lastIndexOf('.'))
      : originalName;
    const translatedName = `${baseName}_${target_lang}${ext ? '.' + ext : ''}`;

    const contentType =
      downloadRes.headers.get('content-type') || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${translatedName}"`
    );

    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.status(200).send(buffer);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  } finally {
    // Clean up temp file if it exists
    if (tempFilePath) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
  }
}
