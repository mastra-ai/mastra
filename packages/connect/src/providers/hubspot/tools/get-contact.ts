// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getContactInputSchema = z.object({
  contactId: z.string().describe('HubSpot contact ID. Example: "123"'),
});

export const getContactOutputSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function getContactTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_get_contact',
    description: 'Get a contact by ID',
    inputSchema: getContactInputSchema,
    outputSchema: getContactOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getContactOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api/crm/contacts#get-contacts
      const response = await platformProxy.get({
        endpoint: `/crm/v3/objects/contacts/${input.contactId}`,
        params: {
          properties: 'email,firstname,lastname',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Contact not found',
          contactId: input.contactId,
        });
      }

      const data = response.data;

      return {
        id: data.id,
        email: data.properties?.['email'] ?? undefined,
        firstname: data.properties?.['firstname'] ?? undefined,
        lastname: data.properties?.['lastname'] ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}
