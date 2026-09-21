// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const removeBookmarkInputSchema = z.object({
  tweet_id: z.string().describe('The ID of the tweet to remove from bookmarks. Example: "1234567890"'),
});

export const removeBookmarkOutputSchema = z.object({
  bookmark_removed: z.boolean().describe('Whether the bookmark was successfully removed'),
  tweet_id: z.string().describe('The ID of the tweet that was removed from bookmarks'),
});

const UserMeSchema = z.object({
  data: z.object({
    id: z.string(),
  }),
});

export function removeBookmarkTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_remove_bookmark',
    description: 'Remove a tweet bookmark',
    inputSchema: removeBookmarkInputSchema,
    outputSchema: removeBookmarkOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeBookmarkOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.x.com/x-api/users/user-lookup-by-id
      const userResponse = await platformProxy.get({
        endpoint: '/2/users/me',
        retries: 3,
      });

      if (userResponse.status !== 200 || !userResponse.data) {
        throw new platformProxy.ActionError({
          type: 'user_lookup_failed',
          message: 'Failed to retrieve authenticated user information',
          status: userResponse.status,
        });
      }

      const parsedUser = UserMeSchema.safeParse(userResponse.data);

      if (!parsedUser.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_user_response',
          message: 'Failed to parse user response from X API',
          details: parsedUser.error.message,
        });
      }

      const userId = parsedUser.data.data.id;

      // https://docs.x.com/x-api/introduction/bookmarks
      const response = await platformProxy.delete({
        endpoint: `/2/users/${userId}/bookmarks/${input.tweet_id}`,
        retries: 2,
      });

      if (response.status !== 200) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: `Failed to remove bookmark: ${response.status}`,
          status: response.status,
          tweet_id: input.tweet_id,
        });
      }

      return {
        bookmark_removed: true,
        tweet_id: input.tweet_id,
      };
    },
  });
}
