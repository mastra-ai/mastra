// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUsersInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor returned by a previous request. Omit for the first page.'),
  cursor_direction: z.enum(['after', 'before']).optional().describe('Direction for the cursor. Defaults to after.'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of users to return.'),
  order: z.enum(['asc', 'desc']).optional(),
  email: z.string().email().optional().describe('Filter users by email address.'),
  organization_id: z.string().optional().describe('Filter users by organization ID.'),
});

const UserSchema = z
  .object({
    object: z.literal('user'),
    id: z.string(),
    email: z.string(),
    email_verified: z.boolean(),
    profile_picture_url: z.string().nullable(),
    name: z.string().nullable(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    last_sign_in_at: z.string().nullable(),
    locale: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    external_id: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({
  object: z.literal('list').optional(),
  data: z.array(UserSchema),
  list_metadata: z.object({ after: z.string().nullable().optional(), before: z.string().nullable().optional() }),
});

export const listUsersOutputSchema = z.object({ items: z.array(UserSchema), next_cursor: z.string().optional() });

export function listUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_list_users',
    description: 'List users from WorkOS User Management.',
    inputSchema: listUsersInputSchema,
    outputSchema: listUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const cursorDirection = input.cursor_direction ?? 'after';
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/user-management/user
        endpoint: '/user_management/users',
        params: {
          ...(input.cursor !== undefined && { [cursorDirection]: input.cursor }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.order !== undefined && { order: input.order }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.organization_id !== undefined && { organization_id: input.organization_id }),
        },
        retries: 3,
      });
      const provider = ProviderResponseSchema.parse(response.data);
      const nextCursor = cursorDirection === 'before' ? provider.list_metadata.before : provider.list_metadata.after;
      return { items: provider.data, ...(nextCursor != null && { next_cursor: nextCursor }) };
    },
  });
}
