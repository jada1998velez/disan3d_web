/* ================================================================
   DISAN3D — d3-app.js  ·  motor de la tienda (data-driven)
   ----------------------------------------------------------------
   Genera toda la interfaz a partir de los JSON (data/config/site.json,
   data/groups.json, data/categories.json y data/products.json).

   - Cabecera / pie / carrito / tarjetas / catálogo con filtros
   - Los filtros de categorías se generan SOLOS a partir de groups.json
   - La temporada destacada de la home se lee de site.featuredSeason
   - Sin emojis como imágenes: placeholders vacíos elegantes

   Depende de d3-data.js (window.DISAN3D). Espera al evento
   'disan3d:ready' antes de arrancar.
   ================================================================ */
(function () {
  'use strict';

  var CART_KEY = 'disan3d:cart';
  var CAMP_TONES = {
    rose: 'from-[#4a1414] via-[#6b1d2a] to-[#0c0f0f]',
    blue: 'from-[#14233a] via-[#1c3a5a] to-[#0c0f0f]',
    pink: 'from-[#3a1420] via-[#5a2440] to-[#0c0f0f]',
    orange: 'from-[#3a1a0e] via-[#5a2c12] to-[#0c0f0f]',
    green: 'from-[#0e2a1c] via-[#14532d] to-[#0c0f0f]',
    brand: 'from-[#12303a] via-[#1f4a52] to-[#0c0f0f]'
  };
  var PRICE_RANGES = [
    ['0-10', 'Hasta 10 €'],
    ['10-20', '10 – 20 €'],
    ['20-40', '20 – 40 €'],
    ['40-999', 'Más de 40 €']
  ];

  /* ---------- Acceso a datos (siempre sobre window.DISAN3D) ---------- */
  function allSite() { return (window.DISAN3D && window.DISAN3D.site) || {}; }
  function allGroups() { return (window.DISAN3D && window.DISAN3D.groups) || []; }
  function allCategories() { return (window.DISAN3D && window.DISAN3D.categories) || []; }
  function allProducts() { return (window.DISAN3D && window.DISAN3D.products) || []; }
  function ui() { return allSite().ui || {}; }
  function brand() { return allSite().brand || {}; }
  function currency() { return allSite().currency || { code: 'EUR', symbol: '€', locale: 'es-ES' }; }
  function siteColors() { return allSite().colors || []; }

  function byOrder(a, b) {
    var oa = typeof a.order === 'number' ? a.order : 1e6;
    var ob = typeof b.order === 'number' ? b.order : 1e6;
    return oa - ob;
  }
  function activeGroups() {
    return allGroups().filter(function (g) { return g.active !== false; }).sort(byOrder);
  }
  function groupById(id) {
    var g = allGroups().filter(function (x) { return x.id === id; });
    return g.length ? g[0] : null;
  }
  function catById(id) {
    if (!id) { return null; }
    var list = allCategories().filter(function (c) { return c.id === id; });
    return list.length ? list[0] : null;
  }
  function catsOfGroup(groupId) {
    return allCategories().filter(function (c) { return c.group === groupId && c.active !== false; }).sort(byOrder);
  }
  function roleGroup(role) {
    var list = activeGroups().filter(function (g) { return g.role === role; });
    return list.length ? list[0] : null;
  }
  function filterGroups() {
    // grupos que se muestran como panel de filtros (todo excepto el rol "catálogo")
    var cat = roleGroup('catalogo');
    return activeGroups().filter(function (g) { return !cat || g.id !== cat.id; });
  }
  function productById(id) {
    return allProducts().filter(function (p) { return p.id === id; })[0] || null;
  }
  /* membresía de un producto en una categoría (soporta categorías derivadas) */
  function catMatches(p, c) {
    if (!c || !p) { return false; }
    if (c.derived) { return !!p[c.derived]; }
    return (p.categories || []).indexOf(c.id) !== -1;
  }
  function productsInCat(c) {
    return allProducts().filter(function (p) { return catMatches(p, c); });
  }
  function productImageSrc(p) {
    return (p && p.images && p.images.length) ? p.images[0] : '';
  }

  /* ---------- Utilidades ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function fmtPrice(n) {
    var num = Number(n) || 0;
    var cur = currency();
    try {
      return new Intl.NumberFormat(cur.locale || 'es-ES', {
        style: 'currency', currency: cur.code || 'EUR', minimumFractionDigits: 2
      }).format(num);
    } catch (e) {
      return num.toFixed(2).replace('.', ',') + ' ' + (cur.symbol || '€');
    }
  }
  function refreshIcons() {
    if (window.lucide && window.lucide.createIcons) { try { window.lucide.createIcons(); } catch (e) {} }
  }
  function productUrl(id) { return 'product-detail.html?p=' + encodeURIComponent(id); }
  /* Enlace de navegación de una categoría:
     - las del grupo con rol "catalogo" van por ?c=
     - el resto usan su grupo como parámetro de filtro (?para=, ?temporada=, ?tipo=…) */
  function catLink(c) {
    var g = groupById(c.group);
    var role = g && g.role;
    if (role === 'catalogo') {
      return 'products.html?c=' + encodeURIComponent(c.id);
    }
    return 'products.html?' + encodeURIComponent(c.group) + '=' + encodeURIComponent(c.id);
  }

  /* Icono visual opcional de una categoría (icono → img o texto; si no, nada) */
  function looksLikeUrl(s) {
    return /^(https?:)?\/\//i.test(s) || /^(data:|\/|\.)/i.test(s) || s.indexOf('/') !== -1;
  }
  function iconGlyph(cat, cls) {
    cls = cls || '';
    if (!cat || !cat.icon) { return ''; }
    if (looksLikeUrl(cat.icon)) {
      return '<img class="' + cls + '" src="' + esc(cat.icon) + '" alt="" loading="lazy"/>';
    }
    return '<span class="' + cls + '">' + esc(cat.icon) + '</span>';
  }
  /* placeholder de imagen vacío (sin emojis) */
  function phSvg(cls) {
    return '<svg class="' + (cls || 'w-10 h-10') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>';
  }
  function initialsOf(s, max) {
    max = max || 2;
    var clean = String(s || '').replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    var words = clean.split(' ');
    var stop = ['para', 'los', 'las', 'mi', 'el', 'la', 'de', 'y'];
    words = words.filter(function (w) { return w && stop.indexOf(w.toLowerCase()) === -1; });
    if (!words.length) { words = clean.split(' ').filter(Boolean); }
    var letters = words.slice(0, max).map(function (w) { return w.charAt(0); });
    return letters.join('').toUpperCase() || '?';
  }
  /* iconos lucide y svgs propios */
  function icon(name, cls) {
    return '<i data-lucide="' + name + '" class="' + (cls || 'w-5 h-5') + '"></i>';
  }
  function chev(cls) {
    return '<i data-lucide="chevron-down" class="' + (cls || 'w-4 h-4') + ' transition-transform group-hover:rotate-180"></i>';
  }
  function d3cube(cls) {
    return '<svg class="' + (cls || 'w-5 h-5') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 8.5v7l-9 5.2-9-5.2v-7L12 3.3l9 5.2z"/><path d="M3.3 8.6 12 13.7l8.7-5.1M12 22.7V13.7"/></svg>';
  }
  function categoryImageBlock(cat, bigCls) {
    // Fondo de tarjeta/tile de categoría: imagen real, icono o placeholder vacío
    bigCls = bigCls || 'text-6xl';
    if (cat && cat.image) {
      return '<img class="absolute inset-0 w-full h-full object-cover" src="' + esc(cat.image) + '" alt="' + esc(cat.name) + '" loading="lazy"/>';
    }
    if (cat && cat.icon) {
      return '<div class="absolute inset-0 flex items-center justify-center">' + iconGlyph(cat, bigCls + ' opacity-90') + '</div>';
    }
    return '<div class="absolute inset-0 flex items-center justify-center opacity-25">' + d3cube(bigCls) + '</div>';
  }

  /* ================================================================
     CABECERA Y PIE
     ================================================================ */
  function seasonLink(c) { return 'products.html?temporada=' + encodeURIComponent(c.id); }

  function navCatalogGroup() { return roleGroup('catalogo') || groupById('categoria'); }
  function navRegalosGroup() { return roleGroup('regalos') || groupById('para'); }
  function navTemporadaGroup() { return roleGroup('temporada') || groupById('temporada'); }

  function seasonCategory() {
    var id = allSite().featuredSeason;
    if (!id) { return null; }
    var c = catById(id);
    if (!c || c.active === false || !c.featured || c.featured.active === false) { return null; }
    return c;
  }
  function seasonNavChip() {
    var c = seasonCategory();
    if (!c) { return ''; }
    var tone = (c.featured && c.featured.kicker) || 'Temporada';
    return '<a class="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider ' +
      'text-brand-700 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/50 dark:text-brand-100 dark:hover:bg-brand-800 transition-colors" href="' + seasonLink(c) + '">' +
      iconGlyph(c, 'w-4 h-4') + '<span>' + esc(c.featured.title || c.name) + '</span>' +
      '</a>';
  }

  function headerMenuItems(list, opts) {
    opts = opts || {};
    return list.map(function (c) {
      var extra = opts.showBlurb ? '<span class="block text-[11px] text-gray-400 font-normal tracking-normal normal-case mt-0.5">' + esc(c.blurb || '') + '</span>' : '';
      var glyph = opts.square
        ? '<span class="h-9 w-9 flex-none rounded-lg product-ph flex items-center justify-center overflow-hidden">' + iconGlyph(c, 'w-4 h-4') + '<span class="text-[10px] font-bold text-ink/40 dark:text-white/40">' + (c.icon ? '' : initialsOf(c.name, 1)) + '</span></span>'
        : iconGlyph(c, 'text-base leading-none');
      return '<a class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-brand-50 dark:hover:bg-brand-900/40 hover:text-brand-700 dark:hover:text-brand-200 transition-colors" href="' + catLink(c) + '">' +
        glyph +
        '<span class="uppercase tracking-widest text-xs font-medium">' + esc(c.name) + '</span>' + extra +
        '</a>';
    }).join('');
  }

  function headerHTML() {
    var catGroup = navCatalogGroup();
    var regalosGroup = navRegalosGroup();
    var tempGroup = navTemporadaGroup();
    var catItems = catGroup ? catsOfGroup(catGroup.id) : [];
    var regalosItems = regalosGroup ? catsOfGroup(regalosGroup.id) : [];
    var tempItems = tempGroup ? catsOfGroup(tempGroup.id) : [];
    var b = brand();

    return '' +
      '<header class="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#0b0f0f] border-b border-gray-100 dark:border-gray-800/70 transition-colors">' +
      '  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">' +
      '    <div class="h-16 lg:h-[4.5rem] flex items-center justify-between gap-4">' +
      '      <button type="button" class="lg:hidden -ml-2 p-2 text-gray-800 dark:text-white hover:text-brand-600 dark:hover:text-brand-300 transition-colors" id="d3-menu-btn" aria-label="Abrir menú">' + icon('menu') + '</button>' +
      '      <a href="index.html" class="flex items-center gap-2 group lg:flex-none" aria-label="' + esc(b.name || 'DISAN 3D') + ' — Inicio">' +
      '        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-300 group-hover:bg-brand-500 group-hover:text-white transition-colors" aria-hidden="true">' + d3cube() + '</span>' +
      '        <span class="font-display text-base sm:text-lg font-semibold tracking-[0.28em] uppercase text-ink dark:text-white">' + esc(b.name || 'DISAN 3D') + '</span>' +
      '      </a>' +
      '      <nav class="hidden lg:flex items-center gap-1" aria-label="Principal">' +
      '        <a class="px-3 py-2 text-[13px] font-medium uppercase tracking-widest text-ink/80 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="index.html">Inicio</a>' +
      (catGroup
        ? '        <div class="relative group">' +
          '          <button type="button" class="px-3 py-2 inline-flex items-center gap-1 text-[13px] font-medium uppercase tracking-widest text-ink/80 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-300 transition-colors">Catálogo' + chev('w-3.5 h-3.5') + '</button>' +
          '          <div class="absolute left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-150">' +
          '            <div class="w-72 rounded-2xl bg-white dark:bg-gray-900 shadow-soft ring-1 ring-gray-100 dark:ring-gray-800 p-3">' +
          '              <p class="px-3 pt-1 pb-2 text-[10px] uppercase tracking-[0.25em] text-gray-400">Explora por categoría</p>' +
          headerMenuItems(catItems) +
          '              <a class="mt-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-xs uppercase tracking-widest font-medium text-brand-600 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/40 transition-colors" href="products.html">Ver todo el catálogo' + icon('arrow-right', 'w-3.5 h-3.5') + '</a>' +
          '            </div>' +
          '          </div>' +
          '        </div>'
        : '') +
      (regalosGroup
        ? '        <div class="relative group">' +
          '          <button type="button" class="px-3 py-2 inline-flex items-center gap-1 text-[13px] font-medium uppercase tracking-widest text-ink/80 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-300 transition-colors">Regalos' + chev('w-3.5 h-3.5') + '</button>' +
          '          <div class="absolute left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-150">' +
          '            <div class="w-80 rounded-2xl bg-white dark:bg-gray-900 shadow-soft ring-1 ring-gray-100 dark:ring-gray-800 p-3">' +
          '              <p class="px-3 pt-1 pb-2 text-[10px] uppercase tracking-[0.25em] text-gray-400">¿Para quién es el regalo?</p>' +
          headerMenuItems(regalosItems) +
          '            </div>' +
          '          </div>' +
          '        </div>'
        : '') +
      '        <a class="px-3 py-2 text-[13px] font-medium uppercase tracking-widest text-ink/80 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="collections.html">Temporadas</a>' +
      '        <a class="px-3 py-2 text-[13px] font-medium uppercase tracking-widest text-ink/80 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="about.html">Nosotros</a>' +
      '      </nav>' +
      '      <div class="flex items-center gap-0.5 sm:gap-1">' +
      seasonNavChip() +
      '        <button type="button" class="p-2 text-gray-700 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-300 transition-colors" id="d3-dark-btn" aria-label="Cambiar tema"></button>' +
      '        <a class="relative p-2 text-gray-700 dark:text-gray-200 hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="cart.html" aria-label="Mi pedido (carrito)">' +
      icon('shopping-bag') +
      '          <span class="d3-cart-count absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center hidden"></span>' +
      '        </a>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="lg:hidden fixed inset-0 z-[60] bg-black/50 hidden" id="d3-menu-overlay" aria-hidden="true"></div>' +
      '  <div class="lg:hidden fixed inset-y-0 left-0 z-[70] w-[86%] max-w-sm bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto transition-transform duration-300 -translate-x-full" id="d3-mobile-menu" aria-label="Menú móvil">' +
      '    <div class="flex items-center justify-between px-5 h-16 border-b border-gray-100 dark:border-gray-800">' +
      '      <span class="font-display text-base font-semibold tracking-[0.28em] uppercase text-ink dark:text-white">' + esc(b.name || 'DISAN 3D') + '</span>' +
      '      <button type="button" class="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white" id="d3-menu-close" aria-label="Cerrar menú">' + icon('x') + '</button>' +
      '    </div>' +
      '    <nav class="px-5 py-6 space-y-1 text-sm" aria-label="Menú móvil">' +
      '      <a class="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 uppercase tracking-widest text-xs font-medium text-ink/90 dark:text-gray-100" href="index.html">Inicio</a>' +
      '      <a class="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 uppercase tracking-widest text-xs font-medium text-brand-600 dark:text-brand-300" href="products.html">Todo el catálogo</a>' +
      (catGroup
        ? '      <p class="pt-4 pb-1 text-[10px] uppercase tracking-[0.25em] text-gray-400">Catálogo</p>' +
          catItems.map(function (c) {
            return '<a class="flex items-center gap-3 py-2.5 text-gray-700 dark:text-gray-200" href="' + catLink(c) + '">' + iconGlyph(c, 'text-lg w-6 flex-none') + '<span class="font-medium">' + esc(c.name) + '</span></a>';
          }).join('')
        : '') +
      (regalosGroup
        ? '      <p class="pt-4 pb-1 text-[10px] uppercase tracking-[0.25em] text-gray-400">Regalos · ¿para quién?</p>' +
          regalosItems.map(function (c) {
            return '<a class="flex items-center gap-3 py-2.5 text-gray-700 dark:text-gray-200" href="' + catLink(c) + '"><span class="text-base w-5 flex-none">' + iconGlyph(c) + '</span><span>' + esc(c.name) + '</span></a>';
          }).join('')
        : '') +
      (tempGroup
        ? '      <p class="pt-4 pb-1 text-[10px] uppercase tracking-[0.25em] text-gray-400">Temporadas</p>' +
          tempItems.map(function (c) {
            return '<a class="flex items-center gap-3 py-2.5 text-gray-700 dark:text-gray-200" href="' + seasonLink(c) + '"><span class="text-base w-5 flex-none">' + iconGlyph(c) + '</span><span>' + esc(c.featured ? (c.featured.title || c.name) : c.name) + '</span></a>';
          }).join('')
        : '') +
      '      <div class="pt-4 mt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">' +
      '        <a class="flex items-center gap-3 py-2.5 text-gray-700 dark:text-gray-200" href="collections.html">' + icon('calendar', 'w-5 h-5 text-gray-400') + '<span class="font-medium">Colecciones y temporadas</span></a>' +
      '        <a class="flex items-center gap-3 py-2.5 text-gray-700 dark:text-gray-200" href="about.html">' + d3cube('w-5 h-5 text-gray-400') + '<span class="font-medium">Nosotros</span></a>' +
      '        <a class="flex items-center gap-3 py-2.5 text-gray-700 dark:text-gray-200" href="contact.html">' + icon('mail', 'w-5 h-5 text-gray-400') + '<span class="font-medium">Contacto</span></a>' +
      '      </div>' +
      '    </nav>' +
      '    <div class="px-5 pb-8">' +
      '      <a class="block w-full py-3.5 text-center bg-brand-500 hover:bg-brand-600 text-white uppercase tracking-widest text-xs font-semibold rounded-xl transition-colors" href="contact.html">¿Tienes una idea? Cuéntanosla</a>' +
      '    </div>' +
      '  </div>' +
      '</header>';
  }

  function footerHTML() {
    var catGroup = navCatalogGroup();
    var catItems = catGroup ? catsOfGroup(catGroup.id) : [];
    var b = brand();
    return '' +
      '<footer class="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">' +
      '  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">' +
      '    <div class="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-10">' +
      '      <div class="col-span-2">' +
      '        <a class="flex items-center gap-2 mb-4" href="index.html">' +
      '          <span class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-300">' + d3cube() + '</span>' +
      '          <span class="font-display text-base font-semibold tracking-[0.28em] uppercase text-ink dark:text-white">' + esc(b.name || 'DISAN 3D') + '</span>' +
      '        </a>' +
      '        <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4 max-w-xs">Diseño y fabricación aditiva. Productos impresos en 3D, personalizados y listos para regalar o decorar tu casa.</p>' +
      '        <p class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest">Hecho en ' + esc(b.city || '') + '</p>' +
      '      </div>' +
      '      <div>' +
      '        <h4 class="text-[11px] uppercase tracking-[0.2em] text-ink dark:text-white font-semibold mb-5">Catálogo</h4>' +
      '        <ul class="space-y-3 text-sm text-gray-500 dark:text-gray-400">' +
      catItems.map(function (c) { return '<li><a class="hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="' + catLink(c) + '">' + esc(c.name) + '</a></li>'; }).join('') +
      '          <li><a class="hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="collections.html">Temporadas</a></li>' +
      '          <li><a class="hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="lookbook.html">Regalos por persona</a></li>' +
      '        </ul>' +
      '      </div>' +
      '      <div>' +
      '        <h4 class="text-[11px] uppercase tracking-[0.2em] text-ink dark:text-white font-semibold mb-5">Ayuda</h4>' +
      '        <ul class="space-y-3 text-sm text-gray-500 dark:text-gray-400">' +
      '          <li><a class="hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="contact.html">Contacto</a></li>' +
      '          <li><a class="hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="contact.html">Cómo funciona</a></li>' +
      '          <li><a class="hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="cart.html">Mi pedido</a></li>' +
      '          <li><a class="hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="privacy.html">Privacidad</a></li>' +
      '          <li><a class="hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="terms.html">Términos</a></li>' +
      '        </ul>' +
      '      </div>' +
      '      <div>' +
      '        <h4 class="text-[11px] uppercase tracking-[0.2em] text-ink dark:text-white font-semibold mb-5">Síguenos</h4>' +
      '        <ul class="space-y-3 text-sm text-gray-500 dark:text-gray-400">' +
      '          <li><a class="hover:text-brand-600 dark:hover:text-brand-300 transition-colors" target="_blank" rel="noopener" href="https://instagram.com/' + encodeURIComponent(b.instagram || 'disan3d') + '">Instagram</a></li>' +
      '          <li><a class="hover:text-brand-600 dark:hover:text-brand-300 transition-colors" target="_blank" rel="noopener" href="https://facebook.com">Facebook</a></li>' +
      '          <li><a class="hover:text-brand-600 dark:hover:text-brand-300 transition-colors" href="mailto:' + esc(b.email || '') + '">' + esc(b.email || '') + '</a></li>' +
      '        </ul>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="border-t border-gray-200/70 dark:border-gray-800">' +
      '    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-3">' +
      '      <p class="text-xs text-gray-400 dark:text-gray-500">© ' + new Date().getFullYear() + ' DISAN3D. Todos los derechos reservados.</p>' +
      '      <div class="flex items-center gap-6">' +
      '        <a class="text-xs text-gray-400 dark:text-gray-500 hover:text-brand-600 transition-colors" href="privacy.html">Privacidad</a>' +
      '        <a class="text-xs text-gray-400 dark:text-gray-500 hover:text-brand-600 transition-colors" href="terms.html">Términos</a>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</footer>';
  }

  /* ---------- Cabecera / menú móvil / tema ---------- */
  function initHeader() {
    var headerHost = $('#site-header');
    var footerHost = $('#site-footer');
    if (headerHost) { headerHost.innerHTML = headerHTML(); }
    if (!footerHost) {
      footerHost = document.createElement('div');
      footerHost.id = 'site-footer';
      document.body.appendChild(footerHost);
    }
    if (footerHost) { footerHost.innerHTML = footerHTML(); }

    var menuBtn = $('#d3-menu-btn'), menu = $('#d3-mobile-menu'),
      overlay = $('#d3-menu-overlay'), closeBtn = $('#d3-menu-close');
    function openMenu() {
      if (menu) { menu.classList.remove('-translate-x-full'); overlay.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
    }
    function closeMenu() {
      if (menu) { menu.classList.add('-translate-x-full'); overlay.classList.add('hidden'); document.body.style.overflow = ''; }
    }
    if (menuBtn) { menuBtn.addEventListener('click', openMenu); }
    if (closeBtn) { closeBtn.addEventListener('click', closeMenu); }
    if (overlay) { overlay.addEventListener('click', closeMenu); }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(); closeFilters(); } });

    var darkBtn = $('#d3-dark-btn');
    function paintDarkBtn() {
      if (!darkBtn) { return; }
      var isDark = document.documentElement.classList.contains('dark');
      darkBtn.innerHTML = isDark ? icon('sun') : icon('moon');
      refreshIcons();
    }
    function applyDark(dark) {
      if (dark) { document.documentElement.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); }
      try { localStorage.setItem('disan3d:dark', dark ? '1' : '0'); } catch (e) {}
      paintDarkBtn();
    }
    if (darkBtn) {
      darkBtn.addEventListener('click', function () { applyDark(!document.documentElement.classList.contains('dark')); });
      paintDarkBtn();
    }
    if (window.__d3InitialDark) { applyDark(true); }
  }

  /* ================================================================
     CARRITO (localStorage)
     ================================================================ */
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; }
  }
  function saveCart(cart) { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} }
  function cartCount() { return readCart().reduce(function (n, it) { return n + (it.qty || 1); }, 0); }
  function updateBadges() {
    var n = cartCount();
    $all('.d3-cart-count').forEach(function (el) {
      el.textContent = n > 99 ? '99+' : String(n);
      el.classList.toggle('hidden', n === 0);
    });
  }
  function addToCart(id, opts) {
    opts = opts || {};
    var cart = readCart();
    var product = productById(id);
    if (!product) { return; }
    var key = id + '|' + (opts.color || '') + '|' + (opts.text || '');
    var found = cart.filter(function (it) { return it.key === key; })[0];
    if (found) { found.qty += (opts.qty || 1); }
    else {
      cart.push({
        key: key, slug: id, name: product.name,
        price: product.price, color: opts.color || '',
        text: opts.text || '', image: productImageSrc(product),
        qty: opts.qty || 1
      });
    }
    saveCart(cart);
    updateBadges();
    return product;
  }
  function removeFromCart(key) { saveCart(readCart().filter(function (it) { return it.key !== key; })); updateBadges(); }
  function setCartQty(key, qty) {
    var cart = readCart();
    var it = cart.filter(function (x) { return x.key === key; })[0];
    if (it) { it.qty = Math.max(1, qty); saveCart(cart); updateBadges(); }
  }
  function cartSubtotal() { return readCart().reduce(function (s, it) { return s + (it.price * it.qty); }, 0); }

  /* ================================================================
     TARJETA DE PRODUCTO
     ================================================================ */
  function productImageBlock(p, cls) {
    cls = cls || '';
    var src = productImageSrc(p);
    if (src) {
      return '<img class="w-full h-full object-cover ' + cls + '" src="' + esc(src) + '" alt="' + esc(p.name) + '" loading="lazy"/>';
    }
    return '<div class="w-full h-full flex items-center justify-center product-ph ' + cls + '" aria-hidden="true">' +
      '<span class="opacity-30 text-ink/40 dark:text-white/30">' + phSvg() + '</span></div>';
  }

  function productCard(p) {
    var badge = p.customizable
      ? '<span class="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 dark:bg-gray-900/90 backdrop-blur px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300 shadow-sm">' + icon('pen-line', 'w-3 h-3') + 'Personalizable</span>'
      : '';
    var best = p.bestseller
      ? '<span class="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-ink/90 dark:bg-white/90 text-white dark:text-gray-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-sm">' + icon('star', 'w-3 h-3') + 'Top</span>'
      : '';
    var from = ui().from || 'Desde';
    return '' +
      '<a class="group relative flex flex-col rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-gray-100 dark:ring-gray-800 hover:ring-brand-300 dark:hover:ring-brand-700 hover:shadow-soft transition-all duration-300 overflow-hidden" href="' + productUrl(p.id) + '">' +
      '  <div class="relative aspect-square overflow-hidden bg-gray-50 dark:bg-gray-800/60">' +
      badge + best +
      '    <div class="w-full h-full transition-transform duration-500 group-hover:scale-[1.04]">' + productImageBlock(p) + '</div>' +
      '  </div>' +
      '  <div class="flex flex-col flex-1 p-3.5 sm:p-4">' +
      '    <h3 class="text-sm sm:text-[15px] font-medium text-ink dark:text-white leading-snug mb-0.5">' + esc(p.name) + '</h3>' +
      '    <p class="text-xs text-gray-400 dark:text-gray-500 line-clamp-1 mb-2">' + esc(p.tagline || '') + '</p>' +
      '    <div class="mt-auto flex items-center justify-between pt-1">' +
      '      <span class="text-sm sm:text-base font-semibold text-ink dark:text-white">' +
      (p.customizable ? '<span class="text-[10px] font-medium uppercase tracking-wider text-gray-400">' + from + ' </span>' : '') + fmtPrice(p.price) +
      '      </span>' +
      '      <span class="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300 group-hover:gap-1.5 transition-all">Ver' + icon('arrow-right', 'w-3.5 h-3.5') + '</span>' +
      '    </div>' +
      '  </div>' +
      '</a>';
  }

  function renderGrid(container, products) {
    if (!container) { return; }
    if (!products || !products.length) { container.innerHTML = emptyStateHTML(); return; }
    container.innerHTML = products.map(function (p) {
      return '<div class="d3-fade-up">' + productCard(p) + '</div>';
    }).join('');
  }
  function emptyStateHTML() {
    return '' +
      '<div class="col-span-full py-16 sm:py-24 text-center">' +
      '  <div class="flex justify-center mb-4"><span class="opacity-40 text-gray-300 dark:text-gray-600">' + phSvg('w-14 h-14') + '</span></div>' +
      '  <h3 class="font-display text-xl font-semibold text-ink dark:text-white mb-2">' + esc(ui().emptyTitle || 'Todavía no hay productos aquí') + '</h3>' +
      '  <p class="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">' + esc(ui().emptyText || '') + '</p>' +
      '  <a class="inline-block px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white uppercase tracking-widest text-xs font-semibold transition-colors" href="contact.html">Pregúntanos por WhatsApp o email</a>' +
      '</div>';
  }

  /* ================================================================
     CATÁLOGO (products.html)
     ================================================================ */
  var catalogState = { page: 1, perPage: 12 };
  var f = {};

  function buildFilterFromURL() {
    var params = new URLSearchParams(location.search);
    var f = { c: params.get('c') || 'todo', personalizable: params.get('personalizable'), busqueda: params.get('q') || '', precio: params.get('precio'), max: params.get('max') ? Number(params.get('max')) : null };
    filterGroups().forEach(function (g) {
      var v = params.get(g.id);
      if (v) { f[g.id] = v; }
    });
    return f;
  }

  function catalogMatches(p, f) {
    if (f.c && f.c !== 'todo') {
      var ccat = catById(f.c);
      if (!ccat || !catMatches(p, ccat)) { return false; }
    }
    for (var i = 0; i < filterGroups().length; i += 1) {
      var g = filterGroups()[i];
      var val = f[g.id];
      if (!val) { continue; }
      var cat = catById(val);
      if (!cat || cat.group !== g.id || !catMatches(p, cat)) { return false; }
    }
    if (f.personalizable === 'si' && !p.customizable) { return false; }
    if (f.personalizable === 'no' && p.customizable) { return false; }
    if (f.precio) {
      var range = String(f.precio).split('-');
      var lo = parseFloat(range[0]);
      var hi = range[1] ? parseFloat(range[1]) : Infinity;
      if (p.price < lo || p.price > hi) { return false; }
    }
    if (f.busqueda) {
      var q = f.busqueda.toLowerCase();
      var hay = String(p.name + ' ' + (p.tagline || '') + ' ' + (p.description || '')).toLowerCase().indexOf(q) !== -1;
      if (!hay) { return false; }
    }
    return true;
  }
  function filterProducts(f) { return allProducts().filter(function (p) { return catalogMatches(p, f); }); }
  function sortProducts(list, sort) {
    var arr = list.slice();
    if (sort === 'price-asc') { arr.sort(function (a, b) { return a.price - b.price; }); }
    else if (sort === 'price-desc') { arr.sort(function (a, b) { return b.price - a.price; }); }
    else { arr.sort(function (a, b) { return (b.bestseller ? 1 : 0) - (a.bestseller ? 1 : 0); }); }
    return arr;
  }

  function filtersPanelHTML() {
    var html = '';
    filterGroups().forEach(function (g) {
      var opts = catsOfGroup(g.id);
      if (!opts.length) { return; } // grupos sin categorías activas → no se pintan
      html += '<div class="pb-5" data-filter-group="' + esc(g.id) + '">' +
        '<p class="text-[11px] uppercase tracking-widest font-semibold text-ink dark:text-white mb-3">' + esc(g.name) + '</p>' +
        '<div class="flex flex-wrap gap-2">' +
        opts.map(function (item) {
          return '<label class="cursor-pointer"><input type="radio" name="' + esc(g.id) + '" value="' + esc(item.id) + '" class="peer sr-only"/>' +
            '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-brand-900/40 hover:text-brand-700 transition-colors peer-checked:bg-brand-500 peer-checked:text-white peer-checked:hover:bg-brand-600">' + esc(item.name) + '</span></label>';
        }).join('') +
        '</div></div>';
    });
    html += '<div class="pb-5" data-filter-group="personalizable">' +
      '<p class="text-[11px] uppercase tracking-widest font-semibold text-ink dark:text-white mb-3">Personalización</p>' +
      '<div class="flex flex-wrap gap-2">' +
      '<label class="cursor-pointer"><input type="radio" name="personalizable" value="si" class="peer sr-only"/><span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 peer-checked:bg-brand-500 peer-checked:text-white">' + icon('pen-line', 'w-3.5 h-3.5') + 'Personalizable</span></label>' +
      '<label class="cursor-pointer"><input type="radio" name="personalizable" value="no" class="peer sr-only"/><span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 peer-checked:bg-brand-500 peer-checked:text-white">Sin personalizar</span></label>' +
      '</div></div>';
    html += '<div class="pb-5" data-filter-group="precio">' +
      '<p class="text-[11px] uppercase tracking-widest font-semibold text-ink dark:text-white mb-3">Precio</p>' +
      '<div class="flex flex-wrap gap-2">' +
      PRICE_RANGES.map(function (r) {
        return '<label class="cursor-pointer"><input type="radio" name="precio" value="' + r[0] + '" class="peer sr-only"/><span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 peer-checked:bg-brand-500 peer-checked:text-white">' + r[1] + '</span></label>';
      }).join('') +
      '</div></div>';
    return html;
  }

  function cloneFilterTemplate() {
    var panel = filtersPanelHTML();
    $all('.filter-insert').forEach(function (host) {
      if (!host.dataset.filled) { host.innerHTML = panel; host.dataset.filled = '1'; }
    });
  }

  function catalogContext(f) {
    var temp = roleGroup('temporada');
    var seen = ['c'].concat(filterGroups().map(function (g) { return g.id; }));
    for (var i = 0; i < seen.length; i += 1) {
      var key = seen[i];
      var val = (key === 'c') ? (f.c && f.c !== 'todo' ? f.c : null) : f[key];
      if (!val) { continue; }
      var cat = catById(val);
      if (!cat) { continue; }
      if (cat.group && temp && cat.group === temp.id && cat.featured) {
        return { kicker: cat.featured.kicker || 'Temporada', title: cat.featured.title || cat.name, text: cat.featured.subtitle || cat.blurb || '' };
      }
      return { kicker: 'Catálogo', title: cat.name, text: cat.blurb || '' };
    }
    return { kicker: 'Catálogo', title: 'Todos los productos', text: 'Piezas únicas impresas en 3D, listas para regalar o decorar.' };
  }

  function buildTabs(catItems) {
    function tab(c, active) {
      return '<button type="button" data-cat-tab="' + esc(c.id) + '" class="flex-none inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-colors ' +
        (active ? 'bg-ink text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:text-brand-700') + '">' +
        iconGlyph(c, 'w-3.5 h-3.5') + esc(c.name) + '</button>';
    }
    return '<button type="button" data-cat-tab="todo" class="flex-none px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-colors ' +
      (f.c === 'todo' ? 'bg-ink text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:text-brand-700') + '">Todo</button>' +
      catItems.map(function (c) { return tab(c, f.c === c.id); }).join('');
  }

  function chipLabelOf(groupId, val) {
    if (groupId === 'precio') {
      for (var i = 0; i < PRICE_RANGES.length; i += 1) { if (PRICE_RANGES[i][0] === val) { return PRICE_RANGES[i][1]; } }
      return val;
    }
    var cat = catById(val);
    return cat ? cat.name : '';
  }

  function initCatalogPage() {
    var host = $('#catalog-root');
    if (!host) { return; }
    cloneFilterTemplate();
    var catGroup = navCatalogGroup();
    var catItems = catGroup ? catsOfGroup(catGroup.id) : [];

    f = buildFilterFromURL();
    catalogState = { page: 1, perPage: host.dataset.perPage ? Number(host.dataset.perPage) : 12, state: f };

    var tabsHost = $('#catalog-tabs');
    if (tabsHost) { tabsHost.innerHTML = buildTabs(catItems); }

    var heroTitle = $('#catalog-hero-title'), heroKicker = $('#catalog-hero-kicker'), heroText = $('#catalog-hero-text');
    function paintHero() {
      var ctx = catalogContext(f);
      if (heroTitle) { heroTitle.textContent = ctx.title; }
      if (heroKicker) { heroKicker.textContent = ctx.kicker; }
      if (heroText) { heroText.textContent = ctx.text; }
    }
    paintHero();

    var grid = $('#catalog-grid');
    var sortSel = $('#catalog-sort');
    var countEl = $('#catalog-count');
    var loadBtn = $('#catalog-load');

    function renderIntoGrid(g, list) {
      if (!list.length) { g.innerHTML = '<div class="col-span-full">' + emptyStateHTML() + '</div>'; return; }
      g.innerHTML = list.map(function (p) { return '<div class="d3-fade-up">' + productCard(p) + '</div>'; }).join('');
    }
    function apply() {
      var all = sortProducts(filterProducts(f), sortSel ? sortSel.value : 'featured');
      var total = all.length;
      var shown = all.slice(0, catalogState.page * catalogState.perPage);
      renderIntoGrid(grid, shown);
      if (countEl) { countEl.textContent = total + (total === 1 ? ' producto' : ' productos'); }
      if (loadBtn) { loadBtn.classList.toggle('hidden', shown.length >= total); loadBtn.dataset.remaining = String(total - shown.length); }
      paintActiveChips();
      syncFilterControls();
      refreshIcons();
    }

    function syncFilterControls() {
      var keys = filterGroups().map(function (g) { return g.id; }).concat(['personalizable', 'precio']);
      keys.forEach(function (k) {
        $all('input[name="' + k + '"]').forEach(function (inp) { inp.checked = inp.value === (f[k] || ''); });
      });
    }
    function bindFilters() {
      $all('[data-filter-group]').forEach(function (group) {
        group.addEventListener('change', function () {
          var key = group.dataset.filterGroup;
          var val = group.querySelector('input[name="' + key + '"]:checked');
          f[key] = val ? val.value : null;
          catalogState.page = 1; syncURL(); apply(); paintHero();
        });
      });
    }
    function syncURL() {
      var p = new URLSearchParams();
      if (f.c && f.c !== 'todo') { p.set('c', f.c); }
      filterGroups().forEach(function (g) { if (f[g.id]) { p.set(g.id, f[g.id]); } });
      if (f.personalizable) { p.set('personalizable', f.personalizable); }
      if (f.precio) { p.set('precio', f.precio); }
      var qs = p.toString();
      try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (e) {}
    }
    function paintActiveChips() {
      var box = $('#catalog-active');
      if (!box) { return; }
      var chips = [];
      var add = function (groupKey, val, label) {
        if (!label) { return; }
        chips.push('<button type="button" class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-900/50 text-brand-700 dark:text-brand-200 px-3 py-1.5 text-xs font-medium" data-remove="' + esc(groupKey) + '|' + esc(val) + '">' + esc(label) + icon('x', 'w-3 h-3') + '</button>');
      };
      if (f.c && f.c !== 'todo') { add('c', f.c, chipLabelOf('c', f.c)); }
      filterGroups().forEach(function (g) { if (f[g.id]) { add(g.id, f[g.id], chipLabelOf(g.id, f[g.id])); } });
      if (f.personalizable) { add('personalizable', f.personalizable, f.personalizable === 'si' ? 'Personalizable' : 'No personalizable'); }
      if (f.precio) { add('precio', f.precio, chipLabelOf('precio', f.precio)); }
      box.innerHTML = chips.join(' ');
      $all('[data-remove]', box).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var parts = btn.dataset.remove.split('|');
          var field = parts[0], value = parts[1];
          if (field === 'c') { f.c = 'todo'; }
          else { f[field] = null; }
          // si era una categoría de tipo, también quitamos radio
          catalogState.page = 1; syncURL(); apply(); paintHero();
          var ctab = $('button[data-cat-tab="' + value + '"]');
          if (field === 'c' && ctab) { ctab.classList.remove('bg-ink', 'text-white', 'dark:bg-white', 'dark:text-gray-900'); ctab.classList.add('bg-gray-100', 'text-gray-600', 'dark:bg-gray-800', 'dark:text-gray-300'); var t = $('button[data-cat-tab="todo"]'); if (t) { t.classList.add('bg-ink', 'text-white', 'dark:bg-white', 'dark:text-gray-900'); t.classList.remove('bg-gray-100', 'text-gray-600', 'dark:bg-gray-800', 'dark:text-gray-300'); } }
        });
      });
    }

    // Tabs de categoría
    $all('[data-cat-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var c = tab.dataset.catTab;
        var nf = buildFilterFromURL();
        // limpiar filtros de grupo al cambiar de categoría tab (como antes)
        filterGroups().forEach(function (g) { nf[g.id] = null; });
        nf.personalizable = null; nf.precio = null;
        nf.c = c;
        f = nf;
        catalogState.page = 1;
        $all('[data-cat-tab]').forEach(function (t) {
          var active = t.dataset.catTab === c;
          t.classList.toggle('bg-ink', active); t.classList.toggle('text-white', active);
          t.classList.toggle('dark:bg-white', active); t.classList.toggle('dark:text-gray-900', active);
          t.classList.toggle('bg-gray-100', !active); t.classList.toggle('dark:bg-gray-800', !active);
        });
        syncURL(); apply(); paintHero();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    if (sortSel) { sortSel.addEventListener('change', function () { catalogState.page = 1; apply(); }); }
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        catalogState.page += 1;
        var shownCount = catalogState.page * catalogState.perPage;
        if (shownCount >= allProducts().length + 10) { loadBtn.classList.add('hidden'); }
        apply();
      });
    }
    var searchInput = $('#catalog-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        f.busqueda = searchInput.value.trim();
        catalogState.page = 1; syncURL(); apply();
      });
    }

    bindFilters();
    updateBadges();
    apply();
  }

  /* Filtros móvil */
  function openFilters() {
    var panel = $('#filters-panel-mobile'), overlay = $('#filters-overlay');
    if (panel) { panel.classList.remove('translate-y-full'); if (overlay) { overlay.classList.remove('hidden'); } document.body.style.overflow = 'hidden'; }
  }
  function closeFilters() {
    var panel = $('#filters-panel-mobile'), overlay = $('#filters-overlay');
    if (panel) { panel.classList.add('translate-y-full'); if (overlay) { overlay.classList.add('hidden'); } document.body.style.overflow = ''; }
  }
  function bindFilterToggle() {
    var btn = $('#filters-toggle');
    if (btn) { btn.addEventListener('click', openFilters); }
    var overlay = $('#filters-overlay');
    if (overlay) { overlay.addEventListener('click', closeFilters); }
    var closeBtn = $('#filters-close');
    if (closeBtn) { closeBtn.addEventListener('click', closeFilters); }
    var doneBtn = $('#filters-done');
    if (doneBtn) { doneBtn.addEventListener('click', closeFilters); }
    var clearBtn = $('#filters-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        location.href = 'products.html';
      });
    }
  }

  /* ================================================================
     FICHA DE PRODUCTO (product-detail.html)
     ================================================================ */
  function initDetailPage() {
    var host = $('#detail-root');
    if (!host) { return; }
    var slug = new URLSearchParams(location.search).get('p');
    var p = slug ? productById(slug) : null;
    if (!p) {
      var emptyHost = document.createElement('div');
      emptyHost.className = 'pt-16 lg:pt-[4.5rem] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20';
      emptyHost.innerHTML = '<div class="grid">' + emptyStateHTML() + '</div>';
      host.innerHTML = emptyHost.innerHTML;
      return;
    }
    document.title = p.name + ' · DISAN3D';

    var images = (p.images || []).filter(Boolean);
    var galleryHost = $('#detail-gallery');
    var infoHost = $('#detail-info');
    var activeImg = 0;

    // Galería con miniaturas (o placeholder vacío)
    function galleryHTML() {
      var main;
      if (images.length) {
        main = '<img class="w-full h-full object-cover" src="' + esc(images[activeImg]) + '" alt="' + esc(p.name) + '"/>';
      } else {
        main = '<div class="w-full h-full flex items-center justify-center product-ph"><span class="opacity-40 text-ink/30 dark:text-white/25">' + phSvg('w-24 h-24 sm:w-32 sm:h-32') + '</span></div>';
      }
      return main;
    }
    galleryHost.innerHTML = '';
    var mainWrap = document.createElement('div');
    mainWrap.className = 'aspect-square overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-800/60';
    mainWrap.innerHTML = galleryHTML();
    galleryHost.appendChild(mainWrap);

    if (images.length > 1) {
      var thumbs = document.createElement('div');
      thumbs.className = 'flex gap-3 mt-3 overflow-x-auto no-scrollbar';
      images.forEach(function (src, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'w-20 h-20 flex-none rounded-xl overflow-hidden ring-2 transition-colors ' + (i === activeImg ? 'ring-brand-500' : 'ring-transparent hover:ring-brand-300');
        b.innerHTML = '<img class="w-full h-full object-cover" src="' + esc(src) + '" alt="Miniatura"/>';
        b.addEventListener('click', function () {
          activeImg = i;
          mainWrap.innerHTML = galleryHTML();
          $all('button', thumbs).forEach(function (t, idx) {
            t.classList.toggle('ring-brand-500', idx === activeImg);
            t.classList.toggle('ring-transparent', idx !== activeImg);
          });
        });
        thumbs.appendChild(b);
      });
      galleryHost.appendChild(thumbs);
    }
    refreshIcons();

    var custBlock = p.customizable ? '' :
      '<p class="flex items-center gap-2 text-xs uppercase tracking-widest text-gray-400"><i data-lucide="check" class="w-4 h-4"></i>No personalizable</p>';

    infoHost.innerHTML =
      '<nav class="text-xs uppercase tracking-widest text-gray-400 mb-5 flex flex-wrap gap-1.5">' +
      '  <a class="hover:text-brand-600 transition-colors" href="index.html">Inicio</a><span>/</span>' +
      '  <a class="hover:text-brand-600 transition-colors" href="products.html">Catálogo</a><span>/</span>' +
      '  <span class="text-ink dark:text-white">' + esc(p.name) + '</span>' +
      '</nav>' +
      '<h1 class="font-display text-2xl sm:text-3xl font-semibold text-ink dark:text-white mb-1">' + esc(p.name) + '</h1>' +
      '<p class="text-gray-500 dark:text-gray-400 mb-4">' + esc(p.tagline || '') + '</p>' +
      '<p class="text-2xl font-semibold text-ink dark:text-white mb-5">' + (p.customizable ? '<span class="text-xs font-medium uppercase tracking-wider text-gray-400">' + (ui().from || 'Desde') + ' </span>' : '') + fmtPrice(p.price) + '</p>' +
      (p.customizable ? '<p class="flex items-center gap-2 mb-5 rounded-xl bg-brand-50 dark:bg-brand-900/30 px-4 py-3 text-sm text-brand-700 dark:text-brand-200"><i data-lucide="pen-line" class="w-4 h-4 flex-none"></i>Incluye tu nombre o mensaje personalizado.</p>' : custBlock) +
      '<p class="text-sm sm:text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed mb-7">' + esc(p.description || p.tagline || '') + '</p>';

    var configHost = $('#detail-config');
    var qtyHost = $('#detail-config');
    var addBtn = $('#detail-add');
    var state = { color: (p.colors || [])[0] || '', text: '', qty: 1 };

    function buildConfig() {
      configHost.innerHTML =
        (p.customizable
          ? '<div class="mb-5">' +
            '  <label class="block text-[11px] uppercase tracking-widest font-semibold text-ink dark:text-white mb-2" for="d3-text">Texto a personalizar</label>' +
            '  <input id="d3-text" type="text" maxlength="18" class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/60" placeholder="P. ej. María y Adrián · 1990"/>' +
            '  <p class="mt-1.5 text-[11px] text-gray-400">Hasta 18 caracteres. Lo revisamos contigo antes de imprimir.</p>' +
            '</div>'
          : '') +
        (p.colors && p.colors.length
          ? '<div class="mb-6">' +
            '  <label class="block text-[11px] uppercase tracking-widest font-semibold text-ink dark:text-white mb-2">Color · <span id="d3-color-label" class="font-normal text-gray-500"></span></label>' +
            '  <div class="flex flex-wrap gap-2.5" id="d3-swatches"></div>' +
            '</div>'
          : '') +
        '<div class="mb-7">' +
        '  <label class="block text-[11px] uppercase tracking-widest font-semibold text-ink dark:text-white mb-2">Cantidad</label>' +
        '  <div class="inline-flex items-center rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">' +
        '    <button type="button" class="p-3 px-4 text-gray-500 hover:text-brand-600" data-qty="dec" aria-label="Menos">' + icon('minus', 'w-4 h-4') + '</button>' +
        '    <span class="w-10 text-center font-medium text-ink dark:text-white" id="d3-qty-num">1</span>' +
        '    <button type="button" class="p-3 px-4 text-gray-500 hover:text-brand-600" data-qty="inc" aria-label="Más">' + icon('plus', 'w-4 h-4') + '</button>' +
        '  </div>' +
        '</div>';
      var sw = $('#d3-swatches');
      if (sw) {
        (p.colors || []).forEach(function (cname) {
          var c = siteColors().filter(function (x) { return x.name === cname; })[0];
          var hex = c ? c.hex : '#9ca3af';
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.title = cname;
          btn.className = 'h-9 w-9 rounded-full border-2 border-gray-200 dark:border-gray-600 hover:border-brand-400 transition-colors';
          btn.style.background = hex;
          btn.setAttribute('aria-label', cname);
          btn.dataset.color = cname;
          if (cname === state.color) { btn.classList.add('ring-2', 'ring-brand-500', 'ring-offset-2', 'dark:ring-offset-gray-900'); }
          btn.addEventListener('click', function () {
            state.color = cname;
            $all('#d3-swatches button').forEach(function (b) { b.classList.remove('ring-2', 'ring-brand-500', 'ring-offset-2', 'dark:ring-offset-gray-900'); });
            btn.classList.add('ring-2', 'ring-brand-500', 'ring-offset-2', 'dark:ring-offset-gray-900');
            var lbl = $('#d3-color-label'); if (lbl) { lbl.textContent = cname; }
          });
          sw.appendChild(btn);
        });
        var lbl = $('#d3-color-label'); if (lbl) { lbl.textContent = state.color; }
      }
      var txt = $('#d3-text');
      if (txt) { txt.addEventListener('input', function () { state.text = txt.value.trim(); }); }
      refreshIcons();
    }

    function updateQtyUI() {
      var n = $('#d3-qty-num'); if (n) { n.textContent = String(state.qty); }
    }
    if (qtyHost) {
      qtyHost.addEventListener('click', function (e) {
        var b = e.target.closest('[data-qty]');
        if (!b) { return; }
        state.qty = Math.max(1, state.qty + (b.dataset.qty === 'inc' ? 1 : -1));
        updateQtyUI();
      });
    }
    if (addBtn) {
      var addLabel = addBtn.getAttribute('data-label') || ui().addToOrder || 'Añadir al pedido';
      addBtn.setAttribute('data-label', addLabel);
      addBtn.addEventListener('click', function () {
        addToCart(p.id, { qty: state.qty, color: state.color, text: state.text });
        toast('Añadido al pedido');
        var label = addBtn.getAttribute('data-label') || addLabel;
        addBtn.innerHTML = '✓ Añadido al pedido';
        setTimeout(function () { addBtn.innerHTML = label; refreshIcons(); }, 1400);
      });
    }

    var specHost = $('#detail-specs');
    if (specHost) {
      specHost.innerHTML =
        '<details class="group border-b border-gray-200 dark:border-gray-800 py-4" open>' +
        '  <summary class="flex items-center justify-between cursor-pointer text-[11px] uppercase tracking-widest font-semibold text-ink dark:text-white list-none">Ficha técnica' + icon('chevron-down', 'w-4 h-4 group-open:rotate-180 transition-transform') + '</summary>' +
        '  <dl class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">' +
        specRow('Dimensiones', p.dimensions) + specRow('Material', p.material) + specRow('Tiempo de fabricación', p.printTime) +
        (p.colors && p.colors.length ? specRow('Colores', p.colors.join(', ')) : '') +
        '</dl></details>' +
        '<details class="group border-b border-gray-200 dark:border-gray-800 py-4">' +
        '  <summary class="flex items-center justify-between cursor-pointer text-[11px] uppercase tracking-widest font-semibold text-ink dark:text-white list-none">Envío y fabricación' + icon('chevron-down', 'w-4 h-4 group-open:rotate-180 transition-transform') + '</summary>' +
        '  <div class="mt-3 text-sm text-gray-500 dark:text-gray-400 space-y-2"><p>Cada pieza se imprime bajo pedido. Fabricamos en ' + esc((brand()).city || '') + ' y enviamos a toda España.</p><p>El plazo depende del producto y del tiempo de impresión indicado.</p></div>' +
        '</details>' +
        (p.customizable
          ? '<details class="group py-4">' +
            '<summary class="flex items-center justify-between cursor-pointer text-[11px] uppercase tracking-widest font-semibold text-ink dark:text-white list-none">¿Cómo funciona la personalización?' + icon('chevron-down', 'w-4 h-4 group-open:rotate-180 transition-transform') + '</summary>' +
            '<div class="mt-3 text-sm text-gray-500 dark:text-gray-400 space-y-2"><p>Escribe el texto, elige color y añádelo al pedido. Cuando hagas el pedido te enviamos una prueba del diseño antes de imprimir.</p></div></details>'
          : '') +
        '<p class="pt-4 text-sm text-gray-400 flex items-center gap-2">' + icon('info', 'w-4 h-4') + 'Fotografía orientativa. Los colores pueden variar ligeramente entre pantallas.</p>';
      refreshIcons();
    }

    var related = $('#detail-related');
    if (related) {
      var myCats = p.categories || [];
      var rel = allProducts().filter(function (x) {
        if (x.id === p.id) { return false; }
        return (x.categories || []).some(function (cid) { return myCats.indexOf(cid) !== -1; });
      }).slice(0, 4);
      renderGrid(related, rel);
      refreshIcons();
    }

    buildConfig();
    updateBadges();
  }
  function specRow(label, val) {
    if (!val) { return ''; }
    return '<div class="flex items-start gap-3"><dt class="text-[10px] uppercase tracking-widest text-gray-400 w-36 flex-none pt-0.5">' + esc(label) + '</dt><dd class="text-gray-700 dark:text-gray-200">' + esc(val) + '</dd></div>';
  }

  /* ================================================================
     CARRITO (cart.html)
     ================================================================ */
  function initCartPage() {
    var host = $('#cart-root');
    if (!host) { return; }
    function paint() {
      var cart = readCart();
      var itemsHost = $('#cart-items'), emptyHost = $('#cart-empty'), summaryHost = $('#cart-summary');
      if (!cart.length) {
        if (itemsHost) { itemsHost.innerHTML = ''; }
        if (emptyHost) { emptyHost.classList.remove('hidden'); }
        if (summaryHost) { summaryHost.classList.add('hidden'); }
        return;
      }
      if (emptyHost) { emptyHost.classList.add('hidden'); }
      if (summaryHost) { summaryHost.classList.remove('hidden'); }
      if (itemsHost) {
        itemsHost.innerHTML = cart.map(function (it) {
          var detail = [it.color, it.text ? ('«' + it.text + '»') : ''].filter(Boolean).join(' · ');
          var img = it.image
            ? '<img class="w-full h-full object-cover" src="' + esc(it.image) + '" alt="' + esc(it.name) + '"/>'
            : '<div class="w-full h-full flex items-center justify-center product-ph"><span class="opacity-30">' + phSvg('w-8 h-8') + '</span></div>';
          return '' +
            '<div class="flex gap-4 py-5 border-b border-gray-100 dark:border-gray-800">' +
            '  <div class="w-20 h-20 sm:w-24 sm:h-24 flex-none overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800/60">' + img + '</div>' +
            '  <div class="flex-1 min-w-0">' +
            '    <div class="flex items-start justify-between gap-3">' +
            '      <div class="min-w-0">' +
            '        <h3 class="text-sm font-medium text-ink dark:text-white truncate">' + esc(it.name) + '</h3>' +
            (detail ? '<p class="text-xs text-gray-400 mt-0.5 truncate">' + esc(detail) + '</p>' : '') +
            '      </div>' +
            '      <button type="button" class="text-gray-300 hover:text-red-500 transition-colors flex-none" data-remove="' + esc(it.key) + '" aria-label="Eliminar">' + icon('trash-2', 'w-4 h-4') + '</button>' +
            '    </div>' +
            '    <div class="mt-2 flex items-center justify-between gap-2">' +
            '      <div class="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700">' +
            '        <button type="button" class="px-2.5 py-1.5 text-gray-500 hover:text-brand-600" data-dec="' + esc(it.key) + '">' + icon('minus', 'w-3.5 h-3.5') + '</button>' +
            '        <span class="w-8 text-center text-sm font-medium text-ink dark:text-white">' + it.qty + '</span>' +
            '        <button type="button" class="px-2.5 py-1.5 text-gray-500 hover:text-brand-600" data-inc="' + esc(it.key) + '">' + icon('plus', 'w-3.5 h-3.5') + '</button>' +
            '      </div>' +
            '      <span class="text-sm font-semibold text-ink dark:text-white">' + fmtPrice(it.price * it.qty) + '</span>' +
            '    </div>' +
            '  </div>' +
            '</div>';
        }).join('');
        $all('[data-remove]', itemsHost).forEach(function (b) { b.addEventListener('click', function () { removeFromCart(b.dataset.remove); paint(); }); });
        $all('[data-inc]', itemsHost).forEach(function (b) { b.addEventListener('click', function () { var it = readCart().filter(function (i) { return i.key === b.dataset.inc; })[0]; setCartQty(b.dataset.inc, (it ? it.qty : 0) + 1); paint(); }); });
        $all('[data-dec]', itemsHost).forEach(function (b) { b.addEventListener('click', function () { var it = readCart().filter(function (i) { return i.key === b.dataset.dec; })[0] || { qty: 1 }; setCartQty(b.dataset.dec, it.qty - 1); paint(); }); });
        refreshIcons();
      }
      var sub = cartSubtotal();
      var subtotalEl = $('#cart-subtotal'); if (subtotalEl) { subtotalEl.textContent = fmtPrice(sub); }
      var totalEl = $('#cart-total'); if (totalEl) { totalEl.textContent = fmtPrice(sub); }
      var countEl = $('#cart-count-label'); if (countEl) { countEl.textContent = cart.reduce(function (n, i) { return n + i.qty; }, 0) + ' artículo(s)'; }
    }
    paint();
    updateBadges();
  }

  /* ================================================================
     CHECKOUT (checkout.html)
     ================================================================ */
  function initCheckoutPage() {
    var wrap = $('#checkout-root');
    if (!wrap) { return; }
    var items = readCart();
    var sub = cartSubtotal();

    var summaryHost = $('#checkout-summary');
    if (summaryHost) {
      if (!items.length) {
        summaryHost.innerHTML = '<p class="text-gray-400 text-sm mb-4">Tu pedido está vacío.</p><a class="text-brand-600 font-medium" href="products.html">Ir al catálogo →</a>';
      } else {
        summaryHost.innerHTML = items.map(function (it) {
          return '<div class="flex items-center justify-between gap-3 py-3 border-b border-gray-100 dark:border-gray-800 text-sm">' +
            '<span class="text-gray-600 dark:text-gray-300">' + esc(it.name) + (it.color ? ' <span class="text-gray-400">· ' + esc(it.color) + '</span>' : '') + (it.text ? ' <span class="text-gray-400">· «' + esc(it.text) + '»</span>' : '') + ' <span class="text-gray-400">×' + it.qty + '</span></span>' +
            '<span class="font-medium text-ink dark:text-white flex-none">' + fmtPrice(it.price * it.qty) + '</span></div>';
        }).join('') +
          '<div class="flex items-center justify-between pt-4 text-base font-semibold text-ink dark:text-white"><span>Total</span><span>' + fmtPrice(sub) + '</span></div>';
      }
    }
    var totalEl = $('#checkout-total'); if (totalEl) { totalEl.textContent = fmtPrice(sub); }

    var form = $('#checkout-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!items.length) { return; }
        var panel = $('#checkout-confirm');
        form.classList.add('hidden');
        if (panel) {
          panel.classList.remove('hidden');
          var summary2 = $('#checkout-confirm-summary');
          if (summary2) {
            summary2.innerHTML = items.map(function (it) {
              return '<li class="flex justify-between gap-4 text-sm py-2 border-b border-gray-100 dark:border-gray-800"><span class="text-gray-600 dark:text-gray-300">' + esc(it.name) + ' ×' + it.qty + '</span><span class="text-ink dark:text-white font-medium">' + fmtPrice(it.price * it.qty) + '</span></li>';
            }).join('');
          }
          var totalConfirm = $('#checkout-confirm-total'); if (totalConfirm) { totalConfirm.textContent = fmtPrice(sub); }
        }
        try { localStorage.removeItem('disan3d:cart'); } catch (err) {}
        updateBadges();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  /* ================================================================
     HOME (index.html)
     ================================================================ */
  function heroMedia(feat) {
    var img = (feat && feat.image) || '';
    if (img) {
      return '<div class="relative flex-1 min-h-[240px] lg:min-h-0 overflow-hidden rounded-3xl ring-1 ring-white/10">' +
        '<img class="absolute inset-0 w-full h-full object-cover" src="' + esc(img) + '" alt="" loading="lazy"/>' +
        '</div>';
    }
    return '<div class="relative flex-1 min-h-[220px] lg:min-h-0 overflow-hidden rounded-3xl product-ph ring-1 ring-white/10 flex items-center justify-center">' +
      '<span class="opacity-40 text-ink/30 dark:text-white/25">' + phSvg('w-24 h-24 sm:w-28 sm:h-28') + '</span></div>';
  }

  function initHomePage() {
    var hero = $('#home-campaign');
    var season = seasonCategory(); // featuredSeason en site.json
    if (hero) {
      var tone = 'brand';
      var f = season && season.featured;
      if (f && f.tone && CAMP_TONES[f.tone]) { tone = f.tone; }
      hero.innerHTML =
        '<div class="absolute inset-0 bg-gradient-to-br ' + CAMP_TONES[tone] + '"></div>' +
        '<div class="absolute inset-0 d3-lines opacity-40"></div>' +
        '<div class="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 lg:py-20">' +
        '  <div class="flex flex-col lg:flex-row gap-8 lg:gap-12 items-end lg:items-center">' +
        '    <div class="max-w-2xl flex-1">' +
        (season && f
          ? '<span class="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-[11px] uppercase tracking-[0.25em] text-white/90 ring-1 ring-white/20">' + esc(f.kicker || 'Temporada') + '</span>' +
            '<h1 class="font-display mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05]">' + esc(f.title || season.name) + '</h1>' +
            '<p class="mt-5 text-base sm:text-lg text-white/80 max-w-xl leading-relaxed">' + esc(f.subtitle || season.blurb || '') + '</p>' +
            '<div class="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3">' +
            '  <a class="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-ink hover:bg-brand-50 font-semibold uppercase tracking-widest text-xs transition-colors" href="' + seasonLink(season) + '">' + esc(f.cta || 'Ver colección') + ' ' + icon('arrow-right', 'w-4 h-4') + '</a>' +
            '  <a class="inline-flex items-center gap-2 px-2 py-3.5 text-sm text-white/80 hover:text-white uppercase tracking-widest" href="collections.html">Ver todas las temporadas</a>' +
            '</div>'
          : '<h1 class="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05]">Impresión 3D personalizada</h1>' +
            '<p class="mt-5 text-base sm:text-lg text-white/80 max-w-xl leading-relaxed">Regalos, decoración y objetos únicos impresos en 3D, personalizables y fabricados bajo pedido.</p>') +
        '    </div>' +
        (season && f ? heroMedia(f) : '') +
        '    </div>' +
        '</div>';
    }

    // Productos destacados de la temporada
    var seasonHost = $('#home-season-products');
    if (seasonHost && season) {
      var prods = productsInCat(season).slice(0, 8);
      var titleHost = $('#home-season-title');
      if (titleHost) { titleHost.innerHTML = 'Idea para <span class="text-brand-600 dark:text-brand-300">' + esc(season.name) + '</span>'; }
      if (prods.length) {
        seasonHost.innerHTML = '';
        renderGrid(seasonHost, prods);
        refreshIcons();
      } else {
        seasonHost.innerHTML = '<div class="col-span-full text-center text-gray-400 py-6 text-sm">Pronto publicaremos los productos de esta temporada. Mientras tanto, explora el catálogo para ver los destacados.</div>';
      }
    }

    // Recipientes "¿Para quién?" (grupo con rol "regalos")
    var recHost = $('#home-recipients');
    var regalosGroup = navRegalosGroup();
    if (recHost && regalosGroup) {
      recHost.innerHTML = catsOfGroup(regalosGroup.id).map(function (r) {
        return '<a class="flex flex-col items-center justify-center gap-1.5 min-w-[96px] sm:min-w-[104px] px-3 py-4 rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-gray-100 dark:ring-gray-800 hover:ring-brand-400 hover:-translate-y-0.5 transition-all text-center" href="' + catLink(r) + '">' +
          '<span class="h-11 w-11 rounded-full product-ph flex items-center justify-center overflow-hidden">' +
          (r.icon ? iconGlyph(r, 'w-5 h-5') : '<span class="text-[10px] font-bold uppercase text-ink/40 dark:text-white/40">' + initialsOf(r.name, 2) + '</span>') +
          '</span>' +
          '<span class="text-[11px] sm:text-xs font-medium text-ink dark:text-gray-200 leading-tight">' + esc(r.name.replace(/^Para\s+/i, '')) + '</span>' +
          '</a>';
      }).join('');
    }

    // Categorías tiles (grupo con rol "catálogo")
    var catHost = $('#home-categories');
    var catGroup = navCatalogGroup();
    if (catHost && catGroup) {
      catHost.innerHTML = catsOfGroup(catGroup.id).map(function (c) {
        var count = productsInCat(c).length;
        var sub = c.blurb || '';
        return '<a class="group relative overflow-hidden rounded-2xl aspect-[4/5] ring-1 ring-gray-100 dark:ring-gray-800" href="' + catLink(c) + '">' +
          '  <div class="absolute inset-0 product-ph group-hover:scale-[1.03] transition-transform duration-700">' + categoryImageBlock(c, 'text-6xl sm:text-7xl') + '</div>' +
          '  <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>' +
          '  <div class="absolute inset-x-0 bottom-0 p-5">' +
          '    <h3 class="font-display text-lg sm:text-xl font-semibold text-white">' + esc(c.name) + '</h3>' +
          '    <p class="text-xs text-white/70 mt-0.5 line-clamp-1">' + esc(sub) + '</p>' +
          '    <span class="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/90">' + (count > 0 ? count + ' productos · ' : '') + 'Explorar' + icon('arrow-right', 'w-3.5 h-3.5') + '</span>' +
          '  </div>' +
          '</a>';
      }).join('');
      refreshIcons();
    }
    refreshIcons();
    updateBadges();
  }

  /* ================================================================
     COLECCIONES (collections.html) + LOOKBOOK (lookbook.html)
     ================================================================ */
  function initCollectionsPage() {
    var host = $('#collections-root');
    var tempGroup = navTemporadaGroup();
    if (host && tempGroup) {
      host.innerHTML = catsOfGroup(tempGroup.id).map(function (s) {
        var n = productsInCat(s).length;
        return '<a class="group relative overflow-hidden rounded-3xl aspect-[4/3] sm:aspect-[16/10] product-ph ring-1 ring-gray-100 dark:ring-gray-800" href="' + seasonLink(s) + '">' +
          '  <div class="absolute inset-0 transition-transform duration-500 group-hover:scale-105">' + categoryImageBlock(s, 'text-7xl sm:text-8xl') + '</div>' +
          '  <div class="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent opacity-90"></div>' +
          '  <div class="absolute inset-x-0 bottom-0 p-5 sm:p-7">' +
          '    <h3 class="font-display text-xl sm:text-2xl font-semibold text-white">' + esc(s.featured ? (s.featured.title || s.name) : s.name) + '</h3>' +
          '    <p class="text-sm text-white/70 mt-1 line-clamp-2">' + esc(s.featured ? (s.featured.subtitle || s.blurb) : (s.blurb || '')) + '</p>' +
          '    <span class="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white">' + (n > 0 ? n + ' productos · ' : '') + 'Ver colección' + icon('arrow-right', 'w-3.5 h-3.5') + '</span>' +
          '  </div>' +
          '</a>';
      }).join('');
    }

    var catHost = $('#collections-categories');
    var catGroup = navCatalogGroup();
    if (catHost && catGroup) {
      catHost.innerHTML = catsOfGroup(catGroup.id).map(function (c) {
        return '<a class="flex items-center justify-between gap-4 rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-gray-100 dark:ring-gray-800 hover:ring-brand-400 px-5 py-4 transition-colors" href="' + catLink(c) + '">' +
          '<span class="flex items-center gap-3"><span class="h-10 w-10 flex-none rounded-xl product-ph flex items-center justify-center overflow-hidden">' + (c.icon ? iconGlyph(c, 'w-4 h-4') : '<span class="text-[10px] font-bold uppercase text-ink/40 dark:text-white/40">' + initialsOf(c.name, 2) + '</span>') + '</span><span class="font-medium text-ink dark:text-white">' + esc(c.name) + '</span></span>' +
          icon('arrow-right', 'w-4 h-4 text-gray-300 group-hover:text-brand-500') + '</a>';
      }).join('');
    }
    refreshIcons();
    updateBadges();
  }

  function initLookbookPage() {
    var host = $('#lookbook-root');
    var regalosGroup = navRegalosGroup();
    if (host && regalosGroup) {
      host.innerHTML = catsOfGroup(regalosGroup.id).map(function (r) {
        var n = productsInCat(r).length;
        return '<a class="group relative flex items-center justify-center rounded-3xl aspect-[3/4] product-ph overflow-hidden ring-1 ring-gray-100 dark:ring-gray-800" href="' + catLink(r) + '">' +
          '  <div class="absolute inset-0 flex items-center justify-center">' + categoryImageBlock(r, 'text-7xl sm:text-8xl') + '</div>' +
          '  <div class="absolute inset-x-0 bottom-0 p-5 text-center bg-gradient-to-t from-black/60 to-transparent pt-12">' +
          '    <h3 class="font-display text-lg font-semibold text-white">' + esc(r.name) + '</h3>' +
          '    <p class="text-[11px] text-white/70 uppercase tracking-widest mt-1">' + (n > 0 ? n + ' ideas · ' : '') + 'Ver regalos</p>' +
          '  </div>' +
          '</a>';
      }).join('');
    }
    refreshIcons();
    updateBadges();
  }

  /* ---------- Toast ---------- */
  function toast(msg) {
    var old = $('#d3-toast');
    if (old) { old.remove(); }
    var t = document.createElement('div');
    t.id = 'd3-toast';
    t.className = 'fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-[90] px-5 py-3 rounded-xl bg-ink dark:bg-white text-white dark:text-ink text-sm font-medium shadow-lg d3-fade-up';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  /* ---------- Arranque por página ---------- */
  function boot() {
    initHeader();
    var page = document.body && document.body.dataset ? document.body.dataset.page : '';
    if (page === 'home') { initHomePage(); }
    if (page === 'catalog') { initCatalogPage(); bindFilterToggle(); }
    if (page === 'product') { initDetailPage(); }
    if (page === 'cart') { initCartPage(); }
    if (page === 'checkout') { initCheckoutPage(); }
    if (page === 'collections') { initCollectionsPage(); }
    if (page === 'lookbook') { initLookbookPage(); }
    refreshIcons();
    updateBadges();
  }

  var started = false;
  function start() {
    if (started) { return; }
    started = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  /* tema inicial (no necesita datos) */
  (function () {
    var root = document.documentElement;
    var saved = null;
    try { saved = localStorage.getItem('disan3d:dark'); } catch (e) {}
    if (saved === '1') { root.classList.add('dark'); window.__d3InitialDark = true; }
    else if (saved === '0') { /* claro por defecto */ }
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) { root.classList.add('dark'); window.__d3InitialDark = true; }
  })();

  if (window.DISAN3D && window.DISAN3D.ready) { start(); }
  else { document.addEventListener('disan3d:ready', start, { once: true }); }
})();
