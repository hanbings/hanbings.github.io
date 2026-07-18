import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { markdownProcessor } from './src/markdown/index.mjs'

// https://astro.build/config
export default defineConfig({
  integrations: [sitemap()],
  site: 'https://blog.hanbings.io',

  markdown: {
    processor: markdownProcessor,
    shikiConfig: {
      themes: {
        light: 'one-light',
        dark: 'tokyo-night',
      },
      defaultColor: false,
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },
})