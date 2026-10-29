// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteCalendarInputSchema = z.object({
  calendarId: z.string().describe('The ID of the calendar to delete. Example: "AAMkAGI..."'),
});

export const deleteCalendarOutputSchema = z.object({
  success: z.boolean(),
  calendarId: z.string(),
});

export function deleteCalendarTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_delete_calendar',
    description: 'Delete a secondary calendar.',
    inputSchema: deleteCalendarInputSchema,
    outputSchema: deleteCalendarOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCalendarOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/en-us/graph/api/calendar-delete
      await platformProxy.delete({
        endpoint: `/v1.0/me/calendars/${encodeURIComponent(input.calendarId)}`,
        retries: 1,
      });

      return {
        success: true,
        calendarId: input.calendarId,
      };
    },
  });
}
