// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCommentsInputSchema = z.object({
  fileId: z
    .string()
    .describe('The ID of the file to list comments for. Example: "1wwU5Dhr-6_3SHgtSQnXJ7HBPkgW-shalzdc0pfRL-Yk"'),
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
});

const AuthorSchema = z.object({
  displayName: z.string().optional(),
  kind: z.string().optional(),
  me: z.boolean().optional(),
  photoLink: z.string().optional(),
});

const CommentSchema = z.object({
  id: z.string(),
  content: z.string().optional(),
  htmlContent: z.string().optional(),
  createdTime: z.string().optional(),
  modifiedTime: z.string().optional(),
  resolved: z.boolean().optional(),
  deleted: z.boolean().optional(),
  author: AuthorSchema.optional(),
});

export const listCommentsOutputSchema = z.object({
  comments: z.array(CommentSchema),
  nextPageToken: z
    .string()
    .optional()
    .describe('The cursor for the next page of comments. Omitted if there are no more pages.'),
});

export function listCommentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_drive_list_comments',
    description: 'List comments on a file',
    inputSchema: listCommentsInputSchema,
    outputSchema: listCommentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCommentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config = {
        // https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/list
        endpoint: `drive/v3/files/${input.fileId}/comments`,
        params: {
          fields: '*',
          ...(input.cursor && { pageToken: input.cursor }),
        },
        retries: 3,
      };

      const response = await platformProxy.get(config);

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'No comments found for the specified file',
          fileId: input.fileId,
        });
      }

      const comments = (response.data.comments || []).map((comment: any) => ({
        id: comment.id,
        content: comment.content ?? undefined,
        htmlContent: comment.htmlContent ?? undefined,
        createdTime: comment.createdTime ?? undefined,
        modifiedTime: comment.modifiedTime ?? undefined,
        resolved: comment.resolved ?? undefined,
        deleted: comment.deleted ?? undefined,
        author: comment.author
          ? {
              displayName: comment.author.displayName ?? undefined,
              kind: comment.author.kind ?? undefined,
              me: comment.author.me ?? undefined,
              photoLink: comment.author.photoLink ?? undefined,
            }
          : undefined,
      }));

      return {
        comments,
        nextPageToken: response.data.nextPageToken || undefined,
      };
    },
  });
}
