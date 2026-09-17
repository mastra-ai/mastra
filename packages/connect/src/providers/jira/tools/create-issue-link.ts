// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createIssueLinkInputSchema = z.object({
  type: z.string().describe('The name of the issue link type. Example: "Blocks"'),
  inwardIssueKey: z
    .string()
    .describe(
      'The issue key for the inward side of the link (the issue that depends on or is affected by the other). Example: "PROJ-123"',
    ),
  outwardIssueKey: z
    .string()
    .describe(
      'The issue key for the outward side of the link (the issue that affects or blocks the other). Example: "PROJ-456"',
    ),
});

export const createIssueLinkOutputSchema = z.object({
  success: z.boolean(),
  linkType: z.string(),
  inwardIssueKey: z.string(),
  outwardIssueKey: z.string(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
});

export function createIssueLinkTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_create_issue_link',
    description: 'Link two Jira issues with a relationship type',
    inputSchema: createIssueLinkInputSchema,
    outputSchema: createIssueLinkOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createIssueLinkOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Resolve cloudId from connection config
      const connection = await platformProxy.getConnection();
      const configCloudId = connection.connection_config?.['cloudId'];

      let cloudId: string;

      if (configCloudId) {
        cloudId = configCloudId;
      } else {
        const metadata = await platformProxy.getMetadata();
        if (metadata.cloudId) {
          cloudId = metadata.cloudId;
        } else {
          // Fetch accessible resources to get cloudId
          // https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#oauth-2-0-3lo
          const accessibleResourcesResponse = await platformProxy.get({
            endpoint: 'oauth/token/accessible-resources',
            retries: 3,
          });

          const responseData = accessibleResourcesResponse.data;
          if (!responseData) {
            throw new platformProxy.ActionError({
              type: 'invalid_response',
              message: 'Accessible resources response data is missing.',
            });
          }

          const resources = z.array(AccessibleResourceSchema).parse(responseData);

          const firstResource = resources[0];
          if (!firstResource) {
            throw new platformProxy.ActionError({
              type: 'no_accessible_resources',
              message: 'No accessible Jira resources found for this connection.',
            });
          }

          cloudId = firstResource.id;
          await platformProxy.updateMetadata({ cloudId });
        }
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-links/#api-rest-api-3-issuelink-post
      await platformProxy.post({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issueLink`,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        data: {
          type: {
            name: input.type,
          },
          inwardIssue: {
            key: input.inwardIssueKey,
          },
          outwardIssue: {
            key: input.outwardIssueKey,
          },
        },
        retries: 1,
      });

      return {
        success: true,
        linkType: input.type,
        inwardIssueKey: input.inwardIssueKey,
        outwardIssueKey: input.outwardIssueKey,
      };
    },
  });
}
