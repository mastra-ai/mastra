// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteLikedTweetInputSchema = z.object({
  tweet_id: z.string().describe('The ID of the liked tweet to remove. Example: "1346889436626259968"'),
});

const ProviderUserSchema = z
  .object({
    data: z.object({
      id: z.string(),
    }),
  })
  .passthrough();

const ProviderUnlikeResponseSchema = z
  .object({
    data: z
      .object({
        liked: z.boolean(),
      })
      .optional(),
  })
  .passthrough();

export const deleteLikedTweetOutputSchema = z.object({
  success: z.boolean(),
  liked: z.boolean().optional(),
});

export function deleteLikedTweetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_delete_liked_tweet',
    description: 'Remove a liked tweet (unlike) for the authenticated user.',
    inputSchema: deleteLikedTweetInputSchema,
    outputSchema: deleteLikedTweetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteLikedTweetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.x.com/x-api/users/lookup-ME#get-api-endpoint
      const userResponse = await platformProxy.get({
        endpoint: '/2/users/me',
        retries: 3,
      });

      const userData = ProviderUserSchema.parse(userResponse.data);
      const userId = userData.data.id;

      // https://docs.x.com/x-api/likes/manage-likes#delete-api-endpoint
      const response = await platformProxy.delete({
        endpoint: `/2/users/${userId}/likes/${input.tweet_id}`,
        retries: 3,
      });

      const parsed = ProviderUnlikeResponseSchema.parse(response.data);

      return {
        success: true,
        ...(parsed.data?.liked !== undefined && { liked: parsed.data.liked }),
      };
    },
  });
}
