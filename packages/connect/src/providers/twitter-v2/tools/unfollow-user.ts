// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const unfollowUserInputSchema = z.object({
  target_user_id: z.string().describe('The user ID of the user to unfollow. Example: "123456789"'),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    following: z.boolean(),
  }),
});

export const unfollowUserOutputSchema = z.object({
  success: z.boolean(),
  following: z.boolean().optional(),
});

export function unfollowUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_unfollow_user',
    description: 'Unfollow a user from the authenticated account',
    inputSchema: unfollowUserInputSchema,
    outputSchema: unfollowUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof unfollowUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ user_id?: string }>();
      let sourceUserId = metadata?.user_id;

      if (!sourceUserId) {
        // https://docs.x.com/x-api/users/api-reference/get-users-me
        const meResponse = await platformProxy.get({
          endpoint: '/2/users/me',
          retries: 3,
        });

        const meSchema = z.object({
          data: z.object({
            id: z.string(),
          }),
        });

        const parsed = meSchema.safeParse(meResponse.data);

        if (!parsed.success) {
          throw new platformProxy.ActionError({
            type: 'invalid_response',
            message: 'Could not retrieve authenticated user ID',
          });
        }

        sourceUserId = parsed.data.data.id;
      }

      const response = await platformProxy.delete({
        // https://docs.x.com/x-api/users/follows/api-reference/delete-users-source-user-id-following-target-user-id
        endpoint: `/2/users/${sourceUserId}/following/${input.target_user_id}`,
        retries: 10,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'User not found or you are not following this user',
          target_user_id: input.target_user_id,
        });
      }

      if (response.status === 403) {
        throw new platformProxy.ActionError({
          type: 'forbidden',
          message: 'You cannot unfollow this user',
        });
      }

      const parsed = ProviderResponseSchema.safeParse(response.data);

      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response from X API',
          details: parsed.error.message,
        });
      }

      return {
        success: !parsed.data.data.following,
        following: parsed.data.data.following,
      };
    },
  });
}
