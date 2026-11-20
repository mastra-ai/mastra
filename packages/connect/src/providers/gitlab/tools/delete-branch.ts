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

export const deleteBranchInputSchema = z.object({
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
  branch: z.string().describe('Name of the branch to delete. Example: "feature/test"'),
});

export const deleteBranchOutputSchema = z.object({
  success: z.boolean(),
  project_id: z.union([z.number(), z.string()]).optional(),
  branch: z.string().optional(),
});

export function deleteBranchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_delete_branch',
    description: 'Delete a branch in GitLab.',
    inputSchema: deleteBranchInputSchema,
    outputSchema: deleteBranchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteBranchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.gitlab.com/api/branches/#delete-repository-branch
      await platformProxy.delete({
        endpoint: `/api/v4/projects/${gitlabPathSegment(input.project_id)}/repository/branches/${encodeURIComponent(String(input.branch))}`,
        retries: 1,
      });

      return {
        success: true,
        project_id: String(input.project_id),
        branch: input.branch,
      };
    },
  });
}
