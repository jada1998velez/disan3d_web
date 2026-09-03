/* ============================================================
   DISAN3D — utilidades menores
   (El motor principal es app.js; el tema claro/oscuro también.)
   ============================================================ */
(function () {
  'use strict';

  // Iconos Lucide: se crean al cargar y cuando app.js añade nuevos.
  function refreshIcons() {
    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshIcons);
  } else {
    refreshIcons();
  }
})();
