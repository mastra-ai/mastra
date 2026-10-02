// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateIssueInputSchema = z.object({
  issue_id_or_key: z.string(),
  fields: z.record(z.string(), z.unknown()).optional(),
  update: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).optional(),
  notify_users: z.boolean().optional(),
  return_issue: z.boolean().optional(),
});

const IssueSchema = z.object({
  id: z.string(),
  key: z.string(),
  self: z.string(),
});

export const updateIssueOutputSchema = z.object({
  success: z.boolean(),
  issue: IssueSchema.optional(),
});

export function updateIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_update_issue',
    description: 'Update issue fields on an existing Jira issue',
    inputSchema: updateIssueInputSchema,
    outputSchema: updateIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get connection to retrieve cloudId
      const connection = await platformProxy.getConnection();

      const cloudId = connection.connection_config?.['cloudId'];

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'cloudId is required in connection configuration.',
        });
      }

      // Build query parameters
      const params: Record<string, string> = {};
      if (input.notify_users !== undefined) {
        params['notifyUsers'] = String(input.notify_users);
      }
      if (input.return_issue !== undefined) {
        params['returnIssue'] = String(input.return_issue);
      }

      // Build request body
      const body: Record<string, unknown> = {};
      if (input.fields !== undefined) {
        body['fields'] = input.fields;
      }
      if (input.update !== undefined) {
        body['update'] = input.update;
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-put
      const response = await platformProxy.put({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issue_id_or_key}`,
        data: body,
        params,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      // 204 No Content - success without returning issue
      if (response.status === 204) {
        return { success: true };
      }

      // 200 OK - success with issue returned
      if (response.status === 200 && response.data) {
        const issueData = IssueSchema.parse(response.data);
        return {
          success: true,
          issue: issueData,
        };
      }

      return { success: true };
    },
  });
}
