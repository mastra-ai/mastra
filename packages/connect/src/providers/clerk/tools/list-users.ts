// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor returned by a previous request. Omit for the first page.'),
  limit: z.number().int().min(1).max(500).optional().describe('Maximum number of users to return. Maximum 500.'),
  query: z
    .string()
    .optional()
    .describe('Search across names, identifiers, email addresses, phone numbers, and usernames.'),
  email_address: z.array(z.string()).max(100).optional().describe('Filter by email addresses.'),
  user_id: z.array(z.string()).max(100).optional().describe('Filter by Clerk user IDs.'),
  external_id: z.array(z.string()).max(100).optional().describe('Filter by external user IDs.'),
  organization_id: z.array(z.string()).max(100).optional().describe('Filter by organization IDs.'),
  order_by: z
    .string()
    .optional()
    .describe('Sort field prefixed with + for ascending or - for descending. Example: "-created_at"'),
});

const UserSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    username: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    image_url: z.string().optional(),
    primary_email_address_id: z.string().nullable().optional(),
    primary_phone_number_id: z.string().nullable().optional(),
    external_id: z.string().nullable().optional(),
    banned: z.boolean().optional(),
    locked: z.boolean().optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
    locale: z.string().nullable().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ data: z.array(UserSchema), total_count: z.number() });

export const listUsersOutputSchema = z.object({
  items: z.array(UserSchema),
  next_cursor: z.string().optional(),
  total: z.number(),
});

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_list_users',
    description: 'List users from Clerk.',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const offset = input.cursor === undefined ? 0 : Number.parseInt(input.cursor, 10);
      if (!Number.isInteger(offset) || offset < 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_cursor',
          message: 'Cursor must be a non-negative integer.',
        });
      }
      const response = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Users#operation/GetUserList
        endpoint: '/v1/users',
        params: {
          offset: String(offset),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.query !== undefined && { query: input.query }),
          ...(input.email_address !== undefined && { email_address: input.email_address }),
          ...(input.user_id !== undefined && { user_id: input.user_id }),
          ...(input.external_id !== undefined && { external_id: input.external_id }),
          ...(input.organization_id !== undefined && { organization_id: input.organization_id }),
          ...(input.order_by !== undefined && { order_by: input.order_by }),
        },
        retries: 3,
      });
      const provider = ProviderResponseSchema.parse(response.data);
      const nextOffset = offset + provider.data.length;
      return {
        items: provider.data,
        ...(nextOffset < provider.total_count && { next_cursor: String(nextOffset) }),
        total: provider.total_count,
      };
    },
  });
}
