// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createCommentReactionInputSchema = z.object({
  file_key: z.string().describe('The key of the file containing the comment. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  comment_id: z.string().describe('The ID of the comment to react to. Example: "1774450119"'),
  emoji: z.string().describe('The emoji shortcode for the reaction. Example: ":thumbsup:"'),
});

const ProviderResponseSchema = z.object({
  status: z.number(),
  error: z.boolean(),
});

export const createCommentReactionOutputSchema = z.object({
  status: z.number(),
  error: z.boolean(),
});

export function createCommentReactionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_create_comment_reaction',
    description: 'Add a reaction emoji to a comment in Figma.',
    inputSchema: createCommentReactionInputSchema,
    outputSchema: createCommentReactionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCommentReactionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.figma.com/docs/rest-api/comments-endpoints/#post-comment-reactions-endpoint
      const response = await platformProxy.post({
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/comments/${encodeURIComponent(input.comment_id)}/reactions`,
        data: {
          emoji: input.emoji,
        },
        retries: 1,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        status: providerResponse.status,
        error: providerResponse.error,
      };
    },
  });
}
