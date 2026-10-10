// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteEventInputSchema = z.object({
  event_id: z.string().describe('The ID of the event to delete. Example: "AAMkAGI2..."'),
  calendar_id: z.string().optional().describe('Optional calendar ID. If omitted, uses the default calendar.'),
});

export const deleteEventOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export function deleteEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_delete_event',
    description: 'Delete an event from a calendar.',
    inputSchema: deleteEventInputSchema,
    outputSchema: deleteEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let endpoint: string;
      if (input.calendar_id) {
        endpoint = `/v1.0/me/calendars/${encodeURIComponent(input.calendar_id)}/events/${encodeURIComponent(input.event_id)}`;
      } else {
        endpoint = `/v1.0/me/events/${encodeURIComponent(input.event_id)}`;
      }

      // https://learn.microsoft.com/graph/api/event-delete
      await platformProxy.delete({
        endpoint: endpoint,
        retries: 3,
      });

      return {
        success: true,
        message: `Event ${input.event_id} deleted successfully.`,
      };
    },
  });
}
