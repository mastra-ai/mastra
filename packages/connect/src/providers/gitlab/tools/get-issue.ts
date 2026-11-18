// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

/** Encodes one GitLab path segment exactly once, whether `value` arrives raw or already URL-encoded. */
function gitlabPathSegment(value: string | number): string {
  const text = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(text));
  } catch {
    return encodeURIComponent(text);
  }
}

export const getIssueInputSchema = z.object({
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
  issue_iid: z.number().describe("The internal ID of a project's issue. Example: 1"),
});

const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  state: z.string(),
  avatar_url: z.string().nullable().optional(),
  web_url: z.string(),
});

const TimeStatsSchema = z.object({
  time_estimate: z.number(),
  total_time_spent: z.number(),
  human_time_estimate: z.string().nullable().optional(),
  human_total_time_spent: z.string().nullable().optional(),
});

const ReferencesSchema = z.object({
  short: z.string(),
  relative: z.string(),
  full: z.string(),
});

const TaskCompletionStatusSchema = z.object({
  count: z.number(),
  completed_count: z.number(),
});

const LinksSchema = z
  .object({
    self: z.string(),
    notes: z.string(),
    award_emoji: z.string(),
    project: z.string(),
    closed_as_duplicate_of: z.string().nullable().optional(),
  })
  .passthrough();

const ProviderIssueSchema = z
  .object({
    id: z.number(),
    iid: z.number(),
    project_id: z.number(),
    title: z.string(),
    description: z.string().nullable().optional(),
    state: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    closed_at: z.string().nullable().optional(),
    closed_by: UserSchema.nullable().optional(),
    labels: z.array(z.string()),
    author: UserSchema,
    assignee: UserSchema.nullable().optional(),
    assignees: z.array(UserSchema),
    type: z.string(),
    upvotes: z.number(),
    downvotes: z.number(),
    merge_requests_count: z.number(),
    subscribed: z.boolean(),
    user_notes_count: z.number(),
    due_date: z.string().nullable().optional(),
    imported: z.boolean(),
    imported_from: z.string(),
    web_url: z.string(),
    references: ReferencesSchema,
    time_stats: TimeStatsSchema,
    confidential: z.boolean(),
    discussion_locked: z.boolean().nullable().optional(),
    issue_type: z.string(),
    severity: z.string(),
    task_completion_status: TaskCompletionStatusSchema,
    weight: z.number().nullable().optional(),
    has_tasks: z.boolean(),
    _links: LinksSchema,
    milestone: z.unknown().nullable().optional(),
  })
  .passthrough();

export const getIssueOutputSchema = ProviderIssueSchema;

export function getIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_get_issue',
    description: 'Retrieve a single issue from GitLab.',
    inputSchema: getIssueInputSchema,
    outputSchema: getIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = String(input.project_id);
      const response = await platformProxy.get({
        // https://docs.gitlab.com/api/issues/#get-a-single-project-issue
        endpoint: `/api/v4/projects/${gitlabPathSegment(projectId)}/issues/${encodeURIComponent(String(input.issue_iid))}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Issue not found',
          project_id: projectId,
          issue_iid: input.issue_iid,
        });
      }

      const issue = ProviderIssueSchema.parse(response.data);
      return issue;
    },
  });
}
