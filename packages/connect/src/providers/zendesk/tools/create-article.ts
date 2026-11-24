// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';
import { articleOutputSchema, localeSchema, toArticle, zendeskId } from '../article.js';

export const createArticleInputSchema = z.object({
  section_id: zendeskId('Help Center section to create the article in'),
  title: z.string().min(1).describe('Title of the article.'),
  body: z.string().describe('Body of the article as HTML. Example: "<p>Restart the printer.</p>"'),
  locale: localeSchema,
  permission_group_id: zendeskId(
    'permission group that can edit and publish the article; see zendesk_list_permission_groups',
  ),
  user_segment_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe('ID of the user segment that can see the article, or null for everyone.'),
  draft: z.boolean().optional().describe('Create the article as an unpublished draft. Default: false'),
  label_names: z.array(z.string()).optional().describe('Labels for search and related articles.'),
  notify_subscribers: z
    .boolean()
    .default(false)
    .describe('Email the section and category subscribers about the new article. Default: false'),
});

export const createArticleOutputSchema = articleOutputSchema;

export function createArticleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_create_article',
    description: 'Create a Help Center article in a section.',
    inputSchema: createArticleInputSchema,
    outputSchema: createArticleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createArticleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/help_center/help-center-api/articles/#create-article
      const response = await platformProxy.post({
        endpoint: `/api/v2/help_center/sections/${input.section_id}/articles`,
        data: {
          article: {
            title: input.title,
            body: input.body,
            locale: input.locale,
            permission_group_id: input.permission_group_id,
            user_segment_id: input.user_segment_id,
            ...(input.draft !== undefined && { draft: input.draft }),
            ...(input.label_names !== undefined && { label_names: input.label_names }),
          },
          notify_subscribers: input.notify_subscribers,
        },
        retries: 1,
      });
      return toArticle(response.data);
    },
  });
}
