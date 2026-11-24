// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSpacePagesInputSchema = z.object({
  space_id: z.string().describe('The ID of the Confluence space. Example: "294916"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  limit: z.number().int().min(1).max(250).optional().describe('Maximum number of results per page. Example: 25'),
  depth: z.enum(['root', 'all']).optional().describe('Page tree depth filter. Example: "root" or "all"'),
  status: z.array(z.string()).optional().describe('Filter by page status. Example: ["current"]'),
  title: z.string().optional().describe('Filter by page title (partial match).'),
  sort: z
    .enum(['id', '-id', 'created-date', '-created-date', 'modified-date', '-modified-date', 'title', '-title'])
    .optional()
    .describe('Sort order for results.'),
  body_format: z.string().optional().describe('Body format for page content. Defaults to "storage".'),
});

const VersionSchema = z.object({
  number: z.number(),
  message: z.string(),
  minorEdit: z.boolean(),
  authorId: z.string(),
  createdAt: z.string(),
  ncsStepVersion: z.union([z.number(), z.string(), z.null()]).optional(),
});

const PageSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  status: z.string(),
  title: z.string(),
  parentId: z.string().nullable().optional(),
  parentType: z.string().nullable().optional(),
  authorId: z.string(),
  ownerId: z.string().nullish(),
  lastOwnerId: z.string().nullable().optional(),
  createdAt: z.string(),
  position: z.number().nullish(),
  version: VersionSchema.optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  _links: z.record(z.string(), z.unknown()).optional(),
});

export const listSpacePagesOutputSchema = z.object({
  pages: z.array(PageSchema),
  next_cursor: z.string().optional(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

type NangoActionExec = PlatformProxy;

async function getCloudId(platformProxy: NangoActionExec): Promise<string> {
  const connection = await platformProxy.getConnection();
  if (connection.connection_config && typeof connection.connection_config['cloudId'] === 'string') {
    return connection.connection_config['cloudId'];
  }

  const metadata = await platformProxy.getMetadata();
  const parsedMetadata = MetadataSchema.safeParse(metadata);
  if (parsedMetadata.success && parsedMetadata.data.cloudId) {
    return parsedMetadata.data.cloudId;
  }

  // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
  const response = await platformProxy.get({
    endpoint: 'oauth/token/accessible-resources',
    retries: 3,
  });

  const resources = z
    .array(
      z.object({
        id: z.string(),
      }),
    )
    .parse(response.data);

  if (resources.length > 1) {
    throw new platformProxy.ActionError({
      type: 'ambiguous_cloud_id',
      message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
    });
  }
  const firstResource = resources[0];
  if (!firstResource || !firstResource.id) {
    throw new platformProxy.ActionError({
      type: 'cloud_id_not_found',
      message: 'Could not resolve Confluence cloud ID from accessible resources.',
    });
  }

  const cloudId = firstResource.id;
  await platformProxy.updateMetadata({ cloudId });
  return cloudId;
}

export function listSpacePagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_list_space_pages',
    description: 'List pages in a specific Confluence space.',
    inputSchema: listSpacePagesInputSchema,
    outputSchema: listSpacePagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSpacePagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const cloudId = await getCloudId(platformProxy);

      const params: Record<string, string | number | string[]> = {};
      if (input.cursor !== undefined) {
        params['cursor'] = input.cursor;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.depth !== undefined) {
        params['depth'] = input.depth;
      }
      if (input.status !== undefined) {
        params['status'] = input.status;
      }
      if (input.title !== undefined) {
        params['title'] = input.title;
      }
      if (input.sort !== undefined) {
        params['sort'] = input.sort;
      }
      params['body-format'] = input.body_format !== undefined ? input.body_format : 'storage';

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-space-pages/#api-wiki-api-v2-spaces-id-pages-get
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/spaces/${encodeURIComponent(input.space_id)}/pages`,
        params: params,
        retries: 3,
      });

      const responseSchema = z.object({
        results: z.array(z.unknown()),
        _links: z
          .object({
            next: z.string().optional(),
            base: z.string().optional(),
          })
          .optional(),
      });

      const parsed = responseSchema.parse(response.data);
      const pages = parsed.results.map(item => PageSchema.parse(item));

      let nextCursor: string | undefined;
      if (parsed._links?.next) {
        const match = parsed._links.next.match(/[?&]cursor=([^&]+)/);
        if (match && match[1]) {
          nextCursor = decodeURIComponent(match[1]);
        }
      }

      return {
        pages: pages,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
