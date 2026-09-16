// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchIssuesInputSchema = z.object({
  term: z.string().describe('Full-text search term. Example: "login bug"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  limit: z.number().int().min(1).max(100).optional().describe('Number of results per page. Default: 50.'),
});

const AssigneeSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

const StateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

const TeamSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  key: z.string().optional(),
});

const IssueSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  priority: z.number().optional().nullable(),
  priorityLabel: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
  assignee: AssigneeSchema.nullable().optional(),
  state: StateSchema.nullable().optional(),
  team: TeamSchema.nullable().optional(),
});

const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().optional().nullable(),
});

const SearchIssuesResponseSchema = z.object({
  data: z.object({
    searchIssues: z.object({
      nodes: z.array(IssueSchema),
      pageInfo: PageInfoSchema,
    }),
  }),
});

const OutputItemSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.number().optional(),
  priorityLabel: z.string().optional(),
  url: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  assignee: z
    .object({
      id: z.string(),
      name: z.string().optional(),
    })
    .optional(),
  state: z
    .object({
      id: z.string(),
      name: z.string().optional(),
    })
    .optional(),
  team: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      key: z.string().optional(),
    })
    .optional(),
});

export const searchIssuesOutputSchema = z.object({
  items: z.array(OutputItemSchema),
  nextCursor: z.string().optional(),
});

export function searchIssuesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_search_issues',
    description: 'Search Linear issues with full-text query support.',
    inputSchema: searchIssuesInputSchema,
    outputSchema: searchIssuesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchIssuesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const limit = input.limit ?? 50;

      const query = `
            query SearchIssues($term: String!, $first: Int, $after: String) {
                searchIssues(term: $term, first: $first, after: $after) {
                    nodes {
                        id
                        identifier
                        title
                        description
                        priority
                        priorityLabel
                        url
                        createdAt
                        updatedAt
                        assignee {
                            id
                            name
                        }
                        state {
                            id
                            name
                        }
                        team {
                            id
                            name
                            key
                        }
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        `;

      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query,
          variables: {
            term: input.term,
            first: limit,
            ...(input.cursor !== undefined && { after: input.cursor }),
          },
        },
        retries: 3,
      });

      const parsed = SearchIssuesResponseSchema.parse(response.data);
      const searchIssues = parsed.data.searchIssues;

      return {
        items: searchIssues.nodes.map(issue => ({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          ...(issue.description != null && { description: issue.description }),
          ...(issue.priority != null && { priority: issue.priority }),
          ...(issue.priorityLabel != null && { priorityLabel: issue.priorityLabel }),
          ...(issue.url != null && { url: issue.url }),
          ...(issue.createdAt != null && { createdAt: issue.createdAt }),
          ...(issue.updatedAt != null && { updatedAt: issue.updatedAt }),
          ...(issue.assignee != null && {
            assignee: {
              id: issue.assignee.id,
              ...(issue.assignee.name != null && { name: issue.assignee.name }),
            },
          }),
          ...(issue.state != null && {
            state: {
              id: issue.state.id,
              ...(issue.state.name != null && { name: issue.state.name }),
            },
          }),
          ...(issue.team != null && {
            team: {
              id: issue.team.id,
              ...(issue.team.name != null && { name: issue.team.name }),
              ...(issue.team.key != null && { key: issue.team.key }),
            },
          }),
        })),
        ...(searchIssues.pageInfo.endCursor != null &&
          searchIssues.pageInfo.hasNextPage && { nextCursor: searchIssues.pageInfo.endCursor }),
      };
    },
  });
}
