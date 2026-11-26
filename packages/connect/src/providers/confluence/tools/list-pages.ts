// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listPagesInputSchema = z.object({
  spaceId: z.string().optional().describe('Space ID to filter pages. Example: "123456"'),
  status: z.enum(['current', 'archived', 'trashed', 'draft']).optional().describe('Page status filter'),
  title: z.string().optional().describe('Title filter (case-insensitive prefix match)'),
  subType: z.enum(['page', 'live']).optional().describe('Content subtype filter'),
  sort: z
    .enum(['id', '-id', 'created-date', '-created-date', 'modified-date', '-modified-date', 'title', '-title'])
    .optional()
    .describe('Sort order; a leading - sorts descending. Example: "-modified-date"'),
  bodyFormat: z
    .enum(['storage', 'atlas_doc_format'])
    .optional()
    .describe('Body representation format. Prefer "storage" for reliable parsing.'),
  cursor: z.string().optional().describe('Pagination cursor from previous response'),
  limit: z.number().int().min(1).max(250).optional().describe('Maximum items per page (1-250)'),
});

const ProviderVersionSchema = z.object({
  authorId: z.string().optional(),
  number: z.number().optional(),
  message: z.string().optional(),
  createdAt: z.string().optional(),
  by: z
    .object({
      accountId: z.string().optional(),
      displayName: z.string().optional(),
    })
    .optional(),
});

const ProviderBodySchema = z.object({
  storage: z.object({ value: z.string().optional(), representation: z.string().optional() }).optional(),
  atlas_doc_format: z.object({ value: z.string().optional(), representation: z.string().optional() }).optional(),
  view: z.object({ value: z.string().optional(), representation: z.string().optional() }).optional(),
  export_view: z.object({ value: z.string().optional(), representation: z.string().optional() }).optional(),
  styled_view: z.object({ value: z.string().optional(), representation: z.string().optional() }).optional(),
  anonymous_export_view: z.object({ value: z.string().optional(), representation: z.string().optional() }).optional(),
});

const ProviderPageSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  spaceId: z.string().optional(),
  parentId: z.string().nullable().optional(),
  position: z.number().nullish(),
  version: ProviderVersionSchema.optional(),
  body: ProviderBodySchema.optional(),
  authorId: z.string().optional(),
  createdAt: z.string().optional(),
});

const ProviderListResponseSchema = z.object({
  results: z.array(z.unknown()),
  _links: z
    .object({
      next: z.string().optional(),
    })
    .optional(),
});

const PageOutputSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  title: z.string().optional(),
  spaceId: z.string().optional(),
  parentId: z.string().optional(),
  position: z.number().optional(),
  version: z
    .object({
      number: z.number().optional(),
      message: z.string().optional(),
      createdAt: z.string().optional(),
      author: z
        .object({
          accountId: z.string().optional(),
          displayName: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  body: z.string().optional(),
  authorId: z.string().optional(),
  createdAt: z.string().optional(),
});

export const listPagesOutputSchema = z.object({
  pages: z.array(PageOutputSchema),
  nextCursor: z.string().optional(),
});

const MetadataSchema = z.object({
  cloudId: z.string().optional(),
});

const ConnectionSchema = z.object({
  connection_config: z.record(z.string(), z.unknown()).optional(),
});

const AccessibleResourceSchema = z.array(
  z.object({
    id: z.string(),
  }),
);

function extractCursor(nextLink: string): string | undefined {
  // @allowTryCatch
  // Gracefully ignore malformed next-link URLs from the provider and treat them as absent pagination.
  try {
    const parsed = new URL(nextLink, 'https://example.com');
    const cursor = parsed.searchParams.get('cursor');
    return cursor || undefined;
  } catch {
    return undefined;
  }
}

function pickBody(
  body: z.infer<typeof ProviderBodySchema> | undefined,
  format: string | undefined,
): string | undefined {
  if (!body || !format) {
    return undefined;
  }
  if (format === 'storage') {
    return body.storage?.value;
  }
  if (format === 'atlas_doc_format') {
    return body.atlas_doc_format?.value;
  }
  if (format === 'view') {
    return body.view?.value;
  }
  if (format === 'export_view') {
    return body.export_view?.value;
  }
  if (format === 'styled_view') {
    return body.styled_view?.value;
  }
  if (format === 'anonymous_export_view') {
    return body.anonymous_export_view?.value;
  }
  return undefined;
}

export function listPagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'confluence_list_pages',
    description: 'List Confluence pages with pagination',
    inputSchema: listPagesInputSchema,
    outputSchema: listPagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = ConnectionSchema.parse(await platformProxy.getConnection());
      let cloudId = connection.connection_config?.['cloudId'];

      if (typeof cloudId !== 'string' || cloudId.length === 0) {
        const metadata = MetadataSchema.parse(await platformProxy.getMetadata());
        cloudId = metadata.cloudId;
      }

      if (typeof cloudId !== 'string' || cloudId.length === 0) {
        // https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/#3--forge-the-access-token-into-a-request
        const resourcesResponse = await platformProxy.get({
          endpoint: 'oauth/token/accessible-resources',
          retries: 3,
        });

        const resources = AccessibleResourceSchema.parse(resourcesResponse.data);
        if (!resources.length) {
          throw new platformProxy.ActionError({
            type: 'missing_cloud_id',
            message: 'Unable to resolve Confluence cloud ID from accessible resources.',
          });
        }
        if (resources.length > 1) {
          throw new platformProxy.ActionError({
            type: 'ambiguous_cloud_id',
            message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
          });
        }

        const resolvedCloudId = resources[0]!.id;

        cloudId = resolvedCloudId;
        await platformProxy.updateMetadata({ cloudId: resolvedCloudId });
      }

      const params: Record<string, string | number> = {};
      if (input.spaceId !== undefined) {
        params['space-id'] = input.spaceId;
      }
      if (input.status !== undefined) {
        params['status'] = input.status;
      }
      if (input.title !== undefined) {
        params['title'] = input.title;
      }
      if (input.subType !== undefined) {
        params['subtype'] = input.subType;
      }
      if (input.sort !== undefined) {
        params['sort'] = input.sort;
      }
      if (input.bodyFormat !== undefined) {
        params['body-format'] = input.bodyFormat;
      }
      if (input.cursor !== undefined) {
        params['cursor'] = input.cursor;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }

      // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/#api-pages-get
      const response = await platformProxy.get({
        endpoint: `/ex/confluence/${cloudId}/wiki/api/v2/pages`,
        params,
        retries: 3,
      });

      const listResponse = ProviderListResponseSchema.parse(response.data);
      const results = listResponse.results;
      const pages: z.infer<typeof PageOutputSchema>[] = [];

      for (const raw of results) {
        const providerPage = ProviderPageSchema.safeParse(raw);
        if (!providerPage.success) {
          continue;
        }

        const page = providerPage.data;
        const bodyValue = pickBody(page.body, input.bodyFormat);

        pages.push({
          id: page.id,
          ...(page.status !== undefined && { status: page.status }),
          ...(page.title !== undefined && { title: page.title }),
          ...(page.spaceId !== undefined && { spaceId: page.spaceId }),
          ...(page.parentId != null && { parentId: page.parentId }),
          ...(page.position != null && { position: page.position }),
          ...(page.version !== undefined && {
            version: {
              ...(page.version.number !== undefined && { number: page.version.number }),
              ...(page.version.message !== undefined && { message: page.version.message }),
              ...(page.version.createdAt !== undefined && { createdAt: page.version.createdAt }),
              ...(page.version.authorId !== undefined && { author: { accountId: page.version.authorId } }),
              ...(page.version.by !== undefined && {
                author: {
                  ...(page.version.by.accountId !== undefined && { accountId: page.version.by.accountId }),
                  ...(page.version.by.displayName !== undefined && { displayName: page.version.by.displayName }),
                },
              }),
            },
          }),
          ...(bodyValue !== undefined && { body: bodyValue }),
          ...(page.authorId !== undefined && { authorId: page.authorId }),
          ...(page.createdAt !== undefined && { createdAt: page.createdAt }),
        });
      }

      const nextLink = listResponse._links?.next;
      const nextCursor = nextLink !== undefined ? extractCursor(nextLink) : undefined;

      return {
        pages,
        ...(nextCursor !== undefined && { nextCursor }),
      };
    },
  });
}
