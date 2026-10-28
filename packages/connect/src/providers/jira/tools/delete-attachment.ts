// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteAttachmentInputSchema = z.object({
  id: z.string().describe('The ID of the attachment to delete. Example: "10001"'),
});

export const deleteAttachmentOutputSchema = z.object({
  success: z.boolean(),
  id: z.string(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
  baseUrl: z.string().optional(),
});

export function deleteAttachmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'jira_delete_attachment',
    description: 'Delete an attachment from a Jira issue',
    inputSchema: deleteAttachmentInputSchema,
    outputSchema: deleteAttachmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteAttachmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get cloudId from connection config or metadata
      const connection = await platformProxy.getConnection();
      let cloudId = connection.connection_config?.['cloudId'];
      let baseUrl = connection.connection_config?.['baseUrl'];

      // If not in connection config, check metadata
      if (!cloudId || !baseUrl) {
        const metadata = await platformProxy.getMetadata();
        cloudId = cloudId || metadata?.cloudId;
        baseUrl = baseUrl || metadata?.baseUrl;
      }

      // If still missing, fetch from accessible resources and cache
      if (!cloudId || !baseUrl) {
        // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#3--access-to-the-cloud-data
        const accessibleResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const accessibleData = accessibleResponse.data;
        if (Array.isArray(accessibleData) && accessibleData.length > 0) {
          const firstResource = accessibleData[0];
          if (!cloudId) cloudId = firstResource.id;
          if (!baseUrl) baseUrl = firstResource.url;

          // Cache the values in metadata for subsequent runs
          if (cloudId && baseUrl) {
            await platformProxy.updateMetadata({
              cloudId: cloudId,
              baseUrl: baseUrl,
            });
          }
        }
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'Unable to determine Jira Cloud ID',
        });
      }

      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-attachments/#api-rest-api-3-attachment-id-delete
      await platformProxy.delete({
        endpoint: `/ex/jira/${cloudId}/rest/api/3/attachment/${input.id}`,
        headers: {
          'X-Atlassian-Token': 'no-check',
        },
        retries: 3,
      });

      return {
        success: true,
        id: input.id,
      };
    },
  });
}
