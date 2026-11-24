// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';
import { articleOutputSchema, toArticle, zendeskId } from '../article.js';

export const updateArticleInputSchema = z
  .object({
    article_id: zendeskId('Help Center article'),
    section_id: zendeskId('section to move the article to').optional(),
    permission_group_id: zendeskId('permission group that can edit and publish the article').optional(),
    user_segment_id: z
      .number()
      .int()
      .positive()
      .nullable()
      .optional()
      .describe('ID of the user segment that can see the article, or null for everyone.'),
    label_names: z.array(z.string()).optional().describe('Replaces the article labels.'),
    promoted: z.boolean().optional().describe('Pin the article to the top of its section.'),
    position: z.number().int().nonnegative().optional().describe('Position in the section when sorted manually.'),
    comments_disabled: z.boolean().optional().describe('Turn comments on the article off.'),
  })
  .refine(input => Object.entries(input).some(([key, value]) => key !== 'article_id' && value !== undefined), {
    message: 'Give at least one field to change. To change the title or body, use zendesk_update_article_translation.',
  });

export const updateArticleOutputSchema = articleOutputSchema;

export function updateArticleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_update_article',
    description:
      "Change a Help Center article's section, visibility, labels, or placement. To change its title or body, use zendesk_update_article_translation.",
    inputSchema: updateArticleInputSchema,
    outputSchema: updateArticleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateArticleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const { article_id, ...article } = input;
      // https://developer.zendesk.com/api-reference/help_center/help-center-api/articles/#update-article
      const response = await platformProxy.put({
        endpoint: `/api/v2/help_center/articles/${article_id}`,
        data: { article },
        retries: 1,
      });
      return toArticle(response.data);
    },
  });
}
