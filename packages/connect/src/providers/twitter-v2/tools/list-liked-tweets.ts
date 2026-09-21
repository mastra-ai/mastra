// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listLikedTweetsInputSchema = z.object({
  userId: z.string().describe('The ID of the User to lookup liked tweets for. Example: "2244994945"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor token for the next page of results. Omit for the first page.'),
  maxResults: z
    .number()
    .min(5)
    .max(100)
    .optional()
    .describe('The maximum number of results per page (5-100). Default: 100.'),
});

const TweetSchema = z.object({
  id: z.string(),
  text: z.string().optional(),
  author_id: z.string().optional(),
  created_at: z.string().optional(),
  conversation_id: z.string().optional(),
  public_metrics: z
    .object({
      like_count: z.number().optional(),
      reply_count: z.number().optional(),
      retweet_count: z.number().optional(),
      quote_count: z.number().optional(),
      impression_count: z.number().optional(),
    })
    .optional(),
  lang: z.string().optional(),
  source: z.string().optional(),
});

export const listLikedTweetsOutputSchema = z.object({
  tweets: z.array(TweetSchema).describe('Array of liked tweets'),
  nextCursor: z.string().optional().describe('Token for the next page of results. Null if there are no more pages.'),
  previousCursor: z.string().optional().describe('Token for the previous page of results.'),
  resultCount: z.number().describe('Number of results returned in this response.'),
});

export function listLikedTweetsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_list_liked_tweets',
    description: 'List liked tweets from a specific Twitter/X user',
    inputSchema: listLikedTweetsInputSchema,
    outputSchema: listLikedTweetsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listLikedTweetsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {
        'tweet.fields': 'id,text,author_id,created_at,conversation_id,public_metrics,lang,source',
        max_results: input.maxResults ?? 100,
      };

      if (input.cursor) {
        params['pagination_token'] = input.cursor;
      }

      // https://docs.x.com/x-api/posts/get-liked-posts
      const response = await platformProxy.get({
        endpoint: `/2/users/${input.userId}/liked_tweets`,
        params,
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'User not found',
          userId: input.userId,
        });
      }

      if (response.status === 401) {
        throw new platformProxy.ActionError({
          type: 'unauthorized',
          message: "Not authorized to access this user's likes",
        });
      }

      if (response.status === 429) {
        throw new platformProxy.ActionError({
          type: 'rate_limited',
          message: 'API rate limit exceeded',
          retry_after: response.headers['retry-after'],
        });
      }

      if (response.status !== 200) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: `Unexpected response from Twitter API`,
          status: response.status,
        });
      }

      const rawData = response.data;
      if (!rawData || typeof rawData !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Twitter API',
        });
      }

      const ApiResponseSchema = z.object({
        data: z.array(z.unknown()).optional(),
        meta: z
          .object({
            result_count: z.number().optional(),
            next_token: z.string().optional(),
            previous_token: z.string().optional(),
          })
          .optional(),
      });

      const parsedResponse = ApiResponseSchema.parse(rawData);
      const tweets = parsedResponse.data?.map((tweet: unknown) => TweetSchema.parse(tweet)) ?? [];
      const resultCount = parsedResponse.meta?.result_count ?? tweets.length;
      const nextToken = parsedResponse.meta?.next_token;
      const previousToken = parsedResponse.meta?.previous_token;

      return {
        tweets,
        resultCount,
        ...(nextToken !== undefined && { nextCursor: nextToken }),
        ...(previousToken !== undefined && { previousCursor: previousToken }),
      };
    },
  });
}
