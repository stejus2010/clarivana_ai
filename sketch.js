let cameraInput;
let extractedTextElement;
let harmfulIngredientsData = {};
let currentUserPlan = 'free';
let scanCount = 0;
let analysisCount = 0;

fetch('ingredients_pro_mode.json')
  .then(r => r.json())
  .then(data => harmfulIngredientsData = data.harmfulIngredients || {})
  .catch(err => console.error('ingredients.json load err', err));

function setup() {
  noCanvas();
  extractedTextElement = document.getElementById('extracted-text');

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const doc = await db.collection('users').doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        currentUserPlan = data.plan || 'free';
        scanCount = data.scansToday || 0;
        analysisCount = data.analysisToday || 0;
      } else currentUserPlan = 'free';
    } else currentUserPlan = 'free';
    updateUsageUI();
  });
}

// 🎥 Start Camera
function startCamera() {
  const constraints = { video: { facingMode: "environment" } };
  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      const video = document.createElement('video');
      video.id = 'camera';
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;
      video.style.cssText = 'width:100%;height:calc(100vh - 180px);object-fit:contain;border-radius:12px';

      const container = document.getElementById('video-container');
      container.innerHTML = '';
      container.appendChild(video);
      cameraInput = video;

      const ids = ['scan-button','gallery-button','gallery-input','edit-button','save-button'];
      const [scanBtn, galBtn, galInput, editBtn, saveBtn] = ids.map(id => document.getElementById(id));

      if (scanBtn) scanBtn.onclick = captureImage;
      if (galBtn) galBtn.onclick = () => galInput.click();
      if (galInput) galInput.onchange = e => { if (e.target.files[0]) processGalleryImage(e.target.files[0]); };
      if (editBtn) editBtn.onclick = enableEditing;
      if (saveBtn) saveBtn.onclick = saveChanges;
    })
    .catch(err => console.error('camera err', err));
}

// 📊 Usage UI
function updateUsageUI() {
  const maxScans = 20000, maxAI = 20000;
  const scanProg = document.getElementById('scan-progress');
  const aiProg = document.getElementById('ai-progress');
  const scanTxt = document.getElementById('scan-text');
  const aiTxt = document.getElementById('ai-text');
  const premSec = document.querySelector('.premium-section');

  if (scanProg) { scanProg.value = scanCount; scanProg.max = maxScans; }
  if (aiProg) { aiProg.value = analysisCount; aiProg.max = maxAI; }
  if (scanTxt) scanTxt.textContent = `${scanCount}/${maxScans} Scans Today`;
  if (aiTxt) aiTxt.textContent = `${analysisCount}/${maxAI} AI Analyses Today`;
  if (premSec) premSec.style.display = currentUserPlan === 'premium' ? 'none' : 'block';

  const usageTxt = document.getElementById('usage-text');
  const progBar = document.getElementById('usage-progress');
  if (usageTxt && progBar) {
    const total = scanCount + analysisCount;
    const limit = currentUserPlan === 'premium' ? 1 : (maxScans + maxAI);
    const pct = currentUserPlan === 'premium' ? 100 : Math.min((total / limit) * 100, 100);
    progBar.style.width = pct + '%';
    progBar.style.background = pct >= 100 ? '#ff4d4d' : '#00c6ff';
    usageTxt.textContent = currentUserPlan === 'premium'
      ? 'Unlimited access for Premium users 🏆'
      : `Used ${total}/${limit} actions today`;
  }
}

// 🧠 Limit Check
async function checkScanLimit(type = 'scan') {
  const user = auth.currentUser;
  if (!user) {
    Swal.fire({ icon: 'info', title: 'Login Required 🔐', text: 'Please log in to use Clarivana\'s scanning features.', confirmButtonText: 'Got it', customClass: { popup: 'swal-account' } });
    return false;
  }

  const docRef = db.collection('users').doc(user.uid);
  const docSnap = await docRef.get();
  const today = new Date().toISOString().split('T')[0];
  let data = docSnap.exists ? docSnap.data() : null;

  if (!data) {
    await docRef.set({ plan: 'free', scansToday: 0, analysisToday: 0, lastScanDate: today });
    data = { plan: 'free', scansToday: 0, analysisToday: 0, lastScanDate: today };
  }
  if (data.lastScanDate !== today) {
    await docRef.update({ scansToday: 0, analysisToday: 0, lastScanDate: today });
    data.scansToday = 0; data.analysisToday = 0;
  }

  const maxScans = 200000, maxAI = 200000;
  if (data.plan === 'free') {
    if (type === 'scan' && data.scansToday >= maxScans) {
      Swal.fire({ icon: 'info', title: 'Daily Scan Limit Reached', text: 'Upgrade to Premium for unlimited scans 🚀', customClass: { popup: 'swal-info' } });
      document.querySelector('.premium-section')?.scrollIntoView({ behavior: 'smooth' });
      return false;
    }
    if (type === 'ai' && data.analysisToday >= maxAI) {
      Swal.fire({ icon: 'info', title: 'Daily AI Analysis Limit Reached', text: 'Upgrade to Premium for unlimited analyses 🚀', customClass: { popup: 'swal-info' } });
      document.querySelector('.premium-section')?.scrollIntoView({ behavior: 'smooth' });
      return false;
    }
  }

  await docRef.update({
    [type === 'scan' ? 'scansToday' : 'analysisToday']: (type === 'scan' ? data.scansToday : data.analysisToday) + 1,
    lastScanDate: today
  });

  if (type === 'scan') scanCount++; else analysisCount++;
  updateUsageUI();
  return true;
}

// 📸 Capture
async function captureImage() {
  const allowed = await checkScanLimit('scan');
  if (!allowed) return;

  const canvas = document.createElement('canvas');
  canvas.width = cameraInput.videoWidth;
  canvas.height = cameraInput.videoHeight;
  canvas.getContext('2d').drawImage(cameraInput, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL();

  document.getElementById('captured-image').innerHTML = `<img src="${data}" alt="captured" style="width:100%;max-width:400px;border-radius:8px">`;
  extractTextFromImage(canvas);
}

// 🖼️ Gallery
function processGalleryImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const src = e.target.result;
    document.getElementById('captured-image').innerHTML = `<img src="${src}" alt="selected" style="width:100%;max-width:400px;border-radius:8px">`;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      extractTextFromImage(canvas);
    };
  };
  reader.readAsDataURL(file);
}

// 🔍 OCR
async function extractTextFromImage(canvasEl) {
  extractedTextElement.value = 'Recognizing...';
  const allowed = await checkScanLimit('ai');
  if (!allowed) return;

  Tesseract.recognize(canvasEl, 'eng', { logger: m => console.log(m) })
    .then(({ data }) => {
      const text = data.text || '';
      extractedTextElement.value = text;
      checkAllergiesThenHarmful(text);
      const aiBtn = document.getElementById('ai-button');
      const scanAnotherBtn = document.getElementById('scan-another');
      if (aiBtn) aiBtn.style.display = 'inline-block';
      if (scanAnotherBtn) scanAnotherBtn.style.display = 'inline-block';
    })
    .catch(err => {
      console.error('ocr err', err);
      extractedTextElement.value = '';
      Swal.fire({ icon: 'error', title: 'OCR Failed 😢', text: 'Please try again.', customClass: { popup: 'swal-error' } });
    });
}

// 🧾 Allergy Check
function checkAllergiesThenHarmful(extractedText) {
  const textLower = extractedText.toLowerCase();
  auth.onAuthStateChanged(async user => {
    let allergyAlerts = [];
    if (user) {
      const doc = await db.collection('users').doc(user.uid).get();
      if (doc.exists) {
        const allergies = doc.data().allergies || [];
        allergyAlerts = allergies.filter(a => a && textLower.includes(a.toLowerCase()));
      }
    }
    if (allergyAlerts.length > 0) {
      Swal.fire({ icon: 'warning', title: '⚠️ Allergy Alert!', text: `Contains: ${allergyAlerts.join(', ')}`, customClass: { popup: 'swal-error' } })
        .then(() => detectHarmfulIngredients(extractedText, allergyAlerts));
    } else detectHarmfulIngredients(extractedText, allergyAlerts);
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const normalize = s => s.toLowerCase()
  .replace(/\u2019/g, "'").replace(/[\u2010-\u2015]/g, '-')
  .replace(/[^a-z0-9\s\-\_]/g, ' ').replace(/\s+/g, ' ').trim();

function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  return dp[m][n];
}

function conservativeFuzzyMatch(a, b) {
  const A = a.replace(/\s+/g,'').toLowerCase();
  const B = b.replace(/\s+/g,'').toLowerCase();
  const maxLen = Math.max(A.length, B.length);
  if (maxLen < 6) return false;
  return levenshtein(A, B) / maxLen <= 0.15;
}

function hasWholePhrase(phrase, text, tokens) {
  if (!phrase?.trim()) return false;
  const p = normalize(phrase);
  if (/[0-9]/.test(p)) {
    for (const v of [p, p.replace(/\s+/g,''), p.replace(/\s+/g,'-'), p.replace(/[-_]+/g,' ')]) {
      if (new RegExp(`\\b${escapeRegex(v)}\\b`, 'i').test(text)) return true;
    }
    return false;
  }
  if (new RegExp(`\\b${escapeRegex(p)}\\b`, 'i').test(text)) return true;
  const parts = p.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    let start = 0, ok = true;
    for (const part of parts) {
      const m = new RegExp(`\\b${escapeRegex(part)}\\b`, 'i').exec(text.slice(start));
      if (!m) { ok = false; break; }
      start += m.index + part.length;
    }
    if (ok) return true;
  }
  return parts.length === 1 && tokens.has(parts[0]);
}

const GENERIC_BLACKLIST = new Set([
  'yellow','red','blue','white','black','green','natural','artificial',
  'flavour','flavor','colour','color','corn','meal','malted','barley',
  'flour','water','sugar','salt','oil','extract'
]);

// ─── Detection ───────────────────────────────────────────────────────────────
async function detectHarmfulIngredients(extractedText, allergyAlerts = []) {
  if (!extractedText?.trim()) return saveScanResult(extractedText, allergyAlerts, []);

  const text = normalize(extractedText);
  const tokens = new Set(text.split(/\s+/).filter(Boolean));
  const harmfulList = Array.isArray(harmfulIngredientsData)
    ? harmfulIngredientsData
    : (harmfulIngredientsData?.harmfulIngredients || []);

  const foundIngredients = [];
  const foundIds = new Set();

  for (const ing of harmfulList) {
    if (!ing?.name) continue;
    const candidates = [ing.name, ing.id, ...(ing.aliases || [])].map(c => normalize(String(c)));
    let matched = false;

    for (const c of candidates) {
      if (!c) continue;
      if (c.split(/\s+/).length === 1 && GENERIC_BLACKLIST.has(c) && !/[0-9]/.test(c) && !ing.id?.match(/[0-9]/)) continue;
      if (hasWholePhrase(c, text, tokens)) { matched = true; break; }
    }

    if (!matched) {
      for (const c of candidates) {
        if (!c || c.replace(/\s+/g,'').length < 6) continue;
        if (conservativeFuzzyMatch(c, text)) {
          if (c.split(/\s+/).map(p => tokens.has(p)).some(Boolean)) { matched = true; break; }
        }
      }
    }

    if (matched && !foundIds.has(ing.id)) { foundIds.add(ing.id); foundIngredients.push(ing); }
  }

  await saveScanResult(extractedText, allergyAlerts, Array.from(foundIds));

  if (foundIngredients.length === 0) {
    await Swal.fire({
      icon: 'success', title: '✨ All Clear',
      text: 'No harmful ingredients detected in this scan.',
      background: '#071122', color: '#e6f7ff',
      confirmButtonColor: '#2ecc71', confirmButtonText: 'Nice'
    });
    return;
  }

  // ── Build summary cards (brief, user-friendly) ──────────────────────────
  const riskBadge = lvl => {
    const map = { High: ['#ff6b6b','#2a0a0a'], Moderate: ['#ffd166','#2a1f00'], Low: ['#8af78a','#0a2a0a'] };
    const [fg, bg] = map[lvl] || ['#ccc','#111'];
    return `<span style="background:${bg};color:${fg};border:1px solid ${fg};border-radius:20px;padding:2px 10px;font-size:0.75em;font-weight:700;letter-spacing:.5px">${lvl || 'Unknown'} Risk</span>`;
  };

  const cardsHtml = foundIngredients.map((ing, i) => {
    const safeId = `ing-details-${i}`;
    const effects = (ing.healthEffects || []).slice(0, 3).map(h => `<li>${h.effect}</li>`).join('');
    const regs = ing.regulatoryStatus
      ? Object.entries(ing.regulatoryStatus).map(([k, v]) => `<span style="display:inline-block;margin:2px 4px 2px 0;background:#0d1e30;border:1px solid #1e3a50;border-radius:8px;padding:2px 8px;font-size:0.78em"><b>${k}:</b> ${v}</span>`).join('')
      : '';
    const refs = (ing.references || []).map(r => `<li><a href="${r}" target="_blank" rel="noopener" style="color:#7ab8ff;font-size:0.82em;word-break:break-all">${r}</a></li>`).join('');
    const toxAc = ing.toxicity?.acute || null;
    const toxCh = ing.toxicity?.chronic || null;

    return `
      <div style="text-align:left;padding:14px 16px;margin:10px 0;border-radius:12px;background:#0b1826;border:1px solid #1a2e42">

        <!-- Summary row (always visible) -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <strong style="color:#e8f4ff;font-size:1em">${ing.name}</strong>
              ${riskBadge(ing.riskLevel)}
            </div>
            <div style="color:#6b8fa8;font-size:0.8em;margin-top:2px">${ing.category || ''} ${ing.id ? '• ' + ing.id : ''}</div>
          </div>
        </div>

        <!-- Brief description (always visible) -->
        <p style="color:#aec6d8;margin:10px 0 4px;font-size:0.9em;line-height:1.5">
          ${ing.description || 'No description available.'}
        </p>

        <!-- Top 1-3 health effects summary (always visible) -->
        ${effects ? `<ul style="color:#8fb8cc;margin:6px 0 0 16px;font-size:0.85em;line-height:1.6">${effects}</ul>` : ''}

        <!-- Toggle button -->
        <button
          onclick="(function(btn){
            var el=document.getElementById('${safeId}');
            var open=el.style.display!=='none';
            el.style.display=open?'none':'block';
            btn.textContent=open?'Show Details ▾':'Hide Details ▴';
          })(this)"
          style="margin-top:10px;background:transparent;border:1px solid #1e3a50;color:#7ab8ff;border-radius:8px;padding:5px 14px;font-size:0.8em;cursor:pointer"
        >Show Details ▾</button>

        <!-- Expandable details -->
        <div id="${safeId}" style="display:none;margin-top:12px;border-top:1px solid #1a2e42;padding-top:12px">

          ${(toxAc || toxCh) ? `
          <div style="margin-bottom:10px">
            <div style="color:#a8c7d8;font-size:0.8em;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Toxicity</div>
            ${toxAc ? `<div style="color:#8fb8cc;font-size:0.85em">⚡ <b>Acute:</b> ${toxAc}</div>` : ''}
            ${toxCh ? `<div style="color:#8fb8cc;font-size:0.85em;margin-top:3px">🔁 <b>Chronic:</b> ${toxCh}</div>` : ''}
          </div>` : ''}

          ${regs ? `
          <div style="margin-bottom:10px">
            <div style="color:#a8c7d8;font-size:0.8em;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Regulatory Status</div>
            <div>${regs}</div>
          </div>` : ''}

          ${refs ? `
          <div>
            <div style="color:#a8c7d8;font-size:0.8em;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Sources</div>
            <ul style="margin:0 0 0 14px;padding:0;list-style:disc">${refs}</ul>
          </div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  await Swal.fire({
    icon: 'warning',
    title: `⚠️ ${foundIngredients.length} Harmful Ingredient${foundIngredients.length > 1 ? 's' : ''} Found`,
    html: `
      <p style="color:#8da8bc;font-size:0.88em;margin-bottom:12px;text-align:left">
        Tap <b>Show Details</b> on any ingredient to see toxicity data, regulatory status, and sources.
      </p>
      ${cardsHtml}
    `,
    width: '680px',
    background: '#071122',
    color: '#e6f7ff',
    showCancelButton: true,
    confirmButtonText: 'Got it',
    cancelButtonText: 'Scan Another',
    confirmButtonColor: '#ff6b6b',
    cancelButtonColor: '#2b2f36',
    customClass: { popup: 'swal-harmful' },
    didClose: () => { if (window.appLoadHistory) window.appLoadHistory(); }
  }).then(result => {
    if (result.dismiss === Swal.DismissReason.cancel) {
      try { resetScanSession(); } catch (e) { location.reload(); }
    }
  });
}

// 💾 Save Result
async function saveScanResult(extractedText, allergyAlerts, foundArr) {
  const user = auth.currentUser;
  const doc = {
    timestamp: firebase.firestore.FieldValue.serverTimestamp
      ? firebase.firestore.FieldValue.serverTimestamp() : Date.now(),
    ingredients: (extractedText || '').slice(0, 2000),
    allergiesFound: allergyAlerts,
    harmfulNotes: foundArr
  };
  try {
    if (user) await db.collection('users').doc(user.uid).collection('history').add(doc);
    else {
      const arr = JSON.parse(localStorage.getItem('localHistory') || '[]');
      arr.unshift(doc);
      localStorage.setItem('localHistory', JSON.stringify(arr.slice(0, 50)));
    }
  } catch (err) { console.error('saveScan err', err); }
}

// ✏️ Edit
function enableEditing() {
  const ta = document.getElementById('extracted-text');
  ta.readOnly = false;
  document.getElementById('edit-button').style.display = 'none';
  document.getElementById('save-button').style.display = 'inline';
}

function saveChanges() {
  const ta = document.getElementById('extracted-text');
  ta.readOnly = true;
  document.getElementById('edit-button').style.display = 'inline';
  document.getElementById('save-button').style.display = 'none';
  checkAllergiesThenHarmful(ta.value);
}

// 🧹 Reset
function resetScanSession() {
  const scanSection = document.getElementById('scanner-screen');
  scanSection.classList.add('fade-out');
  setTimeout(() => {
    document.getElementById('captured-image').innerHTML = '';
    document.getElementById('extracted-text').value = '';
    const aiResult = document.getElementById('ai-result');
    if (aiResult) aiResult.style.display = 'none';
    ['scan-another','ai-button'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    document.getElementById('edit-button').style.display = 'inline';
    document.getElementById('save-button').style.display = 'none';
    startCamera();
    scanSection.classList.remove('fade-out');
    scanSection.classList.add('fade-in');
    Swal.fire({
      icon: 'info', title: '✨ New Scan Ready', text: 'Your scanner has been refreshed.',
      background: 'radial-gradient(circle at top left, #0d121a, #151e28)', color: '#b5e9ff',
      showConfirmButton: false, timer: 1600, customClass: { popup: 'swal-scan' }
    });
    setTimeout(() => scanSection.classList.remove('fade-in'), 800);
  }, 500);
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────
async function runAIAnalysis() {
  const allowed = await checkScanLimit('ai');
  if (!allowed) return;

  const rawText = extractedTextElement.value.trim();
  if (!rawText) {
    Swal.fire({ icon: 'info', title: 'No Ingredients Found!', text: 'Please scan first.', customClass: { popup: 'swal-info' } });
    return;
  }

  const aiBtn = document.getElementById('ai-button');
  aiBtn.textContent = 'Analyzing...';
  aiBtn.disabled = true;

  const prompt = `You are Clarivana AI, a food safety assistant. A user has scanned a food label. Analyze the following ingredient list and respond ONLY with a JSON array (no markdown, no backticks, no extra text).

Each item in the array must have:
- "name": ingredient name (string)
- "status": one of "Harmful", "Caution", or "Safe"
- "reason": a single clear sentence (max 20 words) explaining why
- "alternative": a short, practical safer alternative (or null if Safe)

Only include ingredients that are worth flagging (Harmful or Caution). If everything is fine, return an empty array [].

Ingredients:
${rawText}`;

  try {
    
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
      }
    );

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let items = [];
    try {
      // Strip any accidental markdown fences
      const cleaned = raw.replace(/```json|```/gi, '').trim();
      items = JSON.parse(cleaned);
    } catch (_) {
      // Fallback: show raw text nicely
      await Swal.fire({
        icon: 'info', title: 'AI Ingredient Analysis 🧠',
        html: `<div style="text-align:left;white-space:pre-wrap;color:#aec6d8;font-size:0.9em">${raw}</div>`,
        background: '#071122', color: '#e6f7ff',
        customClass: { popup: 'swal-account' }
      });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      await Swal.fire({
        icon: 'success', title: '✅ Looks Good!',
        text: 'Clarivana AI found no ingredients worth flagging in this product.',
        background: '#071122', color: '#e6f7ff', confirmButtonColor: '#2ecc71'
      });
      return;
    }

    // ── Render AI result cards ──────────────────────────────────────────────
    const statusStyle = s => {
      if (s === 'Harmful') return { color: '#ff6b6b', bg: '#2a0a0a', border: '#ff6b6b' };
      if (s === 'Caution') return { color: '#ffd166', bg: '#2a1f00', border: '#ffd166' };
      return { color: '#8af78a', bg: '#0a2a0a', border: '#8af78a' };
    };

    const statusIcon = s => s === 'Harmful' ? '🚫' : s === 'Caution' ? '⚠️' : '✅';

    const cardsHtml = items.map(item => {
      const st = statusStyle(item.status);
      return `
        <div style="text-align:left;padding:13px 15px;margin:9px 0;border-radius:12px;background:#0b1826;border:1px solid ${st.border}33">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:1.15em">${statusIcon(item.status)}</span>
              <strong style="color:#e8f4ff;font-size:0.97em">${item.name || 'Unknown'}</strong>
            </div>
            <span style="background:${st.bg};color:${st.color};border:1px solid ${st.border};border-radius:20px;padding:2px 10px;font-size:0.75em;font-weight:700">${item.status}</span>
          </div>
          <p style="color:#9ab8cc;margin:8px 0 0;font-size:0.87em;line-height:1.5">${item.reason || ''}</p>
          ${item.alternative ? `
            <div style="margin-top:8px;padding:7px 10px;background:#0d1e30;border-left:3px solid #3b7dd8;border-radius:0 8px 8px 0;font-size:0.83em;color:#7ab8ff">
              💡 <b>Try instead:</b> ${item.alternative}
            </div>` : ''}
        </div>
      `;
    }).join('');

    const harmfulCount = items.filter(i => i.status === 'Harmful').length;
    const cautionCount = items.filter(i => i.status === 'Caution').length;

    await Swal.fire({
      title: 'AI Ingredient Analysis 🧠',
      html: `
        <p style="color:#8da8bc;font-size:0.85em;text-align:left;margin-bottom:4px">
          Found <b style="color:#ff6b6b">${harmfulCount} harmful</b> and <b style="color:#ffd166">${cautionCount} caution</b> ingredient${harmfulCount + cautionCount !== 1 ? 's' : ''}.
        </p>
        ${cardsHtml}
      `,
      width: '640px',
      background: '#071122',
      color: '#e6f7ff',
      confirmButtonText: 'Got it',
      confirmButtonColor: '#3b7dd8',
      customClass: { popup: 'swal-account' }
    });

  } catch (err) {
    console.error('AI Error', err);
    Swal.fire({ icon: 'error', title: 'AI Analysis Failed 😔', text: 'Try again later.', customClass: { popup: 'swal-error' } });
  } finally {
    aiBtn.textContent = 'AI Analysis';
    aiBtn.disabled = false;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const navScanner = document.getElementById('nav-scanner');
  const goScanner = document.getElementById('go-scanner');
  const aiBtn = document.getElementById('ai-button');
  const scanAnotherBtn = document.getElementById('scan-another');

  if (aiBtn) aiBtn.addEventListener('click', runAIAnalysis);
  if (scanAnotherBtn) scanAnotherBtn.addEventListener('click', resetScanSession);

  function ensureCamera() { if (!cameraInput) startCamera(); }
  navScanner?.addEventListener('click', ensureCamera);
  goScanner?.addEventListener('click', ensureCamera);
  const sc = document.getElementById('scanner-screen');
  if (sc && sc.style.display !== 'none') ensureCamera();

  updateUsageUI();
});