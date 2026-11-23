// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listBlogPostsForLabelInputSchema = z.object({
  label_id: z.string().describe('Label ID. Example: "123456"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  limit: z.number().optional().describe('Maximum number of results to return per page. Example: 25'),
  space_ids: z.array(z.string()).optional().describe('Optional space IDs to filter results.'),
  sort: z.string().optional().describe('Sort order for results.'),
  body_format: z.string().optional().describe("Body format for content. Defaults to 'storage'."),
});

const BlogPostSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    title: z.string().optional(),
    spaceId: z.string().optional(),
    authorId: z.string().optional(),
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
        storage: z.unknown().optional(),
        atlas_doc_format: z.unknown().optional(),
      })
      .optional(),
    _links: z
      .object({
        webui: z.string().optional(),
        editui: z.string().optional(),
        tinyui: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({
  results: z.array(BlogPostSchema).optional(),
  _links: z
    .object({
      next: z.string().optional(),
      base: z.string().optional(),
    })
    .optional(),
});

export const listBlogPostsForLabelOutputSchema = z.object({
  results: z.array(BlogPostSchema),
  next_cursor: z.string().optional(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

function extractCursorFromNextUrl(nextUrl: string): string | undefined {
  const match = nextUrl.match(/[?&]cursor=([^&]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  return undefined;
}

export function listBlogPostsForLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_list_blog_posts_for_label',
    description: 'List Confluence blog posts attached to a label.',
    inputSchema: listBlogPostsForLabelInputSchema,
    outputSchema: listBlogPostsForLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBlogPostsForLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = z
        .object({})
        .passthrough()
        .parse(connection.connection_config || {});
      const rawCloudId = connectionConfig['cloudId'];
      let cloudId: string;

      if (typeof rawCloudId === 'string' && rawCloudId.length > 0) {
        cloudId = rawCloudId;
      } else {
        const metadata = await platformProxy.getMetadata();
        const parsedMetadata = MetadataSchema.safeParse(metadata);
        const metadataCloudId = parsedMetadata.success ? parsedMetadata.data['cloudId'] : undefined;

        if (typeof metadataCloudId === 'string' && metadataCloudId.length > 0) {
          cloudId = metadataCloudId;
        } else {
          // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#implementing-oauth-2-0--3lo-
          const accessibleResourcesResponse = await platformProxy.get({
            endpoint: 'oauth/token/accessible-resources',
            retries: 3,
          });

          const accessibleResources = z.array(z.object({}).passthrough()).parse(accessibleResourcesResponse.data || []);
          const firstId = accessibleResources[0]?.['id'];
          if (accessibleResources.length === 0 || typeof firstId !== 'string') {
            throw new platformProxy.ActionError({
              type: 'cloud_id_not_found',
              message: 'Could not resolve Confluence cloud ID from connection or accessible resources.',
            });
          }
          if (accessibleResources.length > 1) {
            throw new platformProxy.ActionError({
              type: 'ambiguous_cloud_id',
              message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
            });
          }

          cloudId = firstId;
          await platformProxy.updateMetadata({ cloudId });
        }
      }
      const params: Record<string, string | number | string[] | number[]> = {};
      if (input.cursor !== undefined && input.cursor.length > 0) {
        params['cursor'] = input.cursor;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.space_ids !== undefined && input.space_ids.length > 0) {
        params['space-id'] = input.space_ids;
      }
      if (input.sort !== undefined && input.sort.length > 0) {
        params['sort'] = input.sort;
      }
      if (input.body_format !== undefined && input.body_format.length > 0) {
        params['body-format'] = input.body_format;
      } else {
        params['body-format'] = 'storage';
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-blog-post/#api-blog-post-get-blog-posts-for-label
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/labels/${encodeURIComponent(input.label_id)}/blogposts`,
        params,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data || {});
      const results = providerResponse.results || [];

      let nextCursor: string | undefined;
      if (
        providerResponse._links &&
        typeof providerResponse._links.next === 'string' &&
        providerResponse._links.next.length > 0
      ) {
        nextCursor = extractCursorFromNextUrl(providerResponse._links.next);
      }

      return {
        results,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
