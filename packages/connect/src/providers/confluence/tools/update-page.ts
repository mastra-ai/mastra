// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const ConnectionConfigSchema = z
  .object({
    cloudId: z.string().optional(),
  })
  .passthrough();

export const updatePageInputSchema = z.object({
  id: z.string().describe('Page ID. Example: "123456"'),
  title: z.string().describe('Page title'),
  status: z.string().describe('Page status. Example: "current"'),
  body: z.string().describe('Page body in storage format'),
  versionMessage: z.string().optional().describe('Version message'),
});

const ProviderVersionSchema = z.object({
  number: z.number(),
});

const ProviderPageSchema = z.object({
  id: z.string(),
  status: z.string(),
  title: z.string(),
  spaceId: z.string().optional(),
  version: ProviderVersionSchema,
});

export const updatePageOutputSchema = z.object({
  id: z.string(),
  status: z.string(),
  title: z.string(),
  spaceId: z.string().optional(),
  versionNumber: z.number().optional(),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
});

export function updatePageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_update_page',
    description: 'Update a Confluence page by id',
    inputSchema: updatePageInputSchema,
    outputSchema: updatePageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updatePageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = ConnectionConfigSchema.parse(connection.connection_config || {});
      let cloudId = connectionConfig.cloudId;

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const parsedMetadata = MetadataSchema.safeParse(metadata);
        if (parsedMetadata.success && parsedMetadata.data.cloudId) {
          cloudId = parsedMetadata.data.cloudId;
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#accessing-data-from-an-on-behalf-of-integration
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });
        const resources = z.array(AccessibleResourceSchema).parse(accessibleResourcesResponse.data);
        if (resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Confluence resources found',
          });
        }
        if (resources.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }
        cloudId = resources[0]!.id;
        await platformProxy.updateMetadata({ cloudId });
      }
      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/#api-pages-id-get
      const getResponse = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(input.id)}`,
        params: {
          'body-format': 'storage',
        },
        retries: 3,
      });

      const currentPage = ProviderPageSchema.parse(getResponse.data);
      const nextVersionNumber = input.status === 'draft' ? 1 : currentPage.version.number + 1;

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/#api-pages-id-put
      const updateResponse = await platformProxy.put({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(input.id)}`,
        data: {
          id: input.id,
          status: input.status,
          title: input.title,
          body: {
            representation: 'storage',
            value: input.body,
          },
          version: {
            number: nextVersionNumber,
            ...(input.versionMessage !== undefined && { message: input.versionMessage }),
          },
        },
        retries: 1,
      });

      const updatedPage = ProviderPageSchema.parse(updateResponse.data);

      return {
        id: updatedPage.id,
        status: updatedPage.status,
        title: updatedPage.title,
        ...(updatedPage.spaceId !== undefined && { spaceId: updatedPage.spaceId }),
        versionNumber: updatedPage.version.number,
      };
    },
  });
}
