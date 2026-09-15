// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateUserInputSchema = z.object({
  user_id: z.string().min(1).describe('WorkOS user ID. Example: "user_01H..."'),
  email: z.string().email().optional(),
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email_verified: z.boolean().optional(),
  password: z.string().optional(),
  password_hash: z.string().optional(),
  password_hash_type: z.enum(['bcrypt', 'firebase-scrypt', 'ssha', 'scrypt', 'argon2']).optional(),
  external_id: z.string().optional(),
  locale: z.string().optional(),
  metadata: z.record(z.string(), z.string().nullable()).optional(),
});

export const updateUserOutputSchema = z
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

export function updateUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_update_user',
    description: 'Update a WorkOS user.',
    inputSchema: updateUserInputSchema,
    outputSchema: updateUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.put({
        // https://workos.com/docs/reference/user-management/user
        endpoint: `/user_management/users/${encodeURIComponent(input.user_id)}`,
        data: {
          ...(input.email !== undefined && { email: input.email }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.first_name !== undefined && { first_name: input.first_name }),
          ...(input.last_name !== undefined && { last_name: input.last_name }),
          ...(input.email_verified !== undefined && { email_verified: input.email_verified }),
          ...(input.password !== undefined && { password: input.password }),
          ...(input.password_hash !== undefined && { password_hash: input.password_hash }),
          ...(input.password_hash_type !== undefined && { password_hash_type: input.password_hash_type }),
          ...(input.external_id !== undefined && { external_id: input.external_id }),
          ...(input.locale !== undefined && { locale: input.locale }),
          ...(input.metadata !== undefined && { metadata: input.metadata }),
        },
        retries: 3,
      });
      return updateUserOutputSchema.parse(response.data);
    },
  });
}
