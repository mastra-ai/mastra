// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const FilterOperatorSchema = z.enum([
  'EQ',
  'NEQ',
  'LT',
  'LTE',
  'GT',
  'GTE',
  'BETWEEN',
  'IN',
  'NOT_IN',
  'HAS_PROPERTY',
  'NOT_HAS_PROPERTY',
  'CONTAINS_TOKEN',
  'NOT_CONTAINS_TOKEN',
]);

const FilterSchema = z.object({
  propertyName: z.string().describe('The property name to filter on'),
  operator: FilterOperatorSchema.describe('The filter operator'),
  value: z.string().optional().describe('The value to match (for single-value operators)'),
  values: z.array(z.string()).optional().describe('The values to match (for multi-value operators like IN)'),
  highValue: z.string().optional().describe('The upper boundary for BETWEEN operator'),
});

const FilterGroupSchema = z.object({
  filters: z.array(FilterSchema).describe('Array of filters within this group'),
});

export const searchTicketsInputSchema = z.object({
  query: z.string().optional().describe('Search query string (up to 3000 characters)'),
  cursor: z.string().optional().describe('Pagination cursor from previous response'),
  limit: z.number().min(1).max(200).optional().describe('Maximum results to return (1-200, default: 50)'),
  filterGroups: z.array(FilterGroupSchema).optional().describe('Filter groups for advanced filtering'),
  subject: z.string().optional().describe('Filter by ticket subject (convenience filter)'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().describe('Filter by ticket priority'),
  category: z.string().optional().describe('Filter by ticket category'),
  pipeline: z.string().optional().describe('Filter by pipeline ID'),
  pipelineStage: z.string().optional().describe('Filter by pipeline stage ID'),
});

const TicketSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  content: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  pipeline: z.string().optional(),
  pipelineStage: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archived: z.boolean(),
});

export const searchTicketsOutputSchema = z.object({
  tickets: z.array(TicketSchema).describe('Array of matching tickets'),
  nextCursor: z.string().optional().describe('Cursor for next page (omitted if no more results)'),
  total: z.number().describe('Total number of matching results'),
});

export function searchTicketsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_search_tickets',
    description: 'Search tickets by criteria',
    inputSchema: searchTicketsInputSchema,
    outputSchema: searchTicketsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchTicketsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const filterGroups: any[] = [];

      if (input.filterGroups && input.filterGroups.length > 0) {
        filterGroups.push(...input.filterGroups);
      }

      const convenienceFilters: any[] = [];
      if (input.subject) {
        convenienceFilters.push({
          propertyName: 'subject',
          operator: 'EQ',
          value: input.subject,
        });
      }
      if (input.priority) {
        convenienceFilters.push({
          propertyName: 'hs_ticket_priority',
          operator: 'EQ',
          value: input.priority,
        });
      }
      if (input.category) {
        convenienceFilters.push({
          propertyName: 'hs_ticket_category',
          operator: 'EQ',
          value: input.category,
        });
      }
      if (input.pipeline) {
        convenienceFilters.push({
          propertyName: 'hs_pipeline',
          operator: 'EQ',
          value: input.pipeline,
        });
      }
      if (input.pipelineStage) {
        convenienceFilters.push({
          propertyName: 'hs_pipeline_stage',
          operator: 'EQ',
          value: input.pipelineStage,
        });
      }

      if (convenienceFilters.length > 0) {
        filterGroups.push({ filters: convenienceFilters });
      }

      const requestBody: any = {
        limit: input.limit || 50,
        filterGroups: filterGroups.length > 0 ? filterGroups : [{ filters: [] }],
        sorts: [],
        properties: [
          'subject',
          'content',
          'hs_ticket_priority',
          'hs_ticket_category',
          'hs_pipeline',
          'hs_pipeline_stage',
        ],
        after: input.cursor || '',
      };

      if (input.query) {
        requestBody.query = input.query;
      }

      // https://developers.hubspot.com/docs/api-reference/crm-tickets-v3/search
      const response = await platformProxy.post({
        endpoint: '/crm/v3/objects/tickets/search',
        data: requestBody,
        retries: 3,
      });

      const data = response.data;

      const tickets = (data.results || []).map((ticket: any) => ({
        id: ticket.id,
        subject: ticket.properties?.['subject'] ?? undefined,
        content: ticket.properties?.['content'] ?? undefined,
        priority: ticket.properties?.['hs_ticket_priority'] ?? undefined,
        category: ticket.properties?.['hs_ticket_category'] ?? undefined,
        pipeline: ticket.properties?.['hs_pipeline'] ?? undefined,
        pipelineStage: ticket.properties?.['hs_pipeline_stage'] ?? undefined,
        createdAt: ticket.createdAt ?? undefined,
        updatedAt: ticket.updatedAt ?? undefined,
        archived: ticket.archived || false,
      }));

      return {
        tickets,
        nextCursor: data.paging?.next?.after || undefined,
        total: data.total || 0,
      };
    },
  });
}
