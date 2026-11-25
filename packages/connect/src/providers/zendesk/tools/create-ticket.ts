// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createTicketInputSchema = z.object({
  subject: z.string().describe('The subject of the ticket. Example: "My printer is on fire!"'),
  comment: z
    .string()
    .describe(
      'The initial comment on the ticket. Example: "The printer caught fire when I tried to print a document."',
    ),
  requester_email: z
    .string()
    .optional()
    .describe(
      'Email of the requester. If no user exists with this email, a new user will be created. Example: "customer@example.com"',
    ),
  requester_name: z
    .string()
    .optional()
    .describe('Name of the requester. Only used when creating a new user. Example: "John Doe"'),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).optional().describe('Priority of the ticket.'),
  status: z.enum(['new', 'open', 'pending', 'hold', 'solved', 'closed']).optional().describe('Status of the ticket.'),
  tags: z.array(z.string()).optional().describe('Tags applied to the ticket. Example: ["printer", "urgent"]'),
  type: z.enum(['problem', 'incident', 'question', 'task']).optional().describe('Type of ticket.'),
});

const TicketSchema = z.object({
  id: z.number(),
  url: z.string(),
  subject: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  priority: z.string().nullable(),
  type: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  requester_id: z.number(),
  submitter_id: z.number(),
  assignee_id: z.number().nullable(),
  organization_id: z.number().nullable(),
  group_id: z.number().nullable(),
  tags: z.array(z.string()),
});

export const createTicketOutputSchema = z.object({
  id: z.number(),
  url: z.string(),
  subject: z.string(),
  description: z.string().optional(),
  status: z.string(),
  priority: z.string().optional(),
  type: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  requester_id: z.number(),
  submitter_id: z.number(),
  assignee_id: z.number().optional(),
  organization_id: z.number().optional(),
  group_id: z.number().optional(),
  tags: z.array(z.string()),
});

export function createTicketTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_create_ticket',
    description: 'Create a support ticket in Zendesk',
    inputSchema: createTicketInputSchema,
    outputSchema: createTicketOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createTicketOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const ticketData: {
        subject: string;
        comment: { body: string };
        requester?: { email: string; name?: string };
        priority?: string;
        status?: string;
        tags?: string[];
        type?: string;
      } = {
        subject: input.subject,
        comment: { body: input.comment },
      };

      if (input.requester_email) {
        ticketData.requester = { email: input.requester_email };
        if (input.requester_name) {
          ticketData.requester.name = input.requester_name;
        }
      }

      if (input.priority !== undefined) {
        ticketData.priority = input.priority;
      }

      if (input.status !== undefined) {
        ticketData.status = input.status;
      }

      if (input.tags !== undefined) {
        ticketData.tags = input.tags;
      }

      if (input.type !== undefined) {
        ticketData.type = input.type;
      }

      // https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/#create-ticket
      const response = await platformProxy.post({
        endpoint: '/api/v2/tickets.json',
        data: { ticket: ticketData },
        retries: 1,
      });

      if (!response.data || !response.data.ticket) {
        throw new platformProxy.ActionError({
          type: 'creation_failed',
          message: 'Failed to create ticket - no ticket data in response',
        });
      }

      const rawTicket = response.data.ticket;
      const providerTicket = TicketSchema.parse(rawTicket);

      return {
        id: providerTicket.id,
        url: providerTicket.url,
        subject: providerTicket.subject,
        ...(providerTicket.description != null && { description: providerTicket.description }),
        status: providerTicket.status,
        ...(providerTicket.priority != null && { priority: providerTicket.priority }),
        ...(providerTicket.type != null && { type: providerTicket.type }),
        created_at: providerTicket.created_at,
        updated_at: providerTicket.updated_at,
        requester_id: providerTicket.requester_id,
        submitter_id: providerTicket.submitter_id,
        ...(providerTicket.assignee_id != null && { assignee_id: providerTicket.assignee_id }),
        ...(providerTicket.organization_id != null && { organization_id: providerTicket.organization_id }),
        ...(providerTicket.group_id != null && { group_id: providerTicket.group_id }),
        tags: providerTicket.tags,
      };
    },
  });
}
