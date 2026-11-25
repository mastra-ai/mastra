// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPageAttachmentsInputSchema = z.object({
  pageId: z.string().describe('The ID of the Confluence page whose attachments should be listed. Example: "123456"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(250)
    .optional()
    .describe('Maximum number of attachments to return per page. Example: 25'),
  filename: z.string().optional().describe('Filter attachments by filename. Example: "report.pdf"'),
  mediaType: z.string().optional().describe('Filter attachments by media type. Example: "application/pdf"'),
  status: z.string().optional().describe('Filter attachments by status. Example: "current"'),
});

const AttachmentSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  mediaType: z.string().optional(),
  fileSize: z.number().optional(),
  comment: z.string().optional(),
  spaceId: z.string().optional(),
  pageId: z.string().optional(),
  blogPostId: z.string().optional(),
  customContentId: z.string().optional(),
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
  parentVersionId: z.string().optional(),
  _links: z
    .object({ download: z.string().optional(), webui: z.string().optional(), thumbnail: z.string().optional() })
    .passthrough()
    .optional(),
  downloadLink: z.string().optional(),
  webuiLink: z.string().optional(),
  links: z
    .object({
      download: z.string().optional(),
      thumbnail: z.string().optional(),
      webui: z.string().optional(),
    })
    .optional(),
});

export const listPageAttachmentsOutputSchema = z.object({
  results: z.array(AttachmentSchema),
  nextCursor: z.string().optional(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export function listPageAttachmentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_list_page_attachments',
    description: 'List attachments for a specific Confluence page.',
    inputSchema: listPageAttachmentsInputSchema,
    outputSchema: listPageAttachmentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPageAttachmentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();

      const ConnectionConfigSchema = z.object({
        cloudId: z.string().optional(),
      });

      const configParse = ConnectionConfigSchema.safeParse(connection.connection_config);
      let cloudId: string | undefined;
      if (configParse.success) {
        cloudId = configParse.data.cloudId;
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const MetadataResultSchema = z.object({
          cloudId: z.string().optional(),
        });
        const metadataParse = MetadataResultSchema.safeParse(metadata);
        if (metadataParse.success) {
          cloudId = metadataParse.data.cloudId;
        }
      }

      if (!cloudId) {
        const accessibleResourcesResponse = await platformProxy.get({
          // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/#base-url
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const AccessibleResourcesSchema = z.array(
          z.object({
            id: z.string(),
          }),
        );

        const resources = AccessibleResourcesSchema.parse(accessibleResourcesResponse.data);
        if (resources.length === 0 || !resources[0]?.id) {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
            message: 'Could not resolve Confluence cloud ID from connection config or accessible resources.',
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

      const params: {
        cursor?: string;
        limit?: number;
        filename?: string;
        mediaType?: string;
        status?: string;
      } = {};
      if (input.cursor !== undefined) {
        params.cursor = input.cursor;
      }
      if (input.limit !== undefined) {
        params.limit = input.limit;
      }
      if (input.filename !== undefined) {
        params.filename = input.filename;
      }
      if (input.mediaType !== undefined) {
        params.mediaType = input.mediaType;
      }
      if (input.status !== undefined) {
        params.status = input.status;
      }

      const response = await platformProxy.get({
        // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-attachment/#api-attachments-getpageattachments
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(input.pageId)}/attachments`,
        params,
        retries: 3,
      });

      const ProviderResponseSchema = z.object({
        results: z.array(z.unknown()).default([]),
        _links: z
          .object({
            next: z.string().optional(),
          })
          .optional(),
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const results = providerResponse.results.map(item => {
        const parsed = AttachmentSchema.parse(item);
        return {
          id: parsed.id,
          ...(parsed.status !== undefined && { status: parsed.status }),
          ...(parsed.title !== undefined && { title: parsed.title }),
          ...(parsed.mediaType !== undefined && { mediaType: parsed.mediaType }),
          ...(parsed.fileSize !== undefined && { fileSize: parsed.fileSize }),
          ...(parsed.comment !== undefined && { comment: parsed.comment }),
          ...(parsed.spaceId !== undefined && { spaceId: parsed.spaceId }),
          ...(parsed.pageId !== undefined && { pageId: parsed.pageId }),
          ...(parsed.blogPostId !== undefined && { blogPostId: parsed.blogPostId }),
          ...(parsed.customContentId !== undefined && { customContentId: parsed.customContentId }),
          ...(parsed.createdAt !== undefined && { createdAt: parsed.createdAt }),
          ...(parsed.version !== undefined && { version: parsed.version }),
          ...(parsed.parentVersionId !== undefined && { parentVersionId: parsed.parentVersionId }),
          ...(() => {
            const download = parsed.links?.download ?? parsed.downloadLink ?? parsed._links?.download;
            const webui = parsed.links?.webui ?? parsed.webuiLink ?? parsed._links?.webui;
            const thumbnail = parsed.links?.thumbnail ?? parsed._links?.thumbnail;
            return download !== undefined || webui !== undefined || thumbnail !== undefined
              ? {
                  links: {
                    ...(download !== undefined && { download }),
                    ...(webui !== undefined && { webui }),
                    ...(thumbnail !== undefined && { thumbnail }),
                  },
                }
              : {};
          })(),
        };
      });

      let nextCursor: string | undefined;
      if (providerResponse._links?.next !== undefined) {
        const nextUrl = providerResponse._links.next;
        const urlMatch = nextUrl.match(/[?&]cursor=([^&]+)/);
        if (urlMatch && urlMatch[1]) {
          nextCursor = decodeURIComponent(urlMatch[1]);
        }
      }

      return {
        results,
        ...(nextCursor !== undefined && { nextCursor }),
      };
    },
  });
}
