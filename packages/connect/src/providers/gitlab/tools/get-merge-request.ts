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

export const getMergeRequestInputSchema = z.object({
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
  merge_request_iid: z.number().describe('The internal ID of the merge request in the project. Example: 1'),
});

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  state: z.string(),
  avatar_url: z.string().nullable().optional(),
  web_url: z.string().optional(),
  locked: z.boolean().optional(),
  public_email: z.string().nullable().optional(),
});

const MilestoneSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number().optional(),
  group_id: z.number().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  state: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  due_date: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  web_url: z.string().optional(),
});

const ReferencesSchema = z.object({
  short: z.string(),
  relative: z.string(),
  full: z.string(),
});

const TimeStatsSchema = z.object({
  time_estimate: z.number(),
  total_time_spent: z.number(),
  human_time_estimate: z.string().nullable().optional(),
  human_total_time_spent: z.string().nullable().optional(),
});

const TaskCompletionStatusSchema = z.object({
  count: z.number(),
  completed_count: z.number(),
});

const ProviderMergeRequestSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable().optional(),
  state: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  target_branch: z.string(),
  source_branch: z.string(),
  upvotes: z.number(),
  downvotes: z.number(),
  author: UserSchema,
  assignee: UserSchema.nullable().optional(),
  assignees: z.array(UserSchema).optional(),
  reviewers: z.array(UserSchema).optional(),
  source_project_id: z.number(),
  target_project_id: z.number(),
  labels: z.array(z.string()).optional(),
  draft: z.boolean(),
  work_in_progress: z.boolean().optional(),
  milestone: MilestoneSchema.nullable().optional(),
  merge_when_pipeline_succeeds: z.boolean().optional(),
  merge_status: z.string().optional(),
  detailed_merge_status: z.string(),
  sha: z.string().nullable(),
  merge_commit_sha: z.string().nullable().optional(),
  squash_commit_sha: z.string().nullable().optional(),
  user_notes_count: z.number(),
  discussion_locked: z.boolean().nullable().optional(),
  should_remove_source_branch: z.boolean().nullable().optional(),
  force_remove_source_branch: z.boolean().nullable().optional(),
  allow_collaboration: z.boolean().optional(),
  allow_maintainer_to_push: z.boolean().optional(),
  web_url: z.string(),
  references: ReferencesSchema,
  time_stats: TimeStatsSchema,
  squash: z.boolean().optional(),
  squash_on_merge: z.boolean().optional(),
  task_completion_status: TaskCompletionStatusSchema,
  has_conflicts: z.boolean().optional(),
  blocking_discussions_resolved: z.boolean().optional(),
  closed_at: z.string().nullable().optional(),
  closed_by: UserSchema.nullable().optional(),
  merged_at: z.string().nullable().optional(),
  merge_user: UserSchema.nullable().optional(),
  merge_after: z.string().nullable().optional(),
  prepared_at: z.string().nullish(),
  imported: z.boolean().optional(),
  imported_from: z.string().nullable().optional(),
});

export const getMergeRequestOutputSchema = ProviderMergeRequestSchema;

export function getMergeRequestTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_get_merge_request',
    description: 'Retrieve a single merge request from GitLab.',
    inputSchema: getMergeRequestInputSchema,
    outputSchema: getMergeRequestOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getMergeRequestOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.gitlab.com/api/merge_requests/#get-single-mr
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/merge_requests/${encodeURIComponent(String(input.merge_request_iid))}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Merge request not found',
          project_id: String(input.project_id),
          merge_request_iid: input.merge_request_iid,
        });
      }

      const mergeRequest = ProviderMergeRequestSchema.parse(response.data);
      return mergeRequest;
    },
  });
}
