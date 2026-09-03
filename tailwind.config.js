// ============================================================
// DISAN3D — Tailwind config (Play CDN style, cargado en <head>)
// Marca: turquesa #4D888E · gris #404040 · gris claro #BAB9B4
// ============================================================
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Turquesa corporativo (logotipo) — acento/CTA principal
        brand: {
          50:  '#EFF6F6',
          100: '#DCECEC',
          200: '#BBD9DA',
          300: '#92C0C2',
          400: '#69A6A9',
          500: '#4D888E', // color del logotipo
          600: '#3F7379',
          700: '#335D62',
          800: '#294A4E',
          900: '#1F3A3D',
        },
        // "primary" hereda el acento (compatibilidad con la plantilla)
        primary: {
          DEFAULT: '#4D888E',
          600: '#3F7379',
          500: '#4D888E',
          700: '#335D62',
        },
        ink: '#404040',     // gris oscuro del logotipo
        mist: '#BAB9B4',    // gris claro del logotipo
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.3em',
      },
      boxShadow: {
        soft: '0 10px 40px -12px rgba(31,58,61,0.18)',
      },
    },
  },
}
