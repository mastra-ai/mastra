// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';
import { zendeskId } from '../article.js';

export const deleteTicketInputSchema = z.object({
  ticket_id: zendeskId('ticket'),
});

export const deleteTicketOutputSchema = z.object({
  success: z.literal(true),
  ticket_id: z.number(),
});

export function deleteTicketTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_delete_ticket',
    description: 'Delete a ticket. Zendesk moves it to deleted tickets, where an admin can restore it for 30 days.',
    inputSchema: deleteTicketInputSchema,
    outputSchema: deleteTicketOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteTicketOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/#delete-ticket
      await platformProxy.delete({
        endpoint: `/api/v2/tickets/${input.ticket_id}.json`,
        retries: 1,
      });
      return { success: true, ticket_id: input.ticket_id };
    },
  });
}
