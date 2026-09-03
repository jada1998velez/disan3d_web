/* ================================================================
   DISAN3D — d3-data.js  ·  capa de datos (data-driven)
   ----------------------------------------------------------------
   La tienda ya NO tiene productos/categorías en el código.

   Este archivo carga los datos desde JSON en tiempo de ejecución:
     data/config/site.json      → configuración (marca, moneda, temporada…)
     data/groups.json           → ejes de filtro
     data/categories.json       → todas las categorías (con su grupo)
     data/products.json         → índice de productos (generado con build_index.py)

   Cuando termina, deja en window.DISAN3D los datos normalizados y
   lanza el evento 'disan3d:ready' (lo escucha d3-app.js).
   ================================================================ */
(function () {
  'use strict';

  var FILES = {
    site: 'data/config/site.json',
    groups: 'data/groups.json',
    categories: 'data/categories.json',
    products: 'data/products.json'
  };

  function loadJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status + ' en ' + url); }
      return res.json();
    });
  }

  function finish(data) {
    var groups = Array.isArray(data.groups) ? data.groups : [];
    var categories = Array.isArray(data.categories) ? data.categories : [];
    var all = Array.isArray(data.products) ? data.products : [];
    var products = all.filter(function (p) {
      return p && p.available !== false;
    }).map(function (p) {
      p.categories = Array.isArray(p.categories) ? p.categories : [];
      p.images = Array.isArray(p.images) ? p.images : [];
      return p;
    });

    window.DISAN3D = {
      ready: true,
      site: data.site || {},
      groups: groups,
      categories: categories,
      products: products,
      // índice de ayuda (id -> categoría)
      categoryById: function (id) {
        for (var i = 0; i < categories.length; i += 1) {
          if (categories[i].id === id) { return categories[i]; }
        }
        return null;
      },
      groupById: function (id) {
        for (var i = 0; i < groups.length; i += 1) {
          if (groups[i].id === id) { return groups[i]; }
        }
        return null;
      }
    };
    document.dispatchEvent(new CustomEvent('disan3d:ready', { detail: window.DISAN3D }));
  }

  function fallbackEmbedded() {
    if (window.__DISAN3D_EMBED__) {
      finish(window.__DISAN3D_EMBED__);
      return true;
    }
    return false;
  }

  Promise.all([
    loadJSON(FILES.site),
    loadJSON(FILES.groups),
    loadJSON(FILES.categories),
    loadJSON(FILES.products)
  ]).then(function (arr) {
    finish({
      site: arr[0],
      groups: arr[1],
      categories: arr[2],
      products: arr[3]
    });
  }).catch(function (err) {
    // Si falla (p. ej. abierto como file:// o servidor sin los JSON)
    // usamos una instantánea incrustada si existe; si no, avisamos.
    if (fallbackEmbedded()) { return; }
    window.DISAN3D = {
      ready: true,
      site: {},
      groups: [],
      categories: [],
      products: [],
      loadError: String((err && err.message) || err)
    };
    if (window.console && console.warn) {
      console.warn('[DISAN3D] No se pudieron cargar los datos JSON:', err);
    }
    document.dispatchEvent(new CustomEvent('disan3d:ready', { detail: window.DISAN3D }));
  });
})();
