// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getUserInputSchema = z.object({
  id: z.string().describe('The ID of the User to lookup. Example: "2244994945"'),
});

const ProviderPublicMetricsSchema = z
  .object({
    followers_count: z.number().optional(),
    following_count: z.number().optional(),
    tweet_count: z.number().optional(),
    listed_count: z.number().optional(),
    like_count: z.number().optional(),
  })
  .optional();

const ProviderUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  created_at: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  profile_image_url: z.string().optional(),
  protected: z.boolean().optional(),
  public_metrics: ProviderPublicMetricsSchema,
  url: z.string().optional(),
  verified: z.boolean().optional(),
  verified_type: z.string().optional(),
  subscription_type: z.string().optional(),
  pinned_tweet_id: z.string().optional(),
  most_recent_tweet_id: z.string().optional(),
});

export const getUserOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  created_at: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  profile_image_url: z.string().optional(),
  protected: z.boolean().optional(),
  public_metrics: ProviderPublicMetricsSchema,
  url: z.string().optional(),
  verified: z.boolean().optional(),
  verified_type: z.string().optional(),
  subscription_type: z.string().optional(),
  pinned_tweet_id: z.string().optional(),
  most_recent_tweet_id: z.string().optional(),
});

export function getUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_get_user',
    description: 'Retrieve a single user from Twitter/X',
    inputSchema: getUserInputSchema,
    outputSchema: getUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.x.com/x-api/users/user-lookup/api-reference/get-users-id
      const response = await platformProxy.get({
        endpoint: `/2/users/${input.id}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'User not found',
          id: input.id,
        });
      }

      const userData = z.object({ data: ProviderUserSchema }).parse(response.data);
      const user = userData.data;

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        ...(user.created_at !== undefined && { created_at: user.created_at }),
        ...(user.description !== undefined && { description: user.description }),
        ...(user.location !== undefined && { location: user.location }),
        ...(user.profile_image_url !== undefined && { profile_image_url: user.profile_image_url }),
        ...(user.protected !== undefined && { protected: user.protected }),
        ...(user.public_metrics !== undefined && { public_metrics: user.public_metrics }),
        ...(user.url !== undefined && { url: user.url }),
        ...(user.verified !== undefined && { verified: user.verified }),
        ...(user.verified_type !== undefined && { verified_type: user.verified_type }),
        ...(user.subscription_type !== undefined && { subscription_type: user.subscription_type }),
        ...(user.pinned_tweet_id !== undefined && { pinned_tweet_id: user.pinned_tweet_id }),
        ...(user.most_recent_tweet_id !== undefined && { most_recent_tweet_id: user.most_recent_tweet_id }),
      };
    },
  });
}
