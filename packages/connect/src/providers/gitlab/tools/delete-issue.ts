// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteIssueInputSchema = z.object({
  project_id: z
    .union([z.number(), z.string()])
    .describe('The global ID or URL-encoded path of the project. Example: 82599306'),
  issue_iid: z.number().describe('The internal ID of a project issue. Example: 1'),
});

export const deleteIssueOutputSchema = z.object({
  success: z.boolean(),
  project_id: z.union([z.number(), z.string()]),
  issue_iid: z.number(),
});

export function deleteIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'gitlab_delete_issue',
    description: 'Delete or archive a issue in GitLab.',
    inputSchema: deleteIssueInputSchema,
    outputSchema: deleteIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.gitlab.com/api/issues/#delete-an-issue
      await platformProxy.delete({
        endpoint: `/api/v4/projects/${String(input.project_id)}/issues/${input.issue_iid}`,
        retries: 1,
      });

      return {
        success: true,
        project_id: input.project_id,
        issue_iid: input.issue_iid,
      };
    },
  });
}
