// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteInlineCommentInputSchema = z.object({
  commentId: z.string().describe('The ID of the inline comment to delete. Example: "123456789"'),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const AccessibleResourcesResponseSchema = z.array(
  z.object({
    id: z.string(),
  }),
);

export const deleteInlineCommentOutputSchema = z.null();

export function deleteInlineCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_delete_inline_comment',
    description: 'Permanently delete a Confluence inline comment.',
    inputSchema: deleteInlineCommentInputSchema,
    outputSchema: deleteInlineCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteInlineCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection.connection_config;

      let cloudId: string | undefined;
      if (
        typeof connectionConfig === 'object' &&
        connectionConfig !== null &&
        'cloudId' in connectionConfig &&
        typeof connectionConfig['cloudId'] === 'string'
      ) {
        cloudId = connectionConfig['cloudId'];
      }

      if (!cloudId) {
        const metadata = MetadataSchema.parse((await platformProxy.getMetadata()) ?? {});
        cloudId = metadata.cloudId;
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#3--access-granted
        const response = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = AccessibleResourcesResponseSchema.safeParse(response.data);
        if (!resources.success || resources.data.length === 0) {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
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

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-comment/#api-inline-comments-comment-id-delete
      await platformProxy.delete({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/inline-comments/${encodeURIComponent(input.commentId)}`,
        retries: 1,
      });

      return null;
    },
  });
}
