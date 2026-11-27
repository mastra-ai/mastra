// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getInlineCommentInputSchema = z.object({
  commentId: z.string().describe('The ID of the inline comment to retrieve. Example: "123456"'),
  bodyFormat: z
    .enum(['storage', 'atlas_doc_format', 'view'])
    .optional()
    .describe('The format of the comment body to return. Defaults to storage.'),
  version: z.number().optional().describe('The version number of the comment to retrieve.'),
  includeProperties: z.boolean().optional().describe('Whether to include content properties in the response.'),
  includeOperations: z.boolean().optional().describe('Whether to include operations in the response.'),
  includeLikes: z.boolean().optional().describe('Whether to include likes in the response.'),
  includeVersions: z.boolean().optional().describe('Whether to include versions in the response.'),
  includeVersion: z.boolean().optional().describe('Whether to include version information in the response.'),
});

const VersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const BodySchema = z.object({
  storage: z.unknown().optional(),
  atlas_doc_format: z.unknown().optional(),
  view: z.unknown().optional(),
});

const MetaSchema = z.object({
  hasMore: z.boolean().optional(),
  cursor: z.string().optional(),
});

const LinksSchema = z
  .object({
    self: z.string().optional(),
  })
  .passthrough();

const PropertiesSchema = z
  .object({
    results: z.array(z.unknown()).optional(),
    meta: MetaSchema.optional(),
    _links: LinksSchema.optional(),
    inlineMarkerRef: z.string().optional(),
    inlineOriginalSelection: z.string().optional(),
  })
  .passthrough();

const OperationsSchema = z
  .object({
    results: z.array(z.unknown()).optional(),
    meta: MetaSchema.optional(),
    _links: LinksSchema.optional(),
  })
  .passthrough();

const LikesSchema = z
  .object({
    results: z.array(z.object({ accountId: z.string().optional() })).optional(),
    meta: MetaSchema.optional(),
    _links: LinksSchema.optional(),
  })
  .passthrough();

const VersionsSchema = z
  .object({
    results: z.array(z.unknown()).optional(),
    meta: MetaSchema.optional(),
    _links: LinksSchema.optional(),
  })
  .passthrough();

const CommentLinksSchema = z
  .object({
    base: z.string().optional(),
    webui: z.string().optional(),
  })
  .passthrough();

const InlineCommentSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    title: z.string().optional(),
    blogPostId: z.string().optional(),
    pageId: z.string().optional(),
    parentCommentId: z.string().optional(),
    version: VersionSchema.optional(),
    body: BodySchema.optional(),
    resolutionLastModifierId: z.string().nullish(),
    resolutionLastModifiedAt: z.string().nullish(),
    resolutionStatus: z.string().nullish(),
    properties: PropertiesSchema.optional(),
    operations: OperationsSchema.optional(),
    likes: LikesSchema.optional(),
    versions: VersionsSchema.optional(),
    _links: CommentLinksSchema.optional(),
  })
  .passthrough();

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export const getInlineCommentOutputSchema = InlineCommentSchema;

export function getInlineCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_get_inline_comment',
    description: 'Retrieve a Confluence inline comment by id.',
    inputSchema: getInlineCommentInputSchema,
    outputSchema: getInlineCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getInlineCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();

      const connectionConfigSchema = z.record(z.string(), z.unknown()).optional();
      const connectionConfig = connectionConfigSchema.parse(connection.connection_config);
      let cloudId = z.string().optional().parse(connectionConfig?.['cloudId']);

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const metadataSchema = z.object({ cloudId: z.string().optional() });
        const parsedMetadata = metadataSchema.parse(metadata);
        cloudId = parsedMetadata.cloudId;
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#3-get-cloudid
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resourcesSchema = z.array(
          z
            .object({
              id: z.string(),
            })
            .passthrough(),
        );
        const resources = resourcesSchema.parse(accessibleResourcesResponse.data);

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

        await platformProxy.updateMetadata({
          cloudId,
        });
      }

      const params: Record<string, string | number> = {};

      if (input.bodyFormat !== undefined) {
        params['body-format'] = input.bodyFormat;
      }
      if (input.version !== undefined) {
        params['version'] = input.version;
      }
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
      if (input.includeVersion !== undefined) {
        params['include-version'] = String(input.includeVersion);
      }

      // @allowTryCatch
      try {
        // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-comment/#api-inline-comments-commentid-get
        const response = await platformProxy.get({
          endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/inline-comments/${encodeURIComponent(input.commentId)}`,
          params,
          retries: 3,
        });
        return InlineCommentSchema.parse(response.data);
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'response' in error) {
          const response = error.response;
          if (response && typeof response === 'object' && 'status' in response && response.status === 404) {
            throw new platformProxy.ActionError({
              type: 'not_found',
              message: `Inline comment with id ${input.commentId} was not found.`,
            });
          }
        }
        throw error;
      }
    },
  });
}
