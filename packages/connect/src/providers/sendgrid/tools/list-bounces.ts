// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listBouncesInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  start_time: z
    .number()
    .optional()
    .describe('Start of the time range in unix timestamp when a bounce was created (inclusive).'),
  end_time: z
    .number()
    .optional()
    .describe('End of the time range in unix timestamp when a bounce was created (inclusive).'),
  limit: z.number().optional().describe('Maximum number of items to return per page. Max 500.'),
  email: z.string().optional().describe('Filter results by email address. Supports % wildcard.'),
});

const BounceSchema = z.object({
  created: z.number().optional(),
  email: z.string().optional(),
  reason: z.string().optional(),
  status: z.string().optional(),
});

export const listBouncesOutputSchema = z.object({
  items: z.array(BounceSchema),
  next_cursor: z.string().optional(),
});

export function listBouncesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_bounces',
    description: 'List bounced email addresses.',
    inputSchema: listBouncesInputSchema,
    outputSchema: listBouncesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBouncesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const offset = input.cursor ? parseInt(input.cursor, 10) : 0;
      if (isNaN(offset)) {
        throw new platformProxy.ActionError({
          type: 'invalid_cursor',
          message: 'cursor must be a valid offset string',
        });
      }

      // https://www.twilio.com/docs/sendgrid/api-reference/bounces-api/retrieve-all-bounces
      const response = await platformProxy.get({
        endpoint: '/v3/suppression/bounces',
        params: {
          ...(input.start_time !== undefined && { start_time: String(input.start_time) }),
          ...(input.end_time !== undefined && { end_time: String(input.end_time) }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.email !== undefined && { email: input.email }),
          offset: String(offset),
        },
        retries: 3,
      });

      const providerBounces = z.array(BounceSchema).parse(response.data);

      const items = providerBounces.map(bounce => ({
        ...(bounce.created !== undefined && { created: bounce.created }),
        ...(bounce.email !== undefined && { email: bounce.email }),
        ...(bounce.reason !== undefined && { reason: bounce.reason }),
        ...(bounce.status !== undefined && { status: bounce.status }),
      }));

      const next_cursor = providerBounces.length > 0 ? String(offset + providerBounces.length) : undefined;

      return {
        items,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
