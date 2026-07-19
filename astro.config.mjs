import {defineConfig} from 'astro/config'
import sitemap from '@astrojs/sitemap'
import mdx from '@astrojs/mdx'
import tailwindcss from '@tailwindcss/vite'

// https://astro.build/config
export default defineConfig({
  integrations: [sitemap(), mdx()],
  site: 'https://blog.hanbings.io',

  markdown: {
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
