// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const queryDatabaseSortedInputSchema = z.object({
  database_id: z.string().describe('The ID of the database to query. Example: "2b6ce298-3121-8079-a497-d3eca16d875c"'),
  sorts: z.array(z.any()).describe('Sort criteria. Example: [{"property":"Name","direction":"ascending"}]'),
  page_size: z.number().optional().describe('Number of results to return (max 100).'),
  cursor: z.string().optional().describe('Pagination cursor from previous response.'),
});

export const queryDatabaseSortedOutputSchema = z.object({
  object: z.string(),
  results: z.array(z.any()),
  has_more: z.boolean(),
  next_cursor: z.union([z.string(), z.null()]),
});

export function queryDatabaseSortedTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_query_database_sorted',
    description: 'Retrieves pages from database in sorted order.',
    inputSchema: queryDatabaseSortedInputSchema,
    outputSchema: queryDatabaseSortedOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof queryDatabaseSortedOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.notion.com/reference/post-database-query
        endpoint: `v1/databases/${input.database_id}/query`,
        data: {
          sorts: input.sorts,
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
