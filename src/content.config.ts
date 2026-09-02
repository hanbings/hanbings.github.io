import {defineCollection} from 'astro:content'
import {glob} from 'astro/loaders'
import {z} from 'astro/zod'
import {typstPosts} from './loaders/typst-posts'

const postDates = {
  // `date` is kept as a read-only compatibility path for posts that have not
  // been migrated yet. New posts should use `created` and `published`.
  date: z.coerce.date().optional(),
  created: z.coerce.date().optional(),
  published: z.coerce.date().optional(),
  draft: z.boolean().optional(),
}

const validatePostDates = (
  data: {
    date?: Date
    created?: Date
    published?: Date
    draft?: boolean
  },
  context: z.RefinementCtx,
) => {
  if (!data.created && !data.date) {
    context.addIssue({
      code: 'custom',
      path: ['created'],
      message: '文章必须设置 created（旧文章可暂时使用 date）',
    })
  }

  const legacyPublished = !data.created && data.date
  if (!data.draft && !data.published && !legacyPublished) {
    context.addIssue({
      code: 'custom',
      path: ['published'],
      message: '非草稿文章必须设置 published',
    })
  }
}

const normalizePostDates = <
  T extends {
    date?: Date
    created?: Date
    published?: Date
    draft?: boolean
  },
>({
  date,
  ...data
}: T) => ({
  ...data,
  created: (data.created ?? date)!,
  // A legacy `date` represented both values. Once `created` is present,
  // publication must be explicit so removing `draft` cannot reuse an old date.
  published: data.published ?? (!data.created && !data.draft ? date : undefined),
})

const postsCollection = defineCollection({
  loader: glob({base: './src/content/posts', pattern: '**/*.{md,mdx}'}),
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
      background: z.string().optional(),
      backgroundOpacity: z.number().min(0).max(1).optional(),
      author: z.string().optional(),
      ...postDates,
    })
    .superRefine(validatePostDates)
    .transform(normalizePostDates),
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
  schema: z
    .object({
      title: z.string(),
      subtitle: z.string().optional(),
      description: z.string(),
      updated: z.coerce.date().optional(),
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
      ...postDates,
    })
    .superRefine(validatePostDates)
    .transform(normalizePostDates),
})

export const collections = {
  posts: postsCollection,
  events: eventsCollection,
  typstPosts: typstPostsCollection,
}
