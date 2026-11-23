// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { z } from 'zod';

export const zendeskId = (what: string) => z.number().int().positive().describe(`The ID of the ${what}.`);

const ProviderArticleSchema = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string().nullable().optional(),
  locale: z.string().optional(),
  section_id: z.number().nullable().optional(),
  author_id: z.number().nullable().optional(),
  permission_group_id: z.number().nullable().optional(),
  user_segment_id: z.number().nullable().optional(),
  user_segment_ids: z.array(z.number()).nullable().optional(),
  draft: z.boolean().optional(),
  promoted: z.boolean().optional(),
  position: z.number().optional(),
  comments_disabled: z.boolean().optional(),
  label_names: z.array(z.string()).nullable().optional(),
  html_url: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const articleOutputSchema = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string().optional(),
  locale: z.string().optional(),
  section_id: z.number().optional(),
  author_id: z.number().optional(),
  permission_group_id: z.number().optional(),
  user_segment_id: z
    .number()
    .nullable()
    .describe(
      'The user segment that can see the article, or null when several can (see user_segment_ids) or everyone can.',
    ),
  user_segment_ids: z
    .array(z.number())
    .describe('Every user segment that can see the article; empty means everyone can.'),
  draft: z.boolean().optional(),
  promoted: z.boolean().optional(),
  position: z.number().optional(),
  comments_disabled: z.boolean().optional(),
  label_names: z.array(z.string()).optional(),
  html_url: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export function toArticle(data: unknown): z.infer<typeof articleOutputSchema> {
  const a = ProviderArticleSchema.parse((data as { article?: unknown } | undefined)?.article);
  return {
    id: a.id,
    title: a.title,
    ...(a.body != null && { body: a.body }),
    ...(a.locale !== undefined && { locale: a.locale }),
    ...(a.section_id != null && { section_id: a.section_id }),
    ...(a.author_id != null && { author_id: a.author_id }),
    ...(a.permission_group_id != null && { permission_group_id: a.permission_group_id }),
    user_segment_id: a.user_segment_id ?? null,
    // Zendesk leaves user_segment_id null when an article has several segments.
    user_segment_ids: a.user_segment_ids ?? (a.user_segment_id != null ? [a.user_segment_id] : []),
    ...(a.draft !== undefined && { draft: a.draft }),
    ...(a.promoted !== undefined && { promoted: a.promoted }),
    ...(a.position !== undefined && { position: a.position }),
    ...(a.comments_disabled !== undefined && { comments_disabled: a.comments_disabled }),
    ...(a.label_names != null && { label_names: a.label_names }),
    ...(a.html_url != null && { html_url: a.html_url }),
    ...(a.created_at !== undefined && { created_at: a.created_at }),
    ...(a.updated_at !== undefined && { updated_at: a.updated_at }),
  };
}

export const localeSchema = z
  .string()
  .regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i, 'Locales look like "en-us" or "fr".')
  .describe('Help Center locale. Example: "en-us"');
