// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createFooterCommentInputSchema = z
  .object({
    pageId: z.string().optional().describe('Page ID to comment on. Example: "12345678"'),
    blogPostId: z.string().optional().describe('Blog post ID to comment on. Example: "12345678"'),
    attachmentId: z.string().optional().describe('Attachment ID to comment on. Example: "12345678"'),
    parentCommentId: z.string().optional().describe('Parent comment ID to reply to. Example: "12345678"'),
    customContentId: z.string().optional().describe('Custom content ID to comment on. Example: "12345678"'),
    bodyValue: z.string().describe('Comment body in Confluence storage format. Example: "<p>Hello world</p>"'),
  })
  .refine(
    input =>
      [input.pageId, input.blogPostId, input.attachmentId, input.parentCommentId, input.customContentId].filter(
        id => id !== undefined,
      ).length === 1,
    'Exactly one of pageId, blogPostId, attachmentId, parentCommentId, or customContentId is required.',
  );

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
});

const AccessibleResourcesSchema = z.array(AccessibleResourceSchema);

const ProviderResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  title: z.string().optional(),
  pageId: z.string().optional(),
  blogPostId: z.string().optional(),
  attachmentId: z.string().optional(),
  parentCommentId: z.string().optional(),
  customContentId: z.string().optional(),
  version: z
    .object({
      createdAt: z.string().optional(),
      message: z.string().optional(),
      number: z.number(),
      minorEdit: z.boolean().optional(),
      authorId: z.string().optional(),
    })
    .optional(),
  body: z
    .object({
      storage: z
        .object({
          representation: z.string().optional(),
          value: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  _links: z
    .object({
      webui: z.string().optional(),
      base: z.string().optional(),
    })
    .optional(),
});

export const createFooterCommentOutputSchema = z.object({
  id: z.string(),
  status: z.string(),
  title: z.string().optional(),
  pageId: z.string().optional(),
  blogPostId: z.string().optional(),
  attachmentId: z.string().optional(),
  parentCommentId: z.string().optional(),
  customContentId: z.string().optional(),
  version: z
    .object({
      createdAt: z.string().optional(),
      message: z.string().optional(),
      number: z.number(),
      minorEdit: z.boolean().optional(),
      authorId: z.string().optional(),
    })
    .optional(),
  body: z
    .object({
      storage: z
        .object({
          representation: z.string().optional(),
          value: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  links: z
    .object({
      webui: z.string().optional(),
      base: z.string().optional(),
    })
    .optional(),
});

export function createFooterCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_create_footer_comment',
    description: 'Create a footer comment on a page, blog post, attachment, or comment thread.',
    inputSchema: createFooterCommentInputSchema,
    outputSchema: createFooterCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createFooterCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const [targetKey, targetValue] = (
        [
          ['pageId', input.pageId],
          ['blogPostId', input.blogPostId],
          ['attachmentId', input.attachmentId],
          ['parentCommentId', input.parentCommentId],
          ['customContentId', input.customContentId],
        ] as const
      ).find(([, value]) => value !== undefined)!;

      const connection = await platformProxy.getConnection();

      let cloudId: string | undefined;

      if (
        connection.connection_config &&
        typeof connection.connection_config === 'object' &&
        'cloudId' in connection.connection_config
      ) {
        const configValue = connection.connection_config['cloudId'];
        if (typeof configValue === 'string') {
          cloudId = configValue;
        }
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        if (metadata && typeof metadata === 'object' && 'cloudId' in metadata) {
          const metaValue = metadata['cloudId'];
          if (typeof metaValue === 'string') {
            cloudId = metaValue;
          }
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/#auth
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = AccessibleResourcesSchema.safeParse(accessibleResourcesResponse.data);
        if (!resources.success || resources.data.length === 0) {
          throw new platformProxy.ActionError({
            type: 'cloud_id_not_found',
            message: 'Unable to resolve Confluence cloud ID from accessible resources.',
          });
        }
        if (resources.data.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }

        cloudId = resources.data[0]!.id;

        await platformProxy.updateMetadata({ cloudId });
      }

      const requestBody: Record<string, unknown> = {
        [targetKey]: targetValue,
        body: {
          representation: 'storage',
          value: input.bodyValue,
        },
      };

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-comment/#api-footer-comments-post
      const response = await platformProxy.post({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/footer-comments`,
        data: requestBody,
        retries: 1,
      });

      const providerResponse = ProviderResponseSchema.safeParse(response.data);
      if (!providerResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Confluence API when creating footer comment.',
        });
      }

      const data = providerResponse.data;

      return {
        id: data.id,
        status: data.status,
        ...(data.title !== undefined && { title: data.title }),
        ...(data.pageId !== undefined && { pageId: data.pageId }),
        ...(data.blogPostId !== undefined && { blogPostId: data.blogPostId }),
        ...(data.attachmentId !== undefined && { attachmentId: data.attachmentId }),
        ...(data.parentCommentId !== undefined && { parentCommentId: data.parentCommentId }),
        ...(data.customContentId !== undefined && { customContentId: data.customContentId }),
        ...(data.version !== undefined && { version: data.version }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data._links !== undefined && {
          links: {
            ...(data._links.webui !== undefined && { webui: data._links.webui }),
            ...(data._links.base !== undefined && { base: data._links.base }),
          },
        }),
      };
    },
  });
}
