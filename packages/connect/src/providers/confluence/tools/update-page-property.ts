// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updatePagePropertyInputSchema = z.object({
  page_id: z.string().describe('Page ID. Example: "123456789"'),
  property_id: z.string().describe('Property ID. Example: "987654321"'),
  key: z.string().describe('Property key. Example: "my-property"'),
  value: z.unknown().describe('JSON value to store.'),
  version_number: z.number().describe('Next version number. Must be higher than the current version.'),
  version_message: z.string().optional().describe('Optional version message.'),
});

const MetadataSchema = z.object({
  cloud_id: z.string().optional(),
  cloudId: z.string().optional(),
});

const ProviderVersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const ProviderContentPropertySchema = z.object({
  id: z.string(),
  key: z.string(),
  version: ProviderVersionSchema,
});

export const updatePagePropertyOutputSchema = z.object({
  id: z.string(),
  key: z.string(),
  version: z.object({
    createdAt: z.string().optional(),
    message: z.string().optional(),
    number: z.number(),
    minorEdit: z.boolean().optional(),
    authorId: z.string().optional(),
  }),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  name: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  avatarUrl: z.string().optional(),
});

export function updatePagePropertyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_update_page_property',
    description: 'Update a content property on a Confluence page.',
    inputSchema: updatePagePropertyInputSchema,
    outputSchema: updatePagePropertyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updatePagePropertyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();

      let cloudId: string | undefined;

      if (connection.connection_config && typeof connection.connection_config['cloudId'] === 'string') {
        cloudId = connection.connection_config['cloudId'];
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        if (metadata && typeof metadata.cloudId === 'string') {
          cloudId = metadata.cloudId;
        }
        if (!cloudId && metadata && typeof metadata.cloud_id === 'string') {
          cloudId = metadata.cloud_id;
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#getting-access-to-an-instance
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: '/oauth/token/accessible-resources',
          retries: 3,
        });

        const resourcesData = z.array(AccessibleResourceSchema).parse(accessibleResourcesResponse.data);
        if (resourcesData.length === 0) {
          throw new platformProxy.ActionError({
            type: 'cloud_id_not_found',
            message: 'Could not resolve Confluence cloud ID from connection config or accessible resources.',
          });
        }
        if (resourcesData.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }

        cloudId = resourcesData[0]!.id;

        await platformProxy.updateMetadata({
          cloud_id: cloudId,
        });
      }

      const requestBody = {
        key: input.key,
        value: input.value,
        version: {
          number: input.version_number,
          ...(input.version_message !== undefined && { message: input.version_message }),
        },
      };

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-content-properties/#api-pages-page-id-properties-property-id-put
      const response = await platformProxy.put({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(input.page_id)}/properties/${encodeURIComponent(input.property_id)}`,
        data: requestBody,
        retries: 10,
      });

      const providerProperty = ProviderContentPropertySchema.parse(response.data);

      return {
        id: providerProperty.id,
        key: providerProperty.key,
        version: {
          ...(providerProperty.version.createdAt !== undefined && { createdAt: providerProperty.version.createdAt }),
          ...(providerProperty.version.message !== undefined && { message: providerProperty.version.message }),
          number: providerProperty.version.number,
          ...(providerProperty.version.minorEdit !== undefined && { minorEdit: providerProperty.version.minorEdit }),
          ...(providerProperty.version.authorId !== undefined && { authorId: providerProperty.version.authorId }),
        },
      };
    },
  });
}
