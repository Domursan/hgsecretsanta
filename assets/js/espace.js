/* ================================================
   ESPACE.JS — Connexion, carte, validation envoi / réception
   + navigation entre les espaces pour le compte admin
   Les comptes et les cartes sont côté Apps Script (apps-script/Code.gs)
   ================================================ */

const SESSION_KEY = 'hg_session';
const $ = id => document.getElementById(id);

let token = null;
let moi = null;        // { login, nom, admin }
let cible = null;      // login de l'espace affiché
let comptes = [];      // admin : [{ login, nom, envoye, recu }]

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

const estMoi = () => cible === moi.login;
const nomDe = login => (comptes.find(c => c.login === login) || {}).nom || login;

/* ── Statuts ── */
const TEXTES = {
  envoi:     { titreMoi: 'Mon cadeau est parti',  titre: 'Cadeau envoyé',
               oui: '✅ Envoyé, bravo !',      non: 'Pas encore envoyé.', btnOui: "J'ai envoyé mon cadeau", btnOuiAdmin: 'Marquer comme envoyé' },
  reception: { titreMoi: "J'ai reçu mon cadeau",  titre: 'Cadeau reçu',
               oui: '✅ Reçu, profites-en !',  non: 'Pas encore reçu.',   btnOui: "J'ai reçu mon cadeau",   btnOuiAdmin: 'Marquer comme reçu' },
};

function renderStatut(statut) {
  [['envoi', statut.envoye], ['reception', statut.recu]].forEach(([type, fait]) => {
    const t = TEXTES[type];
    const bloc = $('statut-' + type);
    const btn = bloc.querySelector('button');
    bloc.classList.toggle('fait', fait);
    bloc.querySelector('h3').textContent = estMoi() ? t.titreMoi : t.titre;
    bloc.querySelector('.statut-etat').textContent = fait ? t.oui : t.non;
    btn.textContent = fait ? 'Annuler' : (estMoi() ? t.btnOui : t.btnOuiAdmin);
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
  const vise = cible;
  btn.disabled = true;
  btn.textContent = '⏳';
  try {
    const res = await call('valider', { type, valeur, cible: vise });
    if (!res.ok) throw new Error(res.erreur);
    const c = comptes.find(x => x.login === vise);
    if (c) { c.envoye = res.statut.envoye; c.recu = res.statut.recu; renderAdmin(); }
    if (vise === cible) renderStatut(res.statut);
    if (valeur) showAlert('alert-container', type === 'envoi' ? 'Envoi validé ! 📦' : 'Réception validée ! 🎄', 'success');
  } catch (err) {
    if (err.message !== 'session') {
      showAlert('alert-container', "Oups, ça n'a pas marché. Réessaie dans un instant.", 'error');
      if (vise === cible) {
        btn.disabled = false;
        btn.dataset.valeur = valeur ? '1' : '0';
        btn.textContent = valeur ? (estMoi() ? TEXTES[type].btnOui : TEXTES[type].btnOuiAdmin) : 'Annuler';
      }
    }
  }
}

/* ── Carte ── */
async function loadCarte() {
  const zone = $('carte-zone');
  const vise = cible;
  zone.innerHTML = '<p class="carte-attente">⏳ Chargement de la carte…</p>';
  try {
    const res = await call('carte', { cible: vise });
    if (vise !== cible) return; // l'admin a changé d'espace entre-temps
    if (!res.ok) { zone.innerHTML = `<p class="carte-attente">${res.erreur}</p>`; return; }
    zone.innerHTML = '';
    const img = new Image();
    img.alt = 'Carte Secret Santa';
    img.className = 'carte-img';
    img.onerror = () => { zone.innerHTML = '<p class="carte-attente">Impossible d\'afficher la carte, préviens l\'organisateur.</p>'; };
    img.src = res.url;
    const lien = document.createElement('a');
    lien.href = res.url; lien.target = '_blank'; lien.rel = 'noopener';
    lien.title = 'Ouvrir en grand';
    lien.appendChild(img);
    zone.appendChild(lien);
  } catch (err) {
    if (err.message !== 'session' && vise === cible) zone.innerHTML = '<p class="carte-attente">Impossible de charger la carte pour le moment.</p>';
  }
}

/* ── Admin ── */
function renderAdmin() {
  const liste = $('admin-liste');
  liste.innerHTML = '';
  comptes.forEach(c => {
    const b = document.createElement('button');
    b.className = 'admin-compte' + (c.login === cible ? ' actif' : '');
    b.innerHTML = `<span></span><span class="marques"><span class="${c.envoye ? '' : 'off'}">📦</span><span class="${c.recu ? '' : 'off'}">🎁</span></span>`;
    b.firstChild.textContent = c.login === moi.login ? c.nom + ' (moi)' : c.nom;
    b.title = (c.envoye ? 'Envoyé' : 'Pas envoyé') + ' · ' + (c.recu ? 'Reçu' : 'Pas reçu');
    b.addEventListener('click', () => ouvrir(c.login));
    liste.appendChild(b);
  });
}

async function loadComptes() {
  try {
    const res = await call('comptes');
    if (res.ok) { comptes = res.comptes; renderAdmin(); }
  } catch (_) {}
}

/* Affiche l'espace d'un participant (soi-même par défaut) */
function ouvrir(login) {
  cible = login;
  const soi = estMoi();
  $('admin-banniere').classList.toggle('hidden', soi);
  $('cible-nom').textContent = nomDe(login);
  $('carte-titre').textContent = soi ? '🃏 Ta carte' : '🃏 Sa carte';
  $('carte-sub').textContent = soi
    ? "La personne à qui tu offres un cadeau. Chut, c'est secret !"
    : 'La personne à qui ' + nomDe(login) + ' offre un cadeau.';
  if (moi.admin) renderAdmin();
  const c = comptes.find(x => x.login === login);
  if (c) renderStatut({ envoye: c.envoye, recu: c.recu });
  loadCarte();
}

/* ── Connexion / déconnexion ── */
async function ouvrirEspace(res) {
  moi = { login: res.login, nom: res.nom, admin: !!res.admin };
  comptes = [{ login: res.login, nom: res.nom, envoye: res.statut.envoye, recu: res.statut.recu }];
  $('nom').textContent = res.nom;
  $('admin-nav').classList.toggle('hidden', !moi.admin);
  show('espace');
  ouvrir(moi.login);
  if (moi.admin) loadComptes();
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
    ouvrirEspace(res);
  } catch (err) {
    showAlert('alert-container', err.message || 'Connexion impossible.', 'error');
  } finally {
    setLoading(btn, false, '🔑 Me connecter');
  }
}

function logout(prevenirServeur = true) {
  if (prevenirServeur && token) apiPost('deconnexion', { token }).catch(() => {});
  token = null; moi = null; cible = null; comptes = [];
  setSession(null);
  $('carte-zone').innerHTML = '';
  $('admin-liste').innerHTML = '';
  show('login');
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  $('btn-login').addEventListener('click', login);
  $('mdp').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('login').addEventListener('keydown', e => { if (e.key === 'Enter') $('mdp').focus(); });
  $('btn-logout').addEventListener('click', () => logout());
  $('btn-retour').addEventListener('click', () => ouvrir(moi.login));
  document.querySelectorAll('.statut button').forEach(b => b.addEventListener('click', toggleStatut));

  token = getSession();
  if (!token) { show('login'); return; }
  try {
    const res = await call('moi');
    if (res.ok) ouvrirEspace(res);
  } catch (_) { /* déjà renvoyé vers la connexion */ }
  if (!token) show('login');
});
