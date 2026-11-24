// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createTweetInputSchema = z.object({
  text: z.string().max(280).describe('The text content of the tweet. Maximum 280 characters.'),
  replyToTweetId: z
    .string()
    .optional()
    .describe('The ID of the tweet to reply to. If provided, creates a reply tweet.'),
  quoteTweetId: z.string().optional().describe('The ID of the tweet to quote. If provided, creates a quote tweet.'),
  mediaIds: z
    .array(z.string())
    .optional()
    .describe('Media IDs for media attachments to include in the tweet (from the upload endpoint).'),
});

const ProviderCreateResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    text: z.string(),
  }),
  errors: z
    .array(
      z.object({
        message: z.string(),
        field: z.string().optional(),
      }),
    )
    .optional(),
});

export const createTweetOutputSchema = z.object({
  id: z.string().describe('The unique identifier of the created tweet.'),
  text: z.string().describe('The text content of the created tweet.'),
});

export function createTweetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_create_tweet',
    description: 'Create a tweet in Twitter/X.',
    inputSchema: createTweetInputSchema,
    outputSchema: createTweetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createTweetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const payload: Record<string, unknown> = {
        text: input.text,
      };

      if (input.replyToTweetId !== undefined) {
        payload['reply'] = {
          in_reply_to_tweet_id: input.replyToTweetId,
        };
      }

      if (input.quoteTweetId !== undefined) {
        payload['quote_tweet_id'] = input.quoteTweetId;
      }

      if (input.mediaIds !== undefined && input.mediaIds.length > 0) {
        payload['media'] = {
          media_ids: input.mediaIds,
        };
      }

      // https://developer.x.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets
      const response = await platformProxy.post({
        endpoint: '/2/tweets',
        data: payload,
        retries: 1,
      });

      if (response.status !== 200 && response.status !== 201) {
        const parsed = ProviderCreateResponseSchema.safeParse(response.data);
        const errors = parsed.success ? parsed.data.errors : undefined;
        if (errors && errors.length > 0) {
          throw new platformProxy.ActionError({
            type: 'api_error',
            message: errors[0]?.message || 'Failed to create tweet',
            errors,
          });
        }
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: `Failed to create tweet. Status: ${response.status}`,
        });
      }

      const providerResponse = ProviderCreateResponseSchema.parse(response.data);
      const tweetData = providerResponse.data;

      return {
        id: tweetData.id,
        text: tweetData.text,
      };
    },
  });
}
