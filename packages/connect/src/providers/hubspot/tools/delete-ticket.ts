// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteTicketInputSchema = z.object({
  ticketId: z.string().describe('The ID of the ticket to delete. Example: "12345"'),
});

export const deleteTicketOutputSchema = z.object({
  success: z.boolean(),
  ticketId: z.string(),
});

export function deleteTicketTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_delete_ticket',
    description: 'Delete a support ticket',
    inputSchema: deleteTicketInputSchema,
    outputSchema: deleteTicketOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTicketOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/crm-tickets-v3/guide
      await platformProxy.delete({
        endpoint: `/crm/v3/objects/tickets/${input.ticketId}`,
        retries: 3,
      });

      return {
        success: true,
        ticketId: input.ticketId,
      };
    },
  });
}
