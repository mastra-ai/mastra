// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateBlogPostInputSchema = z.object({
  id: z.string().describe('Blog post ID. Example: "123456"'),
  title: z.string().optional().describe('New title for the blog post'),
  status: z.enum(['current', 'draft']).optional().describe('New status for the blog post'),
  body: z.string().optional().describe('New body content in storage format'),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  url: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  avatarUrl: z.string().optional(),
});

const BlogPostVersionSchema = z.object({
  number: z.number(),
});

const BlogPostBodySchema = z.object({
  storage: z
    .object({
      representation: z.string().optional(),
      value: z.string().optional(),
    })
    .optional(),
});

const BlogPostSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  body: BlogPostBodySchema.optional(),
  version: BlogPostVersionSchema.optional(),
  spaceId: z.string().optional(),
});

export const updateBlogPostOutputSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  status: z.string().optional(),
  body: z.string().optional(),
  versionNumber: z.number().optional(),
  spaceId: z.string().optional(),
});

export function updateBlogPostTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_update_blog_post',
    description: 'Update a Confluence blog post by id.',
    inputSchema: updateBlogPostInputSchema,
    outputSchema: updateBlogPostOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateBlogPostOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      let cloudId: string | undefined;
      if (connection.connection_config && typeof connection.connection_config['cloudId'] === 'string') {
        cloudId = connection.connection_config['cloudId'];
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const MetadataSchema = z.object({
          cloudId: z.string().optional(),
        });
        const parsedMetadata = MetadataSchema.safeParse(metadata);
        if (parsedMetadata.success && parsedMetadata.data.cloudId) {
          cloudId = parsedMetadata.data.cloudId;
        }
      }

      if (!cloudId) {
        const resourcesResponse = await platformProxy.get({
          // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#accessing-data-on-behalf-of-the-user
          endpoint: '/oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = z.array(AccessibleResourceSchema).parse(resourcesResponse.data);
        if (resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
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
      const getResponse = await platformProxy.get({
        // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-blog-post/#api-blogposts-id-get
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/blogposts/${encodeURIComponent(input.id)}`,
        params: {
          'body-format': 'storage',
        },
        retries: 3,
      });

      const currentPost = BlogPostSchema.parse(getResponse.data);
      const currentVersion = currentPost.version?.number;
      if (typeof currentVersion !== 'number') {
        throw new platformProxy.ActionError({
          type: 'missing_version',
          message: 'Could not determine current version of the blog post.',
        });
      }

      const updateBody: {
        id: string;
        status: string;
        title: string;
        body: { representation: string; value: string };
        version: { number: number };
      } = {
        id: input.id,
        status: input.status ?? currentPost.status ?? 'current',
        title: input.title ?? currentPost.title ?? '',
        body: {
          representation: 'storage',
          value: input.body ?? currentPost.body?.storage?.value ?? '',
        },
        version: {
          number: (input.status ?? currentPost.status ?? 'current') === 'draft' ? 1 : currentVersion + 1,
        },
      };

      const putResponse = await platformProxy.put({
        // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-blog-post/#api-blogposts-id-put
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/blogposts/${encodeURIComponent(input.id)}`,
        data: updateBody,
        retries: 1,
      });

      const updatedPost = BlogPostSchema.parse(putResponse.data);
      return {
        id: updatedPost.id,
        ...(updatedPost.title != null && { title: updatedPost.title }),
        ...(updatedPost.status != null && { status: updatedPost.status }),
        ...(updatedPost.body?.storage?.value != null && { body: updatedPost.body.storage.value }),
        ...(updatedPost.version?.number != null && {
          versionNumber: updatedPost.version.number,
        }),
        ...(updatedPost.spaceId != null && { spaceId: updatedPost.spaceId }),
      };
    },
  });
}
