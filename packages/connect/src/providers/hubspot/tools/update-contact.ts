// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateContactInputSchema = z.object({
  contactId: z.string().describe('The ID of the contact to update. Example: "12345"'),
  firstName: z.string().optional().describe('First name of the contact.'),
  lastName: z.string().optional().describe('Last name of the contact.'),
  email: z.string().optional().describe('Email address of the contact.'),
  phone: z.string().optional().describe('Phone number of the contact.'),
  company: z.string().optional().describe('Company name of the contact.'),
  jobTitle: z.string().optional().describe('Job title of the contact.'),
});

export const updateContactOutputSchema = z.object({
  id: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function updateContactTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_update_contact',
    description: 'Update a contact record',
    inputSchema: updateContactInputSchema,
    outputSchema: updateContactOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateContactOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const properties: Record<string, string> = {};

      // Presence check, not truthiness: HubSpot clears a property when sent '',
      // so an explicitly-supplied empty string must reach the request body.
      if (input.firstName !== undefined) properties['firstname'] = input.firstName;
      if (input.lastName !== undefined) properties['lastname'] = input.lastName;
      if (input.email !== undefined) properties['email'] = input.email;
      if (input.phone !== undefined) properties['phone'] = input.phone;
      if (input.company !== undefined) properties['company'] = input.company;
      if (input.jobTitle !== undefined) properties['jobtitle'] = input.jobTitle;

      const response = await platformProxy.patch({
        // https://developers.hubspot.com/docs/api/crm/contacts
        endpoint: `/crm/v3/objects/contacts/${input.contactId}`,
        data: { properties },
        retries: 3,
      });

      const data = response.data;

      return {
        id: data.id,
        firstName: data.properties?.['firstname'] ?? undefined,
        lastName: data.properties?.['lastname'] ?? undefined,
        email: data.properties?.['email'] ?? undefined,
        phone: data.properties?.['phone'] ?? undefined,
        company: data.properties?.['company'] ?? undefined,
        jobTitle: data.properties?.['jobtitle'] ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}
