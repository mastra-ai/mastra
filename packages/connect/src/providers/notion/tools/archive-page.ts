// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const archivePageInputSchema = z.object({
  page_id: z.string().describe('Notion page ID to archive. Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"'),
});

const ProviderPageSchema = z.object({
  id: z.string(),
  archived: z.boolean(),
  in_trash: z.boolean().optional(),
  url: z.string().optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
});

export const archivePageOutputSchema = z.object({
  id: z.string(),
  archived: z.boolean(),
  in_trash: z.boolean().optional(),
  url: z.string().optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
});

export function archivePageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_archive_page',
    description: 'Archive a page so it is removed from active workspace views.',
    inputSchema: archivePageInputSchema,
    outputSchema: archivePageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof archivePageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const pageId = input.page_id;

      // https://developers.notion.com/reference/patch-page
      const response = await platformProxy.patch({
        endpoint: `/v1/pages/${encodeURIComponent(pageId)}`,
        data: {
          archived: true,
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Page not found',
          page_id: pageId,
        });
      }

      const providerPage = ProviderPageSchema.parse(response.data);

      return {
        id: providerPage.id,
        archived: providerPage.archived,
        ...(providerPage.in_trash !== undefined && { in_trash: providerPage.in_trash }),
        ...(providerPage.url !== undefined && { url: providerPage.url }),
        ...(providerPage.created_time !== undefined && { created_time: providerPage.created_time }),
        ...(providerPage.last_edited_time !== undefined && { last_edited_time: providerPage.last_edited_time }),
      };
    },
  });
}
