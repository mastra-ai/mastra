// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deletePagePropertyInputSchema = z.object({
  pageId: z.number().describe('Page ID. Example: 123'),
  propertyId: z.number().describe('Property ID. Example: 456'),
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
        // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/#auth
        const accessibleResources = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = AccessibleResourceSchema.parse(accessibleResources.data);
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
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${input.pageId}/properties/${input.propertyId}`,
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
