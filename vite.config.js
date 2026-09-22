import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Publicado em https://webstudiopt.github.io/acompanhambio/ — precisa desse
  // base pra assets e rotas resolverem certo no subcaminho do GitHub Pages.
  base: '/acompanhambio/',
})
