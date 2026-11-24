// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createPageInputSchema = z.object({
  spaceId: z.string().describe('Space ID. Example: "123456"'),
  parentId: z.string().optional().describe('Parent page ID. Example: "987654"'),
  title: z.string().describe('Page title. Example: "My New Page"'),
  status: z.string().optional().describe('Page status. Example: "current" or "draft".'),
  body: z.string().optional().describe('Page body in storage format. Example: "<p>Hello world</p>"'),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const ProviderPageSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  spaceId: z.string().optional(),
  parentId: z.string().nullish(),
  parentType: z.string().nullish(),
  position: z.number().nullish(),
  authorId: z.string().optional(),
  ownerId: z.string().nullish(),
  lastOwnerId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  version: z
    .object({
      createdAt: z.string().optional(),
      message: z.string().optional(),
      number: z.number().optional(),
      minorEdit: z.boolean().optional(),
      authorId: z.string().optional(),
    })
    .optional(),
  body: z
    .object({
      storage: z.record(z.string(), z.unknown()).optional(),
      atlas_doc_format: z.record(z.string(), z.unknown()).optional(),
      view: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  _links: z
    .object({
      webui: z.string().optional(),
      editui: z.string().optional(),
      tinyui: z.string().optional(),
      base: z.string().optional(),
    })
    .optional(),
});

export const createPageOutputSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  spaceId: z.string().optional(),
  parentId: z.string().optional(),
  parentType: z.string().optional(),
  position: z.number().optional(),
  authorId: z.string().optional(),
  ownerId: z.string().optional(),
  lastOwnerId: z.string().optional(),
  createdAt: z.string().optional(),
  version: z
    .object({
      createdAt: z.string().optional(),
      message: z.string().optional(),
      number: z.number().optional(),
      minorEdit: z.boolean().optional(),
      authorId: z.string().optional(),
    })
    .optional(),
  body: z
    .object({
      storage: z.record(z.string(), z.unknown()).optional(),
      atlasDocFormat: z.record(z.string(), z.unknown()).optional(),
      view: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  links: z
    .object({
      webui: z.string().optional(),
      editui: z.string().optional(),
      tinyui: z.string().optional(),
      base: z.string().optional(),
    })
    .optional(),
});

export function createPageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_create_page',
    description: 'Create a Confluence page in a space.',
    inputSchema: createPageInputSchema,
    outputSchema: createPageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createPageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfigSchema = z.object({
        cloudId: z.string().optional(),
      });
      const connectionConfig = connectionConfigSchema.safeParse(connection.connection_config);
      let cloudId = connectionConfig.success ? connectionConfig.data.cloudId : undefined;

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        cloudId = metadata.cloudId;

        if (!cloudId) {
          const accessibleResourcesConfig: PlatformProxyRequest = {
            // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/#auth
            endpoint: 'oauth/token/accessible-resources',
            retries: 3,
          };

          const accessibleResources = await platformProxy.get(accessibleResourcesConfig);

          const resourcesSchema = z.array(z.record(z.string(), z.unknown()));
          const resources = resourcesSchema.safeParse(accessibleResources.data);
          if (!resources.success || !resources.data || resources.data.length === 0) {
            throw new platformProxy.ActionError({
              type: 'not_found',
              message: 'No accessible Confluence resources found for this connection.',
            });
          }

          if (resources.data.length > 1) {
            throw new platformProxy.ActionError({
              type: 'ambiguous_cloud_id',
              message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
            });
          }
          const firstResourceSchema = z.object({
            id: z.string(),
          });
          const firstResource = firstResourceSchema.safeParse(resources.data[0]);
          if (!firstResource.success) {
            throw new platformProxy.ActionError({
              type: 'invalid_response',
              message: 'Accessible resources response missing id field.',
            });
          }

          cloudId = firstResource.data.id;
          await platformProxy.updateMetadata({ cloudId });
        }
      }

      const requestBody: Record<string, unknown> = {
        spaceId: input.spaceId,
        title: input.title,
      };

      if (input.status !== undefined) {
        requestBody['status'] = input.status;
      }

      if (input.parentId !== undefined) {
        requestBody['parentId'] = input.parentId;
      }

      if (input.body !== undefined) {
        requestBody['body'] = {
          representation: 'storage',
          value: input.body,
        };
      }

      const createConfig: PlatformProxyRequest = {
        // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/#api-pages-post
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages`,
        data: requestBody,
        retries: 1,
      };

      const response = await platformProxy.post(createConfig);

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Empty response from Confluence API.',
        });
      }

      const providerPage = ProviderPageSchema.parse(response.data);

      return {
        id: providerPage.id,
        ...(providerPage.status != null && { status: providerPage.status }),
        ...(providerPage.title != null && { title: providerPage.title }),
        ...(providerPage.spaceId != null && { spaceId: providerPage.spaceId }),
        ...(providerPage.parentId != null && { parentId: providerPage.parentId }),
        ...(providerPage.parentType != null && { parentType: providerPage.parentType }),
        ...(providerPage.position != null && { position: providerPage.position }),
        ...(providerPage.authorId != null && { authorId: providerPage.authorId }),
        ...(providerPage.ownerId != null && { ownerId: providerPage.ownerId }),
        ...(providerPage.lastOwnerId != null && { lastOwnerId: providerPage.lastOwnerId }),
        ...(providerPage.createdAt != null && { createdAt: providerPage.createdAt }),
        ...(providerPage.version != null && {
          version: {
            ...(providerPage.version.createdAt != null && { createdAt: providerPage.version.createdAt }),
            ...(providerPage.version.message != null && { message: providerPage.version.message }),
            ...(providerPage.version.number != null && { number: providerPage.version.number }),
            ...(providerPage.version.minorEdit != null && { minorEdit: providerPage.version.minorEdit }),
            ...(providerPage.version.authorId != null && { authorId: providerPage.version.authorId }),
          },
        }),
        ...(providerPage.body != null && {
          body: {
            ...(providerPage.body.storage != null && { storage: providerPage.body.storage }),
            ...(providerPage.body.atlas_doc_format != null && { atlasDocFormat: providerPage.body.atlas_doc_format }),
            ...(providerPage.body.view != null && { view: providerPage.body.view }),
          },
        }),
        ...(providerPage._links != null && {
          links: {
            ...(providerPage._links.webui != null && { webui: providerPage._links.webui }),
            ...(providerPage._links.editui != null && { editui: providerPage._links.editui }),
            ...(providerPage._links.tinyui != null && { tinyui: providerPage._links.tinyui }),
            ...(providerPage._links.base != null && { base: providerPage._links.base }),
          },
        }),
      };
    },
  });
}
