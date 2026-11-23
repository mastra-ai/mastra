// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchContentInputSchema = z.object({
  cql: z.string().describe('CQL query string. Example: "type=page AND space=DEV"'),
  limit: z.number().int().min(1).optional().describe('Maximum number of results per page. Default: 25'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  expand: z
    .array(z.string())
    .optional()
    .describe('Fields to expand in the response. Example: ["content.space", "content.history"]'),
});

const SpaceSchema = z
  .object({
    id: z.union([z.number().int(), z.string()]).optional(),
    key: z.string(),
    name: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

const ContentSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    status: z.string().optional(),
    title: z.string().optional(),
    space: SpaceSchema.optional(),
  })
  .passthrough();

const SearchResultSchema = z
  .object({
    content: ContentSchema.optional(),
    url: z.string().optional(),
    title: z.string().optional(),
    excerpt: z.string().optional(),
    contentType: z.string().optional(),
    resultParentContainer: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const searchContentOutputSchema = z.object({
  results: z.array(SearchResultSchema),
  next_cursor: z.string().optional(),
  totalSize: z.number().optional(),
  start: z.number().optional(),
  limit: z.number().optional(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  url: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  avatarUrl: z.string().optional(),
});

const SearchResponseSchema = z
  .object({
    results: z.array(z.record(z.string(), z.unknown())),
    _links: z.record(z.string(), z.unknown()).optional(),
    totalSize: z.number().optional(),
    start: z.number().optional(),
    limit: z.number().optional(),
  })
  .passthrough();

export function searchContentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_search_content',
    description: 'Search Confluence content with CQL',
    inputSchema: searchContentInputSchema,
    outputSchema: searchContentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchContentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Get metadata to check for cached cloudId
      const metadata = await platformProxy.getMetadata();
      const metaResult = MetadataSchema.safeParse(metadata);
      const connection = await platformProxy.getConnection();
      const configCloudId = connection.connection_config?.['cloudId'];
      let cloudId =
        typeof configCloudId === 'string' && configCloudId
          ? configCloudId
          : metaResult.success
            ? metaResult.data.cloudId
            : undefined;

      // If cloudId not in metadata, fetch from accessible resources
      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#3lo---how-to-get-the-cloudid
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const parsedResources = z.array(AccessibleResourceSchema).safeParse(accessibleResourcesResponse.data);
        if (!parsedResources.success || !parsedResources.data || parsedResources.data.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Confluence resources found for this connection',
          });
        }

        if (parsedResources.data.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }
        const firstResource = parsedResources.data[0];
        if (!firstResource || !firstResource.id) {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
            message: 'Accessible resource does not contain a cloudId',
          });
        }
        cloudId = firstResource.id;

        // Cache the cloudId in metadata for subsequent runs
        await platformProxy.updateMetadata({ cloudId });
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'Unable to determine Confluence cloudId',
        });
      }

      // Build query parameters
      const params: Record<string, string | number> = {
        cql: input.cql,
        limit: input.limit ?? 25,
      };

      if (input.cursor) {
        params['cursor'] = input.cursor;
      }

      if (input.expand && input.expand.length > 0) {
        params['expand'] = input.expand.join(',');
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-search/#api-wiki-rest-api-search-get
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/rest/api/search`,
        params: params,
        retries: 3,
      });

      const parsedResponse = SearchResponseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Failed to parse search response from Confluence API',
        });
      }

      const data = parsedResponse.data;
      const results = data.results.map(result => {
        const parsed = SearchResultSchema.safeParse(result);
        return parsed.success ? parsed.data : result;
      });

      // Extract cursor from _links if present
      let nextCursor: string | undefined;
      if (data._links && typeof data._links['next'] === 'string') {
        const nextUrl = new URL(data._links['next'], 'https://api.atlassian.com');
        nextCursor = nextUrl.searchParams.get('cursor') ?? undefined;
      }

      return {
        results: results,
        ...(nextCursor && { next_cursor: nextCursor }),
        ...(data.totalSize !== undefined && { totalSize: data.totalSize }),
        ...(data.start !== undefined && { start: data.start }),
        ...(data.limit !== undefined && { limit: data.limit }),
      };
    },
  });
}
