// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateSitePageInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "7f50f45e-714a-4264-9c59-3bf43ea4db8f"'),
  pageId: z.string().describe('SharePoint site page ID. Example: "df69e386-6c58-4df2-afc0-ab6327d5b202"'),
  title: z.string().optional().describe('Title of the site page.'),
  description: z.string().optional().describe('Description of the site page.'),
  showComments: z.boolean().optional().describe('Whether to show comments at the bottom of the page.'),
  showRecommendedPages: z.boolean().optional().describe('Whether to show recommended pages at the bottom of the page.'),
  thumbnailWebUrl: z.string().optional().describe('URL of the site page thumbnail image.'),
  promotionKind: z.string().optional().describe('Promotion kind of the page. Values: page, newsPost.'),
  titleArea: z.object({}).passthrough().optional().describe('Title area configuration.'),
  canvasLayout: z.object({}).passthrough().optional().describe('Canvas layout configuration.'),
});

const ProviderIdentitySchema = z.object({
  displayName: z.string().optional(),
  email: z.string().optional(),
});

const ProviderIdentitySetSchema = z.object({
  user: ProviderIdentitySchema.optional(),
});

const ProviderPublicationFacetSchema = z.object({
  level: z.string().optional(),
  versionId: z.string().optional(),
});

const ProviderTitleAreaSchema = z.object({
  enableGradientEffect: z.boolean().optional(),
  imageWebUrl: z.string().optional(),
  layout: z.string().optional(),
  showAuthor: z.boolean().optional(),
  showPublishedDate: z.boolean().optional(),
  showTextBlockAboveTitle: z.boolean().optional(),
  textAboveTitle: z.string().optional(),
  textAlignment: z.string().optional(),
  title: z.string().optional(),
  imageSourceType: z.number().optional(),
});

const ProviderSitePageSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  webUrl: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  pageLayout: z.string().optional(),
  showComments: z.boolean().optional(),
  showRecommendedPages: z.boolean().optional(),
  thumbnailWebUrl: z.string().optional(),
  promotionKind: z.string().optional(),
  createdBy: ProviderIdentitySetSchema.optional(),
  lastModifiedBy: ProviderIdentitySetSchema.optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  publishingState: ProviderPublicationFacetSchema.optional(),
  titleArea: ProviderTitleAreaSchema.optional(),
});

export const updateSitePageOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  webUrl: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  pageLayout: z.string().optional(),
  showComments: z.boolean().optional(),
  showRecommendedPages: z.boolean().optional(),
  thumbnailWebUrl: z.string().optional(),
  promotionKind: z.string().optional(),
  createdBy: z
    .object({
      displayName: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  lastModifiedBy: z
    .object({
      displayName: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  publishingState: z
    .object({
      level: z.string().optional(),
      versionId: z.string().optional(),
    })
    .optional(),
  titleArea: z
    .object({
      enableGradientEffect: z.boolean().optional(),
      imageWebUrl: z.string().optional(),
      layout: z.string().optional(),
      showAuthor: z.boolean().optional(),
      showPublishedDate: z.boolean().optional(),
      showTextBlockAboveTitle: z.boolean().optional(),
      textAboveTitle: z.string().optional(),
      textAlignment: z.string().optional(),
      title: z.string().optional(),
      imageSourceType: z.number().optional(),
    })
    .optional(),
});

function buildUpdateBody(input: z.infer<typeof updateSitePageInputSchema>): Record<string, unknown> {
  const body: Record<string, unknown> = {
    '@odata.type': '#microsoft.graph.sitePage',
  };

  if (input.title !== undefined) {
    body['title'] = input.title;
  }
  if (input.description !== undefined) {
    body['description'] = input.description;
  }
  if (input.showComments !== undefined) {
    body['showComments'] = input.showComments;
  }
  if (input.showRecommendedPages !== undefined) {
    body['showRecommendedPages'] = input.showRecommendedPages;
  }
  if (input.thumbnailWebUrl !== undefined) {
    body['thumbnailWebUrl'] = input.thumbnailWebUrl;
  }
  if (input.promotionKind !== undefined) {
    body['promotionKind'] = input.promotionKind;
  }
  if (input.titleArea !== undefined) {
    body['titleArea'] = input.titleArea;
  }
  if (input.canvasLayout !== undefined) {
    body['canvasLayout'] = input.canvasLayout;
  }

  return body;
}

function normalizeIdentitySet(
  identitySet: z.infer<typeof ProviderIdentitySetSchema> | undefined,
): { displayName?: string; email?: string } | undefined {
  if (!identitySet?.user) {
    return undefined;
  }
  return {
    ...(identitySet.user.displayName !== undefined && { displayName: identitySet.user.displayName }),
    ...(identitySet.user.email !== undefined && { email: identitySet.user.email }),
  };
}

export function updateSitePageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_update_site_page',
    description: 'Update a modern site page draft.',
    inputSchema: updateSitePageInputSchema,
    outputSchema: updateSitePageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateSitePageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://learn.microsoft.com/graph/api/sitepage-update
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/pages/${encodeURIComponent(input.pageId)}/microsoft.graph.sitePage`,
        data: buildUpdateBody(input),
        retries: 3,
      });

      const providerPage = ProviderSitePageSchema.parse(response.data);

      return {
        id: providerPage.id,
        ...(providerPage.name !== undefined && { name: providerPage.name }),
        ...(providerPage.webUrl !== undefined && { webUrl: providerPage.webUrl }),
        ...(providerPage.title !== undefined && { title: providerPage.title }),
        ...(providerPage.description !== undefined && { description: providerPage.description }),
        ...(providerPage.pageLayout !== undefined && { pageLayout: providerPage.pageLayout }),
        ...(providerPage.showComments !== undefined && { showComments: providerPage.showComments }),
        ...(providerPage.showRecommendedPages !== undefined && {
          showRecommendedPages: providerPage.showRecommendedPages,
        }),
        ...(providerPage.thumbnailWebUrl !== undefined && { thumbnailWebUrl: providerPage.thumbnailWebUrl }),
        ...(providerPage.promotionKind !== undefined && { promotionKind: providerPage.promotionKind }),
        ...(normalizeIdentitySet(providerPage.createdBy) !== undefined && {
          createdBy: normalizeIdentitySet(providerPage.createdBy),
        }),
        ...(normalizeIdentitySet(providerPage.lastModifiedBy) !== undefined && {
          lastModifiedBy: normalizeIdentitySet(providerPage.lastModifiedBy),
        }),
        ...(providerPage.createdDateTime !== undefined && { createdDateTime: providerPage.createdDateTime }),
        ...(providerPage.lastModifiedDateTime !== undefined && {
          lastModifiedDateTime: providerPage.lastModifiedDateTime,
        }),
        ...(providerPage.publishingState !== undefined && {
          publishingState: {
            ...(providerPage.publishingState.level !== undefined && { level: providerPage.publishingState.level }),
            ...(providerPage.publishingState.versionId !== undefined && {
              versionId: providerPage.publishingState.versionId,
            }),
          },
        }),
        ...(providerPage.titleArea !== undefined && {
          titleArea: {
            ...(providerPage.titleArea.enableGradientEffect !== undefined && {
              enableGradientEffect: providerPage.titleArea.enableGradientEffect,
            }),
            ...(providerPage.titleArea.imageWebUrl !== undefined && {
              imageWebUrl: providerPage.titleArea.imageWebUrl,
            }),
            ...(providerPage.titleArea.layout !== undefined && { layout: providerPage.titleArea.layout }),
            ...(providerPage.titleArea.showAuthor !== undefined && { showAuthor: providerPage.titleArea.showAuthor }),
            ...(providerPage.titleArea.showPublishedDate !== undefined && {
              showPublishedDate: providerPage.titleArea.showPublishedDate,
            }),
            ...(providerPage.titleArea.showTextBlockAboveTitle !== undefined && {
              showTextBlockAboveTitle: providerPage.titleArea.showTextBlockAboveTitle,
            }),
            ...(providerPage.titleArea.textAboveTitle !== undefined && {
              textAboveTitle: providerPage.titleArea.textAboveTitle,
            }),
            ...(providerPage.titleArea.textAlignment !== undefined && {
              textAlignment: providerPage.titleArea.textAlignment,
            }),
            ...(providerPage.titleArea.title !== undefined && { title: providerPage.titleArea.title }),
            ...(providerPage.titleArea.imageSourceType !== undefined && {
              imageSourceType: providerPage.titleArea.imageSourceType,
            }),
          },
        }),
      };
    },
  });
}
