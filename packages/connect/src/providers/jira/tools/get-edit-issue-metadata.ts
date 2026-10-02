// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getEditIssueMetadataInputSchema = z.object({
  issueIdOrKey: z.string().describe('The ID or key of the issue. Example: "10000" or "PROJ-123"'),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
  baseUrl: z.string().optional(),
});

export const getEditIssueMetadataOutputSchema = z.object({
  fields: z.any(),
});

const JiraEditMetaResponseSchema = z.object({
  fields: z.any(),
});

export function getEditIssueMetadataTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_get_edit_issue_metadata',
    description: 'Retrieve editable field metadata for an existing Jira issue',
    inputSchema: getEditIssueMetadataInputSchema,
    outputSchema: getEditIssueMetadataOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getEditIssueMetadataOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Try to get cached cloudId/baseUrl from metadata first
      let cloudId: string | undefined;
      let baseUrl: string | undefined;

      // @allowTryCatch - getMetadata may not be available in some test scenarios
      try {
        const metadata = await platformProxy.getMetadata<{ cloudId?: string; baseUrl?: string }>();
        cloudId = metadata?.cloudId;
        baseUrl = metadata?.baseUrl;
      } catch {
        // Metadata not available, will fetch from accessible-resources
      }

      // If not cached, fetch from accessible-resources endpoint
      if (!cloudId || !baseUrl) {
        // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#3--forge-apps-using-oauth-2--get-accessible-resources
        const resourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = resourcesResponse.data;
        if (!Array.isArray(resources) || resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'configuration_error',
            message: 'Unable to resolve Jira cloudId. No accessible resources found.',
          });
        }

        cloudId = String(resources[0].id);
        baseUrl = String(resources[0].url);

        // Cache for future runs
        // @allowTryCatch - updateMetadata may not be available in some test scenarios
        try {
          await platformProxy.updateMetadata({
            cloudId,
            baseUrl,
          });
        } catch {
          // Failed to cache, continue anyway
        }
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-editmeta-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}/editmeta`,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      const responseData = JiraEditMetaResponseSchema.safeParse(response.data);
      if (!responseData.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Jira API: response does not match expected schema',
        });
      }

      return {
        fields: responseData.data.fields,
      };
    },
  });
}
