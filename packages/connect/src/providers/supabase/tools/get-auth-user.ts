// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getAuthUserInputSchema = z.object({
  userId: z
    .string()
    .uuid()
    .describe('The UUID of the user to retrieve. Example: "a02e344e-4eba-473d-b299-b751cbd1fa2c"'),
});

const IdentitySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  identity_data: z.record(z.string(), z.unknown()).optional(),
  provider: z.string(),
  created_at: z.string().optional(),
  last_sign_in_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const FactorSchema = z.object({
  id: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  status: z.string().optional(),
  friendly_name: z.string().optional(),
  factor_type: z.string().optional(),
});

const ProviderUserSchema = z
  .object({
    id: z.string(),
    aud: z.string().optional(),
    role: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().nullable().optional(),
    email_confirmed_at: z.string().nullable().optional(),
    phone_confirmed_at: z.string().nullable().optional(),
    confirmed_at: z.string().nullable().optional(),
    last_sign_in_at: z.string().nullable().optional(),
    app_metadata: z.record(z.string(), z.unknown()).optional(),
    user_metadata: z.record(z.string(), z.unknown()).optional(),
    identities: z.array(IdentitySchema).optional(),
    factors: z.array(FactorSchema).optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    is_anonymous: z.boolean().optional(),
    banned_until: z.string().nullable().optional(),
  })
  .passthrough();

export const getAuthUserOutputSchema = ProviderUserSchema;

export function getAuthUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_get_auth_user',
    description: 'Retrieve a single auth user from Supabase.',
    inputSchema: getAuthUserInputSchema,
    outputSchema: getAuthUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAuthUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const projectUrl = connection.connection_config?.['projectUrl'];
      const baseUrlOverride =
        typeof projectUrl === 'string'
          ? projectUrl.startsWith('http')
            ? projectUrl
            : `https://${projectUrl}`
          : undefined;

      // https://supabase.com/docs/reference/api/admin-getuserbyid
      const response = await platformProxy.get({
        endpoint: `/auth/v1/admin/users/${encodeURIComponent(input.userId)}`,
        baseUrlOverride,
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'User not found',
          user_id: input.userId,
        });
      }

      const providerUser = ProviderUserSchema.parse(response.data);

      return providerUser;
    },
  });
}
