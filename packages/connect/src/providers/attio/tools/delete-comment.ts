// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteCommentInputSchema = z.object({
  comment_id: z.string().describe('The ID of the comment to delete. Example: "aa1dc1d9-93ac-4c6c-987e-16b6eea9aab2"'),
});

export const deleteCommentOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'attio_delete_comment',
    description: 'Delete a comment in Attio',
    inputSchema: deleteCommentInputSchema,
    outputSchema: deleteCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.attio.com/rest-api
      const response = await platformProxy.delete({
        endpoint: `/v2/comments/${input.comment_id}`,
        retries: 3,
      });

      return {
        success: response.status === 200 || response.status === 204,
      };
    },
  });
}
