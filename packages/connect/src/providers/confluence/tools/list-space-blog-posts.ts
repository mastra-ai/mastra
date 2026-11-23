// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listSpaceBlogPostsInputSchema = z.object({
  spaceId: z.string().describe('The ID of the Confluence space. Example: "123"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  status: z.string().optional().describe('Filter by status such as current, archived, draft, or trashed.'),
  title: z.string().optional().describe('Filter by blog post title.'),
  sort: z.string().optional().describe('Sort order such as created-date or -created-date.'),
  bodyFormat: z
    .enum(['storage', 'atlas_doc_format'])
    .optional()
    .describe('Body format to include: storage or atlas_doc_format.'),
  limit: z.number().optional().describe('Maximum number of results to return per page.'),
});

const BlogPostSchema = z.object({
  id: z.string(),
  status: z.string(),
  title: z.string().optional().nullable(),
  spaceId: z.string().optional().nullable(),
  authorId: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  version: z
    .object({
      createdAt: z.string().optional().nullable(),
      message: z.string().optional().nullable(),
      number: z.number().optional().nullable(),
      minorEdit: z.boolean().optional().nullable(),
      authorId: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  body: z.record(z.string(), z.unknown()).optional().nullable(),
  _links: z
    .object({
      webui: z.string().optional().nullable(),
      editui: z.string().optional().nullable(),
      tinyui: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

const ResponseSchema = z.object({
  results: z.array(BlogPostSchema),
  _links: z
    .object({
      next: z.string().optional().nullable(),
      base: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const listSpaceBlogPostsOutputSchema = z.object({
  blogPosts: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
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
      body: z.record(z.string(), z.unknown()).optional(),
      links: z
        .object({
          webui: z.string().optional(),
          editui: z.string().optional(),
          tinyui: z.string().optional(),
        })
        .optional(),
    }),
  ),
  nextCursor: z.string().optional(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export function listSpaceBlogPostsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_list_space_blog_posts',
    description: 'List blog posts in a specific Confluence space.',
    inputSchema: listSpaceBlogPostsInputSchema,
    outputSchema: listSpaceBlogPostsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSpaceBlogPostsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const config = connection.connection_config;
      let cloudId = config && config['cloudId'];

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        if (metadata && typeof metadata === 'object' && 'cloudId' in metadata) {
          const candidate = metadata.cloudId;
          if (typeof candidate === 'string') {
            cloudId = candidate;
          }
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/#auth
        const resourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const ResourcesSchema = z.array(
          z.object({
            id: z.string(),
          }),
        );

        const resources = ResourcesSchema.parse(resourcesResponse.data);
        if (resources.length === 0 || !resources[0]?.id) {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
            message: 'Unable to determine Confluence cloud ID from connection config or accessible resources.',
          });
        }
        if (resources.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }

        cloudId = resources[0]!.id;

        await platformProxy.updateMetadata({
          cloudId,
        });
      }

      const params: Record<string, string | number> = {};
      if (input.cursor) {
        params['cursor'] = input.cursor;
      }
      if (input.status) {
        params['status'] = input.status;
      }
      if (input.title) {
        params['title'] = input.title;
      }
      if (input.sort) {
        params['sort'] = input.sort;
      }
      if (input.bodyFormat) {
        params['body-format'] = input.bodyFormat;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-blog-post/#api-spaces-id-blogposts-get
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/spaces/${encodeURIComponent(input.spaceId)}/blogposts`,
        params,
        retries: 3,
      });

      const parsed = ResponseSchema.parse(response.data);

      const nextLink = parsed._links?.next;
      let nextCursor: string | undefined;
      if (nextLink) {
        const match = nextLink.match(/[?&]cursor=([^&]+)/);
        if (match && match[1]) {
          nextCursor = decodeURIComponent(match[1]);
        } else if (!nextLink.includes('/')) {
          nextCursor = nextLink;
        }
      }

      const blogPosts = parsed.results.map(post => ({
        id: post.id,
        status: post.status,
        ...(post.title != null && { title: post.title }),
        ...(post.spaceId != null && { spaceId: post.spaceId }),
        ...(post.authorId != null && { authorId: post.authorId }),
        ...(post.createdAt != null && { createdAt: post.createdAt }),
        ...(post.version != null && {
          version: {
            ...(post.version.createdAt != null && { createdAt: post.version.createdAt }),
            ...(post.version.message != null && { message: post.version.message }),
            ...(post.version.number != null && { number: post.version.number }),
            ...(post.version.minorEdit != null && { minorEdit: post.version.minorEdit }),
            ...(post.version.authorId != null && { authorId: post.version.authorId }),
          },
        }),
        ...(post.body != null && { body: post.body }),
        ...(post._links != null && {
          links: {
            ...(post._links.webui != null && { webui: post._links.webui }),
            ...(post._links.editui != null && { editui: post._links.editui }),
            ...(post._links.tinyui != null && { tinyui: post._links.tinyui }),
          },
        }),
      }));

      return {
        blogPosts,
        ...(nextCursor && { nextCursor }),
      };
    },
  });
}
