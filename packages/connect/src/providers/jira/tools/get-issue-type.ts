// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getIssueTypeInputSchema = z.object({
  id: z.string().describe('The ID of the issue type to retrieve.'),
});

const ProjectSchema = z
  .object({
    id: z.string(),
    key: z.string().optional(),
    name: z.string().optional(),
    self: z.string().optional(),
    projectTypeKey: z.string().optional(),
    simplified: z.boolean().optional(),
    avatarUrls: z.record(z.string(), z.string()).optional(),
    projectCategory: z
      .object({
        self: z.string(),
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const ScopeSchema = z.object({
  type: z.string(),
  project: ProjectSchema.optional(),
});

const RawIssueTypeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    self: z.string(),
    iconUrl: z.string().optional(),
    avatarId: z.number().optional(),
    subtask: z.boolean().optional(),
    hierarchyLevel: z.number().optional(),
    entityId: z.string().optional(),
    scope: ScopeSchema.optional(),
  })
  .passthrough();

export const getIssueTypeOutputSchema = RawIssueTypeSchema;

const JiraMetadataSchema = z.object({
  cloudId: z.string().optional(),
  baseUrl: z.string().optional(),
});

export function getIssueTypeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_get_issue_type',
    description: 'Retrieve Jira issue type metadata by issue type ID.',
    inputSchema: getIssueTypeInputSchema,
    outputSchema: getIssueTypeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getIssueTypeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get connection to access cloudId and baseUrl from connection_config
      const connection = await platformProxy.getConnection();

      // Resolve cloudId and baseUrl from connection_config or metadata
      let cloudId: string | undefined = connection.connection_config?.['cloudId'];
      let baseUrl: string | undefined = connection.connection_config?.['baseUrl'];

      if (!cloudId || !baseUrl) {
        // Check metadata as fallback
        const metadata = await platformProxy.getMetadata<Record<string, string>>();
        if (!cloudId && metadata && typeof metadata === 'object' && 'cloudId' in metadata) {
          cloudId = metadata['cloudId'];
        }
        if (!baseUrl && metadata && typeof metadata === 'object' && 'baseUrl' in metadata) {
          baseUrl = metadata['baseUrl'];
        }

        // If still missing, fetch from accessible-resources endpoint
        if (!cloudId || !baseUrl) {
          const accessibleResourcesResponse = await platformProxy.get({
            endpoint: 'oauth/token/accessible-resources',
            retries: 3,
          });

          if (
            accessibleResourcesResponse.data &&
            Array.isArray(accessibleResourcesResponse.data) &&
            accessibleResourcesResponse.data.length > 0
          ) {
            const firstResource = accessibleResourcesResponse.data[0];
            if (
              firstResource !== null &&
              typeof firstResource === 'object' &&
              'id' in firstResource &&
              'url' in firstResource &&
              typeof firstResource.id === 'string' &&
              typeof firstResource.url === 'string'
            ) {
              cloudId = firstResource.id;
              baseUrl = firstResource.url;

              // Cache for future runs
              await platformProxy.updateMetadata({ cloudId, baseUrl });
            }
          }
        }
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          message: 'Unable to resolve cloudId for Jira connection.',
          code: 'missing_cloud_id',
        });
      }

      // Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-types/#api-rest-api-3-issuetype-id-get
      const response = await platformProxy.get({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issuetype/${input.id}`,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      return response.data;
    },
  });
}
