/* ================================================
   ESPACE.JS — Connexion, carte, validation envoi / réception
   Les comptes et les cartes sont côté Apps Script (apps-script/Code.gs)
   ================================================ */

const SESSION_KEY = 'hg_session';
const $ = id => document.getElementById(id);
let token = null;

function getSession() {
  try { return sessionStorage.getItem(SESSION_KEY); } catch (_) { return null; }
}
function setSession(t) {
  try { t ? sessionStorage.setItem(SESSION_KEY, t) : sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
}

function show(vue) {
  $('vue-login').classList.toggle('hidden', vue !== 'login');
  $('vue-espace').classList.toggle('hidden', vue !== 'espace');
}

/* Appel authentifié : renvoie à la connexion si la session a expiré */
async function call(action, data = {}) {
  const res = await apiPost(action, { token, ...data });
  if (!res.ok && res.erreur === 'SESSION_EXPIREE') {
    logout(false);
    showAlert('alert-container', 'Ta session a expiré, reconnecte-toi.', 'info');
    throw new Error('session');
  }
  return res;
}

/* ── Statuts ── */
const TEXTES = {
  envoi:     { oui: '✅ Envoyé, bravo !',  non: 'Pas encore envoyé.', btnOui: "J'ai envoyé mon cadeau", btnNon: 'Annuler' },
  reception: { oui: '✅ Reçu, profites-en !', non: 'Pas encore reçu.',  btnOui: "J'ai reçu mon cadeau",   btnNon: 'Annuler' },
};

function renderStatut(statut) {
  [['envoi', statut.envoye], ['reception', statut.recu]].forEach(([type, fait]) => {
    const bloc = $('statut-' + type);
    const btn = bloc.querySelector('button');
    bloc.classList.toggle('fait', fait);
    bloc.querySelector('.statut-etat').textContent = fait ? TEXTES[type].oui : TEXTES[type].non;
    btn.textContent = fait ? TEXTES[type].btnNon : TEXTES[type].btnOui;
    btn.className = 'btn ' + (fait ? 'btn-outline' : 'btn-primary');
    btn.dataset.valeur = fait ? '0' : '1';
    btn.disabled = false;
  });
}

async function toggleStatut(e) {
  const btn = e.currentTarget;
  const type = btn.dataset.type;
  const valeur = btn.dataset.valeur === '1';
  if (!valeur && !confirm('Annuler cette validation ?')) return;
  btn.disabled = true;
  btn.textContent = '⏳';
  try {
    const res = await call('valider', { type, valeur });
    if (!res.ok) throw new Error(res.erreur);
    renderStatut(res.statut);
    if (valeur) showAlert('alert-container', type === 'envoi' ? 'Envoi validé, merci ! 📦' : 'Réception validée, joyeux Noël ! 🎄', 'success');
  } catch (err) {
    if (err.message !== 'session') {
      showAlert('alert-container', "Oups, ça n'a pas marché. Réessaie dans un instant.", 'error');
      btn.disabled = false;
      btn.textContent = valeur ? TEXTES[type].btnOui : TEXTES[type].btnNon;
    }
  }
}

/* ── Carte ── */
async function loadCarte() {
  const zone = $('carte-zone');
  zone.innerHTML = '<p class="carte-attente">⏳ Chargement de ta carte…</p>';
  try {
    const res = await call('carte');
    if (!res.ok) { zone.innerHTML = `<p class="carte-attente">${res.erreur}</p>`; return; }
    zone.innerHTML = '';
    const img = new Image();
    img.alt = 'Ta carte Secret Santa';
    img.className = 'carte-img';
    img.onerror = () => { zone.innerHTML = '<p class="carte-attente">Impossible d\'afficher ta carte, préviens l\'organisateur.</p>'; };
    img.src = res.url;
    const lien = document.createElement('a');
    lien.href = res.url; lien.target = '_blank'; lien.rel = 'noopener';
    lien.title = 'Ouvrir en grand';
    lien.appendChild(img);
    zone.appendChild(lien);
  } catch (err) {
    if (err.message !== 'session') zone.innerHTML = '<p class="carte-attente">Impossible de charger ta carte pour le moment.</p>';
  }
}

/* ── Connexion / déconnexion ── */
function ouvrirEspace(nom, statut) {
  $('nom').textContent = nom;
  renderStatut(statut);
  show('espace');
  loadCarte();
}

async function login() {
  const login = $('login').value.trim();
  const mdp = $('mdp').value;
  if (!login || !mdp) { showAlert('alert-container', 'Remplis les deux champs.', 'error'); return; }
  const btn = $('btn-login');
  setLoading(btn, true);
  try {
    const res = await apiPost('login', { login, mdp });
    if (!res.ok) throw new Error(res.erreur || 'Connexion impossible.');
    token = res.token; setSession(token);
    $('mdp').value = '';
    ouvrirEspace(res.nom, res.statut);
  } catch (err) {
    showAlert('alert-container', err.message || 'Connexion impossible.', 'error');
  } finally {
    setLoading(btn, false, '🔑 Me connecter');
  }
}

function logout(prevenirServeur = true) {
  if (prevenirServeur && token) apiPost('deconnexion', { token }).catch(() => {});
  token = null; setSession(null);
  $('carte-zone').innerHTML = '';
  show('login');
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  $('btn-login').addEventListener('click', login);
  $('mdp').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('login').addEventListener('keydown', e => { if (e.key === 'Enter') $('mdp').focus(); });
  $('btn-logout').addEventListener('click', () => logout());
  document.querySelectorAll('.statut button').forEach(b => b.addEventListener('click', toggleStatut));

  token = getSession();
  if (!token) { show('login'); return; }
  try {
    const res = await call('moi');
    if (res.ok) ouvrirEspace(res.nom, res.statut);
  } catch (_) { /* déjà renvoyé vers la connexion */ }
  if (!token) show('login');
});
