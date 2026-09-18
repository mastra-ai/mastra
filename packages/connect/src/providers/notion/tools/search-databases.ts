// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const searchDatabasesInputSchema = z.object({
  query: z.string().optional().describe('Text to search for in database titles.'),
  page_size: z.number().optional().describe('Number of results to return (max 100).'),
  cursor: z.string().optional().describe('Pagination cursor from previous response.'),
});

export const searchDatabasesOutputSchema = z.object({
  object: z.string(),
  results: z.array(z.any()),
  has_more: z.boolean(),
  next_cursor: z.union([z.string(), z.null()]),
});

export function searchDatabasesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_search_databases',
    description: 'Searches only databases shared with the integration.',
    inputSchema: searchDatabasesInputSchema,
    outputSchema: searchDatabasesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchDatabasesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.notion.com/reference/post-search
        endpoint: 'v1/search',
        data: {
          ...(input.query && { query: input.query }),
          filter: { property: 'object', value: 'database' },
          ...(input.page_size && { page_size: input.page_size }),
          ...(input.cursor && { start_cursor: input.cursor }),
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);
      const data = response.data;

      return {
        object: data.object,
        results: data.results,
        has_more: data.has_more,
        next_cursor: data.next_cursor ?? null,
      };
    },
  });
}
