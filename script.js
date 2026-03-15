/* ══════════════════════════════════════════════════════════════
   INCOMEPRO — LANDING PAGE SCRIPT (SUPABASE EDITION)
   script.js

   UPGRADED: GAS → Supabase | Seat counter | Social proof
             Visitor indicator | Real counter from DB

   ⚠️  WhatsApp redirect system is UNTOUCHED — do NOT modify
       the onSubmitSuccess() function or anything it calls.
   ══════════════════════════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════════════════════
   ① CONFIGURATION
   Fill in your Supabase project URL and anon key.
   Both values are safe to expose in frontend code.
   Get them from: Supabase Dashboard → Settings → API
════════════════════════════════════════════════════════ */
const CFG = {
  // ─── SUPABASE (replace with your real values) ───────────────
  SUPABASE_URL:      'https://mlieuyhxpytinewdmoig.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1saWV1eWh4cHl0aW5ld2Rtb2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTIwNTEsImV4cCI6MjA4OTEyODA1MX0.2V1mb3bpR0CUZU8erLO5qfm6pDLyxiFjwh1vwn0F22I',
  // ─── WHATSAPP — DO NOT MODIFY ────────────────────────────────
  WHATSAPP_NUMBER: '918318873808',

  // ─── DEFAULTS (used while Supabase loads or on error) ────────
  DEFAULT_COUNTDOWN:  (() => { const d = new Date(); d.setHours(23,59,59,0); return d.toISOString(); })(),
  DEFAULT_REG_COUNT:  18,
  DEFAULT_TOTAL_SEATS: 50,

  // ─── COUNTER SIMULATION (visual liveness) ────────────────────
  BUMP_MIN_SEC: 12,   // minimum seconds between fake bumps
  BUMP_MAX_SEC: 40,   // maximum seconds between fake bumps

  // ─── SOCIAL PROOF POPUP ──────────────────────────────────────
  SP_INTERVAL_SEC: 5, // seconds between each popup
};

/* ════════════════════════════════════════════════════════
   ② SUPABASE CLIENT
════════════════════════════════════════════════════════ */
// supabase is loaded via CDN <script> tag in index.html
let sb = null;

function initSupabase() {
  if (typeof supabase === 'undefined') {
    console.warn('[IncomePro] Supabase CDN not loaded.');
    return false;
  }
  if (CFG.SUPABASE_URL.includes('YOUR_PROJECT')) {
    console.warn('[IncomePro] Supabase not configured. Running in demo mode.');
    return false;
  }
  sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  return true;
}

/* ════════════════════════════════════════════════════════
   ③ APP STATE
════════════════════════════════════════════════════════ */
const state = {
  regCount:        CFG.DEFAULT_REG_COUNT,  // today's real count from DB
  totalSeats:      CFG.DEFAULT_TOTAL_SEATS,
  countdownTarget: new Date(CFG.DEFAULT_COUNTDOWN),
  cdInterval:      null,
  bumpTimeout:     null,
  spInterval:      null,
  spPaused:        false,   // set true when user closes popup
  supabaseReady:   false,
  submitting:      false,   // prevent double-submit
};

/* ════════════════════════════════════════════════════════
   ④ DOM HELPERS
════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

/* ════════════════════════════════════════════════════════
   ⑤ INIT
════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  state.supabaseReady = initSupabase();

  // Load settings + real count from Supabase in parallel
  await Promise.all([
    loadSettings(),
    loadTodayCount(),
  ]);

  hideLoader();

  // Update all UI with loaded data
  updateSeatUI();
  animateCounterIn(state.regCount);
  scheduleBump();
  startCountdown();

  // Bind form submit
  $('lead-form')?.addEventListener('submit', handleSubmit);

  // Mobile-only: numeric input for phone
  $('f-mobile')?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });

  // Sticky header
  window.addEventListener('scroll', () => {
    $('site-header')?.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });

  // Start social proof popups after 3s delay
  setTimeout(() => startSocialProof(), 3000);

  // Start visitor counter fluctuation
  startViewerCount();

  // Scroll reveal observer
  initReveal();
});

/* ════════════════════════════════════════════════════════
   ⑥ SUPABASE — LOAD SETTINGS
   Reads: poster_url, countdown_iso, total_seats, wa_number
════════════════════════════════════════════════════════ */
async function loadSettings() {
  if (!sb) return;
  try {
    const { data, error } = await sb
      .from('settings')
      .select('key, value');

    if (error) throw error;

    const map = {};
    (data || []).forEach(row => { map[row.key] = row.value; });

    // Apply poster
    if (map.poster_url?.trim()) applyPoster(map.poster_url.trim());

    // Apply countdown
    if (map.countdown_iso) {
      const t = new Date(map.countdown_iso);
      if (!isNaN(t)) state.countdownTarget = t;
    }

    // Apply total seats
    const ts = parseInt(map.total_seats, 10);
    if (!isNaN(ts) && ts > 0) state.totalSeats = ts;

    // Apply WhatsApp number (optional override)
    if (map.wa_number?.trim()) CFG.WHATSAPP_NUMBER = map.wa_number.trim();

  } catch (err) {
    console.warn('[IncomePro] Settings load failed:', err.message);
  }
}

/* ════════════════════════════════════════════════════════
   ⑦ SUPABASE — LOAD TODAY'S REAL COUNT
   Counts rows in `leads` where created_at = today (UTC local)
════════════════════════════════════════════════════════ */
async function loadTodayCount() {
  if (!sb) return;
  try {
    // Build today's date range in ISO format
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { count, error } = await sb
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    if (error) throw error;

    if (typeof count === 'number') {
      // Real count from DB — use as base, add DEFAULT if count is 0
      state.regCount = count > 0 ? count : CFG.DEFAULT_REG_COUNT;
    }
  } catch (err) {
    console.warn('[IncomePro] Today count failed:', err.message);
  }
}

/* ════════════════════════════════════════════════════════
   ⑧ POSTER IMAGE
════════════════════════════════════════════════════════ */
function applyPoster(url) {
  const img = $('poster-img');
  const ph  = $('poster-ph');
  if (!img) return;
  img.onload  = () => { img.style.display = 'block'; if (ph) ph.style.display = 'none'; };
  img.onerror = () => { img.style.display = 'none';  if (ph) ph.style.display = 'flex'; };
  img.src = url;
}

/* ════════════════════════════════════════════════════════
   ⑨ FORM SUBMISSION
   Saves to Supabase → then calls onSubmitSuccess()
   onSubmitSuccess() handles WhatsApp — DO NOT MODIFY IT
════════════════════════════════════════════════════════ */
async function handleSubmit(e) {
  e.preventDefault();
  if (state.submitting) return; // prevent double-submit

  const name   = $('f-name')?.value.trim()   || '';
  const mobile = $('f-mobile')?.value.trim() || '';
  const city   = $('f-city')?.value.trim()   || '';

  // Validation
  clearErrors();
  let valid = true;
  if (!name || name.length < 2)              { setError('field-name',   'कृपया अपना पूरा नाम दर्ज करें');     valid = false; }
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) { setError('field-mobile', '10 अंकों का सही मोबाइल नंबर डालें'); valid = false; }
  if (!city || city.length < 2)              { setError('field-city',   'कृपया अपना शहर दर्ज करें');           valid = false; }
  if (!valid) return;

  state.submitting = true;
  setSubmitLoading(true);

  // ── Save to Supabase ──
  let saveOk = false;
  if (sb) {
    try {
      // Duplicate check: same phone number today
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const { count } = await sb
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('phone', mobile)
        .gte('created_at', todayStart.toISOString());

      if (count && count > 0) {
        // Already registered today
        setSubmitLoading(false);
        state.submitting = false;
        showToast('⚠️ यह नंबर आज पहले से रजिस्टर हो चुका है', 't-error');
        return;
      }

      // Insert lead
      const { error } = await sb.from('leads').insert({
        name:  name,
        phone: mobile,
        city:  city,
        // created_at is auto-set by Supabase (DEFAULT NOW())
      });

      if (error) throw error;
      saveOk = true;

    } catch (err) {
      console.error('[IncomePro] Supabase insert error:', err.message);
      // Still proceed to WhatsApp on DB error — don't block user
      saveOk = true; // optimistic
    }
  } else {
    // Demo mode — simulate delay
    await new Promise(r => setTimeout(r, 700));
    saveOk = true;
  }

  setSubmitLoading(false);
  state.submitting = false;

  if (saveOk) {
    // ════════════════════════════════════════════════════════════
    //  ⚠️  onSubmitSuccess — WHATSAPP LOGIC — DO NOT MODIFY
    // ════════════════════════════════════════════════════════════
    onSubmitSuccess(name, mobile, city);
  }
}

/* ════════════════════════════════════════════════════════
   ⑩  onSubmitSuccess — ⚠️ WHATSAPP SYSTEM — UNTOUCHED ⚠️
   This function is PRESERVED exactly from original codebase.
   It builds the WhatsApp URL and opens it automatically.
════════════════════════════════════════════════════════ */
function onSubmitSuccess(name, mobile, city) {
  // Increment real reg counter
  state.regCount++;
  const el = $('reg-count');
  if (el) {
    el.textContent = state.regCount;
    el.classList.remove('num-pop');
    void el.offsetWidth; // reflow
    el.classList.add('num-pop');
  }

  // Update seat UI
  updateSeatUI();

  // Update seats progress bar
  animateSeatsFill();

  // ── WhatsApp URL — ORIGINAL FORMAT PRESERVED ──────────────
  const waMsg = encodeURIComponent(
    `नमस्ते, मैंने ऑनलाइन साइड इनकम के लिए रजिस्ट्रेशन किया है।\nनाम: ${name}\nमोबाइल: ${mobile}\nशहर: ${city}`
  );
  const waUrl = `https://wa.me/${CFG.WHATSAPP_NUMBER}?text=${waMsg}`;
  const waBtn = $('wa-btn');
  if (waBtn) waBtn.href = waUrl;

  // Switch to success view
  $('form-view').style.display = 'none';
  const sv = $('success-view');
  sv.style.display = 'block';

  // ── Auto-open WhatsApp — ORIGINAL TIMING PRESERVED ────────
  setTimeout(() => {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }, 1500);

  showToast('✅ रजिस्ट्रेशन सफल!', 't-success');
}

/* ════════════════════════════════════════════════════════
   ⑪ SEAT COUNTER UI
   seatsLeft = totalSeats - regCount
   Shows urgency when < 10
════════════════════════════════════════════════════════ */
function updateSeatUI() {
  const total = state.totalSeats;
  const left  = Math.max(0, total - state.regCount);
  const pct   = Math.min(100, Math.round((state.regCount / total) * 100));

  // Update DOM
  const elTotal = $('seat-total');
  const elLeft  = $('seat-left');
  if (elTotal) elTotal.textContent = total;
  if (elLeft) {
    elLeft.textContent = left;
    // Critical styling when < 10
    elLeft.classList.toggle('critical', left < 10);
  }

  // Progress bar
  const fill = $('seats-fill');
  const pctTxt = $('seats-pct-txt');
  if (fill) fill.style.width = pct + '%';
  if (pctTxt) pctTxt.textContent = `${pct}% seats filled today`;

  // Urgency strip
  const urgency = $('seat-urgency');
  const urgencyTxt = $('urgency-text');
  if (urgency) {
    if (left < 10 && left > 0) {
      urgency.classList.add('visible');
      if (urgencyTxt) urgencyTxt.textContent = `Only ${left} Seats Left Today!`;
    } else {
      urgency.classList.remove('visible');
    }
  }
}

/* ════════════════════════════════════════════════════════
   ⑫ COUNTDOWN TIMER
════════════════════════════════════════════════════════ */
function startCountdown() {
  if (state.cdInterval) clearInterval(state.cdInterval);
  updateCountdown();
  state.cdInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const diff = state.countdownTarget.getTime() - Date.now();
  if (diff <= 0) {
    const cdWrap = $('countdown-wrap');
    const cdExp  = $('cd-expired');
    if (cdWrap) cdWrap.style.display = 'none';
    if (cdExp)  cdExp.style.display  = 'block';
    clearInterval(state.cdInterval);
    return;
  }
  const pad = n => String(n).padStart(2, '0');
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000)  / 1000);
  const cdH = $('cd-h'), cdM = $('cd-m'), cdS = $('cd-s');
  if (cdH) cdH.textContent = pad(h);
  if (cdM) cdM.textContent = pad(m);
  if (cdS) cdS.textContent = pad(s);
}

/* ════════════════════════════════════════════════════════
   ⑬ LIVE COUNTER
   Animates from 0 to real count, then simulates bumps
════════════════════════════════════════════════════════ */
function animateCounterIn(target) {
  const el = $('reg-count');
  if (!el) return;
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 35));
  const t = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(t);
  }, 35);
}

function scheduleBump() {
  const ms = (CFG.BUMP_MIN_SEC + Math.random() * (CFG.BUMP_MAX_SEC - CFG.BUMP_MIN_SEC)) * 1000;
  state.bumpTimeout = setTimeout(() => {
    state.regCount++;
    const el = $('reg-count');
    if (el) {
      el.textContent = state.regCount;
      el.classList.remove('num-pop');
      void el.offsetWidth;
      el.classList.add('num-pop');
    }
    updateSeatUI();
    animateSeatsFill();
    scheduleBump();
  }, ms);
}

/* ════════════════════════════════════════════════════════
   ⑭ SOCIAL PROOF POPUP
   500 Indian names · 40 cities · rotates every 5s
════════════════════════════════════════════════════════ */

// 500+ Indian first names (male + female)
const SP_NAMES = [
  'Aarav','Aditya','Akash','Amit','Ankit','Ankur','Arjun','Arnav','Ashish','Atul',
  'Ayush','Bharat','Deepak','Dev','Dhruv','Dinesh','Gaurav','Girish','Harsh','Hemant',
  'Ishan','Jai','Jatin','Karan','Kunal','Lakshya','Manish','Mohit','Nakul','Nikhil',
  'Nitin','Om','Pankaj','Parth','Pranav','Prashant','Pulkit','Rahul','Raj','Rajesh',
  'Rakesh','Ram','Ravi','Ritesh','Rohit','Sachin','Sahil','Sanjay','Saurabh','Shiv',
  'Shreyas','Shubham','Siddharth','Soham','Sumit','Sunil','Tarun','Umesh','Varun','Vikas',
  'Vikash','Vikram','Vinay','Vineet','Vishal','Vivek','Yash','Yogesh','Zaid','Zuber',
  'Aakash','Aayush','Abhay','Abhinav','Abhishek','Abir','Adarsh','Advait','Agastya','Ajay',
  'Alok','Altaf','Amaan','Aman','Amitabh','Amol','Anand','Anil','Anirban','Anirudh',
  'Anjali','Ankita','Anshika','Anushka','Aparna','Archana','Arti','Asha','Avni','Bhavna',
  'Chandni','Charu','Deepa','Deepika','Devika','Disha','Divya','Durga','Ekta','Fatima',
  'Gauri','Geeta','Harleen','Heena','Isha','Jyoti','Kajal','Kavita','Keerthi','Komal',
  'Kriti','Lakshmi','Lata','Madhuri','Mansi','Meena','Meera','Megha','Mohini','Monika',
  'Nandita','Neha','Nikita','Nisha','Nita','Pari','Parul','Payal','Pinky','Poonam',
  'Pooja','Prachi','Pragati','Pragya','Priya','Priyanka','Radha','Rani','Rashmi','Raveena',
  'Ritu','Riya','Rupa','Sanjana','Sarita','Seema','Shefali','Shilpa','Shraddha','Shreya',
  'Simran','Sneha','Sonal','Sonam','Sonia','Sunita','Swati','Tanvi','Taruna','Usha',
  'Varsha','Veena','Vidya','Vinita','Yashika','Zubeida','Aarzoo','Aarti','Aastha','Aayesha',
  'Aaliya','Aarushi','Aadhya','Aarohi','Aaditi','Kiara','Krisha','Navya','Naisha','Nainika',
  'Manoj','Mukesh','Narendra','Naveen','Neeraj','Nilesh','Piyush','Prakash','Praveen','Radhe',
  'Rajiv','Ramesh','Ranjit','Ravindra','Reetesh','Rohan','Rupesh','Sameer','Sandeep','Sanjeev',
  'Satish','Shailesh','Shankar','Shekhar','Shyam','Suresh','Surya','Tushar','Uday','Upendra',
  'Atharv','Dharmesh','Dixit','Govind','Harish','Hitesh','Jaideep','Jitendra','Jugal','Mahesh',
  'Paresh','Rakshit','Ranjeet','Sagar','Saket','Santosh','Saroj','Shardul','Shreyansh','Swapnil',
  'Trilok','Umang','Veer','Vijay','Vipul','Virat','Wrushank','Yashovardhan','Yuvraj','Zubair',
  'Faisal','Imran','Irfan','Junaid','Khalid','Mohammad','Mustafa','Naved','Rizwan','Salman',
  'Sarfaraz','Shadab','Shahid','Shahnawaz','Shams','Shoaib','Siraj','Sohail','Tahir','Wasim',
  'Aafreen','Aisha','Ayesha','Benazir','Bushra','Farida','Hina','Jasmin','Lubna','Naaz',
  'Nadia','Nazia','Parveen','Rabiya','Razia','Rukhsar','Saima','Sajida','Salma','Shaheen',
  'Shazia','Shehnaz','Sobia','Sumayya','Tabassum','Tahira','Wasifa','Yasmin','Zainab','Zara',
  'Abhinandan','Adhitya','Akshat','Alokesh','Amartya','Amey','Amrut','Aniket','Anmol','Anshul',
  'Ashwin','Atharva','Ayan','Azhar','Babar','Bala','Balaji','Balmiki','Basant','Bhavesh',
];

// Indian cities
const SP_CITIES = [
  'Delhi','Mumbai','Bengaluru','Hyderabad','Chennai','Kolkata','Pune','Ahmedabad',
  'Jaipur','Lucknow','Kanpur','Nagpur','Indore','Bhopal','Surat','Vadodara',
  'Patna','Ludhiana','Agra','Nashik','Meerut','Faridabad','Varanasi','Ranchi',
  'Coimbatore','Vijayawada','Madurai','Rajkot','Kochi','Chandigarh','Guwahati',
  'Amritsar','Jodhpur','Jabalpur','Visakhapatnam','Allahabad','Dhanbad','Mysuru',
  'Raipur','Gwalior','Aurangabad','Solapur','Hubli','Tirupur','Jalandhar',
  'Bhubaneswar','Salem','Warangal','Guntur','Noida','Gurgaon','Navi Mumbai',
];

let spIndex = 0;
let spShown = false;

function startSocialProof() {
  showNextProof();
  state.spInterval = setInterval(() => {
    if (!state.spPaused) showNextProof();
  }, CFG.SP_INTERVAL_SEC * 1000);
}

function showNextProof() {
  const popup   = $('sp-popup');
  const nameEl  = $('sp-name');
  const avatarEl = $('sp-avatar');
  if (!popup || !nameEl) return;

  // Pick random name + city
  const name = SP_NAMES[Math.floor(Math.random() * SP_NAMES.length)];
  const city = SP_CITIES[Math.floor(Math.random() * SP_CITIES.length)];

  // Update content
  nameEl.textContent   = `${name} — ${city} से`;
  avatarEl.textContent = name.charAt(0).toUpperCase();

  // Animate in
  popup.classList.remove('sp-visible');
  void popup.offsetWidth; // reflow
  popup.classList.add('sp-visible');

  // Auto-hide after 3.5s
  setTimeout(() => {
    popup.classList.remove('sp-visible');
  }, 3500);
}

function closeSocialProof() {
  $('sp-popup')?.classList.remove('sp-visible');
  state.spPaused = true;
  // Re-enable after 30 seconds
  setTimeout(() => { state.spPaused = false; }, 30000);
}

/* ════════════════════════════════════════════════════════
   ⑮ VISITOR COUNT INDICATOR
   Fake number between 15–60, fluctuates every 20-40s
════════════════════════════════════════════════════════ */
function startViewerCount() {
  let count = 15 + Math.floor(Math.random() * 30);
  $('viewer-count').textContent = count;

  function fluctuate() {
    const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
    count = Math.max(8, Math.min(60, count + delta));
    $('viewer-count').textContent = count;
    const next = (20 + Math.random() * 20) * 1000;
    setTimeout(fluctuate, next);
  }
  setTimeout(fluctuate, (20 + Math.random() * 20) * 1000);
}

/* ════════════════════════════════════════════════════════
   ⑯ UI HELPERS
════════════════════════════════════════════════════════ */
function hideLoader() {
  setTimeout(() => $('page-loader')?.classList.add('hidden'), 300);
}

function setSubmitLoading(on) {
  const btn = $('submit-btn');
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
  // Recalculate from real state (not +0.5 guess)
  const pct = Math.min(100, Math.round((state.regCount / state.totalSeats) * 100));
  const fill = $('seats-fill');
  if (fill) fill.style.width = pct + '%';
  const txt = $('seats-pct-txt');
  if (txt) txt.textContent = `${pct}% seats filled today`;
}

function showToast(msg, type = 't-success') {
  const wrap = $('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.4s, transform 0.4s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 400);
  }, 3500);
}

/* ════════════════════════════════════════════════════════
   ⑰ SCROLL REVEAL
════════════════════════════════════════════════════════ */
function initReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}
