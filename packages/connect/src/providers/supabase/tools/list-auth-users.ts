// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listAuthUsersInputSchema = z.object({
  page: z.number().int().min(1).optional().describe('Page number (1-indexed). Defaults to 1.'),
  per_page: z.number().int().min(1).max(1000).optional().describe('Number of items per page. Defaults to 50.'),
});

const ProviderUserSchema = z
  .object({
    id: z.string(),
    aud: z.string().optional(),
    role: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    email_confirmed_at: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    phone_confirmed_at: z.string().nullable().optional(),
    confirmed_at: z.string().nullable().optional(),
    email_change: z.string().nullable().optional(),
    email_change_sent_at: z.string().nullable().optional(),
    email_change_confirm_status: z.number().optional(),
    phone_change: z.string().nullable().optional(),
    phone_change_sent_at: z.string().nullable().optional(),
    phone_change_token: z.string().nullable().optional(),
    recovery_sent_at: z.string().nullable().optional(),
    recovery_token: z.string().nullable().optional(),
    new_email: z.string().nullable().optional(),
    new_phone: z.string().nullable().optional(),
    invited_at: z.string().nullable().optional(),
    confirmation_sent_at: z.string().nullable().optional(),
    confirmation_token: z.string().nullable().optional(),
    reauthentication_sent_at: z.string().nullable().optional(),
    reauthentication_token: z.string().nullable().optional(),
    is_super_admin: z.boolean().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    last_sign_in_at: z.string().nullable().optional(),
    app_metadata: z.object({}).passthrough().optional(),
    user_metadata: z.object({}).passthrough().optional(),
    factors: z.array(z.object({}).passthrough()).optional(),
    identities: z.union([z.array(z.object({}).passthrough()), z.null()]).optional(),
  })
  .passthrough();

export const listAuthUsersOutputSchema = z.object({
  users: z.array(ProviderUserSchema),
  total: z.number().int().optional(),
  next_page: z.number().int().optional(),
});

export function listAuthUsersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_list_auth_users',
    description: 'List auth users from Supabase.',
    inputSchema: listAuthUsersInputSchema,
    outputSchema: listAuthUsersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAuthUsersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection.connection_config;
      const rawProjectUrl = connectionConfig ? connectionConfig['projectUrl'] : undefined;
      const baseUrlOverride =
        typeof rawProjectUrl === 'string'
          ? rawProjectUrl.startsWith('http')
            ? rawProjectUrl
            : `https://${rawProjectUrl}`
          : undefined;

      const page = input.page ?? 1;
      const per_page = input.per_page ?? 50;

      const response = await platformProxy.get({
        // https://supabase.com/docs/reference/api/admin-listusers
        endpoint: '/auth/v1/admin/users',
        params: {
          page: String(page),
          per_page: String(per_page),
        },
        baseUrlOverride,
        retries: 3,
      });

      const parsed = z.object({ users: z.array(ProviderUserSchema) }).safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response format from Supabase Auth API.',
        });
      }

      const users = parsed.data.users;
      const totalHeader = response.headers?.['x-total-count'];
      const total = typeof totalHeader === 'string' ? parseInt(totalHeader, 10) : undefined;
      const hasMore = total !== undefined ? page * per_page < total : users.length === per_page;

      return {
        users,
        ...(total !== undefined && { total }),
        ...(hasMore && { next_page: page + 1 }),
      };
    },
  });
}
