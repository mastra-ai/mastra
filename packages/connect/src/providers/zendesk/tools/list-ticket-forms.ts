// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listTicketFormsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const TicketFormSchema = z.object({
  id: z.number(),
  name: z.string(),
  raw_name: z.string().optional(),
  display_name: z.string().optional(),
  end_user_visible: z.boolean().optional(),
  position: z.number().optional(),
  ticket_field_ids: z.array(z.number()).optional(),
  active: z.boolean().optional(),
  default: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  ticket_forms: z.array(TicketFormSchema),
  next_page: z.string().nullable().optional(),
  previous_page: z.string().nullable().optional(),
  count: z.number().optional(),
});

const OutputItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  raw_name: z.string().optional(),
  display_name: z.string().optional(),
  end_user_visible: z.boolean().optional(),
  position: z.number().optional(),
  ticket_field_ids: z.array(z.number()).optional(),
  active: z.boolean().optional(),
  default: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const listTicketFormsOutputSchema = z.object({
  items: z.array(OutputItemSchema),
  next_cursor: z.string().optional(),
});

export function listTicketFormsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_list_ticket_forms',
    description: 'List ticket forms for the account.',
    inputSchema: listTicketFormsInputSchema,
    outputSchema: listTicketFormsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTicketFormsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input.cursor) {
        params['page'] = input.cursor;
      }

      // https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_forms/
      const response = await platformProxy.get({
        endpoint: '/api/v2/ticket_forms.json',
        params: params,
        retries: 3,
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      let next_cursor: string | undefined;
      if (parsed.next_page) {
        const url = new URL(parsed.next_page);
        const pageParam = url.searchParams.get('page');
        if (pageParam) {
          next_cursor = pageParam;
        }
      }

      return {
        items: parsed.ticket_forms.map(form => ({
          id: form.id,
          name: form.name,
          ...(form.raw_name !== undefined && { raw_name: form.raw_name }),
          ...(form.display_name !== undefined && { display_name: form.display_name }),
          ...(form.end_user_visible !== undefined && { end_user_visible: form.end_user_visible }),
          ...(form.position !== undefined && { position: form.position }),
          ...(form.ticket_field_ids !== undefined && { ticket_field_ids: form.ticket_field_ids }),
          ...(form.active !== undefined && { active: form.active }),
          ...(form.default !== undefined && { default: form.default }),
          ...(form.created_at !== undefined && { created_at: form.created_at }),
          ...(form.updated_at !== undefined && { updated_at: form.updated_at }),
        })),
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
