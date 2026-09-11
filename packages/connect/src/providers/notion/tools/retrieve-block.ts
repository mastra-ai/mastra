// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const retrieveBlockInputSchema = z.object({
  block_id: z.string().describe('Block ID. Example: "c02fc1d3-db8b-45c5-a222-27595b15aea7"'),
});

const ProviderResponseSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    type: z.string(),
    created_time: z.string().optional(),
    last_edited_time: z.string().optional(),
    has_children: z.boolean().optional(),
    in_trash: z.boolean().optional(),
  })
  .passthrough();

export const retrieveBlockOutputSchema = z
  .object({
    id: z.string(),
    object: z.literal('block'),
    type: z.string(),
    created_time: z.string().optional(),
    last_edited_time: z.string().optional(),
    has_children: z.boolean().optional(),
    in_trash: z.boolean().optional(),
  })
  .passthrough();

export function retrieveBlockTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_retrieve_block',
    description: 'Retrieve a single block by block ID.',
    inputSchema: retrieveBlockInputSchema,
    outputSchema: retrieveBlockOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof retrieveBlockOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.notion.com/reference/retrieve-a-block
      const response = await platformProxy.get({
        endpoint: `/v1/blocks/${encodeURIComponent(input.block_id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Block not found',
          block_id: input.block_id,
        });
      }

      const parsed = ProviderResponseSchema.parse(response.data);

      return retrieveBlockOutputSchema.parse({
        ...parsed,
        object: 'block',
      });
    },
  });
}
