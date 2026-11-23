// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteContactsInputSchema = z.object({
  ids: z
    .array(z.string())
    .optional()
    .describe('Contact IDs to delete. Example: ["c6491580-2f4a-4339-8812-eb1f86aae6dd"]'),
  delete_all_contacts: z.boolean().optional().describe('Set to true to delete all contacts. Use with caution.'),
});

const ProviderResponseSchema = z.object({
  job_id: z.string(),
});

export const deleteContactsOutputSchema = z.object({
  job_id: z.string().describe('The ID of the async deletion job.'),
});

export function deleteContactsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_contacts',
    description: 'Delete contacts by id.',
    inputSchema: deleteContactsInputSchema,
    outputSchema: deleteContactsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteContactsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let params: Record<string, string>;

      if (input.ids !== undefined && input.ids.length > 0) {
        if (input.delete_all_contacts === true) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'Exactly one of ids or delete_all_contacts is required. Both were provided.',
          });
        }
        params = { ids: input.ids.join(',') };
      } else if (input.delete_all_contacts === true) {
        params = { delete_all_contacts: 'true' };
      } else {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Exactly one of ids or delete_all_contacts is required. Both were omitted.',
        });
      }

      const response = await platformProxy.delete({
        // https://www.twilio.com/docs/sendgrid/api-reference/contacts-api-delete-contacts
        endpoint: '/v3/marketing/contacts',
        params,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        job_id: providerResponse.job_id,
      };
    },
  });
}
