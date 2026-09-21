// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPullRequestsInputSchema = z.object({
  owner: z.string().describe('Repository owner. Example: "octocat"'),
  repo: z.string().describe('Repository name. Example: "Hello-World"'),
  state: z.enum(['open', 'closed', 'all']).optional().describe('Filter by state. Example: "open"'),
  head: z.string().optional().describe('Filter by head branch (format: user:branch). Example: "octocat:main"'),
  base: z.string().optional().describe('Filter by base branch. Example: "main"'),
  sort: z
    .enum(['created', 'updated', 'popularity', 'long-running'])
    .optional()
    .describe('Sort by field. Example: "created"'),
  direction: z.enum(['asc', 'desc']).optional().describe('Sort direction. Example: "desc"'),
  per_page: z.number().int().min(1).max(100).optional().describe('Items per page (max 100). Example: 30'),
  page: z.number().int().min(1).optional().describe('Page number. Example: 1'),
});

const PullRequestSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  html_url: z.string(),
  diff_url: z.string().optional(),
  patch_url: z.string().optional(),
  issue_url: z.string().optional(),
  commits_url: z.string(),
  review_comments_url: z.string(),
  review_comment_url: z.string(),
  comments_url: z.string(),
  statuses_url: z.string(),
  number: z.number(),
  state: z.enum(['open', 'closed']).or(z.string()),
  title: z.string(),
  body: z.string().nullable().optional(),
  user: z
    .object({
      login: z.string(),
      id: z.number(),
      avatar_url: z.string().optional(),
      html_url: z.string().optional(),
    })
    .optional(),
  labels: z
    .array(
      z.object({
        id: z.number().optional(),
        node_id: z.string().optional(),
        url: z.string().optional(),
        name: z.string(),
        description: z.string().nullable().optional(),
        color: z.string().optional(),
      }),
    )
    .optional(),
  assignees: z
    .array(
      z.object({
        login: z.string(),
        id: z.number(),
      }),
    )
    .optional(),
  milestone: z
    .object({
      id: z.number(),
      number: z.number(),
      title: z.string(),
      state: z.string(),
    })
    .nullable()
    .optional(),
  locked: z.boolean(),
  active_lock_reason: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable().optional(),
  merged_at: z.string().nullable().optional(),
  merge_commit_sha: z.string().nullable().optional(),
  head: z.object({
    label: z.string(),
    ref: z.string(),
    sha: z.string(),
    user: z
      .object({
        login: z.string(),
        id: z.number(),
      })
      .optional(),
    repo: z
      .object({
        id: z.number(),
        name: z.string(),
        full_name: z.string(),
      })
      .optional(),
  }),
  base: z.object({
    label: z.string(),
    ref: z.string(),
    sha: z.string(),
    user: z
      .object({
        login: z.string(),
        id: z.number(),
      })
      .optional(),
    repo: z
      .object({
        id: z.number(),
        name: z.string(),
        full_name: z.string(),
      })
      .optional(),
  }),
  draft: z.boolean(),
  author_association: z.string(),
});

export const listPullRequestsOutputSchema = z.object({
  pull_requests: z.array(PullRequestSchema),
  total_count: z.number().optional(),
});

export function listPullRequestsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_list_pull_requests',
    description: 'List pull requests for a repository with state and branch filters',
    inputSchema: listPullRequestsInputSchema,
    outputSchema: listPullRequestsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPullRequestsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.github.com/en/rest/pulls/pulls#list-pull-requests
      const response = await platformProxy.get({
        endpoint: `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls`,
        params: {
          ...(input.state !== undefined && { state: input.state }),
          ...(input.head !== undefined && { head: input.head }),
          ...(input.base !== undefined && { base: input.base }),
          ...(input.sort !== undefined && { sort: input.sort }),
          ...(input.direction !== undefined && { direction: input.direction }),
          ...(input.per_page !== undefined && { per_page: input.per_page.toString() }),
          ...(input.page !== undefined && { page: input.page.toString() }),
        },
        retries: 3,
      });

      const pullRequests = z.array(PullRequestSchema).parse(response.data);

      return {
        pull_requests: pullRequests,
        total_count: pullRequests.length,
      };
    },
  });
}
