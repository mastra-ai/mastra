// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteContactInputSchema = z.object({
  contactId: z.string().describe('The ID of the contact to delete. Example: "12345"'),
});

export const deleteContactOutputSchema = z.object({
  success: z.boolean(),
  contactId: z.string(),
});

export function deleteContactTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_delete_contact',
    description: 'Delete a contact record',
    inputSchema: deleteContactInputSchema,
    outputSchema: deleteContactOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteContactOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api/crm/contacts#delete-contacts
      await platformProxy.delete({
        endpoint: `/crm/v3/objects/contacts/${input.contactId}`,
        retries: 3,
      });

      return {
        success: true,
        contactId: input.contactId,
      };
    },
  });
}
