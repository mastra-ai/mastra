// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteIssueLinkInputSchema = z.object({
  linkId: z.string().describe('The ID of the issue link to delete. Example: "10001"'),
});

export const deleteIssueLinkOutputSchema = z.object({
  success: z.boolean(),
  linkId: z.string(),
});

export function deleteIssueLinkTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_delete_issue_link',
    description: 'Delete a link between Jira issues',
    inputSchema: deleteIssueLinkInputSchema,
    outputSchema: deleteIssueLinkOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteIssueLinkOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      let cloudId = connection.connection_config?.['cloudId'];

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const metadataCloudId = z.object({ cloudId: z.string().optional() }).parse(metadata);
        cloudId = metadataCloudId.cloudId;
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'Missing cloudId in connection configuration',
        });
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-links/#api-rest-api-3-issuelink-linkid-delete
      await platformProxy.delete({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/issueLink/${input.linkId}`,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 1,
      });

      return {
        success: true,
        linkId: input.linkId,
      };
    },
  });
}
