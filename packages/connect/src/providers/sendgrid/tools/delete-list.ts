// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteListInputSchema = z.object({
  list_id: z.string().describe('The ID of the contact list to delete. Example: "fa1dbbb4-10af-42d7-b07e-d1ab501a805b"'),
  delete_contacts: z.boolean().optional().describe('If true, also delete every contact on the list.'),
});

export const deleteListOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_list',
    description: 'Delete a contact list.',
    inputSchema: deleteListInputSchema,
    outputSchema: deleteListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.twilio.com/docs/sendgrid/api-reference/contactdb-lists/delete-a-list
      await platformProxy.delete({
        endpoint: `/v3/marketing/lists/${encodeURIComponent(input.list_id)}`,
        params: {
          ...(input.delete_contacts !== undefined && { delete_contacts: String(input.delete_contacts) }),
        },
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
