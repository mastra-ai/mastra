// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const queryDatabaseFilteredInputSchema = z.object({
  database_id: z.string().describe('The ID of the database to query. Example: "2b6ce298-3121-8079-a497-d3eca16d875c"'),
  filter: z.any().describe('Filter conditions. Example: {"property":"Name","title":{"contains":"test"}}'),
  page_size: z.number().optional().describe('Number of results to return (max 100).'),
  cursor: z.string().optional().describe('Pagination cursor from previous response.'),
});

export const queryDatabaseFilteredOutputSchema = z.object({
  object: z.string(),
  results: z.array(z.any()),
  has_more: z.boolean(),
  next_cursor: z.union([z.string(), z.null()]),
});

export function queryDatabaseFilteredTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_query_database_filtered',
    description: 'Retrieves pages from database matching filter conditions.',
    inputSchema: queryDatabaseFilteredInputSchema,
    outputSchema: queryDatabaseFilteredOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof queryDatabaseFilteredOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.notion.com/reference/post-database-query
        endpoint: `v1/databases/${input.database_id}/query`,
        data: {
          filter: input.filter,
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
