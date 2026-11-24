// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSpamReportsInputSchema = z.object({
  start_time: z
    .number()
    .optional()
    .describe('The start of the time range when a spam report was created (inclusive). This is a unix timestamp.'),
  end_time: z
    .number()
    .optional()
    .describe('The end of the time range when a spam report was created (inclusive). This is a unix timestamp.'),
  limit: z.number().min(1).max(500).optional().describe('The number of items to return per page. Maximum is 500.'),
  cursor: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe('Pagination cursor (offset) from the previous response. Omit for the first page.'),
});

const SpamReportSchema = z.object({
  created: z.number(),
  email: z.string(),
  ip: z.string(),
});

export const listSpamReportsOutputSchema = z.object({
  items: z.array(SpamReportSchema),
  next_cursor: z.string().optional(),
});

export function listSpamReportsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_spam_reports',
    description: 'List email addresses that reported spam.',
    inputSchema: listSpamReportsInputSchema,
    outputSchema: listSpamReportsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSpamReportsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const limit = input.limit ?? 500;
      const offset = input.cursor ? parseInt(input.cursor, 10) : 0;

      const params: Record<string, string | number> = {
        limit,
        offset,
      };

      if (input.start_time !== undefined) {
        params['start_time'] = input.start_time;
      }

      if (input.end_time !== undefined) {
        params['end_time'] = input.end_time;
      }

      const response = await platformProxy.get({
        // https://www.twilio.com/docs/sendgrid/api-reference/spam-reports-api/retrieve-all-spam-reports
        endpoint: '/v3/suppression/spam_reports',
        params,
        retries: 3,
      });

      const providerItems = z.array(SpamReportSchema).parse(response.data);

      const result: z.infer<typeof listSpamReportsOutputSchema> = {
        items: providerItems,
      };

      if (providerItems.length === limit) {
        result.next_cursor = String(offset + limit);
      }

      return result;
    },
  });
}
