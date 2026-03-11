// ── STATE ──
let sourceLangs = [];
let targetLangs = [];
let selectedDocFile = null;
let docBlobUrl = null;
let docFileName = null;

// ── TABS ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    hideStatus();
  });
});

// ── STATUS ──
function showStatus(type, msg) {
  const bar = document.getElementById('statusBar');
  const txt = document.getElementById('statusText');
  bar.className = 'status-bar visible ' + type;
  txt.textContent = msg;
}

function hideStatus() {
  document.getElementById('statusBar').className = 'status-bar';
}

// ── LOAD LANGUAGES ──
async function loadLanguages() {
  try {
    const res = await fetch('/api/languages');
    const data = await res.json();

    if (data.error) {
      showStatus('error', '⚠ ' + data.error);
      return;
    }

    sourceLangs = data.source;
    targetLangs = data.target;

    populateSelects();
    loadUsage();
  } catch (e) {
    showStatus('error', 'No se pudo conectar con el servidor. ¿Está corriendo node server.js?');
  }
}

function populateSelects() {
  const srcSel = document.getElementById('srcLang');
  const tgtSel = document.getElementById('tgtLang');
  const docSrc = document.getElementById('docSrcLang');
  const docTgt = document.getElementById('docTgtLang');

  sourceLangs.forEach(l => {
    const opt = new Option(l.name, l.language);
    srcSel.add(opt.cloneNode(true));
    docSrc.add(opt);
  });

  targetLangs.forEach(l => {
    const opt = new Option(l.name, l.language);
    tgtSel.add(opt.cloneNode(true));
    docTgt.add(opt);
  });

  // Defaults
  const setDefault = (sel, val) => {
    const opt = Array.from(sel.options).find(o => o.value === val);
    if (opt) sel.value = val;
  };

  setDefault(tgtSel, 'ES');
  setDefault(docTgt, 'ES');
  setDefault(srcSel, 'auto');
}

// ── USAGE ──
async function loadUsage() {
  try {
    const res = await fetch('/api/usage');
    const data = await res.json();
    if (data.character_count !== undefined) {
      const used = data.character_count.toLocaleString();
      const limit = data.character_limit.toLocaleString();
      const pct = Math.round(data.character_count / data.character_limit * 100);
      document.getElementById('usageBadge').innerHTML =
        `<span>${used}</span> / ${limit} chars (${pct}%)`;
    }
  } catch (e) {
    document.getElementById('usageBadge').textContent = 'Uso no disponible';
  }
}

// ── CHAR COUNT ──
const inputText = document.getElementById('inputText');
const charCount = document.getElementById('charCount');

inputText.addEventListener('input', () => {
  const len = inputText.value.length;
  charCount.textContent = `${len.toLocaleString()} / 5,000`;
  charCount.classList.toggle('warn', len > 4000);
});

// ── CLEAR ──
document.getElementById('clearBtn').addEventListener('click', () => {
  inputText.value = '';
  document.getElementById('outputText').value = '';
  document.getElementById('copyBtn').style.display = 'none';
  document.getElementById('detectedLang').style.display = 'none';
  charCount.textContent = '0 / 5,000';
  charCount.classList.remove('warn');
  hideStatus();
});

// ── SWAP ──
document.getElementById('swapBtn').addEventListener('click', () => {
  const src = document.getElementById('srcLang');
  const tgt = document.getElementById('tgtLang');
  const output = document.getElementById('outputText').value;

  const prevSrc = src.value;
  const prevTgt = tgt.value;

  // Try to set source to previous target (may not be in source list)
  const srcOpt = Array.from(src.options).find(o => o.value === prevTgt || o.value === prevTgt.split('-')[0]);
  if (srcOpt) src.value = srcOpt.value;

  const tgtOpt = Array.from(tgt.options).find(o => o.value === prevSrc || o.value.startsWith(prevSrc));
  if (tgtOpt) tgt.value = tgtOpt.value;

  if (output) {
    inputText.value = output;
    document.getElementById('outputText').value = '';
    charCount.textContent = `${output.length.toLocaleString()} / 5,000`;
  }
});

// ── TRANSLATE TEXT ──
document.getElementById('translateBtn').addEventListener('click', translateText);
inputText.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) translateText();
});

async function translateText() {
  const text = inputText.value.trim();
  if (!text) return;

  const btn = document.getElementById('translateBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Traduciendo...';
  hideStatus();

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        source_lang: document.getElementById('srcLang').value,
        target_lang: document.getElementById('tgtLang').value,
      }),
    });

    const data = await res.json();

    if (data.error) {
      showStatus('error', data.error);
    } else {
      document.getElementById('outputText').value = data.translation;
      document.getElementById('copyBtn').style.display = 'flex';

      if (data.detected_source_language) {
        const dl = document.getElementById('detectedLang');
        const dlc = document.getElementById('detectedLangCode');
        dlc.textContent = data.detected_source_language;
        dl.style.display = 'flex';
      }

      loadUsage();
    }
  } catch (e) {
    showStatus('error', 'Error de red: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 4h5M4 2v2M7 4c0 3-2 5-5 6M5 8c1 1 3 2 4 2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 12l2-5 2 5M10 10.5h2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Traducir`;
  }
}

// ── COPY ──
document.getElementById('copyBtn').addEventListener('click', () => {
  const text = document.getElementById('outputText').value;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 6l-5 5-2.5-2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Copiado`;
    setTimeout(() => {
      btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="8" height="8" rx="1" stroke-linecap="round"/><path d="M3 11V3h8" stroke-linecap="round" stroke-linejoin="round"/></svg> Copiar`;
    }, 1500);
  });
});

// ── DOCUMENT DROP ZONE ──
const dropZone = document.getElementById('dropZone');
const docFileInput = document.getElementById('docFile');

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) selectDocFile(file);
});

docFileInput.addEventListener('change', () => {
  if (docFileInput.files[0]) selectDocFile(docFileInput.files[0]);
});

function selectDocFile(file) {
  selectedDocFile = file;
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatBytes(file.size);
  document.getElementById('fileSelected').classList.add('visible');
  hideStatus();
  resetDocResult();
}

document.getElementById('removeFile').addEventListener('click', () => {
  selectedDocFile = null;
  docFileInput.value = '';
  document.getElementById('fileSelected').classList.remove('visible');
  resetDocResult();
});

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function resetDocResult() {
  document.getElementById('resultPlaceholder').style.display = '';
  document.getElementById('resultReady').classList.remove('visible');
  document.getElementById('progressArea').style.display = 'none';
  docBlobUrl = null;
}

// ── TRANSLATE DOCUMENT ──
document.getElementById('docTranslateBtn').addEventListener('click', translateDocument);

async function translateDocument() {
  if (!selectedDocFile) {
    showStatus('error', 'Selecciona un documento primero.');
    return;
  }

  const btn = document.getElementById('docTranslateBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Procesando...';
  hideStatus();

  document.getElementById('resultPlaceholder').style.display = 'none';
  document.getElementById('resultReady').classList.remove('visible');

  const progressArea = document.getElementById('progressArea');
  const progressFill = document.getElementById('progressFill');
  const progressLabel = document.getElementById('progressLabel');

  progressArea.style.display = 'block';
  progressLabel.textContent = 'Subiendo archivo a DeepL...';
  progressFill.style.width = '15%';

  const formData = new FormData();
  formData.append('file', selectedDocFile, selectedDocFile.name);
  formData.append('source_lang', document.getElementById('docSrcLang').value);
  formData.append('target_lang', document.getElementById('docTgtLang').value);

  try {
    progressFill.style.width = '40%';
    progressLabel.textContent = 'Traduciendo... (puede tardar unos segundos)';

    const res = await fetch('/api/translate-document', {
      method: 'POST',
      body: formData,
    });

    progressFill.style.width = '90%';

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    // Get filename from header or build it
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const tgtLang = document.getElementById('docTgtLang').value;
    const ext = selectedDocFile.name.split('.').pop();
    const base = selectedDocFile.name.replace(/\.[^/.]+$/, '');
    docFileName = match ? match[1] : `${base}_${tgtLang}.${ext}`;

    const blob = await res.blob();
    docBlobUrl = URL.createObjectURL(blob);

    progressFill.style.width = '100%';
    progressLabel.textContent = '¡Traducción completada!';

    setTimeout(() => {
      progressArea.style.display = 'none';
      document.getElementById('resultName').textContent = docFileName;
      document.getElementById('resultReady').classList.add('visible');
    }, 500);

    loadUsage();
  } catch (e) {
    progressArea.style.display = 'none';
    document.getElementById('resultPlaceholder').style.display = '';
    showStatus('error', 'Error: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 4h5M4 2v2M7 4c0 3-2 5-5 6M5 8c1 1 3 2 4 2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 12l2-5 2 5M10 10.5h2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Traducir documento`;
  }
}

// ── DOWNLOAD ──
document.getElementById('downloadBtn').addEventListener('click', () => {
  if (!docBlobUrl) return;
  const a = document.createElement('a');
  a.href = docBlobUrl;
  a.download = docFileName || 'translated_document';
  a.click();
});

// ── INIT ──
loadLanguages();
