import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import rss from '@astrojs/rss'
import {createMarkdownProcessor} from '@astrojs/markdown-remark'
import {getCollection, render} from 'astro:content'
import {experimental_AstroContainer as AstroContainer} from 'astro/container'
import {getContainerRenderer} from '@astrojs/mdx/container-renderer'
import mdxServerRenderer from '@astrojs/mdx/server.js'
import {sanitizeMarkdownForRss} from '../utils/sanitizeRss.mjs'
import {mdxComponents} from '../components/mdx'

export async function GET(context) {
  const allPosts = (await getCollection('posts', ({data}) => !data.draft)).sort(
    (a, b) =>
      new Date(b.data.date.replace(' ', 'T')).getTime() -
      new Date(a.data.date.replace(' ', 'T')).getTime(),
  )

  const renderer = await createMarkdownProcessor({syntaxHighlight: false})
  const hasMdx = allPosts.some((post) => post.filePath?.endsWith('.mdx'))
  const mdxRenderer = getContainerRenderer()
  const container = hasMdx
    ? await AstroContainer.create({
        renderers: [{name: mdxRenderer.name, ssr: mdxServerRenderer}],
      })
    : undefined
  const items = await Promise.all(
    allPosts.map(async (post) => {
      let code
      if (post.filePath?.endsWith('.mdx')) {
        const {Content} = await render(post)
        code = await container.renderToString(Content, {
          props: {components: mdxComponents},
        })
      } else {
        const result = await renderer.render(post.body, {
          fileURL: post.filePath ? pathToFileURL(resolve(post.filePath)) : undefined,
        })
        code = result.code
      }

      return {
        title: post.data.title,
        pubDate: post.data.date,
        description: post.data.description,
        link: `/posts/${post.id}/`,
        content: sanitizeMarkdownForRss(code),
      }
    }),
  )

  return rss({
    title: '🐱 寒冰是喵喵的 blog',
    description: '欢迎来到我的小世界~',
    site: context.site,
    items,
  })
}
