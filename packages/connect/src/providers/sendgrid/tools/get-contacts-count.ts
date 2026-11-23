// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getContactsCountInputSchema = z.object({});

export const getContactsCountOutputSchema = z.object({
  contact_count: z.number(),
  billable_count: z.number(),
  identifier_counts: z.record(z.string(), z.number()),
});

const ProviderResponseSchema = z
  .object({
    contact_count: z.number(),
    billable_count: z.number(),
    identifier_counts: z.record(z.string(), z.number()),
  })
  .passthrough();

export function getContactsCountTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_get_contacts_count',
    description: 'Get total and billable contact counts.',
    inputSchema: getContactsCountInputSchema,
    outputSchema: getContactsCountOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getContactsCountOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://www.twilio.com/docs/sendgrid/api-reference/contacts/get-contacts-count
        endpoint: '/v3/marketing/contacts/count',
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        contact_count: providerData.contact_count,
        billable_count: providerData.billable_count,
        identifier_counts: providerData.identifier_counts,
      };
    },
  });
}
