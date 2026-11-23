// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const removeContactsFromListInputSchema = z.object({
  list_id: z
    .string()
    .describe('The ID of the list to remove contacts from. Example: "fa1dbbb4-10af-42d7-b07e-d1ab501a805b"'),
  contact_ids: z
    .array(z.string())
    .min(1)
    .describe('The contact IDs to remove from the list. Example: ["c6491580-2f4a-4339-8812-eb1f86aae6dd"]'),
});

const ProviderResponseSchema = z.object({
  job_id: z.string().optional(),
});

export const removeContactsFromListOutputSchema = z.object({
  job_id: z.string().optional(),
});

export function removeContactsFromListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_remove_contacts_from_list',
    description: 'Remove contacts from a list.',
    inputSchema: removeContactsFromListInputSchema,
    outputSchema: removeContactsFromListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeContactsFromListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const contactIdsParam = input.contact_ids.join(',');

      const response = await platformProxy.delete({
        // https://www.twilio.com/docs/sendgrid/api-reference/lists/remove-contacts-from-a-list
        endpoint: `/v3/marketing/lists/${encodeURIComponent(input.list_id)}/contacts`,
        params: {
          contact_ids: contactIdsParam,
        },
        retries: 3,
      });

      const data = ProviderResponseSchema.parse(response.data);

      return {
        ...(data.job_id !== undefined && { job_id: data.job_id }),
      };
    },
  });
}
