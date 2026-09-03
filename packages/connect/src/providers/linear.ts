import type { ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';

import type { ProxyRequestOptions } from '../client.js';
import { MastraConnectError } from '../errors.js';
import type { ProviderToolsOptions } from '../toolset.js';
import { applyAllowTools, defineProxyTool } from '../toolset.js';

const ENV_VAR = 'MASTRA_LINEAR_CONNECTION_ID';

// Linear's API is GraphQL-only: every tool POSTs a curated query/mutation to
// the proxy path `graphql`.
function graphql(query: string, variables: Record<string, unknown>): ProxyRequestOptions {
  return { method: 'POST', path: 'graphql', body: { query, variables } };
}

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: { message?: string }[];
}

/** Unwraps a GraphQL response; GraphQL errors arrive in a 200 body and must still throw. */
function unwrap(raw: unknown): Record<string, unknown> {
  const response = (raw ?? {}) as GraphQLResponse;
  if (Array.isArray(response.errors) && response.errors.length > 0) {
    const message = response.errors
      .map(error => (typeof error?.message === 'string' ? error.message : 'Unknown GraphQL error'))
      .join('; ');
    throw new MastraConnectError('proxy_error', `Linear GraphQL error: ${message}`, { detail: message });
  }
  if (!response.data || typeof response.data !== 'object') {
    throw new MastraConnectError('proxy_error', 'Linear returned an empty GraphQL response.');
  }
  return response.data;
}

const issueFields = `
  id
  identifier
  title
  description
  priority
  url
  createdAt
  updatedAt
  state { id name type }
  assignee { id name }
  team { id key name }
`;

const issueSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.number().nullable(),
  url: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  state: z.object({ id: z.string(), name: z.string(), type: z.string() }).nullable(),
  assignee: z.object({ id: z.string(), name: z.string() }).nullable(),
  team: z.object({ id: z.string(), key: z.string(), name: z.string() }).nullable(),
});

type Issue = z.infer<typeof issueSchema>;

function shapeIssue(node: Record<string, unknown>): Issue {
  const state = node.state as { id?: string; name?: string; type?: string } | null | undefined;
  const assignee = node.assignee as { id?: string; name?: string } | null | undefined;
  const team = node.team as { id?: string; key?: string; name?: string } | null | undefined;
  return {
    id: String(node.id ?? ''),
    identifier: String(node.identifier ?? ''),
    title: String(node.title ?? ''),
    description: typeof node.description === 'string' ? node.description : null,
    priority: typeof node.priority === 'number' ? node.priority : null,
    url: String(node.url ?? ''),
    createdAt: String(node.createdAt ?? ''),
    updatedAt: String(node.updatedAt ?? ''),
    state: state?.id ? { id: state.id, name: state.name ?? '', type: state.type ?? '' } : null,
    assignee: assignee?.id ? { id: assignee.id, name: assignee.name ?? '' } : null,
    team: team?.id ? { id: team.id, key: team.key ?? '', name: team.name ?? '' } : null,
  };
}

function nodesOf(data: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const connection = data[key] as { nodes?: unknown } | undefined;
  return Array.isArray(connection?.nodes) ? (connection.nodes as Record<string, unknown>[]) : [];
}

const pageInfoOf = (data: Record<string, unknown>, key: string): { hasNextPage: boolean; endCursor: string | null } => {
  const connection = data[key] as { pageInfo?: { hasNextPage?: unknown; endCursor?: unknown } } | undefined;
  return {
    hasNextPage: connection?.pageInfo?.hasNextPage === true,
    endCursor: typeof connection?.pageInfo?.endCursor === 'string' ? connection.pageInfo.endCursor : null,
  };
};

const paginationInput = {
  limit: z.number().int().min(1).max(50).optional().describe('Max results to return (1-50, default 25)'),
  after: z.string().optional().describe('Pagination cursor from a previous page (endCursor)'),
};

const pageInfoSchema = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });

/**
 * Curated Linear toolset executing through the platform connection proxy.
 * All tools resolve the connection from `options.connectionId` or
 * MASTRA_LINEAR_CONNECTION_ID at execute time.
 */
export function createLinearTools(options?: ProviderToolsOptions): ToolsInput {
  const context = { envVar: ENV_VAR, options };

  const tools = {
    linear_list_teams: defineProxyTool(context, {
      id: 'linear_list_teams',
      description: 'List teams in the Linear workspace with their ids, keys, and names.',
      inputSchema: z.object({ ...paginationInput }),
      outputSchema: z.object({
        teams: z.array(z.object({ id: z.string(), key: z.string(), name: z.string() })),
        pageInfo: pageInfoSchema,
      }),
      request: input =>
        graphql(
          `
            query Teams($first: Int!, $after: String) {
              teams(first: $first, after: $after) {
                nodes {
                  id
                  key
                  name
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          `,
          { first: input.limit ?? 25, after: input.after ?? null },
        ),
      transform: raw => {
        const data = unwrap(raw);
        return {
          teams: nodesOf(data, 'teams').map(node => ({
            id: String(node.id ?? ''),
            key: String(node.key ?? ''),
            name: String(node.name ?? ''),
          })),
          pageInfo: pageInfoOf(data, 'teams'),
        };
      },
    }),

    linear_list_issues: defineProxyTool(context, {
      id: 'linear_list_issues',
      description:
        'List issues in the Linear workspace, optionally filtered by team key, assignee email, or workflow state name.',
      inputSchema: z.object({
        teamKey: z.string().optional().describe('Filter by team key (e.g. "ENG")'),
        assigneeEmail: z.string().optional().describe('Filter by assignee email'),
        stateName: z.string().optional().describe('Filter by workflow state name (e.g. "In Progress")'),
        ...paginationInput,
      }),
      outputSchema: z.object({ issues: z.array(issueSchema), pageInfo: pageInfoSchema }),
      request: input => {
        const filter: Record<string, unknown> = {};
        if (input.teamKey) filter.team = { key: { eq: input.teamKey } };
        if (input.assigneeEmail) filter.assignee = { email: { eq: input.assigneeEmail } };
        if (input.stateName) filter.state = { name: { eq: input.stateName } };
        return graphql(
          `query Issues($filter: IssueFilter, $first: Int!, $after: String) {
            issues(filter: $filter, first: $first, after: $after) {
              nodes { ${issueFields} }
              pageInfo { hasNextPage endCursor }
            }
          }`,
          { filter, first: input.limit ?? 25, after: input.after ?? null },
        );
      },
      transform: raw => {
        const data = unwrap(raw);
        return { issues: nodesOf(data, 'issues').map(shapeIssue), pageInfo: pageInfoOf(data, 'issues') };
      },
    }),

    linear_get_issue: defineProxyTool(context, {
      id: 'linear_get_issue',
      description: 'Get a single Linear issue by id or identifier (e.g. "ENG-123").',
      inputSchema: z.object({
        id: z.string().describe('Issue id (UUID) or identifier like "ENG-123"'),
      }),
      outputSchema: z.object({ issue: issueSchema }),
      request: input =>
        graphql(
          `query Issue($id: String!) {
            issue(id: $id) { ${issueFields} }
          }`,
          { id: input.id },
        ),
      transform: raw => {
        const data = unwrap(raw);
        const issue = data.issue as Record<string, unknown> | null | undefined;
        if (!issue) {
          throw new MastraConnectError('proxy_error', 'Linear issue not found.');
        }
        return { issue: shapeIssue(issue) };
      },
    }),

    linear_search_issues: defineProxyTool(context, {
      id: 'linear_search_issues',
      description: 'Full-text search Linear issues by title and description.',
      inputSchema: z.object({
        query: z.string().describe('Search terms'),
        ...paginationInput,
      }),
      outputSchema: z.object({ issues: z.array(issueSchema), pageInfo: pageInfoSchema }),
      request: input =>
        graphql(
          `query SearchIssues($term: String!, $first: Int!, $after: String) {
            searchIssues(term: $term, first: $first, after: $after) {
              nodes { ${issueFields} }
              pageInfo { hasNextPage endCursor }
            }
          }`,
          { term: input.query, first: input.limit ?? 25, after: input.after ?? null },
        ),
      transform: raw => {
        const data = unwrap(raw);
        return {
          issues: nodesOf(data, 'searchIssues').map(shapeIssue),
          pageInfo: pageInfoOf(data, 'searchIssues'),
        };
      },
    }),

    linear_create_issue: defineProxyTool(context, {
      id: 'linear_create_issue',
      description: 'Create a Linear issue in a team.',
      inputSchema: z.object({
        teamId: z.string().describe('Team id (from linear_list_teams)'),
        title: z.string().describe('Issue title'),
        description: z.string().optional().describe('Issue description (Markdown)'),
        assigneeId: z.string().optional().describe('Assignee user id (from linear_list_users)'),
        priority: z
          .number()
          .int()
          .min(0)
          .max(4)
          .optional()
          .describe('Priority: 0 none, 1 urgent, 2 high, 3 normal, 4 low'),
        stateId: z.string().optional().describe('Workflow state id'),
      }),
      outputSchema: z.object({ issue: issueSchema }),
      request: input =>
        graphql(
          `mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue { ${issueFields} }
            }
          }`,
          {
            input: {
              teamId: input.teamId,
              title: input.title,
              description: input.description,
              assigneeId: input.assigneeId,
              priority: input.priority,
              stateId: input.stateId,
            },
          },
        ),
      transform: raw => {
        const data = unwrap(raw);
        const payload = data.issueCreate as { success?: unknown; issue?: Record<string, unknown> } | undefined;
        if (payload?.success !== true || !payload.issue) {
          throw new MastraConnectError('proxy_error', 'Linear issue creation failed.');
        }
        return { issue: shapeIssue(payload.issue) };
      },
    }),

    linear_update_issue: defineProxyTool(context, {
      id: 'linear_update_issue',
      description: 'Update a Linear issue (title, description, assignee, priority, or workflow state).',
      inputSchema: z.object({
        id: z.string().describe('Issue id (UUID)'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description (Markdown)'),
        assigneeId: z.string().optional().describe('New assignee user id'),
        priority: z
          .number()
          .int()
          .min(0)
          .max(4)
          .optional()
          .describe('Priority: 0 none, 1 urgent, 2 high, 3 normal, 4 low'),
        stateId: z.string().optional().describe('New workflow state id'),
      }),
      outputSchema: z.object({ issue: issueSchema }),
      request: input =>
        graphql(
          `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              success
              issue { ${issueFields} }
            }
          }`,
          {
            id: input.id,
            input: {
              title: input.title,
              description: input.description,
              assigneeId: input.assigneeId,
              priority: input.priority,
              stateId: input.stateId,
            },
          },
        ),
      transform: raw => {
        const data = unwrap(raw);
        const payload = data.issueUpdate as { success?: unknown; issue?: Record<string, unknown> } | undefined;
        if (payload?.success !== true || !payload.issue) {
          throw new MastraConnectError('proxy_error', 'Linear issue update failed.');
        }
        return { issue: shapeIssue(payload.issue) };
      },
    }),

    linear_add_comment: defineProxyTool(context, {
      id: 'linear_add_comment',
      description: 'Add a comment to a Linear issue.',
      inputSchema: z.object({
        issueId: z.string().describe('Issue id (UUID)'),
        body: z.string().describe('Comment body (Markdown)'),
      }),
      outputSchema: z.object({
        comment: z.object({ id: z.string(), body: z.string(), url: z.string() }),
      }),
      request: input =>
        graphql(
          `
            mutation AddComment($input: CommentCreateInput!) {
              commentCreate(input: $input) {
                success
                comment {
                  id
                  body
                  url
                }
              }
            }
          `,
          { input: { issueId: input.issueId, body: input.body } },
        ),
      transform: raw => {
        const data = unwrap(raw);
        const payload = data.commentCreate as
          | { success?: unknown; comment?: { id?: unknown; body?: unknown; url?: unknown } }
          | undefined;
        if (payload?.success !== true || !payload.comment) {
          throw new MastraConnectError('proxy_error', 'Linear comment creation failed.');
        }
        return {
          comment: {
            id: String(payload.comment.id ?? ''),
            body: String(payload.comment.body ?? ''),
            url: String(payload.comment.url ?? ''),
          },
        };
      },
    }),

    linear_list_projects: defineProxyTool(context, {
      id: 'linear_list_projects',
      description: 'List projects in the Linear workspace.',
      inputSchema: z.object({ ...paginationInput }),
      outputSchema: z.object({
        projects: z.array(z.object({ id: z.string(), name: z.string(), state: z.string(), url: z.string() })),
        pageInfo: pageInfoSchema,
      }),
      request: input =>
        graphql(
          `
            query Projects($first: Int!, $after: String) {
              projects(first: $first, after: $after) {
                nodes {
                  id
                  name
                  state
                  url
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          `,
          { first: input.limit ?? 25, after: input.after ?? null },
        ),
      transform: raw => {
        const data = unwrap(raw);
        return {
          projects: nodesOf(data, 'projects').map(node => ({
            id: String(node.id ?? ''),
            name: String(node.name ?? ''),
            state: String(node.state ?? ''),
            url: String(node.url ?? ''),
          })),
          pageInfo: pageInfoOf(data, 'projects'),
        };
      },
    }),

    linear_list_users: defineProxyTool(context, {
      id: 'linear_list_users',
      description: 'List users in the Linear workspace with their ids, names, and emails.',
      inputSchema: z.object({ ...paginationInput }),
      outputSchema: z.object({
        users: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), active: z.boolean() })),
        pageInfo: pageInfoSchema,
      }),
      request: input =>
        graphql(
          `
            query Users($first: Int!, $after: String) {
              users(first: $first, after: $after) {
                nodes {
                  id
                  name
                  email
                  active
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          `,
          { first: input.limit ?? 25, after: input.after ?? null },
        ),
      transform: raw => {
        const data = unwrap(raw);
        return {
          users: nodesOf(data, 'users').map(node => ({
            id: String(node.id ?? ''),
            name: String(node.name ?? ''),
            email: String(node.email ?? ''),
            active: node.active === true,
          })),
          pageInfo: pageInfoOf(data, 'users'),
        };
      },
    }),
  } satisfies ToolsInput;

  return applyAllowTools(tools, options?.allowTools);
}
