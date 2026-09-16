// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteWorklogInputSchema = z.object({
  issueIdOrKey: z.string().describe('The ID or key of the issue. Example: "10032" or "PROJ-123"'),
  worklogId: z.string().describe('The ID of the worklog to delete. Example: "10011"'),
});

export const deleteWorklogOutputSchema = z.object({
  success: z.boolean(),
  issueIdOrKey: z.string(),
  worklogId: z.string(),
});

export function deleteWorklogTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_delete_worklog',
    description: 'Delete a worklog from a Jira issue.',
    inputSchema: deleteWorklogInputSchema,
    outputSchema: deleteWorklogOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteWorklogOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection.connection_config || {};
      let cloudId = connectionConfig['cloudId'];

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata<{ cloudId?: string }>();
        cloudId = metadata?.cloudId;
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'cloudId is required in connection_config or metadata. Please reconnect your Jira account.',
        });
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-worklogs/#api-rest-api-3-issue-issueidorkey-worklog-id-delete
      await platformProxy.delete({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}/worklog/${input.worklogId}`,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 10,
      });

      return {
        success: true,
        issueIdOrKey: input.issueIdOrKey,
        worklogId: input.worklogId,
      };
    },
  });
}
