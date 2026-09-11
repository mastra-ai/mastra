// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateUserInputSchema = z.object({
  user_id: z.string().min(1),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(8).optional(),
  skip_password_checks: z.boolean().optional(),
  sign_out_of_other_sessions: z.boolean().optional(),
  external_id: z.string().optional(),
  locale: z.string().optional(),
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

export const updateUserOutputSchema = UserSchema;

export function updateUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_update_user',
    description: 'Update a Clerk user.',
    inputSchema: updateUserInputSchema,
    outputSchema: updateUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://clerk.com/docs/reference/backend-api/tag/Users#operation/UpdateUser
        endpoint: `/v1/users/${encodeURIComponent(input.user_id)}`,
        data: {
          ...(input.first_name !== undefined && { first_name: input.first_name }),
          ...(input.last_name !== undefined && { last_name: input.last_name }),
          ...(input.username !== undefined && { username: input.username }),
          ...(input.password !== undefined && { password: input.password }),
          ...(input.skip_password_checks !== undefined && { skip_password_checks: input.skip_password_checks }),
          ...(input.sign_out_of_other_sessions !== undefined && {
            sign_out_of_other_sessions: input.sign_out_of_other_sessions,
          }),
          ...(input.external_id !== undefined && { external_id: input.external_id }),
          ...(input.locale !== undefined && { locale: input.locale }),
        },
        retries: 3,
      });
      return UserSchema.parse(response.data);
    },
  });
}
