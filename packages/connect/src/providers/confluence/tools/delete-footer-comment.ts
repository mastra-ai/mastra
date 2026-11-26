// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteFooterCommentInputSchema = z.object({
  comment_id: z.string().describe('The ID of the footer comment to delete. Example: "12345"'),
});

export const deleteFooterCommentOutputSchema = z.object({
  success: z.boolean(),
  comment_id: z.string(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  name: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  avatarUrl: z.string().optional(),
});

export function deleteFooterCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_delete_footer_comment',
    description: 'Permanently delete a Confluence footer comment.',
    inputSchema: deleteFooterCommentInputSchema,
    outputSchema: deleteFooterCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteFooterCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection.connection_config;
      let cloudId: string | undefined = connectionConfig?.['cloudId'];

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        cloudId = metadata?.cloudId;
      }

      if (!cloudId) {
        const accessibleResourcesResponse = await platformProxy.get({
          // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#2-get-the-cloudid-for-the-site
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = z.array(AccessibleResourceSchema).safeParse(accessibleResourcesResponse.data);
        if (!resources.success || resources.data.length === 0) {
          throw new platformProxy.ActionError({
            type: 'cloud_id_not_found',
            message: 'Could not resolve Confluence cloud ID from accessible resources.',
          });
        }
        if (resources.data.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }

        cloudId = resources.data[0]!.id;

        await platformProxy.updateMetadata({ cloudId });
      }
      await platformProxy.delete({
        // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-comment/#api-wiki-api-v2-footer-comments-comment-id-delete
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/footer-comments/${encodeURIComponent(input.comment_id)}`,
        retries: 1,
      });

      return {
        success: true,
        comment_id: input.comment_id,
      };
    },
  });
}
