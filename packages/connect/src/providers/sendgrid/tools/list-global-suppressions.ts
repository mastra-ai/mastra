// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listGlobalSuppressionsInputSchema = z.object({
  start_time: z
    .number()
    .optional()
    .describe('Start of the time range in unix timestamp when an unsubscribe email was created (inclusive).'),
  end_time: z
    .number()
    .optional()
    .describe('End of the time range in unix timestamp when an unsubscribe email was created (inclusive).'),
  limit: z.number().min(1).max(500).optional().describe('Maximum number of items to return per page. Defaults to 500.'),
  cursor: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe('Pagination cursor (offset value) from the previous response. Omit for the first page.'),
});

const SuppressionSchema = z.object({
  created: z.number(),
  email: z.string(),
});

export const listGlobalSuppressionsOutputSchema = z.object({
  items: z.array(SuppressionSchema),
  next_cursor: z
    .string()
    .optional()
    .describe('Pagination cursor to use for the next page, if more results may be available.'),
});

export function listGlobalSuppressionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_global_suppressions',
    description: 'List globally unsubscribed email addresses.',
    inputSchema: listGlobalSuppressionsInputSchema,
    outputSchema: listGlobalSuppressionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listGlobalSuppressionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const limit = input.limit ?? 500;
      const offset = input.cursor ? Number(input.cursor) : 0;

      const response = await platformProxy.get({
        // https://www.twilio.com/docs/sendgrid/api-reference/suppressions-global-suppressions/retrieve-all-global-suppressions
        endpoint: '/v3/suppression/unsubscribes',
        params: {
          ...(input.start_time !== undefined && { start_time: String(input.start_time) }),
          ...(input.end_time !== undefined && { end_time: String(input.end_time) }),
          limit: String(limit),
          offset: String(offset),
        },
        retries: 3,
      });

      const items = z.array(SuppressionSchema).parse(response.data);
      const nextOffset = items.length === limit ? offset + limit : undefined;

      return {
        items,
        ...(nextOffset !== undefined && { next_cursor: String(nextOffset) }),
      };
    },
  });
}
