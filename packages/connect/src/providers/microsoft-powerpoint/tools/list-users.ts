// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z.object({
  search: z.string().optional().describe('Search string to filter users by display name or email.'),
  top: z.number().int().min(1).max(999).optional().describe('Number of users to return per page. Maximum 999.'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (odata.nextLink) from the previous response. Omit for the first page.'),
});

const ProviderUserSchema = z.object({
  id: z.string(),
  displayName: z.string().nullish(),
  givenName: z.string().nullish(),
  surname: z.string().nullish(),
  mail: z.string().nullish(),
  userPrincipalName: z.string().nullish(),
});

const ProviderResponseSchema = z.object({
  value: z.array(ProviderUserSchema),
  '@odata.nextLink': z.string().optional().nullable(),
});

const UserSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  givenName: z.string().optional(),
  surname: z.string().optional(),
  mail: z.string().optional(),
  userPrincipalName: z.string().optional(),
});

export const listUsersOutputSchema = z.object({
  users: z.array(UserSchema),
  nextLink: z.string().optional(),
});

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_list_users',
    description: 'List/search tenant users, to resolve a user id for personal OneDrive access.',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      let endpoint: string;
      let headers: Record<string, string> | undefined;

      if (input.cursor) {
        let cursorUrl: URL;
        // @allowTryCatch - Convert an invalid user-supplied cursor into a structured ActionError instead of an unhandled exception.
        try {
          cursorUrl = new URL(input.cursor);
        } catch {
          throw new platformProxy.ActionError({
            type: 'invalid_cursor',
            message: 'The provided cursor is not a valid URL.',
          });
        }
        if (cursorUrl.hostname !== 'graph.microsoft.com' || cursorUrl.pathname !== '/v1.0/users') {
          throw new platformProxy.ActionError({
            type: 'invalid_cursor',
            message: 'The provided cursor does not point to the expected Microsoft Graph users pagination route.',
          });
        }
        endpoint = cursorUrl.pathname;
        cursorUrl.searchParams.forEach((value, key) => {
          params[key] = value;
        });
        if ('$search' in params) {
          headers = { ConsistencyLevel: 'eventual' };
        }
      } else {
        endpoint = '/v1.0/users';
        if (input.top !== undefined) {
          params['$top'] = input.top;
        }
        if (input.search !== undefined) {
          params['$search'] = '"displayName:' + input.search + '" OR "mail:' + input.search + '"';
          params['$count'] = 'true';
          headers = { ConsistencyLevel: 'eventual' };
        }
      }

      const config: PlatformProxyRequest = {
        // https://learn.microsoft.com/en-us/graph/api/user-list
        endpoint,
        params,
        ...(headers !== undefined && { headers }),
        retries: 3,
      };

      const response = await platformProxy.get(config);

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        users: providerResponse.value.map(user => ({
          id: user.id,
          ...(user.displayName != null && { displayName: user.displayName }),
          ...(user.givenName != null && { givenName: user.givenName }),
          ...(user.surname != null && { surname: user.surname }),
          ...(user.mail != null && { mail: user.mail }),
          ...(user.userPrincipalName != null && { userPrincipalName: user.userPrincipalName }),
        })),
        ...(providerResponse['@odata.nextLink'] != null && { nextLink: providerResponse['@odata.nextLink'] }),
      };
    },
  });
}
