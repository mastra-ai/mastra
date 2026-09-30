// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteCommentInputSchema = z.object({
  fileId: z
    .string()
    .describe('The ID of the file containing the comment. Example: "1oD5i7NbLYQ6_mzEjNIXSqFvKXvvRNETwkfLrlDooFV0"'),
  commentId: z.string().describe('The ID of the comment to delete. Example: "AAAB1rDkxSA"'),
});

export const deleteCommentOutputSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  fileId: z.string().describe('The ID of the file from which the comment was deleted'),
  commentId: z.string().describe('The ID of the deleted comment'),
});

export function deleteCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_delete_comment',
    description: 'Delete a comment from a file',
    inputSchema: deleteCommentInputSchema,
    outputSchema: deleteCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/delete
      await platformProxy.delete({
        endpoint: `drive/v3/files/${input.fileId}/comments/${input.commentId}`,
        retries: 3,
      });

      return {
        success: true,
        fileId: input.fileId,
        commentId: input.commentId,
      };
    },
  });
}
