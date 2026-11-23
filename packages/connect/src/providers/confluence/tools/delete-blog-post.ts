// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteBlogPostInputSchema = z.object({
  id: z.string().describe('The ID of the blog post to delete. Example: "123456789"'),
  draft: z.boolean().optional().describe('Whether to delete a draft blog post'),
  purge: z.boolean().optional().describe('Whether to permanently delete a trashed blog post'),
});

export const deleteBlogPostOutputSchema = z.object({
  success: z.boolean(),
  id: z.string(),
});

const ConnectionConfigSchema = z.object({
  cloudId: z.string().optional(),
  baseUrl: z.string().optional(),
  accountId: z.string().optional(),
  subdomain: z.string().optional(),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  name: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  avatarUrl: z.string().optional(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export function deleteBlogPostTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_delete_blog_post',
    description: 'Delete a Confluence blog post by id.',
    inputSchema: deleteBlogPostInputSchema,
    outputSchema: deleteBlogPostOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteBlogPostOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const configParse = ConnectionConfigSchema.safeParse(connection.connection_config);
      let cloudId = configParse.success ? configParse.data.cloudId : undefined;

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const metadataParse = MetadataSchema.safeParse(metadata);
        cloudId = metadataParse.success ? metadataParse.data.cloudId : undefined;
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#get-accessible-resources
        const response = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = z.array(AccessibleResourceSchema).parse(response.data);
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

      const params: Record<string, string> = {};
      if (input.draft !== undefined) {
        params['draft'] = String(input.draft);
      }
      if (input.purge !== undefined) {
        params['purge'] = String(input.purge);
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-blog-post/#api-wiki-api-v2-blogposts-id-delete
      await platformProxy.delete({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/blogposts/${encodeURIComponent(input.id)}`,
        params,
        retries: 1,
      });

      return {
        success: true,
        id: input.id,
      };
    },
  });
}
