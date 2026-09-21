// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listIssuesInputSchema = z.object({
  owner: z.string().describe('The account owner of the repository. The name is not case sensitive.'),
  repo: z.string().describe('The name of the repository without the .git extension. The name is not case sensitive.'),
  state: z.enum(['open', 'closed', 'all']).optional().describe('Indicates the state of the issues to return.'),
  assignee: z
    .string()
    .optional()
    .describe(
      'Can be the name of a user. Pass in none for issues with no assigned user, and * for issues assigned to any user.',
    ),
  labels: z.string().optional().describe('A list of comma separated label names. Example: bug,ui,@high'),
  sort: z.enum(['created', 'updated', 'comments']).optional().describe('What to sort results by.'),
  direction: z.enum(['asc', 'desc']).optional().describe('The direction to sort the results by.'),
  since: z
    .string()
    .optional()
    .describe(
      'Only show results that were last updated after the given time. This is a timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ.',
    ),
  cursor: z.string().optional().describe('Pagination cursor (page number). Omit for the first page.'),
  per_page: z.number().min(1).max(100).optional().describe('The number of results per page (max 100).'),
});

const SimpleUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  node_id: z.string(),
  avatar_url: z.string(),
  gravatar_id: z.string().nullable(),
  url: z.string(),
  html_url: z.string(),
  type: z.string(),
  site_admin: z.boolean(),
  name: z.string().nullable().optional(),
});

const LabelSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable().optional(),
});

const IssueSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  repository_url: z.string(),
  labels_url: z.string(),
  comments_url: z.string(),
  events_url: z.string(),
  html_url: z.string(),
  number: z.number(),
  state: z.string(),
  state_reason: z.string().nullable().optional(),
  title: z.string(),
  body: z.string().nullable().optional(),
  user: SimpleUserSchema.nullable(),
  labels: z.array(LabelSchema),
  assignees: z.array(SimpleUserSchema).optional(),
  locked: z.boolean(),
  comments: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable().optional(),
  pull_request: z
    .object({
      url: z.string().nullable(),
      html_url: z.string().nullable(),
      diff_url: z.string().nullable(),
      patch_url: z.string().nullable(),
    })
    .optional(),
});

export const listIssuesOutputSchema = z.object({
  issues: z.array(IssueSchema),
  next_cursor: z.string().optional(),
});

export function listIssuesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'github_list_issues',
    description: 'List repository issues with state, assignee, label, and pagination filters.',
    inputSchema: listIssuesInputSchema,
    outputSchema: listIssuesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIssuesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};

      if (input.state !== undefined) {
        params['state'] = input.state;
      }
      if (input.assignee !== undefined) {
        params['assignee'] = input.assignee;
      }
      if (input.labels !== undefined) {
        params['labels'] = input.labels;
      }
      if (input.sort !== undefined) {
        params['sort'] = input.sort;
      }
      if (input.direction !== undefined) {
        params['direction'] = input.direction;
      }
      if (input.since !== undefined) {
        params['since'] = input.since;
      }
      if (input.cursor !== undefined) {
        if (!/^\d+$/.test(input.cursor)) {
          throw new platformProxy.ActionError({
            type: 'invalid_cursor',
            message: 'Cursor must be a positive integer page number.',
          });
        }
        const page = parseInt(input.cursor, 10);
        if (page < 1) {
          throw new platformProxy.ActionError({
            type: 'invalid_cursor',
            message: 'Cursor must be a positive integer page number.',
          });
        }
        params['page'] = page;
      }
      if (input.per_page !== undefined) {
        params['per_page'] = input.per_page;
      }

      const response = await platformProxy.get({
        // https://docs.github.com/en/rest/issues/issues#list-repository-issues
        endpoint: `repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues`,
        params,
        retries: 3,
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response format from GitHub API',
        });
      }

      const issues = response.data.map((issue: unknown) => IssueSchema.parse(issue));

      let next_cursor: string | undefined;
      if (input.per_page && issues.length === input.per_page) {
        const currentPage = input.cursor ? Number(input.cursor) : 1;
        next_cursor = String(currentPage + 1);
      }

      return {
        issues,
        ...(next_cursor !== undefined && { next_cursor }),
      };
    },
  });
}
