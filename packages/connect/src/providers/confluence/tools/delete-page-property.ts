// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deletePagePropertyInputSchema = z.object({
  pageId: z.string().regex(/^\d+$/, 'must be a numeric page id').describe('Page ID. Example: "123"'),
  propertyId: z.string().regex(/^\d+$/, 'must be a numeric property id').describe('Property ID. Example: "456"'),
});

export const deletePagePropertyOutputSchema = z.object({
  success: z.boolean(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const AccessibleResourceSchema = z.array(
  z.object({
    id: z.string(),
  }),
);

export function deletePagePropertyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_delete_page_property',
    description: 'Delete a content property from a Confluence page.',
    inputSchema: deletePagePropertyInputSchema,
    outputSchema: deletePagePropertyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deletePagePropertyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      let cloudId = z.string().optional().parse(connection.connection_config?.['cloudId']);
      if (!cloudId) {
        const metadata = MetadataSchema.safeParse(await platformProxy.getMetadata());
        cloudId = metadata.success ? metadata.data.cloudId : undefined;
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/#auth
        const accessibleResources = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = AccessibleResourceSchema.parse(accessibleResources.data);
        if (resources.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }
        const firstResource = resources[0];
        if (!firstResource) {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
            message: 'No accessible Confluence resources found for this connection.',
          });
        }

        cloudId = firstResource.id;
        await platformProxy.updateMetadata({ cloudId });
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-content-properties/#api-pages-page-id-properties-property-id-delete
      const response = await platformProxy.delete({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(input.pageId)}/properties/${encodeURIComponent(input.propertyId)}`,
        retries: 1,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Page property ${input.propertyId} not found on page ${input.pageId}.`,
        });
      }

      return { success: true };
    },
  });
}
