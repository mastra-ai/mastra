// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteCalendarInputSchema = z
  .object({
    calendarId: z.string().describe('The ID of the calendar to delete.'),
  })
  .describe('Input for deleting a Google Calendar.');

export const deleteCalendarOutputSchema = z.object({
  success: z.boolean(),
  calendarId: z.string(),
});

export function deleteCalendarTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_delete_calendar',
    description: 'Delete a calendar',
    inputSchema: deleteCalendarInputSchema,
    outputSchema: deleteCalendarOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCalendarOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/calendar/api/v3/reference/calendars/delete
      await platformProxy.delete({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}`,
        retries: 3,
      });

      return {
        success: true,
        calendarId: input.calendarId,
      };
    },
  });
}
