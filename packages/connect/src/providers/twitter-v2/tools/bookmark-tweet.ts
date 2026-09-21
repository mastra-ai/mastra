// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const bookmarkTweetInputSchema = z.object({
  userId: z
    .string()
    .describe('The ID of the authenticated source User for whom to add bookmarks. Example: "2244994945"'),
  tweetId: z.string().describe('The ID of the Tweet to bookmark. Example: "1460323737035677698"'),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    bookmarked: z.boolean(),
  }),
});

export const bookmarkTweetOutputSchema = z.object({
  bookmarked: z.boolean(),
});

export function bookmarkTweetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_bookmark_tweet',
    description: 'Bookmark a tweet for an authenticated user.',
    inputSchema: bookmarkTweetInputSchema,
    outputSchema: bookmarkTweetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof bookmarkTweetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.x.com/x-api/users/create-bookmark
        endpoint: `/2/users/${input.userId}/bookmarks`,
        data: {
          tweet_id: input.tweetId,
        },
        retries: 1,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        bookmarked: providerResponse.data.bookmarked,
      };
    },
  });
}
