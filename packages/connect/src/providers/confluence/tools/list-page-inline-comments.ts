// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPageInlineCommentsInputSchema = z.object({
  pageId: z.string().describe('The ID of the Confluence page. Example: "123456"'),
  status: z.array(z.string()).optional().describe('Filter by comment status. Example: ["current"]'),
  resolutionStatus: z.array(z.string()).optional().describe('Filter by resolution status. Example: ["open"]'),
  sort: z.string().optional().describe('Sort order. Example: "created-date"'),
  bodyFormat: z.string().optional().describe('Body format representation. Defaults to "storage". Example: "storage"'),
  limit: z.number().optional().describe('Maximum number of results per page. Example: 25'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const AccessibleResourcesSchema = z.array(
  z
    .object({
      id: z.string(),
    })
    .passthrough(),
);

const VersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const BodySchema = z.object({
  storage: z.record(z.string(), z.unknown()).optional(),
  atlas_doc_format: z.record(z.string(), z.unknown()).optional(),
  view: z.record(z.string(), z.unknown()).optional(),
});

const PropertiesSchema = z.object({
  inlineMarkerRef: z.string().optional(),
  inlineOriginalSelection: z.string().optional(),
});

const InlineCommentSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  pageId: z.string().optional(),
  version: VersionSchema.optional(),
  body: BodySchema.optional(),
  resolutionStatus: z.string().optional(),
  properties: PropertiesSchema.optional(),
  _links: z
    .object({
      webui: z.string().optional(),
    })
    .optional(),
});

export const listPageInlineCommentsOutputSchema = z.object({
  comments: z.array(InlineCommentSchema),
  nextCursor: z.string().optional(),
});

export function listPageInlineCommentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_list_page_inline_comments',
    description: 'List inline comments for a Confluence page.',
    inputSchema: listPageInlineCommentsInputSchema,
    outputSchema: listPageInlineCommentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPageInlineCommentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const config = connection.connection_config;
      let cloudId: string | undefined;
      if (config !== null && typeof config === 'object' && !Array.isArray(config)) {
        const candidate = config['cloudId'];
        if (typeof candidate === 'string') {
          cloudId = candidate;
        }
      }

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const metadataParsed = MetadataSchema.safeParse(metadata);
        if (metadataParsed.success && metadataParsed.data.cloudId) {
          cloudId = metadataParsed.data.cloudId;
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#access-token-authorized-resources
        const accessibleResourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const accessibleResources = AccessibleResourcesSchema.parse(accessibleResourcesResponse.data);
        if (accessibleResources.length === 0) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: 'No accessible Confluence resources found for this connection.',
          });
        }
        if (accessibleResources.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }

        cloudId = accessibleResources[0]!.id;
        await platformProxy.updateMetadata({ cloudId: cloudId });
      }

      const params: Record<string, string | number | string[] | number[]> = {
        'body-format': input.bodyFormat ?? 'storage',
      };

      if (input.status !== undefined && input.status.length > 0) {
        params['status'] = input.status;
      }

      if (input.resolutionStatus !== undefined && input.resolutionStatus.length > 0) {
        params['resolution-status'] = input.resolutionStatus;
      }

      if (input.sort !== undefined) {
        params['sort'] = input.sort;
      }

      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }

      if (input.cursor !== undefined) {
        params['cursor'] = input.cursor;
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-comment/#api-pages-id-inline-comments-get
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(input.pageId)}/inline-comments`,
        params,
        retries: 3,
      });

      const ResponseSchema = z.object({
        results: z.array(
          z
            .object({
              id: z.string(),
              status: z.string().optional(),
              title: z.string().optional(),
              pageId: z.string().optional(),
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
                  storage: z.record(z.string(), z.unknown()).optional(),
                  atlas_doc_format: z.record(z.string(), z.unknown()).optional(),
                  view: z.record(z.string(), z.unknown()).optional(),
                })
                .optional(),
              resolutionStatus: z.string().optional(),
              properties: z
                .object({
                  inlineMarkerRef: z.string().optional(),
                  inlineOriginalSelection: z.string().optional(),
                })
                .optional(),
              _links: z
                .object({
                  webui: z.string().optional(),
                })
                .optional(),
            })
            .passthrough(),
        ),
        _links: z
          .object({
            next: z.string().optional(),
            base: z.string().optional(),
          })
          .optional(),
      });

      const parsed = ResponseSchema.parse(response.data);

      let nextCursor: string | undefined;
      if (parsed._links?.next) {
        const match = parsed._links.next.match(/[?&]cursor=([^&]+)/);
        if (match && match[1]) {
          nextCursor = decodeURIComponent(match[1]);
        }
      }

      return {
        comments: parsed.results,
        ...(nextCursor !== undefined && { nextCursor: nextCursor }),
      };
    },
  });
}
