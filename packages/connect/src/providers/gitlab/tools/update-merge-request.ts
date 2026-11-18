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

export const updateMergeRequestInputSchema = z
  .object({
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
    merge_request_iid: z.number().describe('The internal ID of the merge request. Example: 1'),
    add_labels: z.string().optional(),
    allow_collaboration: z.boolean().optional(),
    allow_maintainer_to_push: z.boolean().optional(),
    assignee_id: z.number().optional(),
    assignee_ids: z.array(z.number()).optional(),
    description: z.string().optional(),
    discussion_locked: z.boolean().optional(),
    labels: z.string().optional(),
    merge_after: z.string().optional(),
    milestone_id: z.number().optional(),
    milestone: z.string().optional(),
    remove_labels: z.string().optional(),
    remove_source_branch: z.boolean().optional(),
    reviewer_ids: z.array(z.number()).optional(),
    squash: z.boolean().optional(),
    state_event: z.enum(['close', 'reopen']).optional(),
    target_branch: z.string().optional(),
    title: z.string().optional(),
  })
  .refine(data => Object.keys(data).some(key => key !== 'project_id' && key !== 'merge_request_iid'), {
    message: 'At least one update field must be provided.',
  })
  .refine(data => data.milestone_id === undefined || data.milestone === undefined, {
    message: 'Pass milestone_id or milestone, not both.',
    path: ['milestone'],
  });

export const updateMergeRequestOutputSchema = z
  .object({
    id: z.number(),
    iid: z.number(),
  })
  .passthrough();

export function updateMergeRequestTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_update_merge_request',
    description: 'Update a merge request in GitLab.',
    inputSchema: updateMergeRequestInputSchema,
    outputSchema: updateMergeRequestOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateMergeRequestOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.put({
        // https://docs.gitlab.com/api/merge_requests/#update-a-merge-request
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/merge_requests/${encodeURIComponent(String(input.merge_request_iid))}`,
        data: {
          ...(input.target_branch !== undefined && { target_branch: input.target_branch }),
          ...(input.title !== undefined && { title: input.title }),
          ...(input.assignee_id !== undefined && { assignee_id: input.assignee_id }),
          ...(input.assignee_ids !== undefined && { assignee_ids: input.assignee_ids }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.discussion_locked !== undefined && { discussion_locked: input.discussion_locked }),
          ...(input.labels !== undefined && { labels: input.labels }),
          ...(input.merge_after !== undefined && { merge_after: input.merge_after }),
          ...(input.milestone_id !== undefined && { milestone_id: input.milestone_id }),
          ...(input.milestone !== undefined && { milestone: input.milestone }),
          ...(input.remove_labels !== undefined && { remove_labels: input.remove_labels }),
          ...(input.add_labels !== undefined && { add_labels: input.add_labels }),
          ...(input.remove_source_branch !== undefined && { remove_source_branch: input.remove_source_branch }),
          ...(input.reviewer_ids !== undefined && { reviewer_ids: input.reviewer_ids }),
          ...(input.squash !== undefined && { squash: input.squash }),
          ...(input.state_event !== undefined && { state_event: input.state_event }),
          ...(input.allow_collaboration !== undefined && { allow_collaboration: input.allow_collaboration }),
          ...(input.allow_maintainer_to_push !== undefined && {
            allow_maintainer_to_push: input.allow_maintainer_to_push,
          }),
        },
        retries: 1,
      });

      const mergeRequest = updateMergeRequestOutputSchema.parse(response.data);

      return mergeRequest;
    },
  });
}
