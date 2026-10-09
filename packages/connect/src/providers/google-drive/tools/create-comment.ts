// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createCommentInputSchema = z.object({
  fileId: z
    .string()
    .describe('The ID of the file to comment on. Example: "1zpWYuzY5S65OUGNBZQXmJf4FZnIWLJHBkC2xBamBzvw"'),
  content: z.string().describe('The plain text content of the comment. Example: "This is a test comment."'),
  anchor: z
    .string()
    .optional()
    .describe(
      'A region of the document represented as a JSON string for anchored comments. Example: "{\\"r\\":\\"revision_id\\",\\"a\\":[{\\"line\\":{\\"end\\":\\"1\\"}}]}"',
    ),
});

export const createCommentOutputSchema = z.object({
  id: z.string().describe('The ID of the comment.'),
  content: z.string().describe('The plain text content of the comment.'),
  createdTime: z.string().describe('The time when the comment was created (RFC 3339 date-time).'),
  modifiedTime: z.string().describe('The time when the comment was last modified (RFC 3339 date-time).'),
  author: z
    .object({
      displayName: z.string().optional().describe('The display name of the author.'),
      emailAddress: z.string().optional().describe('The email address of the author.'),
    })
    .passthrough()
    .optional()
    .describe('The author of the comment.'),
  resolved: z.boolean().describe('Whether the comment has been resolved.'),
  deleted: z.boolean().describe('Whether the comment has been deleted.'),
});

export function createCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_create_comment',
    description: 'Add a comment to a file',
    inputSchema: createCommentInputSchema,
    outputSchema: createCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: { content: string; anchor?: string } = {
        content: input.content,
      };

      if (input.anchor) {
        requestBody.anchor = input.anchor;
      }

      // https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/create
      const response = await platformProxy.post({
        endpoint: `/drive/v3/files/${input.fileId}/comments`,
        params: {
          fields: 'id,content,createdTime,modifiedTime,author,resolved,deleted',
        },
        data: requestBody,
        retries: 3,
      });

      const comment = response.data;

      return {
        id: comment.id,
        content: comment.content,
        createdTime: comment.createdTime,
        modifiedTime: comment.modifiedTime,
        author: comment.author
          ? {
              displayName: comment.author.displayName,
              emailAddress: comment.author.emailAddress,
            }
          : undefined,
        resolved: comment.resolved ?? false,
        deleted: comment.deleted ?? false,
      };
    },
  });
}
