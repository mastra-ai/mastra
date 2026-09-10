// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateBlockInputSchema = z.object({
  block_id: z.string().describe('The ID of the block to update. Example: "c02fc1d3-db8b-45c5-a222-27595b15aea7"'),
  content: z.object({}).passthrough(),
});

const BlockBaseSchema = z.object({
  object: z.string(),
  id: z.string(),
  type: z.string(),
});

export const updateBlockOutputSchema = z.object({
  id: z.string(),
  type: z.string(),
  object: z.string(),
});

export function updateBlockTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_update_block',
    description: "Update a block's supported fields or rich text content.",
    inputSchema: updateBlockInputSchema,
    outputSchema: updateBlockOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateBlockOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const blockTypes = Object.keys(input.content);
      if (blockTypes.length !== 1) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message:
            blockTypes.length === 0
              ? 'The content object must contain a block type key (e.g., "paragraph", "heading_1", "to_do").'
              : 'The content object must contain exactly one block type key.',
        });
      }

      const blockType = blockTypes[0]!;

      const blockContent = input.content[blockType];

      if (blockType === 'child_page' || blockType === 'child_database') {
        throw new platformProxy.ActionError({
          type: 'unsupported_block_type',
          message: `Updating ${blockType} blocks is not supported via this endpoint. Use the appropriate page or database update endpoint instead.`,
        });
      }

      // https://developers.notion.com/reference/update-a-block
      const response = await platformProxy.patch({
        endpoint: `/v1/blocks/${encodeURIComponent(input.block_id)}`,
        data: {
          [blockType]: blockContent,
        },
        retries: 3,
      });

      const block = BlockBaseSchema.parse(response.data);

      return {
        id: block.id,
        type: block.type,
        object: block.object,
      };
    },
  });
}
