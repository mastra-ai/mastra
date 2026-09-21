// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listTicketsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
  limit: z.number().min(1).max(100).optional().describe('Number of tickets to return per page. Max 100.'),
});

const TicketSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  content: z.string().optional(),
  hs_pipeline: z.string().optional(),
  hs_pipeline_stage: z.string().optional(),
  hs_ticket_priority: z.string().optional(),
  hs_ticket_category: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const listTicketsOutputSchema = z.object({
  items: z.array(TicketSchema),
  nextCursor: z.string().optional(),
});

export function listTicketsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_list_tickets',
    description: 'List support tickets',
    inputSchema: listTicketsInputSchema,
    outputSchema: listTicketsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTicketsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/crm-tickets-v3/basic/get-crm-v3-objects-tickets
      const response = await platformProxy.get({
        endpoint: '/crm/v3/objects/tickets',
        params: {
          properties: 'subject,content,hs_pipeline,hs_pipeline_stage,hs_ticket_priority,hs_ticket_category',
          limit: String(input.limit || 50),
          ...(input.cursor && { after: input.cursor }),
        },
        retries: 3,
      });

      const tickets = response.data.results || [];

      const items = tickets.map((ticket: any) => ({
        id: ticket.id,
        subject: ticket.properties?.['subject'] ?? undefined,
        content: ticket.properties?.['content'] ?? undefined,
        hs_pipeline: ticket.properties?.['hs_pipeline'] ?? undefined,
        hs_pipeline_stage: ticket.properties?.['hs_pipeline_stage'] ?? undefined,
        hs_ticket_priority: ticket.properties?.['hs_ticket_priority'] ?? undefined,
        hs_ticket_category: ticket.properties?.['hs_ticket_category'] ?? undefined,
        createdAt: ticket.createdAt ?? undefined,
        updatedAt: ticket.updatedAt ?? undefined,
      }));

      const nextCursor = response.data.paging?.next?.after || undefined;

      return {
        items,
        nextCursor,
      };
    },
  });
}
