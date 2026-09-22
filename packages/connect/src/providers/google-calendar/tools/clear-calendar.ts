// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const clearCalendarInputSchema = z
  .object({
    calendarId: z
      .literal('primary')
      .optional()
      .describe(
        'Calendar identifier. This operation is only supported for the primary calendar; the only valid value is "primary".',
      ),
  })
  .describe('Clears all events from the primary calendar.');

export const clearCalendarOutputSchema = z.object({
  success: z.boolean().describe('Whether the calendar was cleared successfully'),
  calendarId: z.string().describe('The calendar ID that was cleared'),
});

export function clearCalendarTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_clear_calendar',
    description: 'Clear the primary calendar by deleting all events.',
    inputSchema: clearCalendarInputSchema,
    outputSchema: clearCalendarOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof clearCalendarOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const calendarId = input.calendarId || 'primary';

      // https://developers.google.com/workspace/calendar/api/v3/reference/calendars/clear
      await platformProxy.post({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/clear`,
        retries: 3,
      });

      return {
        success: true,
        calendarId,
      };
    },
  });
}
