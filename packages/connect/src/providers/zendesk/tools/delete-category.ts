// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';
import { zendeskId } from '../article.js';

export const deleteCategoryInputSchema = z.object({
  category_id: zendeskId('Help Center category'),
});

export const deleteCategoryOutputSchema = z.object({
  success: z.literal(true),
  category_id: z.number(),
});

export function deleteCategoryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_delete_category',
    description: 'Delete a Help Center category and every section and article in it. This cannot be undone.',
    inputSchema: deleteCategoryInputSchema,
    outputSchema: deleteCategoryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCategoryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/help_center/help-center-api/categories/#delete-category
      await platformProxy.delete({
        endpoint: `/api/v2/help_center/categories/${input.category_id}`,
        retries: 1,
      });
      return { success: true, category_id: input.category_id };
    },
  });
}
