// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTweetInputSchema = z.object({
  id: z.string().describe('The unique identifier of the Tweet to retrieve. Example: "1050118621198921728"'),
});

const PublicMetricsSchema = z.object({
  retweet_count: z.number().optional(),
  reply_count: z.number().optional(),
  like_count: z.number().optional(),
  quote_count: z.number().optional(),
  bookmark_count: z.number().optional(),
  impression_count: z.number().optional(),
});

const ProviderTweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  author_id: z.string().optional(),
  created_at: z.string().optional(),
  public_metrics: PublicMetricsSchema.optional(),
  lang: z.string().optional(),
  source: z.string().optional(),
  possibly_sensitive: z.boolean().optional(),
  reply_settings: z.string().optional(),
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
  edit_history_tweet_ids: z.array(z.string()).optional(),
  edit_controls: z
    .object({
      edit_tweet_ids: z.array(z.string()).optional(),
      editable_until: z.string().optional(),
      edits_remaining: z.number().optional(),
      is_edit_eligible: z.boolean().optional(),
    })
    .optional(),
});

export const getTweetOutputSchema = z.object({
  id: z.string(),
  text: z.string(),
  authorId: z.string().optional(),
  createdAt: z.string().optional(),
  publicMetrics: z
    .object({
      retweetCount: z.number().optional(),
      replyCount: z.number().optional(),
      likeCount: z.number().optional(),
      quoteCount: z.number().optional(),
      bookmarkCount: z.number().optional(),
      impressionCount: z.number().optional(),
    })
    .optional(),
  lang: z.string().optional(),
  source: z.string().optional(),
  possiblySensitive: z.boolean().optional(),
  replySettings: z.string().optional(),
  conversationId: z.string().optional(),
  inReplyToUserId: z.string().optional(),
  referencedTweets: z
    .array(
      z.object({
        type: z.string(),
        id: z.string(),
      }),
    )
    .optional(),
  editHistoryTweetIds: z.array(z.string()).optional(),
  editControls: z
    .object({
      editTweetIds: z.array(z.string()).optional(),
      editableUntil: z.string().optional(),
      editsRemaining: z.number().optional(),
      isEditEligible: z.boolean().optional(),
    })
    .optional(),
});

export function getTweetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_get_tweet',
    description: 'Retrieve a single tweet from Twitter/X.',
    inputSchema: getTweetInputSchema,
    outputSchema: getTweetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTweetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.x.com/x-api/posts/retrieve-a-post-by-post-id
      const response = await platformProxy.get({
        endpoint: `/2/tweets/${input.id}`,
        params: {
          'tweet.fields':
            'author_id,created_at,public_metrics,lang,source,possibly_sensitive,reply_settings,conversation_id,in_reply_to_user_id,referenced_tweets,edit_history_tweet_ids,edit_controls',
        },
        retries: 3,
      });

      if (!response.data || !response.data.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Tweet not found',
          id: input.id,
        });
      }

      const providerTweet = ProviderTweetSchema.parse(response.data.data);

      return {
        id: providerTweet.id,
        text: providerTweet.text,
        ...(providerTweet.author_id !== undefined && { authorId: providerTweet.author_id }),
        ...(providerTweet.created_at !== undefined && { createdAt: providerTweet.created_at }),
        ...(providerTweet.public_metrics !== undefined && {
          publicMetrics: {
            ...(providerTweet.public_metrics.retweet_count !== undefined && {
              retweetCount: providerTweet.public_metrics.retweet_count,
            }),
            ...(providerTweet.public_metrics.reply_count !== undefined && {
              replyCount: providerTweet.public_metrics.reply_count,
            }),
            ...(providerTweet.public_metrics.like_count !== undefined && {
              likeCount: providerTweet.public_metrics.like_count,
            }),
            ...(providerTweet.public_metrics.quote_count !== undefined && {
              quoteCount: providerTweet.public_metrics.quote_count,
            }),
            ...(providerTweet.public_metrics.bookmark_count !== undefined && {
              bookmarkCount: providerTweet.public_metrics.bookmark_count,
            }),
            ...(providerTweet.public_metrics.impression_count !== undefined && {
              impressionCount: providerTweet.public_metrics.impression_count,
            }),
          },
        }),
        ...(providerTweet.lang !== undefined && { lang: providerTweet.lang }),
        ...(providerTweet.source !== undefined && { source: providerTweet.source }),
        ...(providerTweet.possibly_sensitive !== undefined && { possiblySensitive: providerTweet.possibly_sensitive }),
        ...(providerTweet.reply_settings !== undefined && { replySettings: providerTweet.reply_settings }),
        ...(providerTweet.conversation_id !== undefined && { conversationId: providerTweet.conversation_id }),
        ...(providerTweet.in_reply_to_user_id !== undefined && { inReplyToUserId: providerTweet.in_reply_to_user_id }),
        ...(providerTweet.referenced_tweets !== undefined && {
          referencedTweets: providerTweet.referenced_tweets.map(rt => ({
            type: rt.type,
            id: rt.id,
          })),
        }),
        ...(providerTweet.edit_history_tweet_ids !== undefined && {
          editHistoryTweetIds: providerTweet.edit_history_tweet_ids,
        }),
        ...(providerTweet.edit_controls !== undefined && {
          editControls: {
            ...(providerTweet.edit_controls.edit_tweet_ids !== undefined && {
              editTweetIds: providerTweet.edit_controls.edit_tweet_ids,
            }),
            ...(providerTweet.edit_controls.editable_until !== undefined && {
              editableUntil: providerTweet.edit_controls.editable_until,
            }),
            ...(providerTweet.edit_controls.edits_remaining !== undefined && {
              editsRemaining: providerTweet.edit_controls.edits_remaining,
            }),
            ...(providerTweet.edit_controls.is_edit_eligible !== undefined && {
              isEditEligible: providerTweet.edit_controls.is_edit_eligible,
            }),
          },
        }),
      };
    },
  });
}
