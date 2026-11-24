// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTicketFormInputSchema = z.object({
  ticket_form_id: z.number().describe('The ID of the ticket form to retrieve. Example: 123'),
});

const ProviderTicketFormSchema = z.object({
  id: z.number(),
  name: z.string(),
  raw_name: z.string().optional(),
  display_name: z.string().optional(),
  raw_display_name: z.string().optional(),
  position: z.number().optional(),
  ticket_field_ids: z.array(z.number()).optional(),
  active: z.boolean().optional(),
  default: z.boolean().optional(),
  end_user_visible: z.boolean().optional(),
  agent_conditions: z.array(z.unknown()).optional(),
  end_user_conditions: z.array(z.unknown()).optional(),
  visible_in_portal: z.boolean().optional(),
  editable_in_portal: z.boolean().optional(),
  required_in_portal: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  in_business_hours: z.boolean().optional(),
});

export const getTicketFormOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  raw_name: z.string().optional(),
  display_name: z.string().optional(),
  raw_display_name: z.string().optional(),
  position: z.number().optional(),
  ticket_field_ids: z.array(z.number()).optional(),
  active: z.boolean().optional(),
  default: z.boolean().optional(),
  end_user_visible: z.boolean().optional(),
  agent_conditions: z.array(z.unknown()).optional(),
  end_user_conditions: z.array(z.unknown()).optional(),
  visible_in_portal: z.boolean().optional(),
  editable_in_portal: z.boolean().optional(),
  required_in_portal: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  in_business_hours: z.boolean().optional(),
});

export function getTicketFormTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_get_ticket_form',
    description: 'Retrieve a ticket form by ID.',
    inputSchema: getTicketFormInputSchema,
    outputSchema: getTicketFormOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTicketFormOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_forms/
      const response = await platformProxy.get({
        endpoint: `/api/v2/ticket_forms/${encodeURIComponent(input.ticket_form_id)}.json`,
        retries: 3,
      });

      if (!response.data || !response.data.ticket_form) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Ticket form with ID ${input.ticket_form_id} not found`,
          ticket_form_id: input.ticket_form_id,
        });
      }

      const ticketForm = ProviderTicketFormSchema.parse(response.data.ticket_form);

      return {
        id: ticketForm.id,
        name: ticketForm.name,
        ...(ticketForm.raw_name !== undefined && { raw_name: ticketForm.raw_name }),
        ...(ticketForm.display_name !== undefined && { display_name: ticketForm.display_name }),
        ...(ticketForm.raw_display_name !== undefined && { raw_display_name: ticketForm.raw_display_name }),
        ...(ticketForm.position !== undefined && { position: ticketForm.position }),
        ...(ticketForm.ticket_field_ids !== undefined && { ticket_field_ids: ticketForm.ticket_field_ids }),
        ...(ticketForm.active !== undefined && { active: ticketForm.active }),
        ...(ticketForm.default !== undefined && { default: ticketForm.default }),
        ...(ticketForm.end_user_visible !== undefined && { end_user_visible: ticketForm.end_user_visible }),
        ...(ticketForm.agent_conditions !== undefined && { agent_conditions: ticketForm.agent_conditions }),
        ...(ticketForm.end_user_conditions !== undefined && { end_user_conditions: ticketForm.end_user_conditions }),
        ...(ticketForm.visible_in_portal !== undefined && { visible_in_portal: ticketForm.visible_in_portal }),
        ...(ticketForm.editable_in_portal !== undefined && { editable_in_portal: ticketForm.editable_in_portal }),
        ...(ticketForm.required_in_portal !== undefined && { required_in_portal: ticketForm.required_in_portal }),
        ...(ticketForm.created_at !== undefined && { created_at: ticketForm.created_at }),
        ...(ticketForm.updated_at !== undefined && { updated_at: ticketForm.updated_at }),
        ...(ticketForm.in_business_hours !== undefined && { in_business_hours: ticketForm.in_business_hours }),
      };
    },
  });
}
