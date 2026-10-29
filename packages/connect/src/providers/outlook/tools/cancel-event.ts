// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const cancelEventInputSchema = z.object({
  eventId: z.string().describe('The ID of the event to cancel. Example: "AQMkAGI2..."'),
  comment: z
    .string()
    .optional()
    .describe('An optional comment to include in the cancellation message sent to attendees.'),
});

export const cancelEventOutputSchema = z.object({
  success: z.boolean(),
});

export function cancelEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_cancel_event',
    description: 'Cancel a meeting and send the cancellation notice to attendees',
    inputSchema: cancelEventInputSchema,
    outputSchema: cancelEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof cancelEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: { Comment?: string } = {};
      if (input.comment !== undefined) {
        requestBody.Comment = input.comment;
      }

      // https://learn.microsoft.com/graph/api/event-cancel?view=graph-rest-1.0
      await platformProxy.post({
        endpoint: `/v1.0/me/events/${encodeURIComponent(input.eventId)}/cancel`,
        data: requestBody,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
