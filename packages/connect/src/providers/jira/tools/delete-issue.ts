// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteIssueInputSchema = z.object({
  issueIdOrKey: z.string().describe('The ID or key of the issue to delete. Example: "10001" or "PROJ-123"'),
  deleteSubtasks: z.boolean().optional().describe('If true, subtasks are also deleted. Defaults to false.'),
});

export const deleteIssueOutputSchema = z.object({
  success: z.boolean(),
  issueIdOrKey: z.string(),
});

const CloudIdResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
});

const AccessibleResourcesSchema = z.array(CloudIdResponseSchema);

const MetadataCacheSchema = z.object({
  cloudId: z.string(),
  baseUrl: z.string(),
});

export function deleteIssueTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_delete_issue',
    description: 'Delete a Jira issue by ID or key',
    inputSchema: deleteIssueInputSchema,
    outputSchema: deleteIssueOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteIssueOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get connection to resolve cloudId
      const connection = await platformProxy.getConnection();

      // Resolve cloudId from connection config
      let cloudId: string | undefined;
      let baseUrl: string | undefined;

      if (connection.connection_config) {
        const connectionConfigSchema = z.object({
          cloudId: z.string().optional(),
          baseUrl: z.string().optional(),
        });
        const parsed = connectionConfigSchema.safeParse(connection.connection_config);
        if (parsed.success) {
          cloudId = parsed.data.cloudId;
          baseUrl = parsed.data.baseUrl;
        }
      }

      // If not in connection config, check metadata
      if (!cloudId || !baseUrl) {
        const metadataSchema = z.object({
          cloudId: z.string().optional(),
          baseUrl: z.string().optional(),
        });
        // @allowTryCatch - metadata may not be set
        try {
          const metadataResult = metadataSchema.safeParse(await platformProxy.getMetadata());
          if (metadataResult.success) {
            cloudId = cloudId || metadataResult.data.cloudId;
            baseUrl = baseUrl || metadataResult.data.baseUrl;
          }
        } catch {
          // Metadata not available, continue to accessible-resources
        }
      }

      // If still missing, fetch from accessible resources endpoint
      if (!cloudId || !baseUrl) {
        // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-oauth-2-0-app/#api-oauth-token-accessible-resources-get
        const response = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const accessibleResources = AccessibleResourcesSchema.parse(response.data);

        if (!accessibleResources || accessibleResources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No Jira Cloud instances accessible with this connection',
          });
        }

        const firstResource = accessibleResources[0];
        if (firstResource) {
          if (!cloudId) cloudId = firstResource.id;
          if (!baseUrl) baseUrl = firstResource.url;
        }

        // Cache for subsequent runs
        if (cloudId && baseUrl) {
          const metadataToCache = MetadataCacheSchema.parse({ cloudId, baseUrl });
          await platformProxy.updateMetadata(metadataToCache);
        }
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'Could not resolve Jira Cloud ID from connection config, metadata, or accessible resources',
        });
      }

      // Build query params for deleteSubtasks
      const params: Record<string, string> = {};
      if (input.deleteSubtasks !== undefined) {
        params['deleteSubtasks'] = String(input.deleteSubtasks);
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-delete
      await platformProxy.delete({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/${input.issueIdOrKey}`,
        params: params,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      return {
        success: true,
        issueIdOrKey: input.issueIdOrKey,
      };
    },
  });
}
