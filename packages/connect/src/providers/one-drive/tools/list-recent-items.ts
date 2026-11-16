// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listRecentItemsInputSchema = z.object({});

const DriveItemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  folder: z.object({}).passthrough().optional(),
  file: z.object({}).passthrough().optional(),
  remoteItem: z.object({}).passthrough().optional(),
});

export const listRecentItemsOutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      webUrl: z.string().optional(),
      size: z.number().optional(),
      createdDateTime: z.string().optional(),
      lastModifiedDateTime: z.string().optional(),
      isFolder: z.boolean().optional(),
      isFile: z.boolean().optional(),
    }),
  ),
});

export function listRecentItemsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'one_drive_list_recent_items',
    description: 'List recently used items from the user drive.',
    inputSchema: listRecentItemsInputSchema,
    outputSchema: listRecentItemsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listRecentItemsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/drive-recent
        endpoint: '/v1.0/me/drive/recent',
        retries: 3,
      });

      if (!response.data || !response.data.value) {
        throw new platformProxy.ActionError({
          type: 'no_data',
          message: 'No recent items found',
        });
      }

      const recentItems = z.array(DriveItemSchema).parse(response.data.value);

      const items = recentItems.map(item => ({
        id: item.id,
        ...(item.name !== undefined && { name: item.name }),
        ...(item.webUrl !== undefined && { webUrl: item.webUrl }),
        ...(item.size !== undefined && { size: item.size }),
        ...(item.createdDateTime !== undefined && { createdDateTime: item.createdDateTime }),
        ...(item.lastModifiedDateTime !== undefined && { lastModifiedDateTime: item.lastModifiedDateTime }),
        ...(item.folder !== undefined && { isFolder: true }),
        ...(item.file !== undefined && { isFile: true }),
      }));

      return {
        items,
      };
    },
  });
}
