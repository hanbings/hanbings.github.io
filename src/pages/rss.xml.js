import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';
const parser = new MarkdownIt();

export async function GET(context) {
    const allPosts =
        (await getCollection('posts'))
            .sort((a, b) =>
                new Date(b.data.date.replace(" ", "T")).getTime() -
                new Date(a.data.date.replace(" ", "T")).getTime())

    return rss({
        title: '🐱 寒冰是喵喵的 blog',
        description: '欢迎来到我的小世界~',
        site: context.site,
        items: allPosts.map((post) => ({
            title: post.data.title,
            pubDate: post.data.date,
            description: post.data.description,
            link: `/posts/${post.slug}/`,
            content: sanitizeHtml(parser.render(post.body), {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img'])
            }),
        })),
    });
}