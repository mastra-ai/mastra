// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getCommentInputSchema = z.object({
  fileId: z.string().describe('The ID of the file containing the comment. Example: "1abc123xyz"'),
  commentId: z.string().describe('The ID of the comment to retrieve. Example: "AAAB1p01B9w"'),
});

export const getCommentOutputSchema = z.object({
  id: z.string(),
  content: z.string(),
  htmlContent: z.string(),
  createdTime: z.string(),
  modifiedTime: z.string(),
  deleted: z.boolean(),
  resolved: z.boolean().optional(),
  author: z.object({
    displayName: z.string(),
    photoLink: z.string().optional(),
    me: z.boolean(),
  }),
  replies: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      author: z.object({
        displayName: z.string(),
        me: z.boolean(),
      }),
      createdTime: z.string(),
    }),
  ),
});

export function getCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_get_comment',
    description: 'Get a comment by ID',
    inputSchema: getCommentInputSchema,
    outputSchema: getCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/get
      const response = await platformProxy.get({
        endpoint: `/drive/v3/files/${input.fileId}/comments/${input.commentId}`,
        params: {
          fields: '*',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Comment not found',
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
        deleted: comment.deleted,
        resolved: comment.resolved,
        author: {
          displayName: comment.author?.displayName || '',
          photoLink: comment.author?.photoLink || undefined,
          me: comment.author?.me || false,
        },
        replies: (comment.replies || []).map((reply: any) => ({
          id: reply.id,
          content: reply.content,
          author: {
            displayName: reply.author?.displayName || '',
            me: reply.author?.me || false,
          },
          createdTime: reply.createdTime,
        })),
      };
    },
  });
}
