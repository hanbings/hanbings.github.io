import { createMarkdownProcessor, unified } from '@astrojs/markdown-remark'
import remarkDirective from 'remark-directive'
import remarkPiano from './plugins/remarkPiano.mjs'
import remarkSidenotes from './plugins/remarkSidenotes.mjs'
import remarkTerms from './plugins/remarkTerms.mjs'
import remarkValidateDirectives from './plugins/remarkValidateDirectives.mjs'

const remarkPlugins = [
  remarkDirective,
  remarkPiano,
  remarkSidenotes,
  remarkTerms,
  remarkValidateDirectives,
]

export const markdownProcessor = unified({remarkPlugins})

export const createMarkdownRenderer = (options = {}) => createMarkdownProcessor({
  ...options,
  remarkPlugins,
})
