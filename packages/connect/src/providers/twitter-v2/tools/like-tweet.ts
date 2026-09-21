// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const likeTweetInputSchema = z.object({
  tweetId: z.string().describe('The ID of the tweet to like. Example: "1346889436626259968"'),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    liked: z.boolean(),
  }),
});

const UsersMeResponseSchema = z.object({
  data: z.object({
    id: z.string(),
  }),
});

export const likeTweetOutputSchema = z.object({
  liked: z.boolean().describe('Whether the tweet was successfully liked'),
});

const MetadataSchema = z.object({
  userId: z
    .string()
    .optional()
    .describe(
      'The ID of the authenticated user who is liking the tweet. If not provided, will be fetched from /2/users/me',
    ),
});

export function likeTweetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_like_tweet',
    description: 'Like a tweet',
    inputSchema: likeTweetInputSchema,
    outputSchema: likeTweetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof likeTweetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const metadata = await platformProxy.getMetadata<{ userId?: string }>();
      let userId = metadata?.userId;

      // If userId not in metadata, fetch from /2/users/me
      if (!userId) {
        // https://docs.x.com/x-api/users/get-authenticated-user-data
        const meResponse = await platformProxy.get({
          endpoint: '/2/users/me',
          retries: 3,
        });

        if (!meResponse.data) {
          throw new platformProxy.ActionError({
            type: 'api_error',
            message: 'Failed to fetch authenticated user: empty response from API',
          });
        }

        const usersMe = UsersMeResponseSchema.parse(meResponse.data);
        userId = usersMe.data.id;
      }

      // https://docs.x.com/x-api/posts/causes-the-user-in-the-path-to-like-the-specified-post
      const response = await platformProxy.post({
        endpoint: `/2/users/${userId}/likes`,
        data: {
          tweet_id: input.tweetId,
        },
        retries: 10,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: 'Failed to like tweet: empty response from API',
        });
      }

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        liked: providerResponse.data.liked,
      };
    },
  });
}
