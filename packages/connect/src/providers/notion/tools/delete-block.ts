// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteBlockInputSchema = z.object({
  block_id: z
    .string()
    .describe('The ID of the block to delete/archive. Example: "12345678-1234-1234-1234-123456789012"'),
});

export const deleteBlockOutputSchema = z.object({
  id: z.string(),
  type: z.string(),
  archived: z.boolean(),
});

const ProviderBlockSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    archived: z.boolean(),
  })
  .passthrough();

export function deleteBlockTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_delete_block',
    description: 'Delete or archive a block by ID.',
    inputSchema: deleteBlockInputSchema,
    outputSchema: deleteBlockOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteBlockOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.notion.com/reference/delete-a-block
      const response = await platformProxy.delete({
        endpoint: `/v1/blocks/${encodeURIComponent(input.block_id)}`,
        retries: 3,
      });

      const providerBlock = ProviderBlockSchema.parse(response.data);

      return {
        id: providerBlock.id,
        type: providerBlock.type,
        archived: providerBlock.archived,
      };
    },
  });
}
