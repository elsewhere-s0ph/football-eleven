/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Notte di Divisione d'Onore: buio da stadio, erba illuminata,
        // oro da riflettore, bianco gesso. La scala ridefinisce i token
        // usati dai componenti: niente JSX da riscrivere per la pelle.
        pitch: {
          50: '#f4f8f4',
          100: '#e9f1eb',
          200: '#cfdcd3',
          300: '#a8bfb2',
          400: '#7e9c8e',
          500: '#476b59',
          600: '#2a4a39',
          700: '#1b3327',
          800: '#10231a',
          900: '#0a1710',
          950: '#050d08',
        },
        // slate rimappato su una nebbia con sbuffo di verde, per coerenza
        slate: {
          50: '#f2f6f1',
          100: '#e4ebe5',
          200: '#c8d4cc',
          300: '#a3b5aa',
          400: '#7e9488',
          500: '#567065',
          600: '#2e4a3d',
          700: '#1e352b',
          800: '#122620',
          900: '#0b1a13',
          950: '#060f0b',
        },
        // teal diventa l'erba sotto i riflettori
        teal: {
          50: '#eafbf2',
          100: '#c8f5dd',
          200: '#a9efc8',
          300: '#7fe6ae',
          400: '#47d489',
          500: '#2fb56e',
          600: '#1f8a5a',
          700: '#176b48',
          800: '#115538',
          900: '#0b3b28',
          950: '#062a1c',
        },
        // amber diventa l'oro dei riflettori: il colore del legacy
        amber: {
          50: '#fbf3df',
          100: '#f7e8c3',
          200: '#fce7ae',
          300: '#f7d37c',
          400: '#efbf4e',
          500: '#dfa832',
          600: '#b8861f',
          700: '#916a18',
          800: '#6e5013',
          900: '#533d10',
          950: '#2e2209',
        },
        flood: {
          200: '#fce7ae',
          300: '#f7d37c',
          400: '#efbf4e',
          500: '#dfa832',
          600: '#b8861f',
        },
      },
      fontFamily: {
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Oswald', 'Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        goalFlash: {
          '0%': { boxShadow: '0 0 0 0 rgba(239,191,78,0)' },
          '25%': { boxShadow: '0 0 44px 6px rgba(239,191,78,0.4)' },
          '100%': { boxShadow: '0 0 0 0 rgba(239,191,78,0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        urgentPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'goal-flash': 'goalFlash 1.6s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-up': 'fadeUp 0.35s ease-out both',
        'urgent': 'urgentPulse 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
