// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getArticleInputSchema = z.object({
  article_id: z.number().describe('The unique ID of the article. Example: 360026053753'),
});

const ProviderArticleSchema = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string().optional(),
  author_id: z.number().optional(),
  section_id: z.number().optional(),
  category_id: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  edited_at: z.string().optional(),
  locale: z.string().optional(),
  source_locale: z.string().optional(),
  html_url: z.string().optional(),
  url: z.string().optional(),
  draft: z.boolean().optional(),
  promoted: z.boolean().optional(),
  position: z.number().optional(),
  comments_disabled: z.boolean().optional(),
  vote_count: z.number().optional(),
  vote_sum: z.number().optional(),
  permission_group_id: z.number().optional(),
  user_segment_id: z.number().nullable().optional(),
  user_segment_ids: z.array(z.number()).optional(),
  label_names: z.array(z.string()).optional(),
  content_tag_ids: z.array(z.string()).optional(),
  outdated: z.boolean().optional(),
  outdated_locales: z.array(z.string()).optional(),
});

export const getArticleOutputSchema = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string().optional(),
  author_id: z.number().optional(),
  section_id: z.number().optional(),
  category_id: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  edited_at: z.string().optional(),
  locale: z.string().optional(),
  source_locale: z.string().optional(),
  html_url: z.string().optional(),
  url: z.string().optional(),
  draft: z.boolean().optional(),
  promoted: z.boolean().optional(),
  position: z.number().optional(),
  comments_disabled: z.boolean().optional(),
  vote_count: z.number().optional(),
  vote_sum: z.number().optional(),
  permission_group_id: z.number().optional(),
  user_segment_id: z.number().optional(),
  user_segment_ids: z.array(z.number()).optional(),
  label_names: z.array(z.string()).optional(),
  content_tag_ids: z.array(z.string()).optional(),
  outdated: z.boolean().optional(),
  outdated_locales: z.array(z.string()).optional(),
});

export function getArticleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_get_article',
    description: 'Retrieve a Zendesk Help Center article by ID.',
    inputSchema: getArticleInputSchema,
    outputSchema: getArticleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getArticleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/help_center/help-center-api/articles/#show-article
      const response = await platformProxy.get({
        endpoint: `/api/v2/help_center/articles/${encodeURIComponent(input.article_id)}`,
        retries: 3,
      });

      if (!response.data || !response.data.article) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Article not found with ID: ${input.article_id}`,
        });
      }

      const providerArticle = ProviderArticleSchema.parse(response.data.article);

      return {
        id: providerArticle.id,
        title: providerArticle.title,
        ...(providerArticle.body !== undefined && { body: providerArticle.body }),
        ...(providerArticle.author_id !== undefined && { author_id: providerArticle.author_id }),
        ...(providerArticle.section_id !== undefined && { section_id: providerArticle.section_id }),
        ...(providerArticle.category_id !== undefined && { category_id: providerArticle.category_id }),
        ...(providerArticle.created_at !== undefined && { created_at: providerArticle.created_at }),
        ...(providerArticle.updated_at !== undefined && { updated_at: providerArticle.updated_at }),
        ...(providerArticle.edited_at !== undefined && { edited_at: providerArticle.edited_at }),
        ...(providerArticle.locale !== undefined && { locale: providerArticle.locale }),
        ...(providerArticle.source_locale !== undefined && { source_locale: providerArticle.source_locale }),
        ...(providerArticle.html_url !== undefined && { html_url: providerArticle.html_url }),
        ...(providerArticle.url !== undefined && { url: providerArticle.url }),
        ...(providerArticle.draft !== undefined && { draft: providerArticle.draft }),
        ...(providerArticle.promoted !== undefined && { promoted: providerArticle.promoted }),
        ...(providerArticle.position !== undefined && { position: providerArticle.position }),
        ...(providerArticle.comments_disabled !== undefined && {
          comments_disabled: providerArticle.comments_disabled,
        }),
        ...(providerArticle.vote_count !== undefined && { vote_count: providerArticle.vote_count }),
        ...(providerArticle.vote_sum !== undefined && { vote_sum: providerArticle.vote_sum }),
        ...(providerArticle.permission_group_id !== undefined && {
          permission_group_id: providerArticle.permission_group_id,
        }),
        ...(providerArticle.user_segment_id != null && { user_segment_id: providerArticle.user_segment_id }),
        ...(providerArticle.user_segment_ids !== undefined && { user_segment_ids: providerArticle.user_segment_ids }),
        ...(providerArticle.label_names !== undefined && { label_names: providerArticle.label_names }),
        ...(providerArticle.content_tag_ids !== undefined && { content_tag_ids: providerArticle.content_tag_ids }),
        ...(providerArticle.outdated !== undefined && { outdated: providerArticle.outdated }),
        ...(providerArticle.outdated_locales !== undefined && { outdated_locales: providerArticle.outdated_locales }),
      };
    },
  });
}
