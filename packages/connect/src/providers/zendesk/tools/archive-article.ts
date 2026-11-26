// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';
import { zendeskId } from '../article.js';

export const archiveArticleInputSchema = z.object({
  article_id: zendeskId('Help Center article'),
});

export const archiveArticleOutputSchema = z.object({
  success: z.literal(true),
  article_id: z.number(),
});

export function archiveArticleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_archive_article',
    description:
      'Archive a Help Center article. Archived articles leave the Help Center and can be restored from the Guide admin archive.',
    inputSchema: archiveArticleInputSchema,
    outputSchema: archiveArticleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof archiveArticleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/help_center/help-center-api/articles/#archive-article
      await platformProxy.delete({
        endpoint: `/api/v2/help_center/articles/${input.article_id}`,
        retries: 1,
      });
      return { success: true, article_id: input.article_id };
    },
  });
}
