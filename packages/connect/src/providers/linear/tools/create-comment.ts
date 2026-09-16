// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createCommentInputSchema = z.object({
  issueId: z.string().describe('The ID of the Linear issue to comment on. Example: "issue-uuid"'),
  body: z.string().describe('The comment body content.'),
  parentId: z.string().optional().describe('The ID of the parent comment for threaded replies.'),
});

const ProviderCommentSchema = z.object({
  id: z.string(),
  body: z.string().nullable(),
  url: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  user: z
    .object({
      id: z.string().nullable(),
      name: z.string().nullable(),
    })
    .nullable(),
  issue: z
    .object({
      id: z.string().nullable(),
      identifier: z.string().nullable(),
    })
    .nullable(),
  parent: z
    .object({
      id: z.string().nullable(),
    })
    .nullable(),
});

const ProviderResponseSchema = z.object({
  data: z
    .object({
      commentCreate: z.object({
        success: z.boolean().nullable(),
        comment: ProviderCommentSchema.nullable(),
      }),
    })
    .nullable(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        path: z.array(z.unknown()).optional(),
        extensions: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
});

export const createCommentOutputSchema = z.object({
  id: z.string(),
  body: z.string().optional(),
  url: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  userId: z.string().optional(),
  userName: z.string().optional(),
  issueId: z.string().optional(),
  issueIdentifier: z.string().optional(),
  parentId: z.string().optional(),
});

export function createCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_create_comment',
    description: 'Create a comment on a Linear issue.',
    inputSchema: createCommentInputSchema,
    outputSchema: createCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const mutation = `
            mutation CreateComment($input: CommentCreateInput!) {
                commentCreate(input: $input) {
                    success
                    comment {
                        id
                        body
                        url
                        createdAt
                        updatedAt
                        user {
                            id
                            name
                        }
                        issue {
                            id
                            identifier
                        }
                        parent {
                            id
                        }
                    }
                }
            }
        `;

      const variables = {
        input: {
          issueId: input.issueId,
          body: input.body,
          ...(input.parentId !== undefined && { parentId: input.parentId }),
        },
      };

      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: mutation,
          variables,
        },
        retries: 10,
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      const graphqlErrors = parsed.errors;
      if (graphqlErrors && graphqlErrors.length > 0) {
        for (const error of graphqlErrors) {
          throw new platformProxy.ActionError({
            type: 'graphql_error',
            message: error.message,
            path: error.path,
          });
        }
      }

      if (!parsed.data) {
        throw new platformProxy.ActionError({
          type: 'creation_failed',
          message: 'Failed to create comment on Linear issue: no data returned.',
        });
      }

      const commentCreate = parsed.data.commentCreate;

      if (!commentCreate.success || !commentCreate.comment) {
        throw new platformProxy.ActionError({
          type: 'creation_failed',
          message: 'Failed to create comment on Linear issue.',
        });
      }

      const comment = commentCreate.comment;

      return {
        id: comment.id,
        ...(comment.body != null && { body: comment.body }),
        ...(comment.url != null && { url: comment.url }),
        ...(comment.createdAt != null && { createdAt: comment.createdAt }),
        ...(comment.updatedAt != null && { updatedAt: comment.updatedAt }),
        ...(comment.user?.id != null && { userId: comment.user.id }),
        ...(comment.user?.name != null && { userName: comment.user.name }),
        ...(comment.issue?.id != null && { issueId: comment.issue.id }),
        ...(comment.issue?.identifier != null && { issueIdentifier: comment.issue.identifier }),
        ...(comment.parent?.id != null && { parentId: comment.parent.id }),
      };
    },
  });
}
