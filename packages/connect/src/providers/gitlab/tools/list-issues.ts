// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

/** Fills x-next-page from the Link header when GitLab sends only Link (keyset pagination, large result sets). */
function fillGitLabNextPage(headers: Record<string, string>): void {
  if (headers['x-next-page']) return;
  const next = /<([^>]+)>;\s*rel="next"/.exec(headers['link'] ?? '')?.[1];
  const page = next ? new URL(next).searchParams.get('page') : null;
  if (page) headers['x-next-page'] = page;
}

/** Encodes one GitLab path segment exactly once, whether `value` arrives raw or already URL-encoded. */
function gitlabPathSegment(value: string | number): string {
  const text = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(text));
  } catch {
    return encodeURIComponent(text);
  }
}

export const listIssuesInputSchema = z.object({
  project_id: z
    .union([
      z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      z
        .string()
        .min(1)
        .refine(value => {
          try {
            encodeURIComponent(value);
            return true;
          } catch {
            return false;
          }
        }, 'must not contain unpaired surrogate characters'),
    ])
    .describe(
      'Numeric project ID, or the project path raw or URL-encoded. Example: 82599306, "team/app", or "team%2Fapp"',
    ),
  state: z.enum(['opened', 'closed', 'all']).optional(),
  labels: z.string().optional(),
  milestone: z.string().optional(),
  search: z.string().optional(),
  author_id: z.number().optional(),
  assignee_id: z.number().optional(),
  scope: z.enum(['created_by_me', 'assigned_to_me', 'all']).optional(),
  sort: z.enum(['asc', 'desc']).optional(),
  order_by: z.string().optional(),
  created_after: z.string().optional(),
  created_before: z.string().optional(),
  updated_after: z.string().optional(),
  updated_before: z.string().optional(),
  confidential: z.boolean().optional(),
  issue_type: z.enum(['issue', 'incident', 'test_case', 'task']).optional(),
  cursor: z
    .string()
    .regex(/^[1-9]\d*$/, 'cursor must be the page number from next_cursor')
    .optional()
    .describe('Pagination cursor (page number) from the previous response. Omit for the first page.'),
  per_page: z.number().int().min(1).max(100).optional(),
});

const GitLabUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  state: z.string(),
  avatar_url: z.string().nullable().optional(),
  web_url: z.string().optional(),
});

const GitLabMilestoneSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  state: z.string(),
  due_date: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

const GitLabTimeStatsSchema = z.object({
  time_estimate: z.number(),
  total_time_spent: z.number(),
  human_time_estimate: z.string().nullable().optional(),
  human_total_time_spent: z.string().nullable().optional(),
});

const GitLabTaskCompletionStatusSchema = z.object({
  count: z.number(),
  completed_count: z.number(),
});

const GitLabReferencesSchema = z.object({
  short: z.string(),
  relative: z.string(),
  full: z.string(),
});

const ProviderIssueSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable().optional(),
  state: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  author: GitLabUserSchema.optional(),
  assignees: z.array(GitLabUserSchema).optional(),
  assignee: GitLabUserSchema.nullable().optional(),
  milestone: GitLabMilestoneSchema.nullable().optional(),
  due_date: z.string().nullable().optional(),
  web_url: z.string().optional(),
  references: GitLabReferencesSchema.optional(),
  confidential: z.boolean().optional(),
  issue_type: z.string().optional(),
  severity: z.string().optional(),
  weight: z.number().nullable().optional(),
  user_notes_count: z.number().optional(),
  merge_requests_count: z.number().optional(),
  upvotes: z.number().optional(),
  downvotes: z.number().optional(),
  has_tasks: z.boolean().optional(),
  task_status: z.string().optional(),
  task_completion_status: GitLabTaskCompletionStatusSchema.optional(),
  time_stats: GitLabTimeStatsSchema.optional(),
  _links: z.record(z.string(), z.string().nullable()).optional(),
  subscribed: z.boolean().optional(),
});

const IssueOutputSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().optional(),
  state: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().optional(),
  labels: z.array(z.string()).optional(),
  author: GitLabUserSchema.optional(),
  assignees: z.array(GitLabUserSchema).optional(),
  assignee: GitLabUserSchema.optional(),
  milestone: GitLabMilestoneSchema.optional(),
  due_date: z.string().optional(),
  web_url: z.string().optional(),
  references: GitLabReferencesSchema.optional(),
  confidential: z.boolean().optional(),
  issue_type: z.string().optional(),
  severity: z.string().optional(),
  weight: z.number().optional(),
  user_notes_count: z.number().optional(),
  merge_requests_count: z.number().optional(),
  upvotes: z.number().optional(),
  downvotes: z.number().optional(),
  has_tasks: z.boolean().optional(),
  task_status: z.string().optional(),
  task_completion_status: GitLabTaskCompletionStatusSchema.optional(),
  time_stats: GitLabTimeStatsSchema.optional(),
  links: z.record(z.string(), z.string().nullable()).optional(),
  subscribed: z.boolean().optional(),
});

export const listIssuesOutputSchema = z.object({
  items: z.array(IssueOutputSchema),
  next_cursor: z.string().optional(),
});

export function listIssuesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_list_issues',
    description: 'List issues from GitLab',
    inputSchema: listIssuesInputSchema,
    outputSchema: listIssuesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIssuesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = typeof input.project_id === 'number' ? String(input.project_id) : input.project_id;

      if (input.cursor !== undefined) {
        const page = parseInt(input.cursor, 10);
        if (Number.isNaN(page) || !Number.isInteger(page) || page < 1) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'cursor must be a valid positive integer page number',
          });
        }
      }

      const params: Record<string, string | number> = {
        ...(input.state !== undefined && { state: input.state }),
        ...(input.labels !== undefined && { labels: input.labels }),
        ...(input.milestone !== undefined && { milestone: input.milestone }),
        ...(input.search !== undefined && { search: input.search }),
        ...(input.author_id !== undefined && { author_id: input.author_id }),
        ...(input.assignee_id !== undefined && { assignee_id: input.assignee_id }),
        ...(input.scope !== undefined && { scope: input.scope }),
        ...(input.sort !== undefined && { sort: input.sort }),
        ...(input.order_by !== undefined && { order_by: input.order_by }),
        ...(input.created_after !== undefined && { created_after: input.created_after }),
        ...(input.created_before !== undefined && { created_before: input.created_before }),
        ...(input.updated_after !== undefined && { updated_after: input.updated_after }),
        ...(input.updated_before !== undefined && { updated_before: input.updated_before }),
        ...(input.confidential !== undefined && { confidential: input.confidential ? 'true' : 'false' }),
        ...(input.issue_type !== undefined && { issue_type: input.issue_type }),
        ...(input.per_page !== undefined && { per_page: input.per_page }),
        ...(input.cursor !== undefined && { page: parseInt(input.cursor, 10) }),
      };

      const config: PlatformProxyRequest = {
        // https://docs.gitlab.com/api/issues/#list-all-project-issues
        endpoint: `/api/v4/projects/${gitlabPathSegment(projectId)}/issues`,
        params,
        retries: 3,
      };

      const response = await platformProxy.get(config);
      fillGitLabNextPage(response.headers);

      const providerIssues = z.array(ProviderIssueSchema).parse(response.data);

      const items = providerIssues.map(issue => ({
        id: issue.id,
        iid: issue.iid,
        project_id: issue.project_id,
        title: issue.title,
        state: issue.state,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        ...(issue.description != null && { description: issue.description }),
        ...(issue.closed_at != null && { closed_at: issue.closed_at }),
        labels: issue.labels,
        author: issue.author,
        assignees: issue.assignees,
        ...(issue.assignee != null && { assignee: issue.assignee }),
        ...(issue.milestone != null && { milestone: issue.milestone }),
        ...(issue.due_date != null && { due_date: issue.due_date }),
        web_url: issue.web_url,
        references: issue.references,
        confidential: issue.confidential,
        issue_type: issue.issue_type,
        severity: issue.severity,
        ...(issue.weight != null && { weight: issue.weight }),
        user_notes_count: issue.user_notes_count,
        merge_requests_count: issue.merge_requests_count,
        upvotes: issue.upvotes,
        downvotes: issue.downvotes,
        has_tasks: issue.has_tasks,
        task_status: issue.task_status,
        task_completion_status: issue.task_completion_status,
        time_stats: issue.time_stats,
        links: issue._links,
        subscribed: issue.subscribed,
      }));

      const nextPage = response.headers['x-next-page'];
      const nextCursor = typeof nextPage === 'string' && nextPage.length > 0 ? nextPage : undefined;

      return {
        items,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
