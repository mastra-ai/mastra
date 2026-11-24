// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export const listPagePropertiesInputSchema = z.object({
  pageId: z.string().describe('Confluence page ID. Example: "12345678"'),
  key: z.string().optional().describe('Filter by property key'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response'),
  limit: z.number().optional().describe('Maximum number of results per page'),
});

const ContentPropertyVersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const ContentPropertySchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.unknown().optional(),
  version: ContentPropertyVersionSchema.optional(),
});

export const listPagePropertiesOutputSchema = z.object({
  properties: z.array(ContentPropertySchema),
  nextCursor: z.string().optional(),
});

export function listPagePropertiesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_list_page_properties',
    description: 'List content properties for a Confluence page.',
    inputSchema: listPagePropertiesInputSchema,
    outputSchema: listPagePropertiesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPagePropertiesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();

      let cloudId: string | undefined;
      const connectionConfig = connection.connection_config;
      if (
        connectionConfig &&
        typeof connectionConfig === 'object' &&
        'cloudId' in connectionConfig &&
        typeof connectionConfig['cloudId'] === 'string'
      ) {
        cloudId = connectionConfig['cloudId'];
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const metadataSchema = z.object({ cloudId: z.string().optional() });
        const parsedMetadata = metadataSchema.safeParse(metadata);
        if (parsedMetadata.success && parsedMetadata.data.cloudId) {
          cloudId = parsedMetadata.data.cloudId;
        }
      }

      if (!cloudId) {
        const resourcesResponse = await platformProxy.get({
          // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/#base-url
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resourcesSchema = z.array(
          z.object({
            id: z.string(),
            name: z.string().optional(),
            url: z.string().optional(),
            scopes: z.array(z.string()).optional(),
            avatarUrl: z.string().optional(),
          }),
        );
        const resources = resourcesSchema.parse(resourcesResponse.data);
        if (resources.length === 0) {
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
        cloudId = resources[0]!.id;

        await platformProxy.updateMetadata({ cloudId });
      }
      const params: Record<string, string | number> = {};
      if (input.key !== undefined) {
        params['key'] = input.key;
      }
      if (input.cursor !== undefined) {
        params['cursor'] = input.cursor;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }

      const response = await platformProxy.get({
        // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-content-properties/#api-pages-page-id-properties-get
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(input.pageId)}/properties`,
        params,
        retries: 3,
      });

      const responseSchema = z.object({
        results: z
          .array(
            z.object({
              id: z.string(),
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
            }),
          )
          .optional(),
        _links: z
          .object({
            next: z.string().optional(),
            base: z.string().optional(),
          })
          .optional(),
      });

      const providerData = responseSchema.parse(response.data);

      const rawNext = providerData._links?.next;
      return {
        properties: providerData.results ?? [],
        ...(rawNext
          ? {
              nextCursor: (() => {
                const u = new URL(rawNext, 'https://dummy');
                return u.searchParams.get('cursor') ?? rawNext;
              })(),
            }
          : {}),
      };
    },
  });
}
