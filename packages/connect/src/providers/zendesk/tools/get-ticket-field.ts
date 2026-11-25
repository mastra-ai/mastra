// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTicketFieldInputSchema = z.object({
  ticketFieldId: z.number().describe('The ID of the ticket field. Example: 123'),
});

const ProviderTicketFieldSchema = z.object({
  id: z.number(),
  url: z.string(),
  type: z.string(),
  title: z.string(),
  raw_title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  raw_description: z.string().nullable().optional(),
  position: z.number().nullable().optional(),
  active: z.boolean().nullable().optional(),
  required: z.boolean().nullable().optional(),
  collapsed_for_agents: z.boolean().nullable().optional(),
  regexp_for_validation: z.string().nullable().optional(),
  title_in_portal: z.string().nullable().optional(),
  raw_title_in_portal: z.string().nullable().optional(),
  visible_in_portal: z.boolean().nullable().optional(),
  editable_in_portal: z.boolean().nullable().optional(),
  required_in_portal: z.boolean().nullable().optional(),
  tag: z.string().nullable().optional(),
  removable: z.boolean().nullable().optional(),
  agent_description: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  custom_field_options: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        raw_name: z.string().nullable().optional(),
        value: z.string(),
      }),
    )
    .nullable()
    .optional(),
  system_field_options: z
    .array(
      z.object({
        id: z.number().nullable().optional(),
        name: z.string(),
        raw_name: z.string().nullable().optional(),
        value: z.string(),
      }),
    )
    .nullable()
    .optional(),
  sub_type_id: z.number().nullable().optional(),
  creator_user_id: z.number().nullable().optional(),
  creator_app_name: z.string().nullable().optional(),
});

export const getTicketFieldOutputSchema = z.object({
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
  removable: z.boolean().optional(),
  agent_description: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  custom_field_options: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        raw_name: z.string().optional(),
        value: z.string(),
      }),
    )
    .optional(),
  system_field_options: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        raw_name: z.string().optional(),
        value: z.string(),
      }),
    )
    .optional(),
  sub_type_id: z.number().optional(),
  creator_user_id: z.number().optional(),
  creator_app_name: z.string().optional(),
});

export function getTicketFieldTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_get_ticket_field',
    description: 'Retrieve a ticket field by ID.',
    inputSchema: getTicketFieldInputSchema,
    outputSchema: getTicketFieldOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTicketFieldOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_fields/#show-ticket-field
      const response = await platformProxy.get({
        endpoint: `/api/v2/ticket_fields/${encodeURIComponent(input.ticketFieldId)}.json`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Ticket field not found',
          ticket_field_id: input.ticketFieldId,
        });
      }

      const providerField = ProviderTicketFieldSchema.parse(response.data.ticket_field);

      // Normalize null values to undefined for clean output
      return {
        id: providerField.id,
        url: providerField.url,
        type: providerField.type,
        title: providerField.title,
        ...(providerField.raw_title != null && { raw_title: providerField.raw_title }),
        ...(providerField.description != null && { description: providerField.description }),
        ...(providerField.raw_description != null && { raw_description: providerField.raw_description }),
        ...(providerField.position != null && { position: providerField.position }),
        ...(providerField.active != null && { active: providerField.active }),
        ...(providerField.required != null && { required: providerField.required }),
        ...(providerField.collapsed_for_agents != null && { collapsed_for_agents: providerField.collapsed_for_agents }),
        ...(providerField.regexp_for_validation != null && {
          regexp_for_validation: providerField.regexp_for_validation,
        }),
        ...(providerField.title_in_portal != null && { title_in_portal: providerField.title_in_portal }),
        ...(providerField.raw_title_in_portal != null && { raw_title_in_portal: providerField.raw_title_in_portal }),
        ...(providerField.visible_in_portal != null && { visible_in_portal: providerField.visible_in_portal }),
        ...(providerField.editable_in_portal != null && { editable_in_portal: providerField.editable_in_portal }),
        ...(providerField.required_in_portal != null && { required_in_portal: providerField.required_in_portal }),
        ...(providerField.tag != null && { tag: providerField.tag }),
        ...(providerField.removable != null && { removable: providerField.removable }),
        ...(providerField.agent_description != null && { agent_description: providerField.agent_description }),
        ...(providerField.created_at != null && { created_at: providerField.created_at }),
        ...(providerField.updated_at != null && { updated_at: providerField.updated_at }),
        ...(providerField.custom_field_options != null && {
          custom_field_options: providerField.custom_field_options.map(opt => ({
            id: opt.id,
            name: opt.name,
            value: opt.value,
            ...(opt.raw_name != null && { raw_name: opt.raw_name }),
          })),
        }),
        ...(providerField.system_field_options != null && {
          system_field_options: providerField.system_field_options.map(opt => ({
            name: opt.name,
            value: opt.value,
            ...(opt.id != null && { id: opt.id }),
            ...(opt.raw_name != null && { raw_name: opt.raw_name }),
          })),
        }),
        ...(providerField.sub_type_id != null && { sub_type_id: providerField.sub_type_id }),
        ...(providerField.creator_user_id != null && { creator_user_id: providerField.creator_user_id }),
        ...(providerField.creator_app_name != null && { creator_app_name: providerField.creator_app_name }),
      };
    },
  });
}
