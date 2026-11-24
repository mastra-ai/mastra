// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteAttachmentInputSchema = z.object({
  id: z.string().describe('Attachment ID. Example: "123456"'),
  purge: z
    .boolean()
    .optional()
    .describe('Permanently delete the attachment. Must be true to purge a trashed attachment.'),
});

export const deleteAttachmentOutputSchema = z.object({
  success: z.boolean(),
  id: z.string(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export function deleteAttachmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_delete_attachment',
    description: 'Delete a Confluence attachment by id.',
    inputSchema: deleteAttachmentInputSchema,
    outputSchema: deleteAttachmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteAttachmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let cloudId: string | undefined;

      const connection = await platformProxy.getConnection();
      if (connection && typeof connection === 'object') {
        const connectionConfig = connection['connection_config'];
        if (
          connectionConfig &&
          typeof connectionConfig === 'object' &&
          typeof connectionConfig['cloudId'] === 'string'
        ) {
          cloudId = connectionConfig['cloudId'];
        }
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        if (metadata && typeof metadata === 'object' && typeof metadata['cloudId'] === 'string') {
          cloudId = metadata['cloudId'];
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#how-3lo-works
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = Array.isArray(accessibleResourcesResponse.data) ? accessibleResourcesResponse.data : [];
        if (resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
            message: 'Could not resolve Confluence cloudId from connection config or accessible resources.',
          });
        }
        if (resources.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }
        const firstRes = resources[0];
        if (!firstRes || typeof firstRes !== 'object' || typeof firstRes['id'] !== 'string') {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
            message: 'Could not resolve Confluence cloudId from connection config or accessible resources.',
          });
        }
        cloudId = firstRes['id'];

        await platformProxy.updateMetadata({
          cloudId: cloudId,
        });
      }

      const deleteParams: Record<string, string> = {};
      if (input.purge !== undefined) {
        deleteParams['purge'] = String(input.purge);
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-attachment/#api-attachments-id-delete
      await platformProxy.delete({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/attachments/${encodeURIComponent(input.id)}`,
        ...(Object.keys(deleteParams).length > 0 && { params: deleteParams }),
        retries: 1,
      });

      return {
        success: true,
        id: input.id,
      };
    },
  });
}
