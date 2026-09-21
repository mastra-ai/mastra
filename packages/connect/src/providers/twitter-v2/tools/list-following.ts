// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listFollowingInputSchema = z.object({
  user_id: z.string().describe('The user ID whose following list to retrieve. Example: "2244994945"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination token from the previous response (meta.next_token). Omit for the first page.'),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum number of results per page (1-1000). Default: 100.'),
  user_fields: z
    .string()
    .optional()
    .describe(
      'Comma-separated list of User fields to return. Example: "username,verified,public_metrics,description".',
    ),
});

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
  .passthrough();

const MetaSchema = z
  .object({
    result_count: z.number().int().optional(),
    next_token: z.string().optional(),
    previous_token: z.string().optional(),
  })
  .passthrough()
  .optional();

const ProviderResponseSchema = z
  .object({
    data: z.array(UserSchema).optional(),
    meta: MetaSchema,
  })
  .passthrough();

export const listFollowingOutputSchema = z.object({
  items: z.array(UserSchema),
  next_cursor: z.string().optional(),
  previous_cursor: z.string().optional(),
  result_count: z.number().int(),
});

export function listFollowingTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_list_following',
    description: 'List the users a specified Twitter/X user is following.',
    inputSchema: listFollowingInputSchema,
    outputSchema: listFollowingOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listFollowingOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const parsedInput = await platformProxy.zodValidateInput({ zodSchema: listFollowingInputSchema, input });

      const params: Record<string, string | number> = {};

      if (parsedInput.data.max_results !== undefined) {
        params['max_results'] = parsedInput.data.max_results;
      }
      if (parsedInput.data.cursor) {
        params['pagination_token'] = parsedInput.data.cursor;
      }
      if (parsedInput.data.user_fields) {
        params['user.fields'] = parsedInput.data.user_fields;
      }

      // https://docs.x.com/x-api/users/follows/introduction
      const response = await platformProxy.get({
        endpoint: `/2/users/${encodeURIComponent(parsedInput.data.user_id)}/following`,
        params,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        items: providerResponse.data ?? [],
        next_cursor: providerResponse.meta?.next_token,
        previous_cursor: providerResponse.meta?.previous_token,
        result_count: providerResponse.meta?.result_count ?? providerResponse.data?.length ?? 0,
      };
    },
  });
}
