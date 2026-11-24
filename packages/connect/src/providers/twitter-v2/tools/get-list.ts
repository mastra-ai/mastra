// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getListInputSchema = z.object({
  id: z.string().describe('The ID of the List to lookup. Example: "1355797419175383040"'),
});

const ProviderListSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string().optional(),
  description: z.string().nullable().optional(),
  follower_count: z.number().optional(),
  member_count: z.number().optional(),
  owner_id: z.string().optional(),
  private: z.boolean().optional(),
});

export const getListOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string().optional(),
  description: z.string().optional(),
  follower_count: z.number().optional(),
  member_count: z.number().optional(),
  owner_id: z.string().optional(),
  private: z.boolean().optional(),
});

export function getListTool(proxy: PlatformProxy) {
  return createTool({
    id: 'twitter_v2_get_list',
    description: 'Retrieve a single list from Twitter/X',
    inputSchema: getListInputSchema,
    outputSchema: getListOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getListOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.x.com/en/docs/twitter-api/lists/list-lookup/api-reference/get-lists-id
      const response = await platformProxy.get({
        endpoint: `/2/lists/${input.id}`,
        params: {
          'list.fields': 'created_at,description,follower_count,member_count,owner_id,private',
        },
        retries: 3,
      });

      if (!response.data || !response.data.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'List not found',
          id: input.id,
        });
      }

      const list = ProviderListSchema.parse(response.data.data);

      return {
        id: list.id,
        name: list.name,
        ...(list.created_at !== undefined && { created_at: list.created_at }),
        ...(list.description != null && list.description !== undefined && { description: list.description }),
        ...(list.follower_count !== undefined && { follower_count: list.follower_count }),
        ...(list.member_count !== undefined && { member_count: list.member_count }),
        ...(list.owner_id !== undefined && { owner_id: list.owner_id }),
        ...(list.private !== undefined && { private: list.private }),
      };
    },
  });
}
