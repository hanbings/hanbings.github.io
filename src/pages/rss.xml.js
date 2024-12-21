import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
    const allPosts = await getCollection('posts');
    return rss({
        title: '🐱 寒冰是喵喵的 blog',
        description: '欢迎来到我的小世界~',
        site: context.site,
        items: allPosts.map((post) => ({
            title: post.data.title,
            pubDate: post.data.date,
            description: post.data.description,
            link: `/posts/${post.slug}/`,
        })),
    });
}