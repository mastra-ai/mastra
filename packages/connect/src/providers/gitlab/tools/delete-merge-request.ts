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

export const deleteMergeRequestInputSchema = z.object({
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
});

const ProviderMergeRequestSchema = z.object({
  id: z.number(),
  iid: z.number(),
  project_id: z.number(),
  title: z.string(),
  state: z.string(),
  source_branch: z.string().optional(),
  target_branch: z.string().optional(),
  web_url: z.string().optional(),
});

export const deleteMergeRequestOutputSchema = z.object({
  success: z.boolean(),
  id: z.number().optional(),
  iid: z.number().optional(),
  project_id: z.number().optional(),
  title: z.string().optional(),
  state: z.string().optional(),
});

export function deleteMergeRequestTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_delete_merge_request',
    description: 'Delete a merge request in GitLab.',
    inputSchema: deleteMergeRequestInputSchema,
    outputSchema: deleteMergeRequestOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteMergeRequestOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://docs.gitlab.com/api/merge_requests/#delete-a-merge-request
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/merge_requests/${encodeURIComponent(String(input.merge_request_iid))}`,
        retries: 1,
      });

      if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        const mr = ProviderMergeRequestSchema.parse(response.data);
        return {
          success: true,
          id: mr.id,
          iid: mr.iid,
          project_id: mr.project_id,
          title: mr.title,
          state: mr.state,
        };
      }

      return {
        success: true,
      };
    },
  });
}
