// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserInputSchema = z.object({
  userId: z.string().describe('Linear user ID. Example: "usr_123abc"'),
});

const ProviderUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  displayName: z.string().optional(),
  admin: z.boolean(),
  active: z.boolean(),
});

const LinearUserResponseSchema = z.object({
  data: z.object({
    user: ProviderUserSchema,
  }),
});

export const getUserOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  displayName: z.string().optional(),
  admin: z.boolean(),
  active: z.boolean(),
});

export function getUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_get_user',
    description: 'Retrieve a Linear user by user ID.',
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query: 'query user($id: String!) { user(id: $id) { id name email displayName admin active } }',
          variables: {
            id: input.userId,
          },
        },
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response from Linear API',
        });
      }

      const parsed = LinearUserResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'User not found',
          userId: input.userId,
        });
      }

      const providerUser = parsed.data.data.user;

      return {
        id: providerUser.id,
        name: providerUser.name,
        email: providerUser.email,
        ...(providerUser.displayName !== undefined && { displayName: providerUser.displayName }),
        admin: providerUser.admin,
        active: providerUser.active,
      };
    },
  });
}
