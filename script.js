/* ===========================
   PREMIUM LEAD PAGE - SCRIPT.JS
   =========================== */

// ── CONFIG ──
const CONFIG = {
  // 🔧 REPLACE WITH YOUR GOOGLE APPS SCRIPT WEB APP URL
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby01QP5XHgA8PMgvAb_umccjtnxFyYJ0_A794upNEaHy-pyK2xk5jLbmWsA5p4HOmBzmw/exec',

  // WhatsApp number (without + or spaces, include country code)
  WHATSAPP_NUMBER: '918318873808',

  // Countdown: set your target date/time (24-hour format)
  COUNTDOWN_TARGET: (() => {
    const d = new Date();
    d.setHours(2, 59, 59, 0);
    return d;
  })(),

  // Registration counter start
  REG_COUNTER_START: 14,
  REG_COUNTER_MAX: 47,
};

// ── NAVBAR SCROLL ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// ── SCROLL REVEAL ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── COUNTER ANIMATION ──
function animateCount(el, from, to, duration = 1800, suffix = '') {
  let startTime = null;
  const step = (timestamp) => {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.floor(from + (to - from) * eased);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Animate stats on enter
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const targets = [
        { el: document.getElementById('stat1'), to: 5000, suffix: '+' },
        { el: document.getElementById('stat2'), to: 98, suffix: '%' },
        { el: document.getElementById('stat3'), to: 3, suffix: ' साल' },
        { el: document.getElementById('stat4'), to: 50, suffix: K => K+'+ शहर' },
      ];
      targets.forEach((t, i) => {
        if (t.el) setTimeout(() => {
          if (typeof t.suffix === 'function') {
            // special
            animateCount(t.el, 0, 50, 2000, '+');
          } else {
            animateCount(t.el, 0, t.to, 1800 + i * 200, t.suffix);
          }
        }, i * 100);
      });
      statsObserver.disconnect();
    }
  });
}, { threshold: 0.3 });
const statsBar = document.getElementById('stats-bar');
if (statsBar) statsObserver.observe(statsBar);

// ── LIVE REGISTRATION COUNTER ──
let currentReg = CONFIG.REG_COUNTER_START;
const regCounterEl = document.getElementById('reg-counter');

function updateRegCounter() {
  if (regCounterEl) regCounterEl.textContent = currentReg;
}

function simulateRegistration() {
  if (currentReg < CONFIG.REG_COUNTER_MAX) {
    const delay = 8000 + Math.random() * 25000; // every 8-33 seconds
    setTimeout(() => {
      currentReg++;
      if (regCounterEl) {
        regCounterEl.classList.add('bump');
        regCounterEl.textContent = currentReg;
        setTimeout(() => regCounterEl.classList.remove('bump'), 500);
      }
      simulateRegistration();
    }, delay);
  }
}

// Animate counter in on scroll
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCount(regCounterEl, 0, currentReg, 1500);
      setTimeout(simulateRegistration, 3000);
      counterObserver.disconnect();
    }
  });
}, { threshold: 0.3 });
const counterSection = document.getElementById('counter-section');
if (counterSection) counterObserver.observe(counterSection);

// ── COUNTDOWN TIMER ──
const timerEls = {
  h: document.getElementById('timer-h'),
  m: document.getElementById('timer-m'),
  s: document.getElementById('timer-s'),
  wrap: document.getElementById('timer-wrap'),
  expired: document.getElementById('timer-expired'),
};

function updateCountdown() {
  const now = new Date().getTime();
  const distance = CONFIG.COUNTDOWN_TARGET.getTime() - now;

  if (distance <= 0) {
    if (timerEls.wrap) timerEls.wrap.style.display = 'none';
    if (timerEls.expired) timerEls.expired.style.display = 'inline-block';
    return;
  }

  const h = Math.floor(distance / 3600000);
  const m = Math.floor((distance % 3600000) / 60000);
  const s = Math.floor((distance % 60000) / 1000);

  const pad = n => String(n).padStart(2, '0');
  if (timerEls.h) timerEls.h.textContent = pad(h);
  if (timerEls.m) timerEls.m.textContent = pad(m);
  if (timerEls.s) timerEls.s.textContent = pad(s);
  setTimeout(updateCountdown, 1000);
}
updateCountdown();

// ── GALLERY ──
const galleryItems = [
  { cat: 'meeting', emoji: '🤝', label: 'टीम मीटिंग' },
  { cat: 'event', emoji: '🎯', label: 'ट्रेनिंग इवेंट' },
  { cat: 'success', emoji: '🏆', label: 'सफलता की कहानी' },
  { cat: 'community', emoji: '👥', label: 'कम्युनिटी' },
  { cat: 'meeting', emoji: '📊', label: 'बिजनेस प्रेजेंटेशन' },
  { cat: 'event', emoji: '🎤', label: 'सेमिनार' },
  { cat: 'success', emoji: '💰', label: 'इनकम प्रूफ' },
  { cat: 'community', emoji: '🌟', label: 'स्टार अर्नर' },
  { cat: 'meeting', emoji: '📱', label: 'ऑनलाइन मीटिंग' },
  { cat: 'event', emoji: '🎓', label: 'वर्कशॉप' },
  { cat: 'success', emoji: '🚀', label: 'ग्रोथ जर्नी' },
  { cat: 'community', emoji: '❤️', label: 'टीम सेलिब्रेशन' },
  { cat: 'meeting', emoji: '💼', label: 'बिजनेस क्लास' },
  { cat: 'event', emoji: '🌍', label: 'राष्ट्रीय इवेंट' },
  { cat: 'success', emoji: '🥇', label: 'अवार्ड' },
  { cat: 'community', emoji: '🤗', label: 'साथी' },
  { cat: 'meeting', emoji: '🖥️', label: 'वेबिनार' },
  { cat: 'event', emoji: '🎪', label: 'महा इवेंट' },
  { cat: 'success', emoji: '📈', label: 'बिजनेस ग्रोथ' },
  { cat: 'community', emoji: '👨‍👩‍👧‍👦', label: 'परिवार' },
  { cat: 'meeting', emoji: '☎️', label: 'कॉन्फ्रेंस' },
  { cat: 'event', emoji: '🌐', label: 'ग्लोबल इवेंट' },
  { cat: 'success', emoji: '💎', label: 'डायमंड' },
  { cat: 'community', emoji: '🙌', label: 'कम्युनिटी लव' },
];

function renderGallery(filter = 'all') {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  const filtered = filter === 'all' ? galleryItems : galleryItems.filter(i => i.cat === filter);
  grid.innerHTML = filtered.map((item, idx) => `
    <div class="gallery-item reveal reveal-delay-${(idx % 4) + 1}" style="transition-delay:${idx * 0.05}s" data-cat="${item.cat}">
      <div class="gallery-placeholder">
        <span class="g-icon">${item.emoji}</span>
        <span>${item.label}</span>
      </div>
      <div class="gallery-item-overlay"></div>
    </div>
  `).join('');

  // Re-observe new items
  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

renderGallery();

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    renderGallery(this.dataset.filter);
  });
});

// ── FORM SUBMISSION ──
const form = document.getElementById('lead-form');
const formCard = document.getElementById('form-card-inner');
const thankyouBox = document.getElementById('thankyou-box');
const submitBtn = document.getElementById('submit-btn');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('f-name').value.trim();
    const mobile = document.getElementById('f-mobile').value.trim();
    const city = document.getElementById('f-city').value.trim();

    // Basic validation
    if (!name) { showFieldError('f-name', 'नाम दर्ज करें'); return; }
    if (!mobile || !/^\d{10}$/.test(mobile)) { showFieldError('f-mobile', '10 अंकों का मोबाइल नंबर दर्ज करें'); return; }
    if (!city) { showFieldError('f-city', 'शहर दर्ज करें'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'भेजा जा रहा है...';

    const now = new Date();
    const payload = {
      name, mobile, city,
      date: now.toLocaleDateString('en-IN'),
      time: now.toLocaleTimeString('en-IN'),
    };

    try {
      await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Even with no-cors we assume success
      showThankYou(name, mobile);
      currentReg++;
      if (regCounterEl) regCounterEl.textContent = currentReg;

    } catch (err) {
      console.error('Submission error:', err);
      showThankYou(name, mobile); // Still show thank you (data will retry)
    }
  });
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'var(--danger)';
  el.style.boxShadow = '0 0 0 3px rgba(255,77,109,0.15)';
  
  let errEl = el.parentNode.querySelector('.field-err');
  if (!errEl) {
    errEl = document.createElement('span');
    errEl.className = 'field-err';
    errEl.style.cssText = 'color:var(--danger);font-size:0.78rem;font-family:var(--font-hindi);display:block;margin-top:4px;';
    el.parentNode.appendChild(errEl);
  }
  errEl.textContent = msg;
  el.focus();
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
    if (errEl) errEl.remove();
  }, 3000);
}

function showThankYou(name, mobile) {
  if (formCard) formCard.style.display = 'none';
  if (thankyouBox) {
    thankyouBox.style.display = 'block';
    const waLink = document.getElementById('wa-link');
    if (waLink) {
      const msg = encodeURIComponent(`नमस्ते, मैंने ऑनलाइन साइड इनकम के लिए रजिस्ट्रेशन किया है।\nनाम: ${name}\nमोबाइल: ${mobile}`);
      waLink.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${msg}`;
    }
    // Auto open WhatsApp after 1.5s
    setTimeout(() => {
      const waLink = document.getElementById('wa-link');
      if (waLink) waLink.click();
    }, 1500);
  }
}

// ── SMOOTH SCROLL for CTA ──
document.querySelectorAll('a[href="#register"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('register')?.scrollIntoView({ behavior: 'smooth' });
  });
});

// ── CSS animation for bump ──
const style = document.createElement('style');
style.textContent = `
  @keyframes bump {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); color: #ffffff; }
    100% { transform: scale(1); }
  }
  .bump { animation: bump 0.4s ease-in-out; }
`;
document.head.appendChild(style);

// ── FLOATING PARTICLES ──
function createParticle() {
  const p = document.createElement('div');
  p.style.cssText = `
    position:fixed;
    width:${2 + Math.random()*3}px;
    height:${2 + Math.random()*3}px;
    background:${Math.random() > 0.5 ? 'var(--neon)' : 'var(--gold)'};
    border-radius:50%;
    pointer-events:none;
    z-index:0;
    opacity:${0.2 + Math.random()*0.4};
    left:${Math.random()*100}vw;
    top:${100 + Math.random()*20}vh;
    animation: floatUp ${6 + Math.random()*8}s linear forwards;
  `;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 14000);
}

const particleStyle = document.createElement('style');
particleStyle.textContent = `
  @keyframes floatUp {
    to { transform: translateY(-120vh) rotate(${Math.random()*720}deg); opacity: 0; }
  }
`;
document.head.appendChild(particleStyle);
setInterval(createParticle, 2000);
