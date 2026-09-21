// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createTicketInputSchema = z.object({
  subject: z.string().describe('The ticket subject/title. Example: "Support request for login issue"'),
  content: z
    .string()
    .optional()
    .describe('The ticket description/content. Example: "User cannot log in to their account"'),
  hs_pipeline: z.string().optional().describe('Pipeline ID. Example: "0"'),
  hs_pipeline_stage: z.string().optional().describe('Pipeline stage ID. Example: "1"'),
  hs_ticket_priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().describe('Ticket priority level'),
});

export const createTicketOutputSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  content: z.string().optional(),
  hs_pipeline: z.string().optional(),
  hs_pipeline_stage: z.string().optional(),
  hs_ticket_priority: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function createTicketTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_create_ticket',
    description: 'Create a support ticket in HubSpot CRM',
    inputSchema: createTicketInputSchema,
    outputSchema: createTicketOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createTicketOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/crm-tickets-v3/basic/post-crm-v3-objects-tickets
      const properties: Record<string, string> = {
        subject: input.subject,
      };

      if (input.content) properties['content'] = input.content;
      if (input.hs_pipeline) properties['hs_pipeline'] = input.hs_pipeline;
      if (input.hs_pipeline_stage) properties['hs_pipeline_stage'] = input.hs_pipeline_stage;
      if (input.hs_ticket_priority) properties['hs_ticket_priority'] = input.hs_ticket_priority;

      const response = await platformProxy.post({
        endpoint: '/crm/v3/objects/tickets',
        data: { properties },
        retries: 3,
      });

      const data = response.data;

      return {
        id: data.id,
        subject: data.properties?.['subject'] ?? undefined,
        content: data.properties?.['content'] ?? undefined,
        hs_pipeline: data.properties?.['hs_pipeline'] ?? undefined,
        hs_pipeline_stage: data.properties?.['hs_pipeline_stage'] ?? undefined,
        hs_ticket_priority: data.properties?.['hs_ticket_priority'] ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}
