// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ContactInputSchema = z.object({
  email: z
    .string()
    .email()
    .describe(
      'Contact email address. SendGrid upserts by email: a matching contact is added to the list, otherwise a new contact is created and added.',
    ),
});

export const addContactsToListInputSchema = z.object({
  list_id: z.string().describe('The ID of the list to add contacts to. Example: fa1dbbb4-10af-42d7-b07e-d1ab501a805b'),
  contacts: z.array(ContactInputSchema).min(1).max(30000).describe('Contacts to add to the list. Min 1, max 30000.'),
});

const ProviderResponseSchema = z.object({
  job_id: z.string(),
});

export const addContactsToListOutputSchema = z.object({
  job_id: z.string(),
});

export function addContactsToListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_add_contacts_to_list',
    description: 'Add existing contacts to a list.',
    inputSchema: addContactsToListInputSchema,
    outputSchema: addContactsToListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addContactsToListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.put({
        // https://www.twilio.com/docs/sendgrid/api-reference/contacts/add-or-update-a-contact
        endpoint: '/v3/marketing/contacts',
        data: {
          list_ids: [input.list_id],
          contacts: input.contacts.map(contact => ({
            email: contact.email,
          })),
        },
        retries: 1,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'unexpected_error',
          message: 'No data returned from the SendGrid API.',
        });
      }

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        job_id: providerResponse.job_id,
      };
    },
  });
}
