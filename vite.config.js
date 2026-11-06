import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Nota deploy: se un giorno servisse GitHub Pages, aggiungere base: '/football-eleven/'.
// Per Cloudflare Pages la root va bene così.
export default defineConfig({
  plugins: [react()],
})
