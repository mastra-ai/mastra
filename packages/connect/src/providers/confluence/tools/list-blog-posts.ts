// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export const listBlogPostsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  spaceId: z.string().optional().describe('Space ID filter.'),
  status: z.string().optional().describe('Status filter, e.g. current.'),
  title: z.string().optional().describe('Title filter.'),
  sort: z
    .enum(['id', '-id', 'created-date', '-created-date', 'modified-date', '-modified-date'])
    .optional()
    .describe('Sort order; a leading - sorts descending. Example: "-created-date"'),
  bodyFormat: z
    .enum(['storage', 'atlas_doc_format'])
    .optional()
    .describe('Body format representation. Defaults to storage.'),
  limit: z.number().int().min(1).max(250).optional().describe('Maximum number of results per page.'),
});

const ProviderVersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const ProviderBodySchema = z.object({
  storage: z.unknown().optional(),
  atlas_doc_format: z.unknown().optional(),
  view: z.unknown().optional(),
});

const ProviderItemLinksSchema = z.object({
  webui: z.string().optional(),
  editui: z.string().optional(),
  tinyui: z.string().optional(),
});

const ProviderBlogPostSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  spaceId: z.string().optional(),
  authorId: z.string().optional(),
  createdAt: z.string().optional(),
  version: ProviderVersionSchema.optional(),
  body: ProviderBodySchema.optional(),
  _links: ProviderItemLinksSchema.optional(),
});

const ProviderResponseSchema = z.object({
  results: z.array(ProviderBlogPostSchema),
  _links: z
    .object({
      next: z.string().optional(),
      base: z.string().optional(),
    })
    .optional(),
});

const BlogPostSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  spaceId: z.string().optional(),
  authorId: z.string().optional(),
  createdAt: z.string().optional(),
  version: ProviderVersionSchema.optional(),
  body: ProviderBodySchema.optional(),
  _links: ProviderItemLinksSchema.optional(),
});

export const listBlogPostsOutputSchema = z.object({
  results: z.array(BlogPostSchema),
  nextCursor: z.string().optional(),
});

export function listBlogPostsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_list_blog_posts',
    description: 'List Confluence blog posts with pagination.',
    inputSchema: listBlogPostsInputSchema,
    outputSchema: listBlogPostsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBlogPostsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = z.record(z.string(), z.unknown()).parse(connection.connection_config ?? {});
      let cloudId = typeof connectionConfig['cloudId'] === 'string' ? connectionConfig['cloudId'] : undefined;

      if (!cloudId) {
        const metadata = MetadataSchema.parse((await platformProxy.getMetadata()) ?? {});
        cloudId = metadata.cloudId;
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/#auth
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const accessibleResourcesSchema = z.array(
          z
            .object({
              id: z.string(),
            })
            .passthrough(),
        );
        const accessibleResources = accessibleResourcesSchema.parse(accessibleResourcesResponse.data);
        if (accessibleResources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
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

      const baseUrl = `https://api.atlassian.com/ex/confluence/${cloudId}`;

      const params = {
        'body-format': input.bodyFormat ?? 'storage',
        ...(input.cursor !== undefined && { cursor: input.cursor }),
        ...(input.spaceId !== undefined && { 'space-id': input.spaceId }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.sort !== undefined && { sort: input.sort }),
        ...(input.limit !== undefined && { limit: input.limit }),
      };

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-blog-post/#api-blogposts-get
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/blogposts`,
        params,
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      let nextCursor: string | undefined;
      const nextLink = providerData._links?.next;
      if (nextLink) {
        // @allowTryCatch
        try {
          const nextUrl = new URL(nextLink, baseUrl);
          const cursor = nextUrl.searchParams.get('cursor');
          if (cursor) {
            nextCursor = cursor;
          }
        } catch {
          // ignore malformed URL
        }
      }

      if (!nextCursor && typeof response.headers?.['link'] === 'string') {
        const parts = response.headers['link'].split(',');
        for (const part of parts) {
          const match = part.match(/<([^>]+)>;\s*rel="next"/);
          if (match && match[1]) {
            // @allowTryCatch
            try {
              const nextUrl = new URL(match[1], baseUrl);
              const cursor = nextUrl.searchParams.get('cursor');
              if (cursor) {
                nextCursor = cursor;
                break;
              }
            } catch {
              // ignore malformed URL
            }
          }
        }
      }

      return {
        results: providerData.results.map(post => ({
          id: post.id,
          ...(post.status !== undefined && { status: post.status }),
          ...(post.title !== undefined && { title: post.title }),
          ...(post.spaceId !== undefined && { spaceId: post.spaceId }),
          ...(post.authorId !== undefined && { authorId: post.authorId }),
          ...(post.createdAt !== undefined && { createdAt: post.createdAt }),
          ...(post.version !== undefined && { version: post.version }),
          ...(post.body !== undefined && { body: post.body }),
          ...(post._links !== undefined && { _links: post._links }),
        })),
        ...(nextCursor !== undefined && { nextCursor }),
      };
    },
  });
}
