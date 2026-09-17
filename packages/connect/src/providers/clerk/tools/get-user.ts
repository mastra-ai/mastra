// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserInputSchema = z.object({
  user_id: z.string().min(1).describe('Clerk user ID. Example: "user_2abc123"'),
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

export const getUserOutputSchema = UserSchema;

export function getUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_get_user',
    description: 'Retrieve a Clerk user by ID.',
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://clerk.com/docs/reference/backend-api/tag/Users#operation/GetUser
      const response = await platformProxy.get({
        endpoint: `/v1/users/${encodeURIComponent(input.user_id)}`,
        retries: 3,
      });
      return UserSchema.parse(response.data);
    },
  });
}
