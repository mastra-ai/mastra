// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const removeCalendarFromListInputSchema = z
  .object({
    calendarId: z
      .string()
      .describe(
        'The ID of the calendar to remove from the user\'s calendar list. Use "primary" for the primary calendar, or retrieve IDs from the calendar list.',
      ),
  })
  .describe("Input for removing a calendar from the user's calendar list");

export const removeCalendarFromListOutputSchema = z
  .null()
  .describe('Empty success response indicating the calendar was removed from the list');

export function removeCalendarFromListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_remove_calendar_from_list',
    description: "Remove a calendar from the user's calendar list",
    inputSchema: removeCalendarFromListInputSchema,
    outputSchema: removeCalendarFromListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeCalendarFromListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/delete
      await platformProxy.delete({
        endpoint: `/calendar/v3/users/me/calendarList/${encodeURIComponent(input.calendarId)}`,
        retries: 3,
      });

      return null;
    },
  });
}
