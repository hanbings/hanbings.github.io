import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { createMarkdownRenderer } from '../markdown/index.mjs';
import { sanitizeMarkdownForRss } from '../markdown/sanitizeRss.mjs';

export async function GET(context) {
    const allPosts =
        (await getCollection('posts', ({ data }) => !data.draft))
            .sort((a, b) =>
                new Date(b.data.date.replace(" ", "T")).getTime() -
                new Date(a.data.date.replace(" ", "T")).getTime())

    const renderer = await createMarkdownRenderer({syntaxHighlight: false})
    const items = await Promise.all(allPosts.map(async (post) => {
        const {code} = await renderer.render(post.body)

        return {
            title: post.data.title,
            pubDate: post.data.date,
            description: post.data.description,
            link: `/posts/${post.id}/`,
            content: sanitizeMarkdownForRss(code),
        }
    }))

    return rss({
        title: '🐱 寒冰是喵喵的 blog',
        description: '欢迎来到我的小世界~',
        site: context.site,
        items,
    });
}
