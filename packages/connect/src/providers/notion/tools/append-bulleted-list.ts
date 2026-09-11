// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const appendBulletedListInputSchema = z.object({
  block_id: z
    .string()
    .describe('The ID of the block or page to append to. Example: "2b6ce298-3121-80ae-bfe1-f8984b993639"'),
  children: z.array(z.any()).describe('Array of bulleted list item blocks.'),
});

export const appendBulletedListOutputSchema = z.object({
  object: z.string(),
  results: z.array(z.any()),
});

export function appendBulletedListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_append_bulleted_list',
    description: 'Adds bulleted list items to a page.',
    inputSchema: appendBulletedListInputSchema,
    outputSchema: appendBulletedListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof appendBulletedListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.notion.com/reference/patch-block-children
        endpoint: `v1/blocks/${input.block_id}/children`,
        data: {
          children: input.children,
        },
        retries: 3,
      };

      const response = await platformProxy.patch(config);
      const data = response.data;

      return {
        object: data.object,
        results: data.results,
      };
    },
  });
}
