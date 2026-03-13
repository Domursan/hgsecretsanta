/* ================================================
   MAIN.JS — Père Noël Secret
   Chargement navbar/footer + toggle thème jour/nuit
   ================================================ */

/* ── URL de l'Apps Script Google Sheets ── */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby11nKSVGzaNZ6cXcWIK3IiB7dVB1KyLjZ8FXVEe-9k0J_wSfCnsp7ptSAs9wVSl0yLog/exec';

/* ================================================
   CHARGEMENT DYNAMIQUE NAVBAR & FOOTER
   ================================================ */
async function loadComponent(containerId, filePath) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const res = await fetch(filePath);
    if (!res.ok) throw new Error(`Erreur chargement ${filePath}`);
    container.innerHTML = await res.text();
  } catch (e) {
    console.warn(`Composant non chargé : ${filePath}`, e);
  }
}

function initComponents() {
  const inSubfolder = window.location.pathname.includes('/pages/');
  const prefix = inSubfolder ? '../' : '';
  loadComponent('navbar-container', `${prefix}components/navbar.html`).then(initNavbar);
  loadComponent('footer-container', `${prefix}components/footer.html`);
}

/* ================================================
   NAVBAR — lien actif + burger mobile
   ================================================ */
function initNavbar() {
  const inSubfolder = window.location.pathname.includes('/pages/');
  const prefix      = inSubfolder ? '' : 'pages/';
  const rootPrefix  = inSubfolder ? '../' : '';

  // Résoudre les hrefs depuis les data attributes
  document.querySelectorAll('[data-nav-page]').forEach(el => {
    el.href = prefix + el.dataset.navPage;
  });
  document.querySelectorAll('[data-nav-root]').forEach(el => {
    el.href = rootPrefix + el.dataset.navRoot;
  });

  // Lien actif
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar-links a').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href.endsWith(current)) link.classList.add('active');
  });

  // Burger
  const burger = document.querySelector('.navbar-burger');
  const navLinks = document.querySelector('.navbar-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => navLinks.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!burger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
      }
    });
  }

  // Bouton thème
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    updateThemeButton(toggle);
    toggle.addEventListener('click', toggleTheme);
  }
}

/* ================================================
   THÈME JOUR / NUIT
   ================================================ */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('theme', theme);
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) updateThemeButton(toggle);
}

function updateThemeButton(btn) {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  btn.innerHTML = isLight
    ? '<span class="icon">🌙</span> Nuit'
    : '<span class="icon">☀️</span> Jour';
}

// Appliquer le thème sauvegardé dès le chargement (évite le flash)
(function() {
  const saved = localStorage.getItem('theme') || 'dark';
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
})();

/* ================================================
   APPELS API GOOGLE APPS SCRIPT
   ================================================ */
async function apiFetch(action, params = {}) {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { credentials: 'omit' });
  return res.json();
}

async function apiPost(action, data = {}) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
    credentials: 'omit'
  });
  return res.json();
}

/* ================================================
   UTILITAIRES UI
   ================================================ */
function showAlert(containerId, message, type = 'info') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  container.innerHTML = `
    <div class="alert alert-${type} animate-in">
      <span>${icons[type]}</span> ${message}
    </div>`;
  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

function setLoading(btn, loading, text = '') {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? '⏳ Chargement...' : text || btn.dataset.originalText;
  if (!loading && text) btn.dataset.originalText = text;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/* ================================================
   INIT AU CHARGEMENT
   ================================================ */
document.addEventListener('DOMContentLoaded', initComponents);