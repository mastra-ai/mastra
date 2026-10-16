// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSitePageInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "7f50f45e-714a-4264-9c59-3bf43ea4db8f"'),
  pageId: z.string().describe('Site page ID. Example: "df69e386-6c58-4df2-afc0-ab6327d5b202"'),
});

const IdentityUserSchema = z.object({
  displayName: z.string().optional(),
  email: z.string().optional(),
});

const IdentitySetSchema = z.object({
  user: IdentityUserSchema.optional(),
});

const ContentTypeInfoSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
});

const ItemReferenceSchema = z.object({
  listId: z.string().optional(),
  siteId: z.string().optional(),
});

const PublicationFacetSchema = z.object({
  level: z.string().optional(),
  versionId: z.string().optional(),
});

const ReactionsFacetSchema = z.object({
  commentCount: z.number().optional(),
});

const ProviderSitePageSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  title: z.string().nullish(),
  webUrl: z.string().nullish(),
  description: z.string().nullish(),
  eTag: z.string().nullish(),
  pageLayout: z.string().nullish(),
  promotionKind: z.string().nullish(),
  showComments: z.boolean().nullish(),
  showRecommendedPages: z.boolean().nullish(),
  thumbnailWebUrl: z.string().nullish(),
  createdDateTime: z.string().nullish(),
  lastModifiedDateTime: z.string().nullish(),
  createdBy: IdentitySetSchema.nullish(),
  lastModifiedBy: IdentitySetSchema.nullish(),
  contentType: ContentTypeInfoSchema.nullish(),
  parentReference: ItemReferenceSchema.nullish(),
  publishingState: PublicationFacetSchema.nullish(),
  reactions: ReactionsFacetSchema.nullish(),
  titleArea: z.unknown().optional(),
  canvasLayout: z.unknown().optional(),
});

export const getSitePageOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  title: z.string().optional(),
  webUrl: z.string().optional(),
  description: z.string().optional(),
  eTag: z.string().optional(),
  pageLayout: z.string().optional(),
  promotionKind: z.string().optional(),
  showComments: z.boolean().optional(),
  showRecommendedPages: z.boolean().optional(),
  thumbnailWebUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  createdBy: IdentitySetSchema.optional(),
  lastModifiedBy: IdentitySetSchema.optional(),
  contentType: ContentTypeInfoSchema.optional(),
  parentReference: ItemReferenceSchema.optional(),
  publishingState: PublicationFacetSchema.optional(),
  reactions: ReactionsFacetSchema.optional(),
  titleArea: z.unknown().optional(),
  canvasLayout: z.unknown().optional(),
});

export function getSitePageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_get_site_page',
    description: 'Retrieve a site page by ID.',
    inputSchema: getSitePageInputSchema,
    outputSchema: getSitePageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSitePageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/sitepage-get
      const response = await platformProxy.get({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/pages/${encodeURIComponent(input.pageId)}/microsoft.graph.sitePage`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Site page not found',
          siteId: input.siteId,
          pageId: input.pageId,
        });
      }

      const providerPage = ProviderSitePageSchema.parse(response.data);

      return {
        id: providerPage.id,
        ...(providerPage.name != null && { name: providerPage.name }),
        ...(providerPage.title != null && { title: providerPage.title }),
        ...(providerPage.webUrl != null && { webUrl: providerPage.webUrl }),
        ...(providerPage.description != null && { description: providerPage.description }),
        ...(providerPage.eTag != null && { eTag: providerPage.eTag }),
        ...(providerPage.pageLayout != null && { pageLayout: providerPage.pageLayout }),
        ...(providerPage.promotionKind != null && { promotionKind: providerPage.promotionKind }),
        ...(providerPage.showComments != null && { showComments: providerPage.showComments }),
        ...(providerPage.showRecommendedPages != null && { showRecommendedPages: providerPage.showRecommendedPages }),
        ...(providerPage.thumbnailWebUrl != null && { thumbnailWebUrl: providerPage.thumbnailWebUrl }),
        ...(providerPage.createdDateTime != null && { createdDateTime: providerPage.createdDateTime }),
        ...(providerPage.lastModifiedDateTime != null && { lastModifiedDateTime: providerPage.lastModifiedDateTime }),
        ...(providerPage.createdBy != null && { createdBy: providerPage.createdBy }),
        ...(providerPage.lastModifiedBy != null && { lastModifiedBy: providerPage.lastModifiedBy }),
        ...(providerPage.contentType != null && { contentType: providerPage.contentType }),
        ...(providerPage.parentReference != null && { parentReference: providerPage.parentReference }),
        ...(providerPage.publishingState != null && { publishingState: providerPage.publishingState }),
        ...(providerPage.reactions != null && { reactions: providerPage.reactions }),
        ...(providerPage.titleArea != null && { titleArea: providerPage.titleArea }),
        ...(providerPage.canvasLayout != null && { canvasLayout: providerPage.canvasLayout }),
      };
    },
  });
}
