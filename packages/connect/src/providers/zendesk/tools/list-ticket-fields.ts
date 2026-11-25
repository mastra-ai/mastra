// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listTicketFieldsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderTicketFieldSchema = z.object({
  id: z.number(),
  url: z.string(),
  type: z.string(),
  title: z.string(),
  raw_title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  raw_description: z.string().nullable().optional(),
  position: z.number().optional(),
  active: z.boolean().optional(),
  required: z.boolean().optional(),
  collapsed_for_agents: z.boolean().optional(),
  regexp_for_validation: z.string().nullable().optional(),
  title_in_portal: z.string().nullable().optional(),
  raw_title_in_portal: z.string().nullable().optional(),
  visible_in_portal: z.boolean().optional(),
  editable_in_portal: z.boolean().optional(),
  required_in_portal: z.boolean().optional(),
  tag: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  removable: z.boolean().optional(),
  agent_description: z.string().nullable().optional(),
  custom_field_options: z.array(z.unknown()).nullable().optional(),
});

const ProviderResponseSchema = z.object({
  ticket_fields: z.array(ProviderTicketFieldSchema),
  next_page: z.string().nullable().optional(),
});

const TicketFieldSchema = z.object({
  id: z.number(),
  url: z.string(),
  type: z.string(),
  title: z.string(),
  raw_title: z.string().optional(),
  description: z.string().optional(),
  raw_description: z.string().optional(),
  position: z.number().optional(),
  active: z.boolean().optional(),
  required: z.boolean().optional(),
  collapsed_for_agents: z.boolean().optional(),
  regexp_for_validation: z.string().optional(),
  title_in_portal: z.string().optional(),
  raw_title_in_portal: z.string().optional(),
  visible_in_portal: z.boolean().optional(),
  editable_in_portal: z.boolean().optional(),
  required_in_portal: z.boolean().optional(),
  tag: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  removable: z.boolean().optional(),
  agent_description: z.string().optional(),
  custom_field_options: z.array(z.unknown()).optional(),
});

export const listTicketFieldsOutputSchema = z.object({
  items: z.array(TicketFieldSchema),
  next_cursor: z.string().optional(),
});

export function listTicketFieldsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_list_ticket_fields',
    description: 'List ticket fields for the account.',
    inputSchema: listTicketFieldsInputSchema,
    outputSchema: listTicketFieldsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTicketFieldsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_fields/#list-ticket-fields
      const response = await platformProxy.get({
        endpoint: '/api/v2/ticket_fields.json',
        params: {
          ...(input.cursor && { page: input.cursor }),
        },
        retries: 3,
      });

      const data = ProviderResponseSchema.parse(response.data);

      // Map provider fields to output format, filtering out null values
      const items = data.ticket_fields.map(field => {
        const mapped: z.infer<typeof TicketFieldSchema> = {
          id: field.id,
          url: field.url,
          type: field.type,
          title: field.title,
        };

        if (field.raw_title != null) {
          mapped.raw_title = field.raw_title;
        }
        if (field.description != null) {
          mapped.description = field.description;
        }
        if (field.raw_description != null) {
          mapped.raw_description = field.raw_description;
        }
        if (field.position != null) {
          mapped.position = field.position;
        }
        if (field.active != null) {
          mapped.active = field.active;
        }
        if (field.required != null) {
          mapped.required = field.required;
        }
        if (field.collapsed_for_agents != null) {
          mapped.collapsed_for_agents = field.collapsed_for_agents;
        }
        if (field.regexp_for_validation != null) {
          mapped.regexp_for_validation = field.regexp_for_validation;
        }
        if (field.title_in_portal != null) {
          mapped.title_in_portal = field.title_in_portal;
        }
        if (field.raw_title_in_portal != null) {
          mapped.raw_title_in_portal = field.raw_title_in_portal;
        }
        if (field.visible_in_portal != null) {
          mapped.visible_in_portal = field.visible_in_portal;
        }
        if (field.editable_in_portal != null) {
          mapped.editable_in_portal = field.editable_in_portal;
        }
        if (field.required_in_portal != null) {
          mapped.required_in_portal = field.required_in_portal;
        }
        if (field.tag != null) {
          mapped.tag = field.tag;
        }
        if (field.created_at != null) {
          mapped.created_at = field.created_at;
        }
        if (field.updated_at != null) {
          mapped.updated_at = field.updated_at;
        }
        if (field.removable != null) {
          mapped.removable = field.removable;
        }
        if (field.agent_description != null) {
          mapped.agent_description = field.agent_description;
        }
        if (field.custom_field_options != null) {
          mapped.custom_field_options = field.custom_field_options;
        }

        return mapped;
      });

      // Extract cursor from next_page URL if present
      let next_cursor: string | undefined;
      if (data.next_page) {
        const url = new URL(data.next_page);
        const pageParam = url.searchParams.get('page');
        if (pageParam) {
          next_cursor = pageParam;
        }
      }

      return {
        items,
        ...(next_cursor && { next_cursor }),
      };
    },
  });
}
