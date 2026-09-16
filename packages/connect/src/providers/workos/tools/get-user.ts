// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserInputSchema = z.object({
  user_id: z.string().min(1).describe('WorkOS user ID. Example: "user_01H..."'),
});

export const getUserOutputSchema = z
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

export function getUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_get_user',
    description: 'Retrieve a WorkOS user by ID.',
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/user-management/user
        endpoint: `/user_management/users/${encodeURIComponent(input.user_id)}`,
        retries: 3,
      });
      return getUserOutputSchema.parse(response.data);
    },
  });
}
