// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createListInputSchema = z.object({
  name: z.string().min(1).max(100).describe('The name for the new contact list. Example: "Newsletter Subscribers"'),
});

const ProviderListSchema = z.object({
  id: z.string(),
  name: z.string(),
  contact_count: z.number().int().optional(),
  _metadata: z
    .object({
      self: z.string(),
    })
    .optional(),
});

export const createListOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  contact_count: z.number().int().optional(),
  metadata_self: z.string().optional(),
});

export function createListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_create_list',
    description: 'Create a contact list.',
    inputSchema: createListInputSchema,
    outputSchema: createListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://www.twilio.com/docs/sendgrid/api-reference/lists/create-list
        endpoint: '/v3/marketing/lists',
        data: {
          name: input.name,
        },
        retries: 10,
      });

      const providerList = ProviderListSchema.parse(response.data);

      return {
        id: providerList.id,
        name: providerList.name,
        ...(providerList.contact_count !== undefined && { contact_count: providerList.contact_count }),
        ...(providerList._metadata?.self != null && { metadata_self: providerList._metadata.self }),
      };
    },
  });
}
