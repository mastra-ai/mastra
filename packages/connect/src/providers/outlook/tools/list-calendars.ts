// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCalendarsInputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe('Full @odata.nextLink URL from the previous response for pagination. Omit for the first page.'),
  limit: z.number().optional().describe('Maximum number of calendars to return. Default is 10, maximum is 50.'),
});

const CalendarSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
  changeKey: z.string().optional(),
  canShare: z.boolean().optional(),
  canViewPrivateItems: z.boolean().optional(),
  canEdit: z.boolean().optional(),
  owner: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
});

const ProviderResponseSchema = z.object({
  value: z.array(CalendarSchema),
  '@odata.nextLink': z.string().optional(),
});

export const listCalendarsOutputSchema = z.object({
  calendars: z.array(CalendarSchema),
  next_cursor: z.string().optional(),
});

export function listCalendarsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_list_calendars',
    description: 'List calendars in the mailbox.',
    inputSchema: listCalendarsInputSchema,
    outputSchema: listCalendarsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCalendarsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Microsoft Graph: use the full @odata.nextLink URL for subsequent pages
      // https://learn.microsoft.com/graph/api/user-list-calendars
      const endpoint = input.cursor ?? '/v1.0/me/calendars';
      const params = input.cursor ? {} : { $top: String(Math.min(input.limit ?? 10, 50)) };
      const response = await platformProxy.get({ endpoint, params, retries: 3 });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        calendars: providerData.value,
        ...(providerData['@odata.nextLink'] !== undefined && { next_cursor: providerData['@odata.nextLink'] }),
      };
    },
  });
}
