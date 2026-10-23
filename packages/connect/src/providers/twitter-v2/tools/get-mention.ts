// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getMentionInputSchema = z.object({
  id: z.string().describe('The unique identifier of the Tweet to retrieve. Example: "1234567890"'),
});

const ProviderPublicMetricsSchema = z.object({
  retweet_count: z.number().optional(),
  reply_count: z.number().optional(),
  like_count: z.number().optional(),
  quote_count: z.number().optional(),
  bookmark_count: z.number().optional(),
  impression_count: z.number().optional(),
});

const ProviderReferencedTweetSchema = z.object({
  type: z.string(),
  id: z.string(),
});

const ProviderTweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  edit_history_tweet_ids: z.array(z.string()),
  author_id: z.string().optional(),
  created_at: z.string().optional(),
  lang: z.string().optional(),
  possibly_sensitive: z.boolean().optional(),
  public_metrics: ProviderPublicMetricsSchema.optional(),
  referenced_tweets: z.array(ProviderReferencedTweetSchema).optional(),
  in_reply_to_user_id: z.string().optional(),
  conversation_id: z.string().optional(),
  reply_settings: z.string().optional(),
  source: z.string().optional(),
});

const PublicMetricsSchema = z.object({
  retweet_count: z.number().optional(),
  reply_count: z.number().optional(),
  like_count: z.number().optional(),
  quote_count: z.number().optional(),
  bookmark_count: z.number().optional(),
  impression_count: z.number().optional(),
});

const ReferencedTweetSchema = z.object({
  type: z.string(),
  id: z.string(),
});

export const getMentionOutputSchema = z.object({
  id: z.string(),
  text: z.string(),
  edit_history_tweet_ids: z.array(z.string()),
  author_id: z.string().optional(),
  created_at: z.string().optional(),
  lang: z.string().optional(),
  possibly_sensitive: z.boolean().optional(),
  public_metrics: PublicMetricsSchema.optional(),
  referenced_tweets: z.array(ReferencedTweetSchema).optional(),
  in_reply_to_user_id: z.string().optional(),
  conversation_id: z.string().optional(),
  reply_settings: z.string().optional(),
  source: z.string().optional(),
});

export function getMentionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_get_mention',
    description: 'Retrieve a single mention from Twitter/X.',
    inputSchema: getMentionInputSchema,
    outputSchema: getMentionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getMentionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.x.com/x-api/tweets/lookup/api-reference/get-tweets-id
      const response = await platformProxy.get({
        endpoint: `/2/tweets/${input.id}`,
        params: {
          'tweet.fields':
            'author_id,created_at,lang,possibly_sensitive,public_metrics,referenced_tweets,in_reply_to_user_id,conversation_id,reply_settings,source',
        },
        retries: 3,
      });

      if (!response.data || !response.data.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Tweet not found',
          tweet_id: input.id,
        });
      }

      const tweet = ProviderTweetSchema.parse(response.data.data);

      return {
        id: tweet.id,
        text: tweet.text,
        edit_history_tweet_ids: tweet.edit_history_tweet_ids,
        ...(tweet.author_id !== undefined && { author_id: tweet.author_id }),
        ...(tweet.created_at !== undefined && { created_at: tweet.created_at }),
        ...(tweet.lang !== undefined && { lang: tweet.lang }),
        ...(tweet.possibly_sensitive !== undefined && { possibly_sensitive: tweet.possibly_sensitive }),
        ...(tweet.public_metrics !== undefined && { public_metrics: tweet.public_metrics }),
        ...(tweet.referenced_tweets !== undefined && { referenced_tweets: tweet.referenced_tweets }),
        ...(tweet.in_reply_to_user_id !== undefined && { in_reply_to_user_id: tweet.in_reply_to_user_id }),
        ...(tweet.conversation_id !== undefined && { conversation_id: tweet.conversation_id }),
        ...(tweet.reply_settings !== undefined && { reply_settings: tweet.reply_settings }),
        ...(tweet.source !== undefined && { source: tweet.source }),
      };
    },
  });
}
