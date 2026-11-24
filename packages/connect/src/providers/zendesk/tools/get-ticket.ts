// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTicketInputSchema = z.object({
  ticket_id: z.union([z.string(), z.number()]).describe('Ticket ID to retrieve. Example: "1" or 1'),
  include: z
    .string()
    .optional()
    .describe(
      'Comma-separated list of sideloads to include. Example: "users,organizations,groups". See: https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/#sideloads',
    ),
});

const ProviderTicketSchema = z.object({
  id: z.number(),
  url: z.string(),
  subject: z.string(),
  description: z.string().optional(),
  priority: z.string().nullable().optional(),
  status: z.string(),
  type: z.string().nullable().optional(),
  requester_id: z.number().optional(),
  assignee_id: z.number().nullable().optional(),
  organization_id: z.number().nullable().optional(),
  group_id: z.number().nullish(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const getTicketOutputSchema = z.object({
  id: z.number(),
  url: z.string(),
  subject: z.string(),
  description: z.string().optional(),
  priority: z.string().optional(),
  status: z.string(),
  type: z.string().optional(),
  requester_id: z.number().optional(),
  assignee_id: z.number().optional(),
  organization_id: z.number().optional(),
  group_id: z.number().nullish(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sideloads: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Records Zendesk sideloaded for `include`, keyed by sideload name, such as users or groups.'),
});

export function getTicketTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_get_ticket',
    description: 'Retrieve a ticket by ID.',
    inputSchema: getTicketInputSchema,
    outputSchema: getTicketOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTicketOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const ticketId = typeof input.ticket_id === 'number' ? input.ticket_id.toString() : input.ticket_id;

      const config: Parameters<typeof platformProxy.get>[0] = {
        // https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/#show-ticket
        endpoint: `/api/v2/tickets/${encodeURIComponent(ticketId)}.json`,
        retries: 3,
      };

      if (input.include) {
        config.params = {
          include: input.include,
        };
      }

      const response = await platformProxy.get(config);

      const rawTicket = ProviderTicketSchema.parse(response.data.ticket);
      const { ticket: _ticket, ...sideloads } = response.data;

      return {
        id: rawTicket.id,
        url: rawTicket.url,
        subject: rawTicket.subject,
        status: rawTicket.status,
        ...(rawTicket.description !== undefined && { description: rawTicket.description }),
        ...(rawTicket.priority != null && { priority: rawTicket.priority }),
        ...(rawTicket.type != null && { type: rawTicket.type }),
        ...(rawTicket.requester_id !== undefined && { requester_id: rawTicket.requester_id }),
        ...(rawTicket.assignee_id != null && { assignee_id: rawTicket.assignee_id }),
        ...(rawTicket.organization_id != null && { organization_id: rawTicket.organization_id }),
        ...(rawTicket.group_id != null && { group_id: rawTicket.group_id }),
        ...(rawTicket.created_at !== undefined && { created_at: rawTicket.created_at }),
        ...(rawTicket.updated_at !== undefined && { updated_at: rawTicket.updated_at }),
        ...(rawTicket.tags !== undefined && { tags: rawTicket.tags }),
        ...(input.include && Object.keys(sideloads).length > 0 && { sideloads }),
      };
    },
  });
}
