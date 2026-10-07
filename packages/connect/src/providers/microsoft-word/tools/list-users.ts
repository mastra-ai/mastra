// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z.object({
  filter: z.string().optional().describe('OData $filter expression. Example: "startswith(displayName, \'A\')"'),
  search: z.string().optional().describe('OData $search expression. Example: "api@nango.dev"'),
  top: z.number().int().min(1).max(999).optional().describe('Maximum number of users to return per page. Example: 10'),
  cursor: z
    .string()
    .url()
    .optional()
    .describe('Pagination cursor from the previous response (@odata.nextLink). Omit for the first page.'),
});

const ProviderUserSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable().optional(),
  mail: z.string().nullable().optional(),
  userPrincipalName: z.string().nullable().optional(),
});

const ProviderListSchema = z.object({
  value: z.array(ProviderUserSchema),
  '@odata.nextLink': z.string().optional(),
});

export const listUsersOutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      displayName: z.string().optional(),
      mail: z.string().optional(),
      userPrincipalName: z.string().optional(),
    }),
  ),
  nextCursor: z.string().optional(),
});

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_word_list_users',
    description: 'List/search tenant users, to resolve a user id for personal OneDrive access.',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const endpoint = '/v1.0/users';
      const params: Record<string, string | number> = {};

      if (input.cursor) {
        const cursorUrl = new URL(input.cursor);
        if (cursorUrl.pathname !== endpoint) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'cursor must be a nextLink returned by this same action',
          });
        }
        cursorUrl.searchParams.forEach((value, key) => {
          params[key] = value;
        });
      } else {
        if (input.filter !== undefined) {
          params['$filter'] = input.filter;
        }
        if (input.search !== undefined) {
          params['$search'] = input.search;
        }
        if (input.top !== undefined) {
          params['$top'] = input.top;
        }
      }

      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/user-list
        endpoint,
        params,
        // $search requires this header on every request, including paginated continuations.
        ...('$search' in params && { headers: { ConsistencyLevel: 'eventual' } }),
        retries: 3,
      });

      const listData = ProviderListSchema.parse(response.data);

      return {
        items: listData.value.map(user => ({
          id: user.id,
          ...(user.displayName != null && { displayName: user.displayName }),
          ...(user.mail != null && { mail: user.mail }),
          ...(user.userPrincipalName != null && { userPrincipalName: user.userPrincipalName }),
        })),
        ...(listData['@odata.nextLink'] != null && { nextCursor: listData['@odata.nextLink'] }),
      };
    },
  });
}
