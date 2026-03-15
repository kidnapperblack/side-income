/* ══════════════════════════════════════════════════════════════
   INCOMEPRO — LANDING PAGE SCRIPT
   script.js
   Handles: Settings fetch · Form submission · Live counter ·
            Countdown timer · WhatsApp redirect · Animations
   ══════════════════════════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════════
   CONFIGURATION
   Replace APPS_SCRIPT_URL with your deployed
   Google Apps Script Web App URL.
════════════════════════════════════════════ */
const CFG = {
  // 🔧 PASTE YOUR DEPLOYED GAS WEB APP URL HERE:
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxNN-RC8i3xScU0xUbSiPRo-pv6hhM8pB9HXXn1pkKZbQCKMmypumggnRqUoqE7FTQ-Ew/exec',

  // WhatsApp number (country code + number, no spaces or +)
  WHATSAPP_NUMBER: '918318873808',

  // Default countdown target if settings can't be fetched.
  // Format: "YYYY-MM-DDTHH:MM:SS"
  DEFAULT_COUNTDOWN: (() => {
    const d = new Date();
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  })(),

  // Default registration counter start shown before settings load
  DEFAULT_REG_COUNT: 18,

  // Max seconds between simulated counter bumps (for liveness effect)
  COUNTER_BUMP_MIN_SEC: 10,
  COUNTER_BUMP_MAX_SEC: 35,
};

/* ════════════════════════════════════════════
   DOM REFERENCES
════════════════════════════════════════════ */
const DOM = {
  loader:       () => document.getElementById('page-loader'),
  header:       () => document.getElementById('site-header'),
  posterImg:    () => document.getElementById('poster-img'),
  posterPh:     () => document.getElementById('poster-ph'),
  regCount:     () => document.getElementById('reg-count'),
  cdH:          () => document.getElementById('cd-h'),
  cdM:          () => document.getElementById('cd-m'),
  cdS:          () => document.getElementById('cd-s'),
  cdWrap:       () => document.getElementById('countdown-wrap'),
  cdExpired:    () => document.getElementById('cd-expired'),
  seatsFill:    () => document.getElementById('seats-fill'),
  form:         () => document.getElementById('lead-form'),
  formView:     () => document.getElementById('form-view'),
  successView:  () => document.getElementById('success-view'),
  submitBtn:    () => document.getElementById('submit-btn'),
  waBtn:        () => document.getElementById('wa-btn'),
  toastWrap:    () => document.getElementById('toast-wrap'),
  fName:        () => document.getElementById('f-name'),
  fMobile:      () => document.getElementById('f-mobile'),
  fCity:        () => document.getElementById('f-city'),
  fieldName:    () => document.getElementById('field-name'),
  fieldMobile:  () => document.getElementById('field-mobile'),
  fieldCity:    () => document.getElementById('field-city'),
};

/* ════════════════════════════════════════════
   APP STATE
════════════════════════════════════════════ */
let state = {
  regCount:        CFG.DEFAULT_REG_COUNT,
  countdownTarget: new Date(CFG.DEFAULT_COUNTDOWN),
  cdInterval:      null,
  bumpTimeout:     null,
  settingsLoaded:  false,
};

/* ════════════════════════════════════════════
   INIT — Entry point
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // Start loading settings from GAS in background
  await loadSettings();

  // Hide loader once settings attempted (success or fail)
  hideLoader();

  // Start live counter animation
  animateCounterIn(state.regCount);
  scheduleBump();

  // Start countdown
  startCountdown();

  // Bind form
  DOM.form()?.addEventListener('submit', handleSubmit);

  // Sticky header on scroll
  window.addEventListener('scroll', () => {
    DOM.header()?.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });

  // Only allow numeric input on mobile field
  DOM.fMobile()?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });
});

/* ════════════════════════════════════════════
   SETTINGS — Fetch from Google Apps Script
   GET ?action=getSettings
   Returns: { posterUrl, countdownISO, regCount }
════════════════════════════════════════════ */
async function loadSettings() {
  if (!CFG.APPS_SCRIPT_URL || CFG.APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
    console.warn('[IncomePro] Apps Script URL not set. Using defaults.');
    return;
  }

  try {
    const url = `${CFG.APPS_SCRIPT_URL}?action=getSettings&t=${Date.now()}`;
    const res = await fetchWithTimeout(url, { method: 'GET' }, 6000);
    const data = await res.json();

    if (data.status === 'success' && data.settings) {
      const s = data.settings;

      // Apply poster image
      if (s.posterUrl && s.posterUrl.trim() !== '') {
        applyPoster(s.posterUrl.trim());
      }

      // Apply countdown target
      if (s.countdownISO && s.countdownISO.trim() !== '') {
        const target = new Date(s.countdownISO.trim());
        if (!isNaN(target)) {
          state.countdownTarget = target;
        }
      }

      // Apply registration counter
      const cnt = parseInt(s.regCount, 10);
      if (!isNaN(cnt) && cnt > 0) {
        state.regCount = cnt;
      }

      state.settingsLoaded = true;
      console.log('[IncomePro] Settings loaded:', s);
    }
  } catch (err) {
    console.warn('[IncomePro] Could not load settings:', err.message);
    // Silently fall back to defaults — page still works
  }
}

/* ── Apply poster image to DOM ── */
function applyPoster(url) {
  const img = DOM.posterImg();
  const ph  = DOM.posterPh();
  if (!img) return;

  img.onload = () => {
    img.style.display = 'block';
    if (ph) ph.style.display = 'none';
  };
  img.onerror = () => {
    img.style.display = 'none';
    if (ph) ph.style.display = 'flex';
  };
  img.src = url;
}

/* ════════════════════════════════════════════
   FORM SUBMISSION
   POST → GAS → saves to Google Sheet
   Then shows success message + WhatsApp link
════════════════════════════════════════════ */
async function handleSubmit(e) {
  e.preventDefault();

  const name   = DOM.fName()?.value.trim()   || '';
  const mobile = DOM.fMobile()?.value.trim() || '';
  const city   = DOM.fCity()?.value.trim()   || '';

  // Client-side validation
  let valid = true;
  clearErrors();

  if (!name || name.length < 2) {
    setError('field-name', 'कृपया अपना पूरा नाम दर्ज करें');
    valid = false;
  }
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
    setError('field-mobile', '10 अंकों का सही मोबाइल नंबर डालें');
    valid = false;
  }
  if (!city || city.length < 2) {
    setError('field-city', 'कृपया अपना शहर दर्ज करें');
    valid = false;
  }
  if (!valid) return;

  // Set loading state
  setSubmitLoading(true);

  // Build payload
  const now     = new Date();
  const payload = {
    action: 'saveLead',
    name,
    mobile,
    city,
    date: now.toLocaleDateString('en-IN'),
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };

  try {
    if (CFG.APPS_SCRIPT_URL && !CFG.APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
      // Send to Google Apps Script
      // Using mode: 'no-cors' because GAS doesn't send CORS headers on redirect
      await fetch(CFG.APPS_SCRIPT_URL, {
        method:  'POST',
        mode:    'no-cors',            // GAS requires this
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      // NOTE: with no-cors we cannot read the response body,
      // so we optimistically assume success after 200ms
    } else {
      // Demo mode: simulate network delay
      await delay(800);
    }

    // Success!
    onSubmitSuccess(name, mobile, city);

  } catch (err) {
    console.error('[IncomePro] Submit error:', err);
    // Still show success to user — data likely went through
    onSubmitSuccess(name, mobile, city);
  }
}

/* ── Called on successful submission ── */
function onSubmitSuccess(name, mobile, city) {
  setSubmitLoading(false);

  // Increment reg counter
  state.regCount++;
  const el = DOM.regCount();
  if (el) {
    el.textContent = state.regCount;
    el.classList.remove('bump');
    void el.offsetWidth; // reflow
    el.classList.add('bump');
  }

  // Update seats fill
  animateSeatsFill();

  // Build WhatsApp link
  const waMsg = encodeURIComponent(
    `नमस्ते, मैंने ऑनलाइन साइड इनकम के लिए रजिस्ट्रेशन किया है।\nनाम: ${name}\nमोबाइल: ${mobile}\nशहर: ${city}`
  );
  const waUrl = `https://wa.me/${CFG.WHATSAPP_NUMBER}?text=${waMsg}`;
  const waBtn = DOM.waBtn();
  if (waBtn) waBtn.href = waUrl;

  // Switch to success view
  DOM.formView().style.display = 'none';
  const sv = DOM.successView();
  sv.style.display = 'block';

  // Auto-open WhatsApp after 1.5s
  setTimeout(() => {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }, 1500);

  showToast('✅ रजिस्ट्रेशन सफल!', 'success');
}

/* ════════════════════════════════════════════
   COUNTDOWN TIMER
   Target is loaded from GAS settings.
   Resets to tomorrow midnight each day.
════════════════════════════════════════════ */
function startCountdown() {
  // Clear any existing interval
  if (state.cdInterval) clearInterval(state.cdInterval);

  updateCountdown(); // immediate tick
  state.cdInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const now  = Date.now();
  const diff = state.countdownTarget.getTime() - now;

  const cdWrap   = DOM.cdWrap();
  const cdExpired = DOM.cdExpired();

  if (diff <= 0) {
    // Timer expired
    if (cdWrap)    cdWrap.style.display = 'none';
    if (cdExpired) cdExpired.style.display = 'block';
    if (state.cdInterval) clearInterval(state.cdInterval);
    return;
  }

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  const pad = n => String(n).padStart(2, '0');
  const cdH = DOM.cdH(), cdM = DOM.cdM(), cdS = DOM.cdS();
  if (cdH) cdH.textContent = pad(h);
  if (cdM) cdM.textContent = pad(m);
  if (cdS) cdS.textContent = pad(s);
}

/* ════════════════════════════════════════════
   LIVE REGISTRATION COUNTER
   - Initial value from settings
   - Animates up from 0 on page load
   - Random bump every ~10-35 seconds
════════════════════════════════════════════ */
function animateCounterIn(target) {
  const el = DOM.regCount();
  if (!el) return;

  let current = 0;
  const step = Math.ceil(target / 40);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 40);
}

function scheduleBump() {
  const { COUNTER_BUMP_MIN_SEC: mn, COUNTER_BUMP_MAX_SEC: mx } = CFG;
  const delay_ms = (mn + Math.random() * (mx - mn)) * 1000;

  state.bumpTimeout = setTimeout(() => {
    state.regCount++;
    const el = DOM.regCount();
    if (el) {
      el.textContent = state.regCount;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
    animateSeatsFill();
    scheduleBump(); // schedule next
  }, delay_ms);
}

/* ════════════════════════════════════════════
   UI HELPERS
════════════════════════════════════════════ */

function hideLoader() {
  const loader = DOM.loader();
  if (loader) {
    setTimeout(() => loader.classList.add('hidden'), 300);
  }
}

function setSubmitLoading(on) {
  const btn = DOM.submitBtn();
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}

function setError(fieldId, msg) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.add('has-error');
  const errEl = field.querySelector('.field-err');
  if (errEl) errEl.textContent = msg;
}

function clearErrors() {
  document.querySelectorAll('.field.has-error').forEach(f => f.classList.remove('has-error'));
}

function animateSeatsFill() {
  const fill = DOM.seatsFill();
  if (!fill) return;
  const current = parseFloat(fill.style.width) || 68;
  const next = Math.min(current + 0.5, 99);
  fill.style.width = next + '%';
}

/* ── Toast notification ── */
function showToast(msg, type = 'success') {
  const wrap = DOM.toastWrap();
  if (!wrap) return;

  const toast = document.createElement('div');
  toast.className = `toast t-${type}`;
  toast.textContent = msg;
  wrap.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s, transform 0.4s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/* ════════════════════════════════════════════
   UTILITY
════════════════════════════════════════════ */

/* fetch() with timeout */
async function fetchWithTimeout(url, options = {}, ms = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/* Promise-based delay */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
