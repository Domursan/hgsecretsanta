/* ================================================
   INFORMATIONS.JS
   Logique JavaScript de la page Informations
   Château Marius
   ================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ──────────────────────────────────────────────
     MODALES — fermeture au clic sur l'overlay
  ────────────────────────────────────────────── */
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) window.location.hash = '';
    });
  });

  /* ── Fermeture avec la touche Échap ── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.location.hash) window.location.hash = '';
  });

  /* ── Réinitialise les accordéons à la fermeture d'une modale ── */
  window.addEventListener('hashchange', () => {
    if (!window.location.hash) {
      document.querySelectorAll('.accordeon input[type="radio"]').forEach(r => r.checked = false);
    }
  });

});