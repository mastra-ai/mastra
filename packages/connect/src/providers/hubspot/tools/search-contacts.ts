// Hand-written Mastra addition — not generated from NangoHQ/integration-templates.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchContactsInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('Free-text search across default searchable contact properties (name, email, phone, company).'),
  email: z.string().optional().describe('Contact email to search for (exact match).'),
  firstname: z.string().optional().describe('Contact first name to search for.'),
  lastname: z.string().optional().describe('Contact last name to search for.'),
  company: z.string().optional().describe('Contact company name to search for.'),
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
});

const ContactSchema = z.object({
  id: z.string(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const searchContactsOutputSchema = z.object({
  contacts: z.array(ContactSchema),
  nextCursor: z.string().optional(),
});

export function searchContactsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_search_contacts',
    description: 'Search contacts by free-text query or property filters instead of paging the full contact list.',
    inputSchema: searchContactsInputSchema,
    outputSchema: searchContactsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchContactsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const filters: any[] = [];

      if (input.email) {
        filters.push({
          propertyName: 'email',
          operator: 'EQ',
          value: input.email,
        });
      }

      if (input.firstname) {
        filters.push({
          propertyName: 'firstname',
          operator: 'CONTAINS_TOKEN',
          value: input.firstname,
        });
      }

      if (input.lastname) {
        filters.push({
          propertyName: 'lastname',
          operator: 'CONTAINS_TOKEN',
          value: input.lastname,
        });
      }

      if (input.company) {
        filters.push({
          propertyName: 'company',
          operator: 'CONTAINS_TOKEN',
          value: input.company,
        });
      }

      const searchBody: any = {
        properties: ['firstname', 'lastname', 'email', 'phone', 'company', 'createdate', 'lastmodifieddate'],
        limit: 100,
      };

      if (input.query) {
        searchBody.query = input.query;
      }

      if (filters.length > 0) {
        searchBody.filterGroups = [{ filters }];
      }

      if (input.cursor) {
        searchBody.after = input.cursor;
      }

      // https://developers.hubspot.com/docs/api/crm/search
      const response = await platformProxy.post({
        endpoint: '/crm/v3/objects/contacts/search',
        data: searchBody,
        retries: 3,
      });

      const data = response.data;

      const contacts = (data.results || []).map((contact: any) => ({
        id: contact.id,
        firstname: contact.properties?.['firstname'] ?? undefined,
        lastname: contact.properties?.['lastname'] ?? undefined,
        email: contact.properties?.['email'] ?? undefined,
        phone: contact.properties?.['phone'] ?? undefined,
        company: contact.properties?.['company'] ?? undefined,
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
