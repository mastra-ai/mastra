// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listContactsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
});

const ContactSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const listContactsOutputSchema = z.object({
  contacts: z.array(ContactSchema),
  nextCursor: z.string().optional(),
});

export function listContactsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_list_contacts',
    description: 'List contact records',
    inputSchema: listContactsInputSchema,
    outputSchema: listContactsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listContactsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api/crm/contacts#get-page-of-contacts
      const response = await platformProxy.get({
        endpoint: '/crm/v3/objects/contacts',
        params: {
          properties: 'email,firstname,lastname,phone,createdate,lastmodifieddate',
          limit: '100',
          ...(input.cursor && { after: input.cursor }),
        },
        retries: 3,
      });

      const data = response.data;

      const contacts = (data.results || []).map((contact: any) => ({
        id: contact.id,
        email: contact.properties?.['email'] ?? undefined,
        firstName: contact.properties?.['firstname'] ?? undefined,
        lastName: contact.properties?.['lastname'] ?? undefined,
        phone: contact.properties?.['phone'] ?? undefined,
        createdAt: contact.properties?.['createdate'] ?? undefined,
        updatedAt: contact.properties?.['lastmodifieddate'] ?? undefined,
      }));

      return {
        contacts,
        nextCursor: data.paging?.next?.after || undefined,
      };
    },
  });
}
