// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listUserReactionsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
  user_id: z.string().optional().describe('User ID to show reactions for. Defaults to the authenticated user.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum number of items to return. Default is 100, max is 1000.'),
});

export const listUserReactionsOutputSchema = z.object({
  items: z.array(z.any()),
  next_cursor: z.any(),
  total: z.number().int().optional(),
  count: z.number().int().optional(),
});

export function listUserReactionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'slack_list_user_reactions',
    description: 'List items the user reacted to with cursor-based pagination',
    inputSchema: listUserReactionsInputSchema,
    outputSchema: listUserReactionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listUserReactionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://api.slack.com/methods/reactions.list
      const response = await platformProxy.get({
        endpoint: '/reactions.list',
        params: {
          ...(input.cursor && { cursor: input.cursor }),
          ...(input.user_id && { user: input.user_id }),
          ...(input.limit && { limit: input.limit.toString() }),
        },
        retries: 3,
      });

      if (!response.data || !response.data.ok) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: response.data?.error || 'Failed to fetch user reactions',
        });
      }

      const items = response.data.items || [];
      const nextCursor = response.data.response_metadata?.next_cursor || undefined;
      const paging = response.data.paging || {};

      return {
        items: items,
        next_cursor: nextCursor,
        total: paging.total,
        count: paging.count,
      };
    },
  });
}
