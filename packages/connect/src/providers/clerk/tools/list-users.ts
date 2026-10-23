// AUTO-GENERATED from NangoHQ/integration-templates @ 23df553a789b — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z.object({
  cursor: z
    .string()
    .regex(/^\d+$/, 'Cursor must be a non-negative integer.')
    .refine(value => Number.isSafeInteger(Number(value)), 'Cursor must be a non-negative integer.')
    .optional()
    .describe('Pagination cursor returned by a previous request. Omit for the first page.'),
  limit: z.number().int().min(1).max(500).optional().describe('Maximum number of users to return. Maximum 500.'),
  query: z
    .string()
    .optional()
    .describe('Search across names, identifiers, email addresses, phone numbers, and usernames.'),
  email_address: z.array(z.string()).max(100).optional().describe('Filter by email addresses.'),
  phone_number: z.array(z.string()).max(100).optional().describe('Filter by phone numbers.'),
  username: z.array(z.string()).max(100).optional().describe('Filter by usernames.'),
  user_id: z.array(z.string()).max(100).optional().describe('Filter by Clerk user IDs.'),
  external_id: z.array(z.string()).max(100).optional().describe('Filter by external user IDs.'),
  organization_id: z.array(z.string()).max(100).optional().describe('Filter by organization IDs.'),
  last_active_at_before: z
    .number()
    .int()
    .optional()
    .describe('Filter users last active before this Unix timestamp in milliseconds.'),
  last_active_at_after: z
    .number()
    .int()
    .optional()
    .describe('Filter users last active after this Unix timestamp in milliseconds.'),
  created_at_before: z
    .number()
    .int()
    .optional()
    .describe('Filter users created before this Unix timestamp in milliseconds.'),
  created_at_after: z
    .number()
    .int()
    .optional()
    .describe('Filter users created after this Unix timestamp in milliseconds.'),
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

const ProviderResponseSchema = z.array(UserSchema);

const ProviderCountSchema = z.object({ total_count: z.number() }).passthrough();

export const listUsersOutputSchema = z.object({
  items: z.array(UserSchema),
  next_cursor: z
    .string()
    .regex(/^\d+$/, 'Cursor must be a non-negative integer.')
    .refine(value => Number.isSafeInteger(Number(value)), 'Cursor must be a non-negative integer.')
    .optional()
    .describe('Pagination cursor returned by a previous request. Omit for the first page.'),
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
      const offset = input.cursor === undefined ? 0 : Number(input.cursor);
      const filterParams = {
        ...(input.query !== undefined && { query: input.query }),
        ...(input.email_address !== undefined && { email_address: input.email_address }),
        ...(input.phone_number !== undefined && { phone_number: input.phone_number }),
        ...(input.username !== undefined && { username: input.username }),
        ...(input.user_id !== undefined && { user_id: input.user_id }),
        ...(input.external_id !== undefined && { external_id: input.external_id }),
        ...(input.organization_id !== undefined && { organization_id: input.organization_id }),
        ...(input.last_active_at_before !== undefined && {
          last_active_at_before: String(input.last_active_at_before),
        }),
        ...(input.last_active_at_after !== undefined && { last_active_at_after: String(input.last_active_at_after) }),
        ...(input.created_at_before !== undefined && { created_at_before: String(input.created_at_before) }),
        ...(input.created_at_after !== undefined && { created_at_after: String(input.created_at_after) }),
      };
      const response = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Users#operation/GetUserList
        endpoint: '/v1/users',
        params: {
          offset: String(offset),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.order_by !== undefined && { order_by: input.order_by }),
          ...filterParams,
        },
        retries: 3,
      });
      const users = ProviderResponseSchema.parse(response.data);
      const countResponse = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Users#operation/GetUsersCount
        endpoint: '/v1/users/count',
        params: filterParams,
        retries: 3,
      });
      const total = ProviderCountSchema.parse(countResponse.data).total_count;
      const nextOffset = offset + users.length;
      return {
        items: users,
        ...(users.length > 0 && nextOffset < total && { next_cursor: String(nextOffset) }),
        total,
      };
    },
  });
}
