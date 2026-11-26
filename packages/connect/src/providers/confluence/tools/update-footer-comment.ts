// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateFooterCommentInputSchema = z.object({
  comment_id: z.string().describe('The ID of the footer comment to update. Example: "123456"'),
  version_number: z.number().int().describe('The next version number for the comment. Example: 2'),
  body: z.string().describe('The updated comment body in storage format. Example: "<p>Updated comment</p>"'),
  version_message: z.string().optional().describe('An optional message describing the update.'),
});

const ProviderBodyRepresentationSchema = z.object({
  representation: z.string().optional(),
  value: z.string().optional(),
});

const ProviderVersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const ProviderFooterCommentSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  pageId: z.string().optional(),
  blogPostId: z.string().optional(),
  attachmentId: z.string().optional(),
  customContentId: z.string().optional(),
  parentCommentId: z.string().optional(),
  version: ProviderVersionSchema.optional(),
  body: z
    .object({
      storage: ProviderBodyRepresentationSchema.optional(),
      atlas_doc_format: ProviderBodyRepresentationSchema.optional(),
      view: ProviderBodyRepresentationSchema.optional(),
    })
    .optional(),
});

export const updateFooterCommentOutputSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  pageId: z.string().optional(),
  blogPostId: z.string().optional(),
  attachmentId: z.string().optional(),
  customContentId: z.string().optional(),
  parentCommentId: z.string().optional(),
  version: z
    .object({
      number: z.number().optional(),
      message: z.string().optional(),
      createdAt: z.string().optional(),
      authorId: z.string().optional(),
    })
    .optional(),
  body: z
    .object({
      representation: z.string().optional(),
      value: z.string().optional(),
    })
    .optional(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export function updateFooterCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_update_footer_comment',
    description: 'Update the body of a Confluence footer comment.',
    inputSchema: updateFooterCommentInputSchema,
    outputSchema: updateFooterCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateFooterCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let cloudId: string | undefined;

      const connection = await platformProxy.getConnection();
      const rawConnectionConfig: unknown = connection.connection_config;
      const connectionConfigResult = z.record(z.string(), z.unknown()).safeParse(rawConnectionConfig);
      if (connectionConfigResult.success) {
        const rawCloudId: unknown = connectionConfigResult.data['cloudId'];
        if (typeof rawCloudId === 'string' && rawCloudId.length > 0) {
          cloudId = rawCloudId;
        }
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const rawMetadataCloudId: unknown = metadata?.cloudId;
        if (typeof rawMetadataCloudId === 'string' && rawMetadataCloudId.length > 0) {
          cloudId = rawMetadataCloudId;
        }
      }

      if (!cloudId) {
        const accessibleResourcesResponse = await platformProxy.get({
          // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const accessibleResources = z.array(z.object({ id: z.string() })).parse(accessibleResourcesResponse.data);
        if (accessibleResources.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }
        if (!accessibleResources[0]) {
          throw new platformProxy.ActionError({
            type: 'cloud_id_not_found',
            message: 'Could not resolve Confluence cloud ID from accessible resources.',
          });
        }

        cloudId = accessibleResources[0].id;
        await platformProxy.updateMetadata({ cloudId });
      }
      const updateResponse = await platformProxy.put({
        // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-comment/#api-wiki-api-v2-footer-comments-comment-id-put
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/footer-comments/${encodeURIComponent(input.comment_id)}`,
        data: {
          version: {
            number: input.version_number,
            ...(input.version_message !== undefined && { message: input.version_message }),
          },
          body: {
            representation: 'storage',
            value: input.body,
          },
        },
        retries: 1,
      });

      const providerComment = ProviderFooterCommentSchema.parse(updateResponse.data);

      return {
        id: providerComment.id,
        ...(providerComment.status !== undefined && { status: providerComment.status }),
        ...(providerComment.title !== undefined && { title: providerComment.title }),
        ...(providerComment.pageId !== undefined && { pageId: providerComment.pageId }),
        ...(providerComment.blogPostId !== undefined && { blogPostId: providerComment.blogPostId }),
        ...(providerComment.attachmentId !== undefined && { attachmentId: providerComment.attachmentId }),
        ...(providerComment.customContentId !== undefined && { customContentId: providerComment.customContentId }),
        ...(providerComment.parentCommentId !== undefined && { parentCommentId: providerComment.parentCommentId }),
        ...(providerComment.version !== undefined && {
          version: {
            ...(providerComment.version.number !== undefined && { number: providerComment.version.number }),
            ...(providerComment.version.message !== undefined && { message: providerComment.version.message }),
            ...(providerComment.version.createdAt !== undefined && { createdAt: providerComment.version.createdAt }),
            ...(providerComment.version.authorId !== undefined && { authorId: providerComment.version.authorId }),
          },
        }),
        ...(providerComment.body !== undefined &&
          providerComment.body.storage !== undefined && {
            body: {
              ...(providerComment.body.storage.representation !== undefined && {
                representation: providerComment.body.storage.representation,
              }),
              ...(providerComment.body.storage.value !== undefined && { value: providerComment.body.storage.value }),
            },
          }),
      };
    },
  });
}
