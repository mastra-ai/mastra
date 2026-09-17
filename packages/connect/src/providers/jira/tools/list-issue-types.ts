// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
  baseUrl: z.string().optional(),
});

export const listIssueTypesInputSchema = z.object({
  // No input required - lists all issue types available to the user
});

const IssueTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  iconUrl: z.string().optional(),
  avatarId: z.number().optional(),
  subtask: z.boolean().optional(),
  hierarchyLevel: z.number().optional(),
});

export const listIssueTypesOutputSchema = z.object({
  issueTypes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      iconUrl: z.string().optional(),
      avatarId: z.number().optional(),
      subtask: z.boolean().optional(),
      hierarchyLevel: z.number().optional(),
    }),
  ),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  scopes: z.array(z.string()),
  avatarUrl: z.string(),
});

export function listIssueTypesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_list_issue_types',
    description: 'List Jira issue types available to the user',
    inputSchema: listIssueTypesInputSchema,
    outputSchema: listIssueTypesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIssueTypesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();

      let cloudId: string | undefined = connection.connection_config?.['cloudId'];
      let baseUrl: string | undefined = connection.connection_config?.['baseUrl'];

      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata<{
          cloudId?: string;
          baseUrl?: string;
        }>();
        cloudId = metadata?.cloudId;
        baseUrl = metadata?.baseUrl;
      }

      if (!cloudId || !baseUrl) {
        // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#accessible-resources
        const response = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = z.array(AccessibleResourceSchema).parse(response.data);
        if (resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection',
          });
        }

        const firstResource = resources[0];
        if (!firstResource) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Jira resources found for this connection',
          });
        }

        cloudId = firstResource.id;
        baseUrl = firstResource.url;

        await platformProxy.updateMetadata({
          cloudId,
          baseUrl,
        });
      }

      const config: PlatformProxyRequest = {
        // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-types/#api-rest-api-3-issuetype-get
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issuetype`,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      };

      const response = await platformProxy.get(config);

      const issueTypes = z.array(IssueTypeSchema).parse(response.data);

      return {
        issueTypes: issueTypes.map(issueType => ({
          id: issueType.id,
          name: issueType.name,
          ...(issueType.description !== undefined && {
            description: issueType.description,
          }),
          ...(issueType.iconUrl !== undefined && {
            iconUrl: issueType.iconUrl,
          }),
          ...(issueType.avatarId !== undefined && {
            avatarId: issueType.avatarId,
          }),
          ...(issueType.subtask !== undefined && {
            subtask: issueType.subtask,
          }),
          ...(issueType.hierarchyLevel !== undefined && {
            hierarchyLevel: issueType.hierarchyLevel,
          }),
        })),
      };
    },
  });
}
