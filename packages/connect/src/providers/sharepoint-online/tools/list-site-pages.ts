// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const IdentityUserSchema = z.object({
  displayName: z.string().nullish(),
  email: z.string().nullish(),
});

const IdentitySetSchema = z.object({
  user: IdentityUserSchema.nullish(),
});

const PublicationFacetSchema = z.object({
  level: z.string().nullish(),
  versionId: z.string().nullish(),
  checkedOutBy: IdentitySetSchema.nullish(),
});

const ReactionsFacetSchema = z.object({
  commentCount: z.number().nullish(),
  likeCount: z.number().nullish(),
});

const ProviderSitePageSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  webUrl: z.string().nullish(),
  title: z.string().nullish(),
  pageLayout: z.string().nullish(),
  promotionKind: z.string().nullish(),
  showComments: z.boolean().nullish(),
  showRecommendedPages: z.boolean().nullish(),
  createdDateTime: z.string().nullish(),
  lastModifiedDateTime: z.string().nullish(),
  thumbnailWebUrl: z.string().nullish(),
  createdBy: IdentitySetSchema.nullish(),
  lastModifiedBy: IdentitySetSchema.nullish(),
  publishingState: PublicationFacetSchema.nullish(),
  reactions: ReactionsFacetSchema.nullish(),
  titleArea: z.unknown().nullish(),
});

const ProviderResponseSchema = z.object({
  value: z.array(z.unknown()),
  '@odata.nextLink': z.string().nullish(),
});

const SitePageOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  webUrl: z.string().optional(),
  title: z.string().optional(),
  pageLayout: z.string().optional(),
  promotionKind: z.string().optional(),
  showComments: z.boolean().optional(),
  showRecommendedPages: z.boolean().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  thumbnailWebUrl: z.string().optional(),
  createdBy: z
    .object({
      user: z
        .object({
          displayName: z.string().optional(),
          email: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  lastModifiedBy: z
    .object({
      user: z
        .object({
          displayName: z.string().optional(),
          email: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  publishingState: z
    .object({
      level: z.string().optional(),
      versionId: z.string().optional(),
      checkedOutBy: z
        .object({
          user: z
            .object({
              displayName: z.string().optional(),
              email: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  reactions: z
    .object({
      commentCount: z.number().optional(),
      likeCount: z.number().optional(),
    })
    .optional(),
  titleArea: z.unknown().optional(),
});

export const listSitePagesInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "7f50f45e-714a-4264-9c59-3bf43ea4db8f"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from the previous response (@odata.nextLink). Omit for the first page.'),
});

export const listSitePagesOutputSchema = z.object({
  items: z.array(SitePageOutputSchema),
  nextCursor: z.string().optional(),
});

export function listSitePagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_list_site_pages',
    description: 'List modern site pages on a site.',
    inputSchema: listSitePagesInputSchema,
    outputSchema: listSitePagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSitePagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const endpoint = input.cursor
        ? input.cursor.replace('https://graph.microsoft.com', '')
        : `/v1.0/sites/${encodeURIComponent(input.siteId)}/pages/microsoft.graph.sitePage`;

      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/sitepage-list
        endpoint,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const items = providerResponse.value.map((rawPage: unknown) => {
        const page = ProviderSitePageSchema.parse(rawPage);

        return {
          id: page.id,
          ...(page.name != null && { name: page.name }),
          ...(page.webUrl != null && { webUrl: page.webUrl }),
          ...(page.title != null && { title: page.title }),
          ...(page.pageLayout != null && { pageLayout: page.pageLayout }),
          ...(page.promotionKind != null && { promotionKind: page.promotionKind }),
          ...(page.showComments != null && { showComments: page.showComments }),
          ...(page.showRecommendedPages != null && { showRecommendedPages: page.showRecommendedPages }),
          ...(page.createdDateTime != null && { createdDateTime: page.createdDateTime }),
          ...(page.lastModifiedDateTime != null && { lastModifiedDateTime: page.lastModifiedDateTime }),
          ...(page.thumbnailWebUrl != null && { thumbnailWebUrl: page.thumbnailWebUrl }),
          ...(page.createdBy != null && {
            createdBy: {
              ...(page.createdBy.user != null && {
                user: {
                  ...(page.createdBy.user.displayName != null && { displayName: page.createdBy.user.displayName }),
                  ...(page.createdBy.user.email != null && { email: page.createdBy.user.email }),
                },
              }),
            },
          }),
          ...(page.lastModifiedBy != null && {
            lastModifiedBy: {
              ...(page.lastModifiedBy.user != null && {
                user: {
                  ...(page.lastModifiedBy.user.displayName != null && {
                    displayName: page.lastModifiedBy.user.displayName,
                  }),
                  ...(page.lastModifiedBy.user.email != null && { email: page.lastModifiedBy.user.email }),
                },
              }),
            },
          }),
          ...(page.publishingState != null && {
            publishingState: {
              ...(page.publishingState.level != null && { level: page.publishingState.level }),
              ...(page.publishingState.versionId != null && { versionId: page.publishingState.versionId }),
              ...(page.publishingState.checkedOutBy != null && {
                checkedOutBy: {
                  ...(page.publishingState.checkedOutBy.user != null && {
                    user: {
                      ...(page.publishingState.checkedOutBy.user.displayName != null && {
                        displayName: page.publishingState.checkedOutBy.user.displayName,
                      }),
                      ...(page.publishingState.checkedOutBy.user.email != null && {
                        email: page.publishingState.checkedOutBy.user.email,
                      }),
                    },
                  }),
                },
              }),
            },
          }),
          ...(page.reactions != null && {
            reactions: {
              ...(page.reactions.commentCount != null && { commentCount: page.reactions.commentCount }),
              ...(page.reactions.likeCount != null && { likeCount: page.reactions.likeCount }),
            },
          }),
          ...(page.titleArea != null && { titleArea: page.titleArea }),
        };
      });

      const nextCursor = providerResponse['@odata.nextLink']
        ? providerResponse['@odata.nextLink'].replace('https://graph.microsoft.com', '')
        : undefined;

      return {
        items,
        ...(nextCursor != null && { nextCursor }),
      };
    },
  });
}
