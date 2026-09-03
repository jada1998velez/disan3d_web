# DISAN3D — Web (tienda pública)

Tienda online de **impresión 3D personalizada** (HTML + Tailwind CDN + JavaScript
vainilla, sin build). Productos, categorías y configuración viven en **JSON**,
no en el código: puedes administrarlos con el **BackOffice** (`../backoffice`) o
editando los archivos directamente.

> Antes se llamaba `maison_curated-ecommerce-editorial_tailwind`. Ahora este
> repositorio es la **tienda pública** y se publica en tu hosting (GitHub Pages,
> Netlify, Vercel, etc.) con despliegue automático desde Git.

## Estructura

```
disan3d_web/
├─ index.html, products.html, product-detail.html, …   (páginas)
├─ d3-data.js        → carga los JSON en tiempo de ejecución
├─ d3-app.js         → motor de la tienda (data-driven, sin emojis)
├─ scripts.js        → utilidades menores (iconos Lucide)
├─ style.css / tailwind.config.js
├─ build_index.py    → regenera data/products.json desde las carpetas
└─ data/             ← TODO SON DATOS
   ├─ config/site.json            (marca, moneda, colores, featuredSeason)
   ├─ groups.json                 (ejes de filtro: categoría, para, tipo, temporada…)
   ├─ categories.json             (todas las categorías con su grupo)
   ├─ products.json               (ÍNDICE generado — la tienda lo lee)
   └─ products/<id>/product.json  (un producto = una carpeta, con images/)
```

> Nota: `data.js` y `app.js` (antiguos, con datos hardcodeados y emojis) ya no se
> usan. Las páginas cargan `d3-data.js` y `d3-app.js`. Puedes borrar los antiguos.

## Cómo funciona la tienda

1. `d3-data.js` hace `fetch` de `data/config/site.json`, `data/groups.json`,
   `data/categories.json` y `data/products.json`.
2. `d3-app.js` genera cabecera, home, catálogo con filtros, ficha, carrito, etc.
   **a partir de esos JSON**:
   - Cada **grupo** de `groups.json` (excepto el de rol `catalogo`) se convierte
     automáticamente en un **panel de filtros** en el catálogo.
   - Cada **categoría activa** de un grupo aparece automáticamente como chip.
   - Añadir una categoría o un producto **no requiere tocar código**.
3. La **temporada destacada** de la home se lee de `site.json →
   featuredSeason`; su contenido (título, subtítulo, imagen…) se guarda en el
   campo `featured` de esa categoría en `categories.json`.

## product.json (esquema)

```jsonc
{
  "id": "llavero-corazon",          // slug único (minúsculas, guiones)
  "name": "Llavero Corazón Personalizado",
  "tagline": "El detalle perfecto para San Valentín.",   // frase corta (tarjeta)
  "description": "Texto largo de la ficha…",
  "price": 5.9,
  "currency": "EUR",
  "customizable": true,
  "bestseller": true,
  "colors": ["Blanco", "Negro", "Rosa"],
  "dimensions": "6 × 6 × 0,3 cm",
  "material": "PLA",
  "printTime": "~45 min",
  "categories": ["regalos", "personalizados", "pareja", "llaveros", "san-valentin"],
  "images": ["data/products/llavero-corazon/images/foto-1.jpg"],  // [] si aún no hay
  "available": true,
  "seo": {}
}
```

- Un producto puede estar en **varias categorías** (`categories`), de distintos
  grupos a la vez.
- Las categorías **no son carpetas**: la relación es por `id`.
- `categories.json` usa: `id, name, group, blurb, icon, image, active, order`.
  Opcionalmente `derived: "bestseller"` (categoría automática = productos con
  `bestseller: true`) y `featured` (para temporadas/campañas).
- Si un producto no tiene imágenes, la web muestra un **hueco vacío elegante**
  (sin emojis) hasta que subas las fotos desde el backoffice.

## Ver la tienda en local

Como los datos se cargan con `fetch`, necesitas un servidor local:

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

## Regenerar el índice de productos

Después de editar productos/carpetas a mano (o lo hace el backoffice al publicar):

```bash
python3 build_index.py        # escribe data/products.json
python3 build_index.py --check
```

## Publicar (con el BackOffice)

El backoffice (`../backoffice`) guarda y publica por ti: **Guardar** escribe los
JSON locales; **Publicar cambios** valida → `build_index.py` → `git add/commit/push`.
