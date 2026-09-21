// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listTweetsInputSchema = z.object({
  user_id: z.string().describe('The ID of the User whose tweets to retrieve. Example: "2244994945"'),
  max_results: z.number().min(5).max(100).optional().describe('Maximum number of results per page (5-100).'),
  pagination_token: z.string().optional().describe('Pagination token for fetching the next page of results.'),
  since_id: z.string().optional().describe('Minimum tweet ID to include in the result set.'),
  until_id: z.string().optional().describe('Maximum tweet ID to include in the result set.'),
  start_time: z
    .string()
    .optional()
    .describe('ISO 8601 timestamp. Earliest UTC timestamp from which tweets will be provided.'),
  end_time: z
    .string()
    .optional()
    .describe('ISO 8601 timestamp. Latest UTC timestamp to which tweets will be provided.'),
  exclude: z
    .array(z.enum(['replies', 'retweets']))
    .optional()
    .describe('Entities to exclude from results (replies or retweets).'),
});

const ReferencedTweetSchema = z.object({
  type: z.enum(['retweeted', 'quoted', 'replied_to']).or(z.string()),
  id: z.string(),
});

const PublicMetricsSchema = z.object({
  retweet_count: z.number().optional(),
  reply_count: z.number().optional(),
  like_count: z.number().optional(),
  quote_count: z.number().optional(),
  bookmark_count: z.number().optional(),
  impression_count: z.number().optional(),
});

const TweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  edit_history_tweet_ids: z.array(z.string()).optional(),
  author_id: z.string().optional(),
  created_at: z.string().optional(),
  conversation_id: z.string().optional(),
  in_reply_to_user_id: z.string().optional(),
  referenced_tweets: z.array(ReferencedTweetSchema).optional(),
  public_metrics: PublicMetricsSchema.optional(),
  lang: z.string().optional(),
  possibly_sensitive: z.boolean().optional(),
  reply_settings: z.enum(['everyone', 'mentionedUsers', 'following']).or(z.string()).optional(),
  source: z.string().optional(),
});

const MetaSchema = z.object({
  newest_id: z.string().optional(),
  oldest_id: z.string().optional(),
  result_count: z.number(),
  next_token: z.string().optional(),
  previous_token: z.string().optional(),
});

export const listTweetsOutputSchema = z.object({
  tweets: z.array(TweetSchema),
  meta: MetaSchema,
});

const ProviderTweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  edit_history_tweet_ids: z.array(z.string()).optional(),
  author_id: z.string().optional(),
  created_at: z.string().optional(),
  conversation_id: z.string().optional(),
  in_reply_to_user_id: z.string().optional(),
  referenced_tweets: z
    .array(
      z.object({
        type: z.string(),
        id: z.string(),
      }),
    )
    .optional(),
  public_metrics: z.record(z.string(), z.number()).optional(),
  lang: z.string().optional(),
  possibly_sensitive: z.boolean().optional(),
  reply_settings: z.string().optional(),
  source: z.string().optional(),
});

const ProviderMetaSchema = z.object({
  newest_id: z.string().optional(),
  oldest_id: z.string().optional(),
  result_count: z.number().optional(),
  next_token: z.string().optional(),
  previous_token: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  data: z.array(ProviderTweetSchema).optional(),
  meta: ProviderMetaSchema.optional(),
});

export function listTweetsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_list_tweets',
    description: 'List tweets from a specific Twitter/X user timeline.',
    inputSchema: listTweetsInputSchema,
    outputSchema: listTweetsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTweetsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number | string[]> = {};

      if (input.max_results !== undefined) {
        params['max_results'] = input.max_results;
      }
      if (input.pagination_token !== undefined) {
        params['pagination_token'] = input.pagination_token;
      }
      if (input.since_id !== undefined) {
        params['since_id'] = input.since_id;
      }
      if (input.until_id !== undefined) {
        params['until_id'] = input.until_id;
      }
      if (input.start_time !== undefined) {
        params['start_time'] = input.start_time;
      }
      if (input.end_time !== undefined) {
        params['end_time'] = input.end_time;
      }
      if (input.exclude !== undefined && input.exclude.length > 0) {
        params['exclude'] = input.exclude.join(',');
      }

      // https://docs.x.com/x-api/users/lookup/api-reference/get-users-id-tweets
      const response = await platformProxy.get({
        endpoint: `/2/users/${input.user_id}/tweets`,
        params,
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'User not found or user has no tweets',
          user_id: input.user_id,
        });
      }

      if (response.status === 401) {
        throw new platformProxy.ActionError({
          type: 'unauthorized',
          message: "Unauthorized to access this user's tweets",
          user_id: input.user_id,
        });
      }

      if (response.status === 429) {
        const retryAfter = response.headers?.['retry-after'];
        throw new platformProxy.ActionError({
          type: 'rate_limited',
          message: 'API rate limit exceeded',
          retry_after: retryAfter,
        });
      }

      const providerData = ProviderResponseSchema.parse(response.data);

      const tweets = providerData.data || [];
      const meta = providerData.meta || { result_count: 0 };

      const validatedTweets = tweets.map(tweet => {
        const result: z.infer<typeof TweetSchema> = {
          id: tweet.id,
          text: tweet.text,
        };

        if (tweet.edit_history_tweet_ids !== undefined) {
          result.edit_history_tweet_ids = tweet.edit_history_tweet_ids;
        }
        if (tweet.author_id !== undefined) {
          result.author_id = tweet.author_id;
        }
        if (tweet.created_at !== undefined) {
          result.created_at = tweet.created_at;
        }
        if (tweet.conversation_id !== undefined) {
          result.conversation_id = tweet.conversation_id;
        }
        if (tweet.in_reply_to_user_id !== undefined) {
          result.in_reply_to_user_id = tweet.in_reply_to_user_id;
        }
        if (tweet.referenced_tweets !== undefined) {
          result.referenced_tweets = tweet.referenced_tweets.map(ref => {
            const validType =
              ref.type === 'retweeted' || ref.type === 'quoted' || ref.type === 'replied_to' ? ref.type : 'replied_to';
            return {
              type: validType,
              id: ref.id,
            };
          });
        }
        if (tweet.public_metrics !== undefined) {
          result.public_metrics = tweet.public_metrics;
        }
        if (tweet.lang !== undefined) {
          result.lang = tweet.lang;
        }
        if (tweet.possibly_sensitive !== undefined) {
          result.possibly_sensitive = tweet.possibly_sensitive;
        }
        if (tweet.reply_settings !== undefined) {
          const settings = tweet.reply_settings;
          if (settings === 'everyone' || settings === 'mentionedUsers' || settings === 'following') {
            result.reply_settings = settings;
          }
        }
        if (tweet.source !== undefined) {
          result.source = tweet.source;
        }

        return result;
      });

      const validatedMeta: z.infer<typeof MetaSchema> = {
        result_count: meta.result_count || 0,
        ...(meta.newest_id !== undefined && { newest_id: meta.newest_id }),
        ...(meta.oldest_id !== undefined && { oldest_id: meta.oldest_id }),
        ...(meta.next_token !== undefined && { next_token: meta.next_token }),
        ...(meta.previous_token !== undefined && { previous_token: meta.previous_token }),
      };

      return {
        tweets: validatedTweets,
        meta: validatedMeta,
      };
    },
  });
}
