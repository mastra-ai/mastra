// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const retrieveBlockChildrenInputSchema = z.object({
  block_id: z.string().describe('The ID of the block or page. Example: "2b6ce298-3121-80ae-bfe1-f8984b993639"'),
  page_size: z.number().optional().describe('Number of results to return (max 100).'),
  cursor: z.string().optional().describe('Pagination cursor from previous response.'),
});

export const retrieveBlockChildrenOutputSchema = z.object({
  object: z.string(),
  results: z.array(z.any()),
  has_more: z.boolean(),
  next_cursor: z.union([z.string(), z.null()]),
});

export function retrieveBlockChildrenTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_retrieve_block_children',
    description: 'Gets paginated list of child blocks within a block or page.',
    inputSchema: retrieveBlockChildrenInputSchema,
    outputSchema: retrieveBlockChildrenOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof retrieveBlockChildrenOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.notion.com/reference/get-block-children
        endpoint: `v1/blocks/${input.block_id}/children`,
        params: {
          ...(input.page_size && { page_size: input.page_size }),
          ...(input.cursor && { start_cursor: input.cursor }),
        },
        retries: 3,
      };

      const response = await platformProxy.get(config);
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
