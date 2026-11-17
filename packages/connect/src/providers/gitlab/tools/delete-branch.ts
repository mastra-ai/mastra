// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteBranchInputSchema = z.object({
  project_id: z.union([z.number(), z.string()]).describe('Project ID or URL-encoded path. Example: "82599306"'),
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
    description: 'Delete or archive a branch in GitLab.',
    inputSchema: deleteBranchInputSchema,
    outputSchema: deleteBranchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteBranchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.gitlab.com/api/branches/#delete-repository-branch
      await platformProxy.delete({
        endpoint: `/api/v4/projects/${String(input.project_id)}/repository/branches/${encodeURIComponent(input.branch)}`,
        retries: 3,
      });

      return {
        success: true,
        project_id: input.project_id,
        branch: input.branch,
      };
    },
  });
}
