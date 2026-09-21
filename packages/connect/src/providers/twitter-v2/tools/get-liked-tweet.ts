// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getLikedTweetInputSchema = z.object({
  tweet_id: z.string().describe('The unique identifier of the tweet to retrieve. Example: "1346889436626259968"'),
});

const PublicMetricsSchema = z
  .object({
    like_count: z.number().optional(),
    retweet_count: z.number().optional(),
    reply_count: z.number().optional(),
    quote_count: z.number().optional(),
    impression_count: z.number().optional(),
    bookmark_count: z.number().optional(),
  })
  .optional();

const ReferencedTweetSchema = z
  .object({
    id: z.string(),
    type: z.enum(['retweeted', 'quoted', 'replied_to']).or(z.string()),
  })
  .optional();

export const getLikedTweetOutputSchema = z.object({
  id: z.string().describe('The unique identifier of this tweet. Example: "1346889436626259968"'),
  text: z.string().describe('The content of the tweet. Example: "Learn how to use the user Tweet timeline..."'),
  author_id: z.string().optional().describe('The unique identifier of the author of this tweet.'),
  created_at: z.string().optional().describe('Creation time of the tweet. Format: ISO 8601 date-time.'),
  lang: z.string().optional().describe('Language of the tweet, if detected by X.'),
  possibly_sensitive: z.boolean().optional().describe('Indicates if the tweet contains URLs marked as sensitive.'),
  reply_settings: z.string().optional().describe('Shows who can reply to this tweet.'),
  source: z.string().optional().describe('The source of the tweet.'),
  conversation_id: z.string().optional().describe('The conversation ID for the tweet.'),
  in_reply_to_user_id: z
    .string()
    .optional()
    .describe('If this tweet is a reply, the ID of the user it is replying to.'),
  public_metrics: PublicMetricsSchema.describe('Engagement metrics for the tweet.'),
  referenced_tweets: z
    .array(ReferencedTweetSchema)
    .optional()
    .describe('A list of tweets this tweet refers to (retweets, quotes, replies).'),
});

export function getLikedTweetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_get_liked_tweet',
    description: 'Retrieve a single liked tweet from Twitter/X by its ID.',
    inputSchema: getLikedTweetInputSchema,
    outputSchema: getLikedTweetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getLikedTweetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.x.com/x-api/posts/get-post-by-id
      const response = await platformProxy.get({
        endpoint: `/2/tweets/${input.tweet_id}`,
        params: {
          'tweet.fields':
            'id,text,author_id,created_at,lang,possibly_sensitive,reply_settings,source,conversation_id,in_reply_to_user_id,public_metrics,referenced_tweets',
        },
        retries: 3,
      });

      if (!response.data || !response.data.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Tweet not found',
          tweet_id: input.tweet_id,
        });
      }

      const tweetData = response.data.data;

      return {
        id: tweetData.id,
        text: tweetData.text,
        ...(tweetData.author_id && { author_id: tweetData.author_id }),
        ...(tweetData.created_at && { created_at: tweetData.created_at }),
        ...(tweetData.lang && { lang: tweetData.lang }),
        ...(tweetData.possibly_sensitive !== undefined && { possibly_sensitive: tweetData.possibly_sensitive }),
        ...(tweetData.reply_settings && { reply_settings: tweetData.reply_settings }),
        ...(tweetData.source && { source: tweetData.source }),
        ...(tweetData.conversation_id && { conversation_id: tweetData.conversation_id }),
        ...(tweetData.in_reply_to_user_id && { in_reply_to_user_id: tweetData.in_reply_to_user_id }),
        ...(tweetData.public_metrics && {
          public_metrics: {
            like_count: tweetData.public_metrics.like_count,
            retweet_count: tweetData.public_metrics.retweet_count,
            reply_count: tweetData.public_metrics.reply_count,
            quote_count: tweetData.public_metrics.quote_count,
            impression_count: tweetData.public_metrics.impression_count,
            bookmark_count: tweetData.public_metrics.bookmark_count,
          },
        }),
        ...(tweetData.referenced_tweets && { referenced_tweets: tweetData.referenced_tweets }),
      };
    },
  });
}
