// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateCommentInputSchema = z.object({
  fileId: z
    .string()
    .describe('The ID of the file containing the comment. Example: "1mlzflxHXQkoCj-3p1T_O762TNAfGGr_iIb5C9uwnIwk"'),
  commentId: z.string().describe('The ID of the comment to update. Example: "AAAB1pvq854"'),
  content: z.string().describe('The new plain text content of the comment. Example: "Updated comment text"'),
  resolved: z.boolean().optional().describe('Whether the comment is resolved. Optional.'),
});

export const updateCommentOutputSchema = z.object({
  id: z.string(),
  content: z.string(),
  htmlContent: z.string(),
  createdTime: z.string(),
  modifiedTime: z.string(),
  author: z.object({
    displayName: z.string(),
    kind: z.string(),
    me: z.boolean(),
    photoLink: z.string().optional(),
  }),
  deleted: z.boolean(),
  resolved: z.boolean().optional(),
  replies: z.array(z.object({})).optional(),
});

export function updateCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_update_comment',
    description: 'Update a comment on a file',
    inputSchema: updateCommentInputSchema,
    outputSchema: updateCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/update
      const response = await platformProxy.patch({
        endpoint: `/drive/v3/files/${input.fileId}/comments/${input.commentId}`,
        params: {
          fields: '*',
        },
        data: {
          content: input.content,
          ...(input.resolved !== undefined && { resolved: input.resolved }),
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Comment not found or could not be updated',
          fileId: input.fileId,
          commentId: input.commentId,
        });
      }

      const comment = response.data;

      return {
        id: comment.id,
        content: comment.content,
        htmlContent: comment.htmlContent,
        createdTime: comment.createdTime,
        modifiedTime: comment.modifiedTime,
        author: comment.author,
        deleted: comment.deleted,
        resolved: comment.resolved,
        replies: comment.replies || [],
      };
    },
  });
}
