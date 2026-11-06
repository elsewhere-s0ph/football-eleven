/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Identità provvisoria F0: la palette definitiva arriverà
        // insieme all'icona PWA (F6). Verde prato notturno.
        pitch: {
          950: '#04140e',
          900: '#07211a',
          800: '#0b2f24',
        },
      },
    },
  },
  plugins: [],
}
