// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export const listSpacesInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  key: z.string().optional().describe('Filter by space key.'),
  type: z.string().optional().describe('Filter by space type. Example: "global", "personal".'),
  status: z.string().optional().describe('Filter by space status. Example: "current", "archived".'),
  label: z.string().optional().describe('Filter by label name.'),
  includeIcon: z.boolean().optional().describe('Include space icon in the response.'),
});

const ProviderSpaceSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  authorId: z.string().nullish(),
  currentActiveAlias: z.string().nullish(),
  createdAt: z.string().nullish(),
  homepageId: z.string().nullish(),
  description: z.record(z.string(), z.unknown()).nullish(),
  icon: z
    .object({
      path: z.string().optional(),
      apiDownloadLink: z.string().optional(),
    })
    .nullish(),
  _links: z.record(z.string(), z.unknown()).nullish(),
});

const SpaceSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  authorId: z.string().optional(),
  currentActiveAlias: z.string().optional(),
  createdAt: z.string().optional(),
  homepageId: z.string().optional(),
  description: z.record(z.string(), z.unknown()).optional(),
  icon: z
    .object({
      path: z.string().optional(),
      apiDownloadLink: z.string().optional(),
    })
    .optional(),
  _links: z.record(z.string(), z.unknown()).optional(),
});

export const listSpacesOutputSchema = z.object({
  items: z.array(SpaceSchema),
  nextCursor: z.string().optional(),
});

const AccessibleResourcesSchema = z.array(
  z.object({
    id: z.string(),
    url: z.string().optional(),
    name: z.string().optional(),
  }),
);

function extractNextCursor(nextUrl: string | undefined): string | undefined {
  if (!nextUrl) {
    return undefined;
  }
  if (nextUrl.startsWith('http://') || nextUrl.startsWith('https://')) {
    const url = new URL(nextUrl);
    const cursor = url.searchParams.get('cursor');
    return cursor || undefined;
  }
  const url = new URL(nextUrl, 'https://example.com');
  const cursor = url.searchParams.get('cursor');
  return cursor || undefined;
}

function mapProviderSpaceToOutput(providerSpace: z.infer<typeof ProviderSpaceSchema>): z.infer<typeof SpaceSchema> {
  return {
    id: providerSpace.id,
    key: providerSpace.key,
    name: providerSpace.name,
    type: providerSpace.type,
    status: providerSpace.status,
    ...(providerSpace.authorId != null && { authorId: providerSpace.authorId }),
    ...(providerSpace.currentActiveAlias != null && { currentActiveAlias: providerSpace.currentActiveAlias }),
    ...(providerSpace.createdAt != null && { createdAt: providerSpace.createdAt }),
    ...(providerSpace.homepageId != null && { homepageId: providerSpace.homepageId }),
    ...(providerSpace.description != null && { description: providerSpace.description }),
    ...(providerSpace.icon != null && { icon: providerSpace.icon }),
    ...(providerSpace._links != null && { _links: providerSpace._links }),
  };
}

export function listSpacesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_list_spaces',
    description: 'List accessible Confluence spaces.',
    inputSchema: listSpacesInputSchema,
    outputSchema: listSpacesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSpacesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();

      const connectionConfigSchema = z.object({
        cloudId: z.string().optional(),
      });
      const parsedConnectionConfig = connectionConfigSchema.safeParse(connection.connection_config);
      let cloudId: string | undefined;
      if (parsedConnectionConfig.success) {
        cloudId = parsedConnectionConfig.data.cloudId;
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const parsedMetadata = MetadataSchema.safeParse(metadata);
        if (parsedMetadata.success && parsedMetadata.data.cloudId) {
          cloudId = parsedMetadata.data.cloudId;
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const parsedResources = AccessibleResourcesSchema.safeParse(accessibleResourcesResponse.data);
        if (!parsedResources.success || parsedResources.data.length === 0) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: 'Could not find a Confluence cloud instance for this connection.',
          });
        }
        if (parsedResources.data.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }
        cloudId = parsedResources.data[0]!.id;

        // https://docs.nango.dev/reference/sdk/javascript#set-metadata
        await platformProxy.updateMetadata({ cloudId });
      }

      const params: Record<string, string | number | string[]> = {};
      if (input.cursor) {
        params['cursor'] = input.cursor;
      }
      if (input.key) {
        params['keys'] = [input.key];
      }
      if (input.type) {
        params['type'] = input.type;
      }
      if (input.status) {
        params['status'] = input.status;
      }
      if (input.label) {
        params['labels'] = [input.label];
      }
      if (input.includeIcon !== undefined) {
        params['include-icon'] = String(input.includeIcon);
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-space/#api-spaces-get
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/spaces`,
        params,
        retries: 3,
      });

      const responseSchema = z.object({
        results: z.array(z.record(z.string(), z.unknown())).optional(),
        _links: z
          .object({
            next: z.string().optional(),
            base: z.string().optional(),
          })
          .optional(),
      });

      const parsedResponse = responseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Failed to parse the Confluence API response.',
        });
      }

      const results = parsedResponse.data.results || [];
      const nextUrl = parsedResponse.data._links?.next;
      const nextCursor = extractNextCursor(nextUrl);

      const items: z.infer<typeof SpaceSchema>[] = [];
      for (const item of results) {
        const parsedSpace = ProviderSpaceSchema.safeParse(item);
        if (parsedSpace.success) {
          items.push(mapProviderSpaceToOutput(parsedSpace.data));
        }
      }

      return {
        items,
        ...(nextCursor && { nextCursor }),
      };
    },
  });
}
