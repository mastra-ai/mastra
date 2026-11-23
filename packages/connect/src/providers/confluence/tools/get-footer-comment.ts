// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getFooterCommentInputSchema = z.object({
  commentId: z.string().describe('Comment ID. Example: "123"'),
  includeProperties: z.boolean().optional(),
  includeOperations: z.boolean().optional(),
  includeLikes: z.boolean().optional(),
  includeVersions: z.boolean().optional(),
});

const VersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const BodyRepresentationSchema = z
  .object({
    representation: z.string().optional(),
    value: z.string().optional(),
  })
  .passthrough();

const BodySchema = z
  .object({
    storage: z.union([BodyRepresentationSchema, z.record(z.string(), z.unknown())]).optional(),
    atlas_doc_format: z.union([BodyRepresentationSchema, z.record(z.string(), z.unknown())]).optional(),
    view: z.union([BodyRepresentationSchema, z.record(z.string(), z.unknown())]).optional(),
  })
  .passthrough();

const LinksSchema = z
  .object({
    webui: z.string().optional(),
    base: z.string().optional(),
    self: z.string().optional(),
  })
  .passthrough();

const MetaSchema = z
  .object({
    hasMore: z.boolean().optional(),
    cursor: z.string().optional(),
  })
  .passthrough();

const PropertySchema = z.object({
  id: z.string().optional(),
  key: z.string().optional(),
  value: z.unknown().optional(),
  version: z.record(z.string(), z.unknown()).optional(),
});

const OperationSchema = z.object({
  operation: z.string().optional(),
  targetType: z.string().optional(),
});

const LikeSchema = z.object({
  accountId: z.string().optional(),
});

function resultListSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .object({
      results: z.array(itemSchema).optional(),
      meta: MetaSchema.optional(),
      _links: LinksSchema.optional(),
    })
    .passthrough();
}

const ProviderFooterCommentSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    title: z.string().optional(),
    blogPostId: z.string().optional(),
    pageId: z.string().optional(),
    attachmentId: z.string().optional(),
    customContentId: z.string().optional(),
    parentCommentId: z.string().optional(),
    version: VersionSchema.optional(),
    properties: resultListSchema(PropertySchema).optional(),
    operations: resultListSchema(OperationSchema).optional(),
    likes: resultListSchema(LikeSchema).optional(),
    versions: resultListSchema(VersionSchema).optional(),
    body: BodySchema.optional(),
    _links: LinksSchema.optional(),
  })
  .passthrough();

export const getFooterCommentOutputSchema = ProviderFooterCommentSchema;

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export function getFooterCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_get_footer_comment',
    description: 'Retrieve a Confluence footer comment by id.',
    inputSchema: getFooterCommentInputSchema,
    outputSchema: getFooterCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFooterCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();

      let cloudId: string | undefined;
      const configCloudId = connection.connection_config?.['cloudId'];
      if (typeof configCloudId === 'string') {
        cloudId = configCloudId;
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        if (metadata && typeof metadata === 'object') {
          const metadataCloudId = Reflect.get(metadata, 'cloudId');
          if (typeof metadataCloudId === 'string') {
            cloudId = metadataCloudId;
          }
        }
      }

      if (!cloudId) {
        const response = await platformProxy.get({
          // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const AccessibleResourceSchema = z.object({
          id: z.string(),
        });
        const resources = z.array(AccessibleResourceSchema).parse(response.data);
        if (resources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: 'No accessible Confluence resource found for this connection.',
          });
        }
        if (resources.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }

        const discoveredCloudId = resources[0]!.id;

        await platformProxy.updateMetadata({ cloudId: discoveredCloudId });
        cloudId = discoveredCloudId;
      }

      const params: Record<string, string> = {
        'body-format': 'storage',
      };
      if (input.includeProperties !== undefined) {
        params['include-properties'] = String(input.includeProperties);
      }
      if (input.includeOperations !== undefined) {
        params['include-operations'] = String(input.includeOperations);
      }
      if (input.includeLikes !== undefined) {
        params['include-likes'] = String(input.includeLikes);
      }
      if (input.includeVersions !== undefined) {
        params['include-versions'] = String(input.includeVersions);
      }

      const response = await platformProxy.get({
        // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-comment/#api-footer-comments-comment-id-get
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/footer-comments/${encodeURIComponent(input.commentId)}`,
        params: params,
        retries: 3,
      });

      const comment = ProviderFooterCommentSchema.parse(response.data);
      return comment;
    },
  });
}
