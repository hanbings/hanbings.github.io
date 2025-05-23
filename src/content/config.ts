import { z, defineCollection } from "astro:content"

const postsCollection = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(),
        tags: z.array(z.string()),
        draft: z.boolean().optional(),
        image: z.string().optional(),
        author: z.string().optional()
    })
})

const eventsCollection = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(),
        draft: z.boolean().optional(),
        image: z.string().optional(),
        author: z.string().optional()
    })
})

export const collections = {
    posts: postsCollection,
    events: eventsCollection,
}