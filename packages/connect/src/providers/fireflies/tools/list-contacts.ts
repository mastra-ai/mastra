// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listContactsInputSchema = z.object({});

const ProviderContactSchema = z.object({
  email: z.string(),
  name: z.string().nullable(),
  picture: z.string().nullable(),
  last_meeting_date: z.string().nullable(),
});

const ContactSchema = z.object({
  email: z.string(),
  name: z.string().optional(),
  picture: z.string().optional(),
  last_meeting_date: z.string().optional(),
});

export const listContactsOutputSchema = z.object({
  contacts: z.array(ContactSchema),
});

export function listContactsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_list_contacts',
    description: 'List all contacts in the workspace.',
    inputSchema: listContactsInputSchema,
    outputSchema: listContactsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listContactsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/query/contacts
        endpoint: 'graphql',
        data: {
          query: 'query { contacts { email name picture last_meeting_date } }',
        },
        retries: 3,
      });

      const data = response.data;
      if (!data || typeof data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Fireflies API',
        });
      }

      const graphqlWrapper = z
        .object({
          data: z
            .object({ contacts: z.array(z.unknown()) })
            .nullable()
            .optional(),
          errors: z.array(z.object({ message: z.string() })).optional(),
        })
        .safeParse(data);
      if (!graphqlWrapper.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Expected contacts array in GraphQL response',
        });
      }

      if (graphqlWrapper.data.errors && graphqlWrapper.data.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: graphqlWrapper.data.errors[0]!.message,
        });
      }

      const contacts = graphqlWrapper.data.data?.contacts;
      if (!contacts) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Expected contacts array in GraphQL response',
        });
      }

      const parsedContacts = contacts.map(contact => {
        const parsed = ProviderContactSchema.safeParse(contact);
        if (!parsed.success) {
          throw new platformProxy.ActionError({
            type: 'invalid_response',
            message: 'Contact schema validation failed',
          });
        }
        const c = parsed.data;
        return {
          email: c.email,
          ...(c.name != null && { name: c.name }),
          ...(c.picture != null && { picture: c.picture }),
          ...(c.last_meeting_date != null && { last_meeting_date: c.last_meeting_date }),
        };
      });

      return {
        contacts: parsedContacts,
      };
    },
  });
}
