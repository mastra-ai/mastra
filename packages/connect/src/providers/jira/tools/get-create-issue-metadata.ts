// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getCreateIssueMetadataInputSchema = z.object({
  projectIds: z.array(z.string()).optional().describe('List of project IDs to filter by. Example: ["10000", "10001"]'),
  projectKeys: z.array(z.string()).optional().describe('List of project keys to filter by. Example: ["PROJ", "TEST"]'),
  issuetypeIds: z
    .array(z.string())
    .optional()
    .describe('List of issue type IDs to filter by. Example: ["10000", "10001"]'),
  expand: z
    .string()
    .optional()
    .describe(
      'Use expand to include additional information about issue metadata in the response. Supported values: projects, projects.issuetypes, projects.issuetypes.fields',
    ),
});

const ProjectSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  self: z.string().optional(),
  avatarUrls: z.record(z.string(), z.string()).optional(),
});

const ProviderResponseSchema = z.object({
  projects: z.array(ProjectSchema).optional(),
});

export const getCreateIssueMetadataOutputSchema = z.object({
  projects: z.array(ProjectSchema).optional(),
});

export function getCreateIssueMetadataTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_get_create_issue_metadata',
    description: 'Retrieve project and issue type metadata for issue creation.',
    inputSchema: getCreateIssueMetadataInputSchema,
    outputSchema: getCreateIssueMetadataOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCreateIssueMetadataOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get cloudId from connection config or metadata
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection?.connection_config;
      const cloudIdConfig = connectionConfig?.['cloudId'];
      let cloudId = typeof cloudIdConfig === 'string' ? cloudIdConfig : undefined;

      // Fallback to metadata if not found in connection config
      if (!cloudId) {
        const metadata = await platformProxy.getMetadata<{ cloudId?: string }>();
        const metadataCloudId = metadata?.cloudId;
        cloudId = typeof metadataCloudId === 'string' ? metadataCloudId : undefined;
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message:
            'cloudId is required in connection configuration or metadata. Please ensure the connection has the cloudId configured.',
        });
      }

      // Build query parameters
      const params: Record<string, string | string[]> = {};

      if (input.projectIds && input.projectIds.length > 0) {
        params['projectIds'] = input.projectIds;
      }

      if (input.projectKeys && input.projectKeys.length > 0) {
        params['projectKeys'] = input.projectKeys;
      }

      if (input.issuetypeIds && input.issuetypeIds.length > 0) {
        params['issuetypeIds'] = input.issuetypeIds;
      }

      if (input.expand) {
        params['expand'] = input.expand;
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-createmeta-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issue/createmeta`,
        params,
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        projects: providerData.projects,
      };
    },
  });
}
