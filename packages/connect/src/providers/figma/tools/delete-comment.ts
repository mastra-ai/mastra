// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteCommentInputSchema = z.object({
  file_key: z.string().describe('The key of the Figma file containing the comment. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  comment_id: z.string().describe('The ID of the comment to delete. Example: "1774450194"'),
});

const ProviderDeleteResponseSchema = z.object({
  status: z.number(),
  error: z.boolean(),
});

export const deleteCommentOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_delete_comment',
    description: 'Delete a specific comment from a Figma file. Only the author of the comment can delete it.',
    inputSchema: deleteCommentInputSchema,
    outputSchema: deleteCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://developers.figma.com/docs/rest-api/comments-endpoints/
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/comments/${encodeURIComponent(input.comment_id)}`,
        retries: 1,
      });

      const providerResponse = ProviderDeleteResponseSchema.parse(response.data);
      return {
        success: providerResponse.error === false,
      };
    },
  });
}
