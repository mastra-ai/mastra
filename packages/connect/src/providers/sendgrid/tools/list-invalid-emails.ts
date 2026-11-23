// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listInvalidEmailsInputSchema = z.object({
  start_time: z
    .number()
    .int()
    .optional()
    .describe(
      'Start of the time range in unix timestamp when an invalid email was created (inclusive). Example: 1443651141',
    ),
  end_time: z
    .number()
    .int()
    .optional()
    .describe(
      'End of the time range in unix timestamp when an invalid email was created (inclusive). Example: 1443651154',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe('Maximum number of items to return for a single API request. Min 1, max 500. Example: 10'),
  cursor: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe('Pagination cursor (offset) from the previous response. Omit for the first page.'),
});

const InvalidEmailSchema = z.object({
  created: z.number(),
  email: z.string(),
  reason: z.string().optional(),
});

export const listInvalidEmailsOutputSchema = z.object({
  items: z.array(InvalidEmailSchema),
  next_offset: z.string().optional(),
});

export function listInvalidEmailsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_invalid_emails',
    description: 'List invalid email addresses.',
    inputSchema: listInvalidEmailsInputSchema,
    outputSchema: listInvalidEmailsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listInvalidEmailsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const offset = input.cursor ? parseInt(input.cursor, 10) : 0;
      const limit = input.limit ?? 500;

      // https://www.twilio.com/docs/sendgrid/api-reference/invalid-emails-api/retrieve-all-invalid-emails
      const response = await platformProxy.get({
        endpoint: '/v3/suppression/invalid_emails',
        params: {
          ...(input.start_time !== undefined && { start_time: String(input.start_time) }),
          ...(input.end_time !== undefined && { end_time: String(input.end_time) }),
          limit: String(limit),
          offset: String(offset),
        },
        retries: 3,
      });

      const rawItems = z.array(z.unknown()).parse(response.data);
      const items = rawItems.map((item: unknown) => InvalidEmailSchema.parse(item));

      const nextOffset = items.length === limit ? String(offset + items.length) : undefined;

      return {
        items,
        ...(nextOffset !== undefined && { next_offset: nextOffset }),
      };
    },
  });
}
