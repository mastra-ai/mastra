// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPagesForLabelInputSchema = z.object({
  label_id: z.string().describe('Label ID. Example: "22"'),
  space_ids: z.array(z.string()).optional().describe('Optional space IDs to filter pages'),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  limit: z.number().int().min(1).max(250).optional().describe('Maximum number of results per page. Default: 25'),
});

const PageVersionSchema = z.object({
  createdAt: z.string().optional(),
  message: z.string().optional(),
  number: z.number().optional(),
  minorEdit: z.boolean().optional(),
  authorId: z.string().optional(),
});

const PageBodySchema = z.object({
  storage: z.unknown().optional(),
  atlas_doc_format: z.unknown().optional(),
});

const PageLinksSchema = z.object({
  webui: z.string().optional(),
  editui: z.string().optional(),
  tinyui: z.string().optional(),
});

const PageSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  spaceId: z.string().optional(),
  parentId: z.string().nullish(),
  parentType: z.string().nullish(),
  position: z.number().nullish(),
  authorId: z.string().optional(),
  ownerId: z.string().nullish(),
  lastOwnerId: z.string().nullish(),
  subtype: z.string().nullish(),
  createdAt: z.string().optional(),
  version: PageVersionSchema.optional(),
  body: PageBodySchema.optional(),
  _links: PageLinksSchema.optional(),
});

const ListResponseSchema = z.object({
  results: z.array(PageSchema),
  _links: z
    .object({
      next: z.string().optional(),
      base: z.string().optional(),
    })
    .optional(),
});

export const listPagesForLabelOutputSchema = z.object({
  pages: z.array(
    z.object({
      id: z.string(),
      status: z.string().optional(),
      title: z.string().optional(),
      spaceId: z.string().optional(),
      parentId: z.string().optional(),
      parentType: z.string().optional(),
      position: z.number().optional(),
      authorId: z.string().optional(),
      ownerId: z.string().optional(),
      lastOwnerId: z.string().optional(),
      subtype: z.string().optional(),
      createdAt: z.string().optional(),
      version: PageVersionSchema.optional(),
      body: PageBodySchema.optional(),
      _links: PageLinksSchema.optional(),
    }),
  ),
  next_cursor: z.string().optional(),
});

const ConnectionConfigSchema = z.object({
  cloudId: z.string().optional(),
});

const AccessibleResourceSchema = z.object({
  id: z.string(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

export function listPagesForLabelTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_list_pages_for_label',
    description: 'List Confluence pages attached to a label',
    inputSchema: listPagesForLabelInputSchema,
    outputSchema: listPagesForLabelOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPagesForLabelOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const parsedConfig = ConnectionConfigSchema.safeParse(connection.connection_config);
      let cloudId = parsedConfig.success ? parsedConfig.data.cloudId : undefined;

      if (!cloudId) {
        const metadata = await platformProxy.getMetadata();
        const MetadataSchema = z.object({
          cloudId: z.string().optional(),
        });
        const parsedMetadata = MetadataSchema.safeParse(metadata);
        cloudId = parsedMetadata.success ? parsedMetadata.data.cloudId : undefined;
      }

      if (!cloudId) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#access-resources
        const resourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resourcesArraySchema = z.array(AccessibleResourceSchema);
        const resources = resourcesArraySchema.safeParse(resourcesResponse.data);

        if (!resources.success || resources.data.length === 0) {
          throw new platformProxy.ActionError({
            type: 'no_accessible_resources',
            message: 'No accessible Confluence resources found for this connection.',
          });
        }
        if (resources.data.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }

        cloudId = resources.data[0]!.id;

        if (cloudId) {
          await platformProxy.updateMetadata({
            cloudId: cloudId,
          });
        }
      }

      if (!cloudId) {
        throw new platformProxy.ActionError({
          type: 'missing_cloud_id',
          message: 'Unable to determine Confluence cloud ID.',
        });
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/#api-wiki-api-v2-labels-id-pages-get
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/labels/${encodeURIComponent(input.label_id)}/pages`,
        params: {
          'body-format': 'storage',
          limit: input.limit ?? 25,
          ...(input.cursor !== undefined && { cursor: input.cursor }),
          ...(input.space_ids !== undefined && input.space_ids.length > 0 && { 'space-id': input.space_ids }),
        },
        retries: 3,
      });

      const parsed = ListResponseSchema.safeParse(response.data);

      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'The Confluence API returned an unexpected response format.',
          details: parsed.error.message,
        });
      }

      let nextCursor: string | undefined;
      if (parsed.data._links?.next) {
        // @allowTryCatch: URL constructor may throw on malformed input from the provider.
        // We gracefully skip next_cursor extraction rather than fail the whole action.
        try {
          const nextUrl = new URL(parsed.data._links.next, 'https://api.atlassian.com');
          const cursorValue = nextUrl.searchParams.get('cursor');
          if (cursorValue) {
            nextCursor = cursorValue;
          }
        } catch {
          // If URL parsing fails, fall back to returning the raw next link
          // or skip next_cursor
        }
      }

      return {
        pages: parsed.data.results.map(page => ({
          id: page.id,
          ...(page.status !== undefined && { status: page.status }),
          ...(page.title !== undefined && { title: page.title }),
          ...(page.spaceId !== undefined && { spaceId: page.spaceId }),
          ...(page.parentId != null && { parentId: page.parentId }),
          ...(page.parentType != null && { parentType: page.parentType }),
          ...(page.position != null && { position: page.position }),
          ...(page.authorId !== undefined && { authorId: page.authorId }),
          ...(page.ownerId != null && { ownerId: page.ownerId }),
          ...(page.lastOwnerId != null && { lastOwnerId: page.lastOwnerId }),
          ...(page.subtype != null && { subtype: page.subtype }),
          ...(page.createdAt !== undefined && { createdAt: page.createdAt }),
          ...(page.version !== undefined && { version: page.version }),
          ...(page.body !== undefined && { body: page.body }),
          ...(page._links !== undefined && { _links: page._links }),
        })),
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
