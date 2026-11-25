// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';
import { localeSchema, zendeskId } from '../article.js';

export const updateArticleTranslationInputSchema = z
  .object({
    article_id: zendeskId('Help Center article'),
    locale: localeSchema,
    title: z.string().min(1).optional().describe('New title.'),
    body: z.string().optional().describe('New body as HTML. Replaces the whole body.'),
    draft: z.boolean().optional().describe('true unpublishes this translation; false publishes it.'),
  })
  .refine(input => input.title !== undefined || input.body !== undefined || input.draft !== undefined, {
    message: 'Give a title, body, or draft value to change.',
  });

const ProviderTranslationSchema = z.object({
  id: z.number(),
  source_id: z.number().optional(),
  locale: z.string(),
  title: z.string(),
  body: z.string().nullable().optional(),
  draft: z.boolean().optional(),
  outdated: z.boolean().optional(),
  html_url: z.string().nullable().optional(),
  updated_at: z.string().optional(),
});

export const updateArticleTranslationOutputSchema = z.object({
  id: z.number().describe('ID of the translation.'),
  article_id: z.number(),
  locale: z.string(),
  title: z.string(),
  body: z.string().optional(),
  draft: z.boolean().optional(),
  outdated: z.boolean().optional(),
  html_url: z.string().optional(),
  updated_at: z.string().optional(),
});

export function updateArticleTranslationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_update_article_translation',
    description:
      "Change the title, body, or published state of one language of a Help Center article. Use the article's own locale to edit the original.",
    inputSchema: updateArticleTranslationInputSchema,
    outputSchema: updateArticleTranslationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateArticleTranslationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/help_center/help-center-api/translations/#update-translation
      const response = await platformProxy.put({
        endpoint: `/api/v2/help_center/articles/${input.article_id}/translations/${encodeURIComponent(input.locale)}`,
        data: {
          translation: {
            ...(input.title !== undefined && { title: input.title }),
            ...(input.body !== undefined && { body: input.body }),
            ...(input.draft !== undefined && { draft: input.draft }),
          },
        },
        retries: 1,
      });
      const t = ProviderTranslationSchema.parse((response.data as { translation?: unknown } | undefined)?.translation);
      return {
        id: t.id,
        article_id: t.source_id ?? input.article_id,
        locale: t.locale,
        title: t.title,
        ...(t.body != null && { body: t.body }),
        ...(t.draft !== undefined && { draft: t.draft }),
        ...(t.outdated !== undefined && { outdated: t.outdated }),
        ...(t.html_url != null && { html_url: t.html_url }),
        ...(t.updated_at !== undefined && { updated_at: t.updated_at }),
      };
    },
  });
}
