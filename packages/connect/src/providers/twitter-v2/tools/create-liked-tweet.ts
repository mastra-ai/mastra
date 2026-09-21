// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createLikedTweetInputSchema = z.object({
  userId: z
    .string()
    .describe(
      'The ID of the authenticated user that is requesting to like the Post. Must match the authenticated user.',
    ),
  tweetId: z.string().describe('The ID of the Post to like. Example: "1228393702244134912"'),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    liked: z.boolean(),
  }),
});

export const createLikedTweetOutputSchema = z.object({
  liked: z.boolean(),
});

export function createLikedTweetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_create_liked_tweet',
    description: 'Create a liked tweet in Twitter/X',
    inputSchema: createLikedTweetInputSchema,
    outputSchema: createLikedTweetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createLikedTweetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.x.com/en/docs/x-api/tweets/likes/api-reference/post-users-id-likes
      const response = await platformProxy.post({
        endpoint: `/2/users/${input.userId}/likes`,
        data: {
          tweet_id: input.tweetId,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: 'Failed to like tweet. Empty response from API.',
        });
      }

      const parsed = ProviderResponseSchema.parse(response.data);

      return {
        liked: parsed.data.liked,
      };
    },
  });
}
