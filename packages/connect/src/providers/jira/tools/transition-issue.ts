// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const transitionIssueInputSchema = z.object({
  issueIdOrKey: z.string().describe('The ID or key of the issue. Example: "PROJ-123"'),
  transitionId: z.string().describe('The ID of the transition to perform. Example: "31"'),
  fields: z.record(z.string(), z.unknown()).optional(),
  update: z.record(z.string(), z.unknown()).optional(),
});

export const transitionIssueOutputSchema = z.object({
  success: z.boolean(),
  issueIdOrKey: z.string(),
});

export function transitionIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_transition_issue',
    description: 'Move a Jira issue through a workflow transition.',
    inputSchema: transitionIssueInputSchema,
    outputSchema: transitionIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof transitionIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get cloudId and baseUrl from connection config or metadata
      const connection = await platformProxy.getConnection();
      const metadata = await platformProxy.getMetadata<{ cloudId?: string; baseUrl?: string }>();

      let cloudId = connection.connection_config?.['cloudId'];
      let baseUrl = connection.connection_config?.['baseUrl'];

      if (!cloudId) {
        cloudId = metadata?.cloudId;
      }
      if (!baseUrl) {
        baseUrl = metadata?.baseUrl;
      }

      // If still missing, fetch from accessible-resources endpoint
      if (!cloudId) {
        const accessibleResourcesResponse = await platformProxy.get({
          // https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = accessibleResourcesResponse.data;
        if (!Array.isArray(resources) || resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'missing_accessible_resources',
            message: 'No accessible Jira resources found for this connection.',
          });
        }

        cloudId = resources[0].id;
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'Unable to determine Jira Cloud ID.',
        });
      }

      // Build the transition payload
      const transitionPayload: {
        transition: { id: string };
        fields?: Record<string, unknown>;
        update?: Record<string, unknown>;
      } = {
        transition: {
          id: input.transitionId,
        },
      };

      if (input.fields !== undefined && typeof input.fields === 'object' && input.fields !== null) {
        transitionPayload.fields = input.fields;
      }

      if (input.update !== undefined && typeof input.update === 'object' && input.update !== null) {
        transitionPayload.update = input.update;
      }

      // Perform the transition
      await platformProxy.post({
        // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-transitions-post
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}/transitions`,
        data: transitionPayload,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 10,
      });

      return {
        success: true,
        issueIdOrKey: input.issueIdOrKey,
      };
    },
  });
}
