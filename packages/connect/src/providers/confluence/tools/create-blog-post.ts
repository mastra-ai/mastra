// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export const createBlogPostInputSchema = z.object({
  spaceId: z.string().describe('Space ID. Example: "123456"'),
  title: z.string().describe('Blog post title.'),
  status: z.string().describe('Blog post status. Example: "current" or "draft".'),
  body: z.string().describe('Blog post body in storage format.'),
});

const ProviderBlogPostSchema = z.object({
  id: z.string(),
  status: z.string(),
  title: z.string(),
  spaceId: z.string(),
  authorId: z.string().optional(),
  createdAt: z.string().optional(),
  body: z
    .object({
      storage: z.unknown().optional(),
      atlas_doc_format: z.unknown().optional(),
      view: z.unknown().optional(),
    })
    .optional(),
});

export const createBlogPostOutputSchema = z.object({
  id: z.string(),
  status: z.string(),
  title: z.string(),
  spaceId: z.string(),
  authorId: z.string().optional(),
  createdAt: z.string().optional(),
  body: z
    .object({
      storage: z.unknown().optional(),
      atlas_doc_format: z.unknown().optional(),
      view: z.unknown().optional(),
    })
    .optional(),
});

const AccessibleResourceSchema = z.array(
  z.object({
    id: z.string(),
  }),
);

export function createBlogPostTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_create_blog_post',
    description: 'Create a Confluence blog post in a space.',
    inputSchema: createBlogPostInputSchema,
    outputSchema: createBlogPostOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createBlogPostOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      let cloudId = connection.connection_config?.['cloudId'];

      if (!cloudId) {
        const rawMetadata = await platformProxy.getMetadata();
        if (rawMetadata && typeof rawMetadata === 'object') {
          const metadata = MetadataSchema.parse(rawMetadata);
          cloudId = metadata.cloudId;
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#3-1-get-the-cloudid-for-your-site
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const accessibleResources = AccessibleResourceSchema.parse(accessibleResourcesResponse.data);
        if (accessibleResources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
            message: 'No accessible Confluence resource found for this connection.',
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

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-blog-post/#api-blogposts-post
      const createResponse = await platformProxy.post({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/blogposts`,
        data: {
          spaceId: input.spaceId,
          status: input.status,
          title: input.title,
          body: {
            representation: 'storage',
            value: input.body,
          },
        },
        retries: 10,
      });

      const providerBlogPost = ProviderBlogPostSchema.parse(createResponse.data);

      return {
        id: providerBlogPost.id,
        status: providerBlogPost.status,
        title: providerBlogPost.title,
        spaceId: providerBlogPost.spaceId,
        ...(providerBlogPost.authorId !== undefined && { authorId: providerBlogPost.authorId }),
        ...(providerBlogPost.createdAt !== undefined && { createdAt: providerBlogPost.createdAt }),
        ...(providerBlogPost.body !== undefined && { body: providerBlogPost.body }),
      };
    },
  });
}
