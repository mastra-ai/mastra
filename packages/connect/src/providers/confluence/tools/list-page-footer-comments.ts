// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export const listPageFooterCommentsInputSchema = z.object({
  pageId: z
    .string()
    .regex(/^\d+$/, 'must be a numeric page id')
    .describe('The ID of the page whose footer comments should be listed. Example: "123456"'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  limit: z.number().optional().describe('Maximum number of results to return per page.'),
  sort: z.string().optional().describe('Sort order for comments. Example: "created-date" or "-created-date".'),
  status: z.array(z.string()).optional().describe('Filter comments by status. Example: ["current", "trashed"].'),
  bodyFormat: z.string().optional().describe('The format of the comment body. Defaults to "storage".'),
});

const VersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const BodySchema = z
  .object({
    storage: z.unknown().optional(),
    atlasDocFormat: z.unknown().optional(),
    view: z.unknown().optional(),
  })
  .passthrough();

const LinksSchema = z.object({
  webui: z.string().optional(),
});

const CommentSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    title: z.string().optional(),
    pageId: z.string().optional(),
    version: VersionSchema.optional(),
    body: BodySchema.optional(),
    links: LinksSchema.optional(),
  })
  .passthrough();

const PageLinksSchema = z.object({
  next: z.string().optional(),
  base: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  results: z.array(CommentSchema),
  links: PageLinksSchema.optional(),
  _links: PageLinksSchema.optional(),
});

export const listPageFooterCommentsOutputSchema = z.object({
  results: z.array(CommentSchema),
  nextCursor: z.string().optional(),
});

export function listPageFooterCommentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_list_page_footer_comments',
    description: 'List footer comments for a Confluence page.',
    inputSchema: listPageFooterCommentsInputSchema,
    outputSchema: listPageFooterCommentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPageFooterCommentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();

      const connectionConfig = z
        .object({
          cloudId: z.string().optional(),
        })
        .passthrough()
        .safeParse(connection.connection_config);

      let cloudId = connectionConfig.success ? connectionConfig.data.cloudId : undefined;

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const metadataParsed = MetadataSchema.safeParse(metadata);
        if (metadataParsed.success && metadataParsed.data.cloudId) {
          cloudId = metadataParsed.data.cloudId;
        }
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#3--construct-the-request-url
        const accessibleResources = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = z.array(z.object({ id: z.string() }).passthrough()).safeParse(accessibleResources.data);
        if (!resources.success || resources.data.length === 0) {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
            message: 'Could not resolve Confluence cloudId from connection config or accessible resources.',
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

      const params: Record<string, string | number | string[]> = {
        'body-format': input.bodyFormat ?? 'storage',
      };
      if (input.cursor !== undefined) {
        params['cursor'] = input.cursor;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.sort !== undefined) {
        params['sort'] = input.sort;
      }
      if (input.status !== undefined) {
        params['status'] = input.status;
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-comment/#api-pages-id-footer-comments-get
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(input.pageId)}/footer-comments`,
        params,
        retries: 3,
      });

      const parsed = ProviderResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_provider_response',
          message: 'Provider returned an unexpected response shape.',
          errors: parsed.error.issues,
        });
      }

      const rawNext = parsed.data.links?.next ?? parsed.data._links?.next;
      return {
        results: parsed.data.results,
        ...(rawNext
          ? {
              nextCursor: (() => {
                // @allowTryCatch
                try {
                  const u = new URL(rawNext, 'https://dummy');
                  return u.searchParams.get('cursor') ?? rawNext;
                } catch {
                  return rawNext;
                }
              })(),
            }
          : {}),
      };
    },
  });
}
