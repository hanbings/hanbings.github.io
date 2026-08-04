import {defineCollection} from 'astro:content'
import {glob} from 'astro/loaders'
import {z} from 'astro/zod'
import {typstPosts} from './loaders/typst-posts'

const postsCollection = defineCollection({
  loader: glob({base: './src/content/posts', pattern: '**/*.{md,mdx}'}),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    tags: z.array(z.string()),
    draft: z.boolean().optional(),
    background: z.string().optional(),
    backgroundOpacity: z.number().min(0).max(1).optional(),
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
    backgroundOpacity: z.number().min(0).max(1).optional(),
    author: z.string().optional(),
  }),
})

const typstPostsCollection = defineCollection({
  loader: typstPosts(),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    description: z.string(),
    date: z.string(),
    updated: z.string().optional(),
    authors: z.array(
      z.object({
        name: z.string(),
        affiliation: z.string().optional(),
        email: z.email().optional(),
        orcid: z.string().optional(),
      }),
    ),
    abstract: z.string(),
    keywords: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().optional(),
    venue: z.string().optional(),
    doi: z.string().optional(),
    repository: z.url().optional(),
    license: z.string().optional(),
    language: z.string().default('en'),
    background: z.string().optional(),
    backgroundOpacity: z.number().min(0).max(1).optional(),
    source: z.string(),
    pdfUrl: z.string(),
    sourceUrl: z.string(),
    htmlBody: z.string(),
    htmlStyles: z.string(),
    typstVersion: z.string(),
  }),
})

export const collections = {
  posts: postsCollection,
  events: eventsCollection,
  typstPosts: typstPostsCollection,
}
