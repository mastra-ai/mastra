// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createAuthUserInputSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().optional(),
    phone: z.string().optional(),
    email_confirm: z.boolean().optional(),
    phone_confirm: z.boolean().optional(),
    user_metadata: z.record(z.string(), z.unknown()).optional(),
    app_metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(data => data.email !== undefined || data.phone !== undefined, {
    message: 'Either email or phone must be provided.',
  });

const ProviderUserSchema = z.object({
  id: z.string(),
  aud: z.string().optional(),
  role: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  email_confirmed_at: z.string().optional().nullable(),
  phone_confirmed_at: z.string().optional().nullable(),
  last_sign_in_at: z.string().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  identities: z
    .array(
      z.object({
        id: z.string(),
        user_id: z.string(),
        identity_data: z.record(z.string(), z.unknown()).optional(),
        provider: z.string().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
      }),
    )
    .optional()
    .nullable(),
  user_metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  app_metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const createAuthUserOutputSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  email_confirmed_at: z.string().optional(),
  phone_confirmed_at: z.string().optional(),
  last_sign_in_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  identities: z
    .array(
      z.object({
        id: z.string(),
        user_id: z.string(),
        identity_data: z.record(z.string(), z.unknown()).optional(),
        provider: z.string().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
      }),
    )
    .optional(),
  user_metadata: z.record(z.string(), z.unknown()).optional(),
  app_metadata: z.record(z.string(), z.unknown()).optional(),
});

export function createAuthUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_create_auth_user',
    description: 'Create an auth user in Supabase.',
    inputSchema: createAuthUserInputSchema,
    outputSchema: createAuthUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createAuthUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const projectUrl = connection.connection_config?.['projectUrl'];
      const baseUrlOverride =
        typeof projectUrl === 'string'
          ? projectUrl.startsWith('http')
            ? projectUrl
            : `https://${projectUrl}`
          : undefined;

      // https://supabase.com/docs/reference/api/admin-create-user
      const response = await platformProxy.post({
        endpoint: '/auth/v1/admin/users',
        baseUrlOverride,
        data: {
          ...(input.email !== undefined && { email: input.email }),
          ...(input.password !== undefined && { password: input.password }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.email_confirm !== undefined && { email_confirm: input.email_confirm }),
          ...(input.phone_confirm !== undefined && { phone_confirm: input.phone_confirm }),
          ...(input.user_metadata !== undefined && { user_metadata: input.user_metadata }),
          ...(input.app_metadata !== undefined && { app_metadata: input.app_metadata }),
        },
        retries: 3,
      });

      const providerUser = ProviderUserSchema.parse(response.data);

      return {
        id: providerUser.id,
        created_at: providerUser.created_at,
        updated_at: providerUser.updated_at,
        ...(providerUser.email != null && { email: providerUser.email }),
        ...(providerUser.phone != null && { phone: providerUser.phone }),
        ...(providerUser.email_confirmed_at != null && { email_confirmed_at: providerUser.email_confirmed_at }),
        ...(providerUser.phone_confirmed_at != null && { phone_confirmed_at: providerUser.phone_confirmed_at }),
        ...(providerUser.last_sign_in_at != null && { last_sign_in_at: providerUser.last_sign_in_at }),
        ...(providerUser.identities != null && { identities: providerUser.identities }),
        ...(providerUser.user_metadata != null && { user_metadata: providerUser.user_metadata }),
        ...(providerUser.app_metadata != null && { app_metadata: providerUser.app_metadata }),
      };
    },
  });
}
