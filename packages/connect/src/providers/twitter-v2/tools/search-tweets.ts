// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchTweetsInputSchema = z.object({
  query: z
    .string()
    .describe('Search query using Twitter/X search operators. Example: "from:nangohq -is:retweet has:links"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination token from the previous response (meta.next_token). Omit for the first page.'),
  max_results: z
    .number()
    .int()
    .min(10)
    .max(100)
    .optional()
    .describe('Maximum number of results per page (10-100). Default: 10.'),
  start_time: z
    .string()
    .optional()
    .describe('Earliest UTC timestamp from which Tweets will be provided (ISO 8601). Example: "2024-01-01T00:00:00Z".'),
  end_time: z
    .string()
    .optional()
    .describe('Latest UTC timestamp to which Tweets will be provided (ISO 8601). Example: "2024-12-31T23:59:59Z".'),
  since_id: z
    .string()
    .optional()
    .describe('Minimum Tweet ID to be included in the result set. Takes precedence over start_time.'),
  until_id: z
    .string()
    .optional()
    .describe('Maximum Tweet ID to be included in the result set. Takes precedence over end_time.'),
  sort_order: z
    .enum(['recency', 'relevancy'])
    .optional()
    .describe('Order in which to return results. Default: recency.'),
  tweet_fields: z
    .string()
    .optional()
    .describe('Comma-separated list of Tweet fields to return. Example: "created_at,public_metrics,author_id".'),
  expansions: z
    .string()
    .optional()
    .describe('Comma-separated list of fields to expand. Example: "author_id,referenced_tweets.id".'),
  user_fields: z
    .string()
    .optional()
    .describe(
      'Comma-separated list of User fields to return for expanded users. Example: "username,verified,public_metrics".',
    ),
});

const PublicMetricsSchema = z
  .object({
    retweet_count: z.number().int().optional(),
    reply_count: z.number().int().optional(),
    like_count: z.number().int().optional(),
    quote_count: z.number().int().optional(),
    bookmark_count: z.number().int().optional(),
    impression_count: z.number().int().optional(),
  })
  .passthrough()
  .optional();

const ReferencedTweetSchema = z
  .object({
    id: z.string(),
    type: z.enum(['retweeted', 'quoted', 'replied_to']).or(z.string()),
  })
  .passthrough();

const TweetSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    edit_history_tweet_ids: z.array(z.string()).optional(),
    author_id: z.string().optional(),
    created_at: z.string().optional(),
    conversation_id: z.string().optional(),
    in_reply_to_user_id: z.string().optional(),
    referenced_tweets: z.array(ReferencedTweetSchema).optional(),
    public_metrics: PublicMetricsSchema,
    lang: z.string().optional(),
    possibly_sensitive: z.boolean().optional(),
  })
  .passthrough();

const UserSchema = z
  .object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    verified: z.boolean().optional(),
    description: z.string().optional(),
    profile_image_url: z.string().optional(),
  })
  .passthrough();

const IncludesSchema = z
  .object({
    users: z.array(UserSchema).optional(),
    tweets: z.array(TweetSchema).optional(),
  })
  .passthrough()
  .optional();

const MetaSchema = z
  .object({
    newest_id: z.string().optional(),
    oldest_id: z.string().optional(),
    result_count: z.number().int().optional(),
    next_token: z.string().optional(),
  })
  .passthrough()
  .optional();

const ProviderResponseSchema = z
  .object({
    data: z.array(TweetSchema).optional(),
    includes: IncludesSchema,
    meta: MetaSchema,
  })
  .passthrough();

export const searchTweetsOutputSchema = z.object({
  items: z.array(TweetSchema),
  includes: IncludesSchema,
  next_cursor: z.string().optional(),
  newest_id: z.string().optional(),
  oldest_id: z.string().optional(),
  result_count: z.number().int(),
});

export function searchTweetsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_search_tweets',
    description: 'Search recent Tweets (last 7 days) on Twitter/X matching a query.',
    inputSchema: searchTweetsInputSchema,
    outputSchema: searchTweetsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchTweetsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const parsedInput = await platformProxy.zodValidateInput({ zodSchema: searchTweetsInputSchema, input });

      const params: Record<string, string | number> = {
        query: parsedInput.data.query,
      };

      if (parsedInput.data.max_results !== undefined) {
        params['max_results'] = parsedInput.data.max_results;
      }
      if (parsedInput.data.cursor) {
        params['next_token'] = parsedInput.data.cursor;
      }
      if (parsedInput.data.start_time) {
        params['start_time'] = parsedInput.data.start_time;
      }
      if (parsedInput.data.end_time) {
        params['end_time'] = parsedInput.data.end_time;
      }
      if (parsedInput.data.since_id) {
        params['since_id'] = parsedInput.data.since_id;
      }
      if (parsedInput.data.until_id) {
        params['until_id'] = parsedInput.data.until_id;
      }
      if (parsedInput.data.sort_order) {
        params['sort_order'] = parsedInput.data.sort_order;
      }
      if (parsedInput.data.tweet_fields) {
        params['tweet.fields'] = parsedInput.data.tweet_fields;
      }
      if (parsedInput.data.expansions) {
        params['expansions'] = parsedInput.data.expansions;
      }
      if (parsedInput.data.user_fields) {
        params['user.fields'] = parsedInput.data.user_fields;
      }

      // https://docs.x.com/x-api/posts/search/quickstart/recent-search
      const response = await platformProxy.get({
        endpoint: '/2/tweets/search/recent',
        params,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        items: providerResponse.data ?? [],
        includes: providerResponse.includes,
        next_cursor: providerResponse.meta?.next_token,
        newest_id: providerResponse.meta?.newest_id,
        oldest_id: providerResponse.meta?.oldest_id,
        result_count: providerResponse.meta?.result_count ?? providerResponse.data?.length ?? 0,
      };
    },
  });
}
