// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const followUserInputSchema = z.object({
  target_user_id: z.string().describe('The user ID of the user to follow. Example: "2244994945"'),
});

const ProviderResponseSchema = z.object({
  data: z
    .object({
      following: z.boolean(),
      pending_follow: z.boolean(),
    })
    .optional(),
  errors: z.array(z.object({})).optional(),
});

export const followUserOutputSchema = z.object({
  following: z.boolean().describe('Whether the follow was successful'),
  pending_follow: z
    .boolean()
    .describe('Whether the follow is pending (target user has protected account and must accept the request)'),
});

export function followUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_follow_user',
    description: 'Follow a user from the authenticated account.',
    inputSchema: followUserInputSchema,
    outputSchema: followUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof followUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.x.com/en/docs/twitter-api/users/lookup/api-reference/get-users-me
      const meResponse = await platformProxy.get({
        endpoint: '/2/users/me',
        retries: 3,
      });

      const MeResponseSchema = z.object({
        data: z.object({
          id: z.string(),
        }),
      });
      const meData = MeResponseSchema.parse(meResponse.data);
      const userId = meData.data.id;

      // https://developer.x.com/en/docs/twitter-api/users/follows/api-reference/post-users-source_user_id-following
      const response = await platformProxy.post({
        endpoint: `/2/users/${userId}/following`,
        data: {
          target_user_id: input.target_user_id,
        },
        retries: 3,
      });

      if (response.status === 429) {
        throw new platformProxy.ActionError({
          type: 'rate_limited',
          message: 'API rate limit exceeded',
          retry_after: response.headers['retry-after'],
        });
      }

      if (response.status >= 400) {
        const errorObj = response.data && typeof response.data === 'object' ? response.data : {};
        throw new platformProxy.ActionError({
          type: 'api_error',
          message:
            'message' in errorObj && typeof errorObj['message'] === 'string'
              ? errorObj['message']
              : 'Failed to follow user',
          status: response.status,
          errors: 'errors' in errorObj ? errorObj['errors'] : undefined,
        });
      }

      const providerData = ProviderResponseSchema.parse(response.data);

      if (!providerData.data) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response from X API: missing data',
        });
      }

      return {
        following: providerData.data.following,
        pending_follow: providerData.data.pending_follow,
      };
    },
  });
}
