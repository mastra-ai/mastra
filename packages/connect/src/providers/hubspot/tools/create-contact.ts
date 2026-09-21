// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createContactInputSchema = z.object({
  email: z.string().describe('Email address of the contact. Example: "john.doe@example.com"'),
  firstname: z.string().optional().describe('First name of the contact. Example: "John"'),
  lastname: z.string().optional().describe('Last name of the contact. Example: "Doe"'),
  phone: z.string().optional().describe('Phone number of the contact. Example: "+1 555-1234"'),
  company: z.string().optional().describe('Company name of the contact. Example: "Acme Inc"'),
  website: z.string().optional().describe('Website URL of the contact. Example: "https://example.com"'),
});

export const createContactOutputSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function createContactTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_create_contact',
    description: 'Create a contact record',
    inputSchema: createContactInputSchema,
    outputSchema: createContactOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createContactOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const properties: Record<string, string> = {
        email: input.email,
      };

      if (input.firstname) properties['firstname'] = input.firstname;
      if (input.lastname) properties['lastname'] = input.lastname;
      if (input.phone) properties['phone'] = input.phone;
      if (input.company) properties['company'] = input.company;
      if (input.website) properties['website'] = input.website;

      // https://developers.hubspot.com/docs/api/crm/contacts#create-contacts
      const response = await platformProxy.post({
        endpoint: '/crm/v3/objects/contacts',
        data: { properties },
        retries: 3,
      });

      const data = response.data;

      return {
        id: data.id,
        email: data.properties?.['email'] ?? undefined,
        firstname: data.properties?.['firstname'] ?? undefined,
        lastname: data.properties?.['lastname'] ?? undefined,
        phone: data.properties?.['phone'] ?? undefined,
        company: data.properties?.['company'] ?? undefined,
        website: data.properties?.['website'] ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}
