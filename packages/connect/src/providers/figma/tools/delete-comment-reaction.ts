// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteCommentReactionInputSchema = z.object({
  file_key: z
    .string()
    .describe('File key of the file to delete the comment reaction from. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  comment_id: z.string().describe('ID of the comment to delete the reaction from. Example: "1774450119"'),
  emoji: z.string().describe('Emoji shortcode of the reaction to delete. Example: ":thumbsup:"'),
});

const ProviderResponseSchema = z.object({
  status: z.number().optional(),
  error: z.boolean().nullable().optional(),
});

export const deleteCommentReactionOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteCommentReactionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_delete_comment_reaction',
    description: 'Remove a reaction from a comment in Figma.',
    inputSchema: deleteCommentReactionInputSchema,
    outputSchema: deleteCommentReactionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCommentReactionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.figma.com/developers/api#delete-comment-reaction
      const response = await platformProxy.delete({
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/comments/${encodeURIComponent(input.comment_id)}/reactions`,
        params: {
          emoji: input.emoji,
        },
        retries: 1,
      });

      const providerResponse = ProviderResponseSchema.safeParse(response.data);

      if (!providerResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response from Figma API when deleting comment reaction',
          details: providerResponse.error.message,
        });
      }

      return {
        success: true,
      };
    },
  });
}
