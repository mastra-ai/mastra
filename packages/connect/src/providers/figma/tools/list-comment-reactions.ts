// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCommentReactionsInputSchema = z.object({
  file_key: z.string().describe('File key or branch key. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  comment_id: z.string().describe('Comment ID. Example: "1774450119"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const UserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  img_url: z.string(),
});

const ReactionSchema = z.object({
  user: UserSchema,
  emoji: z.string(),
  created_at: z.string(),
});

export const listCommentReactionsOutputSchema = z.object({
  reactions: z.array(ReactionSchema),
  next_cursor: z.string().optional(),
});

const ProviderPaginationSchema = z.object({
  prev_page: z.string().optional(),
  next_page: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  reactions: z.array(ReactionSchema),
  pagination: ProviderPaginationSchema,
});

export function listCommentReactionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_list_comment_reactions',
    description: 'List reactions on a Figma comment.',
    inputSchema: listCommentReactionsInputSchema,
    outputSchema: listCommentReactionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCommentReactionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.figma.com/docs/rest-api/comments-endpoints/
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/comments/${encodeURIComponent(input.comment_id)}/reactions`,
        params: {
          ...(input.cursor !== undefined && { cursor: input.cursor }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      let next_cursor: string | undefined;
      if (providerResponse.pagination.next_page) {
        const url = new URL(providerResponse.pagination.next_page, 'https://api.figma.com');
        const cursor = url.searchParams.get('cursor');
        if (cursor) {
          next_cursor = cursor;
        }
      }

      return {
        reactions: providerResponse.reactions,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
