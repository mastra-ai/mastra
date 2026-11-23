// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createPagePropertyInputSchema = z.object({
  page_id: z.string().describe('The ID of the Confluence page. Example: "123456789"'),
  key: z.string().describe('The key of the content property. Example: "my-property"'),
  value: z.unknown().describe('The JSON value to store.'),
});

const ProviderVersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const ProviderPropertySchema = z.object({
  id: z.string().optional(),
  key: z.string(),
  value: z.unknown().optional(),
  version: ProviderVersionSchema.optional(),
});

export const createPagePropertyOutputSchema = z.object({
  id: z.string().optional(),
  key: z.string(),
  value: z.unknown().optional(),
  version: z
    .object({
      createdAt: z.string().optional(),
      message: z.string().optional(),
      number: z.number().optional(),
      minorEdit: z.boolean().optional(),
      authorId: z.string().optional(),
    })
    .optional(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export function createPagePropertyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_create_page_property',
    description: 'Create a content property on a Confluence page.',
    inputSchema: createPagePropertyInputSchema,
    outputSchema: createPagePropertyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createPagePropertyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      let cloudId: string | undefined;

      if (connection.connection_config && typeof connection.connection_config === 'object') {
        const candidate = connection.connection_config['cloudId'];
        if (typeof candidate === 'string') {
          cloudId = candidate;
        }
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        if (metadata && typeof metadata === 'object') {
          const candidate = metadata['cloudId'];
          if (typeof candidate === 'string') {
            cloudId = candidate;
          }
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const accessibleResourcesSchema = z.array(
          z.object({
            id: z.string(),
          }),
        );

        const accessibleResources = accessibleResourcesSchema.parse(accessibleResourcesResponse.data);

        if (accessibleResources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: 'No accessible Confluence resources found for this connection.',
          });
        }
        if (accessibleResources.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }

        cloudId = accessibleResources[0]!.id;
        await platformProxy.updateMetadata({ cloudId });
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-content-properties/#api-pages-page-id-properties-post
      const response = await platformProxy.post({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(input.page_id)}/properties`,
        data: {
          key: input.key,
          value: input.value,
        },
        retries: 1,
      });

      const providerProperty = ProviderPropertySchema.parse(response.data);

      return {
        ...(providerProperty.id != null && { id: providerProperty.id }),
        key: providerProperty.key,
        ...(providerProperty.value !== undefined && { value: providerProperty.value }),
        ...(providerProperty.version !== undefined && {
          version: {
            ...(providerProperty.version.createdAt !== undefined && { createdAt: providerProperty.version.createdAt }),
            ...(providerProperty.version.message !== undefined && { message: providerProperty.version.message }),
            ...(providerProperty.version.number !== undefined && { number: providerProperty.version.number }),
            ...(providerProperty.version.minorEdit !== undefined && { minorEdit: providerProperty.version.minorEdit }),
            ...(providerProperty.version.authorId !== undefined && { authorId: providerProperty.version.authorId }),
          },
        }),
      };
    },
  });
}
