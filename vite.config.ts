import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Déployée sur GitHub Pages en tant que "project page", l'appli vit sous
// https://<user>.github.io/<repo>/ : `base` doit donc correspondre au nom du
// dépôt. La valeur peut être surchargée sans toucher au code via la variable
// d'environnement VITE_BASE_PATH (déjà positionnée par le workflow GitHub
// Actions fourni, voir .github/workflows/deploy.yml).
// Si tu déploies plutôt sur un "user/org page" (<user>.github.io racine) ou
// sur un autre hébergeur à la racine, mets simplement base: '/'.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
