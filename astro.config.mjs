import {defineConfig} from 'astro/config'
import sitemap from '@astrojs/sitemap'
import mdx from '@astrojs/mdx'
import {unified} from '@astrojs/markdown-remark'
import tailwindcss from '@tailwindcss/vite'
import remarkChatBoxHeadings from './src/remark/chat-box-headings.mjs'

// https://astro.build/config
export default defineConfig({
  integrations: [sitemap(), mdx()],
  site: 'https://blog.hanbings.io',

  markdown: {
    processor: unified({
      remarkPlugins: [remarkChatBoxHeadings],
    }),
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
