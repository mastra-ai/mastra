// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateCalendarInputSchema = z.object({
  calendarId: z.string().describe('The unique identifier of the calendar to update. Example: "AQMkAGI..."'),
  name: z.string().optional().describe('The calendar name. Example: "Work Calendar"'),
  color: z
    .string()
    .optional()
    .describe('The color of the calendar in hex format or a preset color constant. Example: "#2B579A" or "lightBlue"'),
});

const ProviderCalendarSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
});

export const updateCalendarOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
});

export function updateCalendarTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_update_calendar',
    description: 'Update calendar properties.',
    inputSchema: updateCalendarInputSchema,
    outputSchema: updateCalendarOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateCalendarOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) {
        updateData['name'] = input.name;
      }
      if (input.color !== undefined) {
        updateData['color'] = input.color;
      }

      const response = await platformProxy.patch({
        // https://learn.microsoft.com/graph/api/calendar-update
        endpoint: `/v1.0/me/calendars/${encodeURIComponent(input.calendarId)}`,
        data: updateData,
        retries: 3,
      });

      const providerCalendar = ProviderCalendarSchema.parse(response.data);

      return {
        id: providerCalendar.id,
        ...(providerCalendar.name !== undefined && { name: providerCalendar.name }),
        ...(providerCalendar.color !== undefined && { color: providerCalendar.color }),
      };
    },
  });
}
