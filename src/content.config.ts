import {defineCollection} from 'astro:content'
import {glob} from 'astro/loaders'
import {z} from 'astro/zod'

const postsCollection = defineCollection({
  loader: glob({base: './src/content/posts', pattern: '**/*.{md,mdx}'}),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    tags: z.array(z.string()),
    draft: z.boolean().optional(),
    background: z.string().optional(),
    author: z.string().optional(),
  }),
})

const eventsCollection = defineCollection({
  loader: glob({base: './src/content/events', pattern: '**/*.{md,mdx}'}),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    draft: z.boolean().optional(),
    background: z.string().optional(),
    author: z.string().optional(),
  }),
})

export const collections = {
  posts: postsCollection,
  events: eventsCollection,
}
