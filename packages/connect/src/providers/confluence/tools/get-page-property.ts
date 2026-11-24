// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPagePropertyInputSchema = z.object({
  pageId: z.string().describe('Page ID. Example: "12345678"'),
  propertyId: z.string().describe('Property ID. Example: "123456"'),
});

const PropertyVersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const ProviderPropertySchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.unknown().optional(),
  version: PropertyVersionSchema.optional(),
});

export const getPagePropertyOutputSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.unknown().optional(),
  version: PropertyVersionSchema.optional(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export function getPagePropertyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_get_page_property',
    description: 'Retrieve a content property from a Confluence page.',
    inputSchema: getPagePropertyInputSchema,
    outputSchema: getPagePropertyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPagePropertyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection.connection_config;
      let cloudId: string | undefined;

      if (
        connectionConfig &&
        typeof connectionConfig === 'object' &&
        !Array.isArray(connectionConfig) &&
        'cloudId' in connectionConfig &&
        typeof connectionConfig['cloudId'] === 'string'
      ) {
        cloudId = connectionConfig['cloudId'];
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        if (
          metadata &&
          typeof metadata === 'object' &&
          !Array.isArray(metadata) &&
          'cloudId' in metadata &&
          typeof metadata['cloudId'] === 'string'
        ) {
          cloudId = metadata['cloudId'];
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#2-2-get-a-list-of-accessible-resources
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = accessibleResourcesResponse.data;
        if (!Array.isArray(resources) || resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: 'No accessible Confluence resources found for this connection.',
          });
        }

        if (resources.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }
        const firstResource = resources[0];
        if (
          !firstResource ||
          typeof firstResource !== 'object' ||
          !('id' in firstResource) ||
          firstResource.id == null
        ) {
          throw new platformProxy.ActionError({
            type: 'invalid_response',
            message: 'Unexpected response from accessible-resources endpoint.',
          });
        }

        cloudId = String(firstResource.id);
        await platformProxy.updateMetadata({ cloudId });
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-content-properties/#api-pages-page-id-properties-property-id-get
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(input.pageId)}/properties/${encodeURIComponent(input.propertyId)}`,
        retries: 3,
      });

      const providerProperty = ProviderPropertySchema.parse(response.data);

      return {
        id: providerProperty.id,
        key: providerProperty.key,
        ...(providerProperty.value !== undefined && { value: providerProperty.value }),
        ...(providerProperty.version !== undefined && { version: providerProperty.version }),
      };
    },
  });
}
