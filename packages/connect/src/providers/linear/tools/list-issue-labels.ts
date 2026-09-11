// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listIssueLabelsInputSchema = z.object({
  first: z.number().optional().describe('The number of items to forward paginate. Defaults to 50.'),
  after: z.string().optional().describe('A cursor to be used with first for forward pagination.'),
  filter: z.record(z.string(), z.unknown()).optional().describe('[Alpha] Filter returned issue labels.'),
  orderBy: z.string().optional().describe('Ordering of returned results. Example: "updatedAt", "createdAt".'),
});

const IssueLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
  isGroup: z.boolean().optional(),
  parent: z
    .object({
      id: z.string(),
    })
    .nullable()
    .optional(),
  creator: z
    .object({
      id: z.string(),
    })
    .nullable()
    .optional(),
  team: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
});

const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable().optional(),
});

export const listIssueLabelsOutputSchema = z.object({
  nodes: z.array(IssueLabelSchema),
  pageInfo: PageInfoSchema,
});

const GraphQLIssueLabelsResponseSchema = z.object({
  data: z.object({
    issueLabels: z.object({
      nodes: z.array(z.unknown()),
      pageInfo: PageInfoSchema,
    }),
  }),
});

export function listIssueLabelsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_list_issue_labels',
    description: 'List Linear issue labels with filtering and pagination.',
    inputSchema: listIssueLabelsInputSchema,
    outputSchema: listIssueLabelsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIssueLabelsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const variables: Record<string, unknown> = {};

      if (input.first !== undefined) {
        variables['first'] = input.first;
      }
      if (input.after !== undefined) {
        variables['after'] = input.after;
      }
      if (input.filter !== undefined) {
        variables['filter'] = input.filter;
      }
      if (input.orderBy !== undefined) {
        variables['orderBy'] = input.orderBy;
      }

      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query: `query IssueLabels($first: Int, $after: String, $filter: IssueLabelFilter, $orderBy: PaginationOrderBy) {
                    issueLabels(first: $first, after: $after, filter: $filter, orderBy: $orderBy) {
                        nodes {
                            id
                            name
                            color
                            description
                            createdAt
                            updatedAt
                            archivedAt
                            isGroup
                            parent {
                                id
                            }
                            creator {
                                id
                            }
                            team {
                                id
                                name
                            }
                        }
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                    }
                }`,
          variables: variables,
        },
        retries: 3,
      });

      if (!response.data || typeof response.data !== 'object') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid or missing response data from Linear GraphQL API.',
        });
      }

      const parsedResponse = GraphQLIssueLabelsResponseSchema.safeParse(response.data);

      if (!parsedResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Failed to parse GraphQL response.',
          details: parsedResponse.error.message,
        });
      }

      const nodes = parsedResponse.data.data.issueLabels.nodes;
      const pageInfo = parsedResponse.data.data.issueLabels.pageInfo;

      return {
        nodes: nodes.map(node => IssueLabelSchema.parse(node)),
        pageInfo: pageInfo,
      };
    },
  });
}
