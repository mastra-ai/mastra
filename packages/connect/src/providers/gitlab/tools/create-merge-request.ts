// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

/** Encodes one GitLab path segment exactly once, whether `value` arrives raw or already URL-encoded. */
function gitlabPathSegment(value: string | number): string {
  const text = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(text));
  } catch {
    return encodeURIComponent(text);
  }
}

export const createMergeRequestInputSchema = z.object({
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
  source_branch: z.string(),
  target_branch: z.string(),
  title: z.string(),
  description: z.string().optional(),
  labels: z.string().optional(),
  assignee_ids: z.array(z.number()).optional(),
  reviewer_ids: z.array(z.number()).optional(),
  milestone_id: z.number().optional(),
  remove_source_branch: z.boolean().optional(),
  squash: z.boolean().optional(),
  allow_collaboration: z.boolean().optional(),
});

export const createMergeRequestOutputSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  description: z.string().nullable().optional(),
  state: z.string(),
  source_branch: z.string(),
  target_branch: z.string(),
  web_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  author: z
    .object({
      id: z.number(),
      name: z.string(),
      username: z.string(),
    })
    .optional(),
});

export function createMergeRequestTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_create_merge_request',
    description: 'Create a merge request in GitLab',
    inputSchema: createMergeRequestInputSchema,
    outputSchema: createMergeRequestOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createMergeRequestOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://docs.gitlab.com/api/merge_requests/#create-mr
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/merge_requests`,
        data: {
          source_branch: input.source_branch,
          target_branch: input.target_branch,
          title: input.title,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.labels !== undefined && { labels: input.labels }),
          ...(input.assignee_ids !== undefined && { assignee_ids: input.assignee_ids }),
          ...(input.reviewer_ids !== undefined && { reviewer_ids: input.reviewer_ids }),
          ...(input.milestone_id !== undefined && { milestone_id: input.milestone_id }),
          ...(input.remove_source_branch !== undefined && { remove_source_branch: input.remove_source_branch }),
          ...(input.squash !== undefined && { squash: input.squash }),
          ...(input.allow_collaboration !== undefined && { allow_collaboration: input.allow_collaboration }),
        },
        retries: 1,
      };

      // https://docs.gitlab.com/api/merge_requests/#create-mr
      const response = await platformProxy.post(config);
      return createMergeRequestOutputSchema.parse(response.data);
    },
  });
}
