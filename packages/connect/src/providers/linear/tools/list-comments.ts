// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCommentsInputSchema = z.object({
  first: z.number().optional().describe('Number of items to return. Defaults to 50.'),
  after: z.string().optional().describe('Cursor for forward pagination.'),
  filter: z.record(z.string(), z.unknown()).optional().describe('Comment filter object.'),
  orderBy: z.string().optional().describe('Order by field, e.g. "createdAt" or "updatedAt".'),
});

const UserSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
});

const IssueSchema = z.object({
  id: z.string(),
  identifier: z.string().optional(),
  title: z.string().optional(),
});

const ParentSchema = z.object({
  id: z.string(),
});

const CommentSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  url: z.string(),
  user: UserSchema.nullable().optional(),
  issue: IssueSchema.nullable().optional(),
  parent: ParentSchema.nullable().optional(),
  editedAt: z.string().nullable().optional(),
});

const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable().optional(),
  hasPreviousPage: z.boolean(),
  startCursor: z.string().nullable().optional(),
});

export const listCommentsOutputSchema = z.object({
  items: z.array(CommentSchema),
  nextCursor: z.string().optional(),
  pageInfo: PageInfoSchema,
});

const GraphQLResponseSchema = z.object({
  data: z.object({
    comments: z.object({
      nodes: z.array(CommentSchema),
      pageInfo: PageInfoSchema,
    }),
  }),
});

export function listCommentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_list_comments',
    description: 'List Linear comments with filtering and pagination.',
    inputSchema: listCommentsInputSchema,
    outputSchema: listCommentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCommentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = `
            query Comments($first: Int, $after: String, $filter: CommentFilter, $orderBy: PaginationOrderBy) {
                comments(first: $first, after: $after, filter: $filter, orderBy: $orderBy) {
                    nodes {
                        id
                        body
                        createdAt
                        updatedAt
                        url
                        user {
                            id
                            name
                            email
                        }
                        issue {
                            id
                            identifier
                            title
                        }
                        parent {
                            id
                        }
                        editedAt
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                        hasPreviousPage
                        startCursor
                    }
                }
            }
        `;

      const variables: { first?: number; after?: string; filter?: Record<string, unknown>; orderBy?: string } = {};
      if (input.first !== undefined) {
        variables.first = input.first;
      }
      if (input.after !== undefined) {
        variables.after = input.after;
      }
      if (input.filter !== undefined) {
        variables.filter = input.filter;
      }
      if (input.orderBy !== undefined) {
        variables.orderBy = input.orderBy;
      }

      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query,
          variables,
        },
        retries: 3,
      });

      const parsed = GraphQLResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Failed to parse Linear GraphQL response',
          details: parsed.error.message,
        });
      }

      const comments = parsed.data.data.comments;

      return {
        items: comments.nodes,
        nextCursor: comments.pageInfo.endCursor ?? undefined,
        pageInfo: comments.pageInfo,
      };
    },
  });
}
