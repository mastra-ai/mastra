// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listBlocksInputSchema = z.object({
  cursor: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe('Pagination cursor (offset) from the previous response. Omit for the first page.'),
  start_time: z
    .number()
    .int()
    .optional()
    .describe('Start of the time range in unix timestamp when a block was created (inclusive).'),
  end_time: z
    .number()
    .int()
    .optional()
    .describe('End of the time range in unix timestamp when a block was created (inclusive).'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe('Maximum number of items to return per page. Min 1, max 500.'),
  email: z.string().optional().describe('Filter results by email address. Supports % wildcard.'),
});

const BlockSchema = z.object({
  created: z.number(),
  email: z.string(),
  reason: z.string().optional(),
  status: z.string().optional(),
});

export const listBlocksOutputSchema = z.object({
  items: z.array(BlockSchema),
  next_cursor: z.string().optional(),
});

export function listBlocksTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_blocks',
    description: 'List blocked email addresses.',
    inputSchema: listBlocksInputSchema,
    outputSchema: listBlocksOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBlocksOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const offset = input.cursor ? parseInt(input.cursor, 10) : 0;
      const limit = input.limit ?? 500;

      // https://www.twilio.com/docs/sendgrid/api-reference/blocks-api/retrieve-all-blocks
      const response = await platformProxy.get({
        endpoint: '/v3/suppression/blocks',
        params: {
          ...(input.start_time !== undefined && { start_time: String(input.start_time) }),
          ...(input.end_time !== undefined && { end_time: String(input.end_time) }),
          limit: String(limit),
          ...(input.email !== undefined && { email: input.email }),
          offset: String(offset),
        },
        retries: 3,
      });

      const items = z.array(BlockSchema).parse(response.data);

      const nextCursor = items.length === limit ? String(offset + items.length) : undefined;

      return {
        items,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
