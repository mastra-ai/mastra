// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listIssuesInputSchema = z.object({
  first: z.number().int().min(1).max(100).optional().describe('Number of issues to return per page. Example: 50'),
  after: z.string().optional().describe('Pagination cursor for forward pagination. Example: "eyJvcmRlciI6..."'),
  orderBy: z.string().optional().describe('Field to order by. Example: "updatedAt" or "createdAt"'),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Issue filter object. Example: { state: { type: { eq: "started" } } }'),
});

const IssueSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  priority: z.number().nullish(),
  state: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      color: z.string().nullish(),
    })
    .nullish(),
  team: z
    .object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
    })
    .nullish(),
  assignee: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string().nullish(),
    })
    .nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  url: z.string().nullish(),
});

const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.string().nullable().optional(),
  endCursor: z.string().nullable().optional(),
});

export const listIssuesOutputSchema = z.object({
  issues: z.array(IssueSchema),
  pageInfo: PageInfoSchema,
  nextCursor: z.string().optional().describe('Convenience field matching pageInfo.endCursor when hasNextPage is true'),
});

const GraphQLErrorSchema = z.object({
  message: z.string(),
});

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      issues: z.object({
        nodes: z.array(z.unknown()),
        pageInfo: PageInfoSchema,
      }),
    })
    .optional(),
  errors: z.array(GraphQLErrorSchema).optional(),
});

export function listIssuesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_list_issues',
    description: 'List Linear issues with filtering and pagination.',
    inputSchema: listIssuesInputSchema,
    outputSchema: listIssuesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIssuesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = `
            query Issues($first: Int, $after: String, $orderBy: PaginationOrderBy, $filter: IssueFilter) {
                issues(first: $first, after: $after, orderBy: $orderBy, filter: $filter) {
                    nodes {
                        id
                        identifier
                        title
                        description
                        priority
                        state {
                            id
                            name
                            type
                            color
                        }
                        team {
                            id
                            key
                            name
                        }
                        assignee {
                            id
                            name
                            email
                        }
                        createdAt
                        updatedAt
                        url
                    }
                    pageInfo {
                        hasNextPage
                        hasPreviousPage
                        startCursor
                        endCursor
                    }
                }
            }
        `;

      const variables: Record<string, unknown> = {};
      if (input.first !== undefined) {
        variables['first'] = input.first;
      }
      if (input.after !== undefined && input.after !== '') {
        variables['after'] = input.after;
      }
      if (input.orderBy !== undefined && input.orderBy !== '') {
        variables['orderBy'] = input.orderBy;
      }
      if (input.filter !== undefined && Object.keys(input.filter).length > 0) {
        variables['filter'] = input.filter;
      }

      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query,
          variables,
        },
        retries: 3,
      });

      if (response.data === undefined || response.data === null || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Received invalid or empty response from Linear GraphQL API',
        });
      }

      const parsedResponse = GraphQLResponseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Failed to parse GraphQL response structure',
          details: parsedResponse.error.issues,
        });
      }

      const responseErrors = parsedResponse.data.errors;
      if (responseErrors && responseErrors.length > 0) {
        const firstError = responseErrors.at(0);
        if (firstError) {
          throw new platformProxy.ActionError({
            type: 'graphql_error',
            message: firstError.message,
            errors: responseErrors,
          });
        }
      }

      if (!parsedResponse.data.data || !parsedResponse.data.data.issues) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Missing issues data in GraphQL response',
        });
      }

      const connection = parsedResponse.data.data.issues;

      const parsedNodes = z.array(IssueSchema).safeParse(connection.nodes);
      if (!parsedNodes.success) {
        throw new platformProxy.ActionError({
          type: 'validation_error',
          message: 'Failed to validate issue nodes from provider response',
          details: parsedNodes.error.issues,
        });
      }

      return {
        issues: parsedNodes.data,
        pageInfo: connection.pageInfo,
        ...(connection.pageInfo.hasNextPage &&
          connection.pageInfo.endCursor != null && { nextCursor: connection.pageInfo.endCursor }),
      };
    },
  });
}
