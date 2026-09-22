// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listMentionsInputSchema = z.object({
  user_id: z.string().describe('The user ID whose mentions to retrieve. Example: "2244994945"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination token from the previous response (meta.next_token). Omit for the first page.'),
  max_results: z
    .number()
    .int()
    .min(5)
    .max(100)
    .optional()
    .describe('Maximum number of results per page (5-100). Default: 10.'),
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
  exclude: z
    .array(z.enum(['replies', 'retweets']))
    .optional()
    .describe('Types of Tweets to exclude from results.'),
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
  media_fields: z.string().optional().describe('Comma-separated list of Media fields to return.'),
  place_fields: z.string().optional().describe('Comma-separated list of Place fields to return.'),
  poll_fields: z.string().optional().describe('Comma-separated list of Poll fields to return.'),
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
    attachments: z
      .object({
        media_keys: z.array(z.string()).optional(),
        poll_ids: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
    public_metrics: PublicMetricsSchema,
    lang: z.string().optional(),
    source: z.string().optional(),
    reply_settings: z.string().optional(),
    possibly_sensitive: z.boolean().optional(),
  })
  .passthrough();

const UserSchema = z
  .object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    verified: z.boolean().optional(),
    created_at: z.string().optional(),
    description: z.string().optional(),
    public_metrics: z
      .object({
        followers_count: z.number().int().optional(),
        following_count: z.number().int().optional(),
        tweet_count: z.number().int().optional(),
        listed_count: z.number().int().optional(),
      })
      .passthrough()
      .optional(),
    profile_image_url: z.string().optional(),
    url: z.string().optional(),
    location: z.string().optional(),
    pinned_tweet_id: z.string().optional(),
  })
  .passthrough()
  .optional();

const MediaSchema = z
  .object({
    media_key: z.string(),
    type: z.string(),
    url: z.string().optional(),
    preview_image_url: z.string().optional(),
    alt_text: z.string().optional(),
    variants: z
      .array(
        z.object({
          bit_rate: z.number().int().optional(),
          content_type: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
  })
  .passthrough()
  .optional();

const IncludesSchema = z
  .object({
    users: z.array(UserSchema).optional(),
    tweets: z.array(TweetSchema).optional(),
    media: z.array(MediaSchema).optional(),
    polls: z.array(z.object({ id: z.string() }).passthrough()).optional(),
    places: z.array(z.object({ id: z.string() }).passthrough()).optional(),
  })
  .passthrough()
  .optional();

const MetaSchema = z
  .object({
    newest_id: z.string().optional(),
    oldest_id: z.string().optional(),
    result_count: z.number().int().optional(),
    next_token: z.string().optional(),
    previous_token: z.string().optional(),
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

const MentionSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    edit_history_tweet_ids: z.array(z.string()).optional(),
    author_id: z.string().optional(),
    created_at: z.string().optional(),
    conversation_id: z.string().optional(),
    in_reply_to_user_id: z.string().optional(),
    referenced_tweets: z.array(ReferencedTweetSchema).optional(),
    attachments: z
      .object({
        media_keys: z.array(z.string()).optional(),
        poll_ids: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
    public_metrics: PublicMetricsSchema,
    lang: z.string().optional(),
    source: z.string().optional(),
    reply_settings: z.string().optional(),
    possibly_sensitive: z.boolean().optional(),
  })
  .passthrough();

export const listMentionsOutputSchema = z.object({
  items: z.array(MentionSchema),
  includes: IncludesSchema,
  next_cursor: z.string().optional(),
  previous_cursor: z.string().optional(),
  newest_id: z.string().optional(),
  oldest_id: z.string().optional(),
  result_count: z.number().int(),
});

export function listMentionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_list_mentions',
    description: 'List mentions from Twitter/X for a specified user.',
    inputSchema: listMentionsInputSchema,
    outputSchema: listMentionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listMentionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (!input.user_id) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'user_id is required to fetch mentions.',
        });
      }

      const params: Record<string, string | number | string[]> = {};

      if (input.max_results !== undefined) {
        params['max_results'] = input.max_results;
      }
      if (input.cursor) {
        params['pagination_token'] = input.cursor;
      }
      if (input.start_time) {
        params['start_time'] = input.start_time;
      }
      if (input.end_time) {
        params['end_time'] = input.end_time;
      }
      if (input.since_id) {
        params['since_id'] = input.since_id;
      }
      if (input.until_id) {
        params['until_id'] = input.until_id;
      }
      if (input.exclude && input.exclude.length > 0) {
        params['exclude'] = input.exclude.join(',');
      }
      if (input.tweet_fields) {
        params['tweet.fields'] = input.tweet_fields;
      }
      if (input.expansions) {
        params['expansions'] = input.expansions;
      }
      if (input.user_fields) {
        params['user.fields'] = input.user_fields;
      }
      if (input.media_fields) {
        params['media.fields'] = input.media_fields;
      }
      if (input.place_fields) {
        params['place.fields'] = input.place_fields;
      }
      if (input.poll_fields) {
        params['poll.fields'] = input.poll_fields;
      }

      const response = await platformProxy.get({
        // https://developer.x.com/en/docs/twitter-api/tweets/timelines/api-reference/get-users-id-mentions
        endpoint: `/2/users/${input.user_id}/mentions`,
        params,
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'User not found or user has no mentions.',
          user_id: input.user_id,
        });
      }

      if (response.status === 401) {
        throw new platformProxy.ActionError({
          type: 'unauthorized',
          message: 'Not authorized to access mentions for this user.',
          user_id: input.user_id,
        });
      }

      if (response.status === 429) {
        throw new platformProxy.ActionError({
          type: 'rate_limited',
          message: 'Rate limit exceeded.',
          retry_after: response.headers?.['retry-after'],
        });
      }

      if (!response.data) {
        return {
          items: [],
          includes: {},
          result_count: 0,
        };
      }

      const rawData = ProviderResponseSchema.safeParse(response.data);

      if (!rawData.success) {
        throw new platformProxy.ActionError({
          type: 'parse_error',
          message: 'Failed to parse API response',
          details: rawData.error.issues,
        });
      }

      const data = rawData.data;

      return {
        items: data.data ?? [],
        includes: data.includes || {},
        next_cursor: data.meta?.next_token,
        previous_cursor: data.meta?.previous_token,
        newest_id: data.meta?.newest_id,
        oldest_id: data.meta?.oldest_id,
        result_count: data.meta?.result_count ?? data.data?.length ?? 0,
      };
    },
  });
}
