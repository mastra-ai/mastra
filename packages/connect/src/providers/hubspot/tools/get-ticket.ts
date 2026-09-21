// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTicketInputSchema = z.object({
  ticketId: z.string().describe('HubSpot ticket ID. Example: "123456789"'),
});

export const getTicketOutputSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  content: z.string().optional(),
  pipeline: z.string().optional(),
  pipelineStage: z.string().optional(),
  priority: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function getTicketTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_get_ticket',
    description: 'Get a ticket by ID',
    inputSchema: getTicketInputSchema,
    outputSchema: getTicketOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTicketOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.hubspot.com/docs/api-reference/crm-tickets-v3/basic/get-crm-v3-objects-tickets-ticketId
        endpoint: `/crm/v3/objects/tickets/${input.ticketId}`,
        params: {
          properties:
            'subject,content,hs_pipeline,hs_pipeline_stage,priority,hs_ticket_priority,source,hs_ticket_source,hs_ticket_category,hs_ticket_resolution,createdate,hs_lastmodifieddate,hs_object_id',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Ticket not found',
          ticketId: input.ticketId,
        });
      }

      const data = response.data;

      return {
        id: data.id,
        subject: data.properties?.['subject'] ?? undefined,
        content: data.properties?.['content'] ?? undefined,
        pipeline: data.properties?.['hs_pipeline'] ?? undefined,
        pipelineStage: data.properties?.['hs_pipeline_stage'] ?? undefined,
        priority: data.properties?.['hs_ticket_priority'] ?? data.properties?.['priority'] ?? undefined,
        source: data.properties?.['hs_ticket_source'] ?? data.properties?.['source'] ?? undefined,
        status: data.properties?.['hs_ticket_category'] ?? undefined,
        createdAt: data.properties?.['createdate'] ?? data.createdAt ?? undefined,
        updatedAt: data.properties?.['hs_lastmodifieddate'] ?? data.updatedAt ?? undefined,
      };
    },
  });
}
