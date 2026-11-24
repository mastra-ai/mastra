// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const PasswordHashTypeSchema = z.enum(['bcrypt', 'firebase-scrypt', 'ssha', 'scrypt', 'argon2']);

export const createUserInputSchema = z.object({
  email: z.string().email().describe('Email address for the user.'),
  password: z.string().optional().describe('Plaintext password for the user.'),
  password_hash: z.string().optional().describe('Pre-hashed password. Use with password_hash_type.'),
  password_hash_type: PasswordHashTypeSchema.optional(),
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email_verified: z.boolean().optional(),
  external_id: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  signals_id: z.string().optional(),
});

export const createUserOutputSchema = z
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
    radar_auth_attempt_id: z.string().optional(),
  })
  .passthrough();

export function createUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_create_user',
    description: 'Create a user in WorkOS User Management.',
    inputSchema: createUserInputSchema,
    outputSchema: createUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://workos.com/docs/reference/user-management/user
        endpoint: '/user_management/users',
        data: {
          email: input.email,
          ...(input.password !== undefined && { password: input.password }),
          ...(input.password_hash !== undefined && { password_hash: input.password_hash }),
          ...(input.password_hash_type !== undefined && { password_hash_type: input.password_hash_type }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.first_name !== undefined && { first_name: input.first_name }),
          ...(input.last_name !== undefined && { last_name: input.last_name }),
          ...(input.email_verified !== undefined && { email_verified: input.email_verified }),
          ...(input.external_id !== undefined && { external_id: input.external_id }),
          ...(input.metadata !== undefined && { metadata: input.metadata }),
          ...(input.ip_address !== undefined && { ip_address: input.ip_address }),
          ...(input.user_agent !== undefined && { user_agent: input.user_agent }),
          ...(input.signals_id !== undefined && { signals_id: input.signals_id }),
        },
        retries: 3,
      });
      return createUserOutputSchema.parse(response.data);
    },
  });
}
