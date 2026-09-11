// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const appendCalloutBlockInputSchema = z.object({
  block_id: z
    .string()
    .describe('The ID of the block or page to append to. Example: "2b6ce298-3121-80ae-bfe1-f8984b993639"'),
  children: z.array(z.any()).describe('Array of callout block objects.'),
});

export const appendCalloutBlockOutputSchema = z.object({
  object: z.string(),
  results: z.array(z.any()),
});

export function appendCalloutBlockTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_append_callout_block',
    description: 'Adds a callout block with icon to a page.',
    inputSchema: appendCalloutBlockInputSchema,
    outputSchema: appendCalloutBlockOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof appendCalloutBlockOutputSchema>> => {
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
