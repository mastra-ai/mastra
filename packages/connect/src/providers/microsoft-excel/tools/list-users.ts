// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from the previous response (@odata.nextLink). Omit for the first page.'),
  top: z
    .number()
    .int()
    .min(1)
    .max(999)
    .optional()
    .describe('Number of users to return per page. Must be between 1 and 999. Default is determined by the API.'),
});

const ProviderUserSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable().optional(),
  userPrincipalName: z.string().nullable().optional(),
  mail: z.string().nullable().optional(),
});

const ProviderResponseSchema = z.object({
  value: z.array(ProviderUserSchema),
  '@odata.nextLink': z.string().optional(),
});

const UserSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  userPrincipalName: z.string().optional(),
  mail: z.string().optional(),
});

export const listUsersOutputSchema = z.object({
  users: z.array(UserSchema),
  nextCursor: z.string().optional(),
});

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_list_users',
    description: 'List/search tenant users, to resolve a user id for personal OneDrive access.',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const baseUrl = 'https://graph.microsoft.com';
      let endpoint = '/v1.0/users';
      if (input.cursor) {
        endpoint = input.cursor.startsWith(baseUrl) ? input.cursor.slice(baseUrl.length) : input.cursor;
      }

      const params: Record<string, string | number> = {};
      if (input.top !== undefined) {
        params['$top'] = input.top;
      }

      // https://learn.microsoft.com/en-us/graph/api/user-list
      const response = await platformProxy.get({
        endpoint,
        params,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        users: providerResponse.value.map(user => ({
          id: user.id,
          ...(user.displayName != null && { displayName: user.displayName }),
          ...(user.userPrincipalName != null && { userPrincipalName: user.userPrincipalName }),
          ...(user.mail != null && { mail: user.mail }),
        })),
        ...(providerResponse['@odata.nextLink'] != null && { nextCursor: providerResponse['@odata.nextLink'] }),
      };
    },
  });
}
