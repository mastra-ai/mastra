// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteEventInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe('Calendar ID containing the event. Example: "primary" or "abc123@group.calendar.google.com"'),
    eventId: z.string().describe('Event ID to delete. Example: "m1s4a7vgu68bbliv0ganj6fhio"'),
  })
  .describe('Parameters for deleting a calendar event');

export const deleteEventOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export function deleteEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_delete_event',
    description: 'Delete a calendar event',
    inputSchema: deleteEventInputSchema,
    outputSchema: deleteEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/calendar/api/v3/reference/events/delete
      await platformProxy.delete({
        endpoint: `/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
        retries: 3,
      });

      return {
        success: true,
        message: `Event ${input.eventId} successfully deleted from calendar ${input.calendarId}`,
      };
    },
  });
}
