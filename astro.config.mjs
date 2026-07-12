import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

// https://astro.build/config
export default defineConfig({
  integrations: [sitemap()],
  site: 'https://blog.hanbings.io',

  markdown: {
    shikiConfig: {
      themes: {
        light: 'one-light',
        dark: 'tokyo-night',
      },
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },
})