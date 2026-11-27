// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateInlineCommentInputSchema = z
  .object({
    commentId: z.string().describe('The ID of the inline comment to update. Example: "123456"'),
    body: z
      .object({
        representation: z.string().describe('Body representation. Example: "storage"'),
        value: z.string().describe('Body value in the given representation.'),
      })
      .optional(),
    resolved: z.boolean().optional().describe('Set to true to resolve the comment, false to reopen it.'),
    versionMessage: z.string().optional().describe('Message describing the update.'),
  })
  .refine(
    input => input.body !== undefined || input.resolved !== undefined,
    'At least one of body or resolved must be provided to update the inline comment.',
  );

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  name: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  avatarUrl: z.string().optional(),
});

const VersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().nullable().optional(),
  number: z.number(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().nullable().optional(),
});

const BodyRepresentationSchema = z.object({
  representation: z.string().optional(),
  value: z.string().optional(),
});

const InlineCommentSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().nullable().optional(),
  blogPostId: z.string().nullable().optional(),
  pageId: z.string().nullable().optional(),
  parentCommentId: z.string().nullable().optional(),
  version: VersionSchema.optional(),
  body: z
    .object({
      storage: BodyRepresentationSchema.optional(),
      atlas_doc_format: BodyRepresentationSchema.optional(),
      view: BodyRepresentationSchema.optional(),
    })
    .optional(),
  resolutionLastModifierId: z.string().nullable().optional(),
  resolutionLastModifiedAt: z.string().nullable().optional(),
  resolutionStatus: z.string().nullable().optional(),
  properties: z
    .object({
      inlineMarkerRef: z.string().nullable().optional(),
      inlineOriginalSelection: z.string().nullable().optional(),
    })
    .optional(),
  _links: z
    .object({
      webui: z.string().nullable().optional(),
      base: z.string().nullable().optional(),
    })
    .optional(),
});

export const updateInlineCommentOutputSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  blogPostId: z.string().optional(),
  pageId: z.string().optional(),
  parentCommentId: z.string().optional(),
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
      representation: z.string().optional(),
      value: z.string().optional(),
    })
    .optional(),
  resolutionStatus: z.string().optional(),
  resolutionLastModifierId: z.string().optional(),
  resolutionLastModifiedAt: z.string().optional(),
  webui: z.string().optional(),
});

async function resolveCloudId(platformProxy: PlatformProxy): Promise<string> {
  const connection = await platformProxy.getConnection();
  const connectionConfig = connection.connection_config;
  if (connectionConfig && typeof connectionConfig === 'object' && connectionConfig !== null) {
    const configCloudId = connectionConfig['cloudId'];
    if (typeof configCloudId === 'string' && configCloudId) {
      return configCloudId;
    }
  }

  const metadata = await platformProxy.getMetadata();
  const metaCloudId = metadata.cloudId;
  if (typeof metaCloudId === 'string' && metaCloudId) {
    return metaCloudId;
  }

  // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#access-tokens
  const response = await platformProxy.get({
    endpoint: 'oauth/token/accessible-resources',
    retries: 3,
  });

  const parsed = z.array(AccessibleResourceSchema).safeParse(response.data);
  const resources = parsed.success ? parsed.data : [];
  if (resources.length === 0) {
    throw new platformProxy.ActionError({
      type: 'cloud_id_not_found',
      message: 'Could not resolve Confluence cloudId from connection config or accessible resources.',
    });
  }

  if (resources.length > 1) {
    throw new platformProxy.ActionError({
      type: 'ambiguous_cloud_id',
      message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
    });
  }
  const firstResource = resources[0];
  if (!firstResource) {
    throw new platformProxy.ActionError({
      type: 'cloud_id_not_found',
      message: 'Could not resolve Confluence cloudId from connection config or accessible resources.',
    });
  }

  const resolvedCloudId = firstResource.id;
  await platformProxy.updateMetadata({ cloudId: resolvedCloudId });
  return resolvedCloudId;
}

export function updateInlineCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_update_inline_comment',
    description: 'Update the body or resolution state of a Confluence inline comment.',
    inputSchema: updateInlineCommentInputSchema,
    outputSchema: updateInlineCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateInlineCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const cloudId = await resolveCloudId(platformProxy);
      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-comment/#api-inline-comments-comment-id-get
      const getResponse = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/inline-comments/${encodeURIComponent(input.commentId)}`,
        params: {
          'body-format': 'storage',
        },
        retries: 3,
      });

      const currentComment = InlineCommentSchema.safeParse(getResponse.data);
      if (!currentComment.success) {
        throw new platformProxy.ActionError({
          type: 'parse_error',
          message: 'Failed to parse the current inline comment response.',
        });
      }

      const currentVersion = currentComment.data.version?.number ?? 0;
      const nextVersion = currentVersion + 1;

      const putBody: Record<string, unknown> = {
        version: {
          number: nextVersion,
          ...(input.versionMessage !== undefined && { message: input.versionMessage }),
        },
      };

      if (input.body !== undefined) {
        putBody['body'] = {
          representation: input.body.representation,
          value: input.body.value,
        };
      }

      if (input.resolved !== undefined) {
        putBody['resolved'] = input.resolved;
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-comment/#api-inline-comments-comment-id-put
      const updateResponse = await platformProxy.put({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/inline-comments/${encodeURIComponent(input.commentId)}`,
        data: putBody,
        retries: 1,
      });

      const updatedComment = InlineCommentSchema.safeParse(updateResponse.data);
      if (!updatedComment.success) {
        throw new platformProxy.ActionError({
          type: 'parse_error',
          message: 'Failed to parse the updated inline comment response.',
        });
      }

      const data = updatedComment.data;
      const storageBody = data.body?.storage;

      return {
        id: data.id,
        ...(data.status !== undefined && { status: data.status }),
        ...(data.title != null && { title: data.title }),
        ...(data.blogPostId != null && { blogPostId: data.blogPostId }),
        ...(data.pageId != null && { pageId: data.pageId }),
        ...(data.parentCommentId != null && { parentCommentId: data.parentCommentId }),
        ...(data.version !== undefined && {
          version: {
            ...(data.version.createdAt !== undefined && { createdAt: data.version.createdAt }),
            ...(data.version.message != null && { message: data.version.message }),
            number: data.version.number,
            ...(data.version.minorEdit !== undefined && { minorEdit: data.version.minorEdit }),
            ...(data.version.authorId != null && { authorId: data.version.authorId }),
          },
        }),
        ...(storageBody !== undefined && {
          body: {
            ...(storageBody.representation !== undefined && { representation: storageBody.representation }),
            ...(storageBody.value !== undefined && { value: storageBody.value }),
          },
        }),
        ...(data.resolutionStatus != null && { resolutionStatus: data.resolutionStatus }),
        ...(data.resolutionLastModifierId != null && { resolutionLastModifierId: data.resolutionLastModifierId }),
        ...(data.resolutionLastModifiedAt != null && { resolutionLastModifiedAt: data.resolutionLastModifiedAt }),
        ...(data._links?.webui != null && { webui: data._links.webui }),
      };
    },
  });
}
