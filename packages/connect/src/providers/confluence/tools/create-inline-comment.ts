// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createInlineCommentInputSchema = z
  .object({
    pageId: z
      .string()
      .optional()
      .describe('ID of the containing page, if creating a top-level inline comment on a page. Example: "98401"'),
    blogPostId: z
      .string()
      .optional()
      .describe(
        'ID of the containing blog post, if creating a top-level inline comment on a blog post. Example: "12345"',
      ),
    parentCommentId: z
      .string()
      .optional()
      .describe('ID of the parent comment, if creating a reply. Example: "14221315"'),
    body: z.object({
      representation: z
        .enum(['storage', 'atlas_doc_format', 'wiki'])
        .describe('Content representation type. Example: "storage"'),
      value: z.string().describe('Comment body in the chosen representation. Example: "<p>Nice work!</p>"'),
    }),
    inlineCommentProperties: z
      .object({
        textSelection: z.string().describe('The text to highlight. Example: "Spaces are where teams organize ideas"'),
        textSelectionMatchCount: z
          .number()
          .int()
          .describe('The number of matches for the selected text on the page. Example: 1'),
        textSelectionMatchIndex: z.number().int().describe('The zero-based match index to highlight. Example: 0'),
      })
      .optional(),
  })
  .refine(
    input => Boolean(input.pageId || input.blogPostId || input.parentCommentId),
    'At least one of pageId, blogPostId, or parentCommentId is required.',
  )
  .refine(input => Boolean(input.parentCommentId || input.inlineCommentProperties), {
    message: 'inlineCommentProperties is required for top-level inline comments.',
    path: ['inlineCommentProperties'],
  });

const ProviderVersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const ProviderBodyTypeSchema = z.object({
  representation: z.string().optional(),
  value: z.string().optional(),
});

const ProviderBodySingleSchema = z.object({
  storage: ProviderBodyTypeSchema.optional(),
  atlas_doc_format: ProviderBodyTypeSchema.optional(),
  view: ProviderBodyTypeSchema.optional(),
});

const ProviderPropertiesSchema = z.object({
  results: z.array(z.unknown()).optional(),
  meta: z.unknown().optional(),
  _links: z.unknown().optional(),
  inlineMarkerRef: z.string().optional(),
  inlineOriginalSelection: z.string().optional(),
});

const ProviderLinksSchema = z.object({
  webui: z.string().optional(),
  base: z.string().optional(),
});

const ProviderInlineCommentSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  blogPostId: z.string().optional(),
  pageId: z.string().optional(),
  parentCommentId: z.string().optional(),
  version: ProviderVersionSchema.optional(),
  body: ProviderBodySingleSchema.optional(),
  resolutionLastModifierId: z.string().nullish(),
  resolutionLastModifiedAt: z.string().nullish(),
  resolutionStatus: z.string().optional(),
  properties: ProviderPropertiesSchema.optional(),
  operations: z.unknown().optional(),
  likes: z.unknown().optional(),
  versions: z.unknown().optional(),
  _links: ProviderLinksSchema.optional(),
});

export const createInlineCommentOutputSchema = z.object({
  id: z.string().describe('ID of the created inline comment. Example: "14221315"'),
  status: z.string().optional(),
  title: z.string().optional(),
  pageId: z.string().optional(),
  blogPostId: z.string().optional(),
  parentCommentId: z.string().optional(),
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
      representation: z.string().optional(),
      value: z.string().optional(),
    })
    .optional(),
  resolutionStatus: z.string().optional(),
  properties: z
    .object({
      inlineMarkerRef: z.string().optional(),
      inlineOriginalSelection: z.string().optional(),
    })
    .optional(),
  links: z
    .object({
      webui: z.string().optional(),
      base: z.string().optional(),
    })
    .optional(),
});

export function createInlineCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_create_inline_comment',
    description: 'Create an inline comment on a page or blog post selection.',
    inputSchema: createInlineCommentInputSchema,
    outputSchema: createInlineCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createInlineCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfigSchema = z.object({
        cloudId: z.string().optional(),
      });
      const connectionConfig = connectionConfigSchema.parse(connection.connection_config || {});
      let cloudId = connectionConfig.cloudId;

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const metadataSchema = z.object({
          cloudId: z.string().optional(),
        });
        const metadataParsed = metadataSchema.parse(metadata || {});
        cloudId = metadataParsed.cloudId;
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#accessible-resources
        const accessibleResourcesResponse = await platformProxy.get({
          // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#accessible-resources
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const accessibleResourcesSchema = z.array(z.object({ id: z.string() }));
        const resources = accessibleResourcesSchema.parse(accessibleResourcesResponse.data);
        if (resources.length === 0 || !resources[0]?.id) {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
            message: 'No cloudId found in connection config or accessible resources.',
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

      const requestBody: {
        pageId?: string;
        blogPostId?: string;
        parentCommentId?: string;
        body: {
          representation: string;
          value: string;
        };
        inlineCommentProperties?: {
          textSelection: string;
          textSelectionMatchCount: number;
          textSelectionMatchIndex: number;
        };
      } = {
        body: {
          representation: input.body.representation,
          value: input.body.value,
        },
      };

      if (input.pageId !== undefined) {
        requestBody.pageId = input.pageId;
      }
      if (input.blogPostId !== undefined) {
        requestBody.blogPostId = input.blogPostId;
      }
      if (input.parentCommentId !== undefined) {
        requestBody.parentCommentId = input.parentCommentId;
      }
      if (input.inlineCommentProperties !== undefined) {
        requestBody.inlineCommentProperties = {
          textSelection: input.inlineCommentProperties.textSelection,
          textSelectionMatchCount: input.inlineCommentProperties.textSelectionMatchCount,
          textSelectionMatchIndex: input.inlineCommentProperties.textSelectionMatchIndex,
        };
      }

      const response = await platformProxy.post({
        // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-comment/#api-inline-comments-post
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/inline-comments`,
        data: requestBody,
        retries: 1,
      });

      const providerComment = ProviderInlineCommentSchema.parse(response.data);

      const body = providerComment.body;
      const selectedBody = body?.storage ?? body?.atlas_doc_format ?? body?.view;

      return {
        id: providerComment.id,
        ...(providerComment.status !== undefined && { status: providerComment.status }),
        ...(providerComment.title !== undefined && { title: providerComment.title }),
        ...(providerComment.pageId !== undefined && { pageId: providerComment.pageId }),
        ...(providerComment.blogPostId !== undefined && { blogPostId: providerComment.blogPostId }),
        ...(providerComment.parentCommentId !== undefined && { parentCommentId: providerComment.parentCommentId }),
        ...(providerComment.version !== undefined && {
          version: {
            ...(providerComment.version.createdAt !== undefined && { createdAt: providerComment.version.createdAt }),
            ...(providerComment.version.message !== undefined && { message: providerComment.version.message }),
            ...(providerComment.version.number !== undefined && { number: providerComment.version.number }),
            ...(providerComment.version.minorEdit !== undefined && { minorEdit: providerComment.version.minorEdit }),
            ...(providerComment.version.authorId !== undefined && { authorId: providerComment.version.authorId }),
          },
        }),
        ...(selectedBody !== undefined && {
          body: {
            ...(selectedBody.representation !== undefined && { representation: selectedBody.representation }),
            ...(selectedBody.value !== undefined && { value: selectedBody.value }),
          },
        }),
        ...(providerComment.resolutionStatus !== undefined && { resolutionStatus: providerComment.resolutionStatus }),
        ...(providerComment.properties !== undefined && {
          properties: {
            ...(providerComment.properties.inlineMarkerRef !== undefined && {
              inlineMarkerRef: providerComment.properties.inlineMarkerRef,
            }),
            ...(providerComment.properties.inlineOriginalSelection !== undefined && {
              inlineOriginalSelection: providerComment.properties.inlineOriginalSelection,
            }),
          },
        }),
        ...(providerComment._links !== undefined && {
          links: {
            ...(providerComment._links.webui !== undefined && { webui: providerComment._links.webui }),
            ...(providerComment._links.base !== undefined && { base: providerComment._links.base }),
          },
        }),
      };
    },
  });
}
