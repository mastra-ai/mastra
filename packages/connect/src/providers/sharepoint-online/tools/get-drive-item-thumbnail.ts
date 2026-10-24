// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getDriveItemThumbnailInputSchema = z.object({
  siteId: z.string().describe('SharePoint site ID. Example: "contoso.sharepoint.com,siteId,webId"'),
  driveId: z.string().describe('Drive ID. Example: "b!driveId"'),
  itemId: z.string().describe('Drive item ID. Example: "01NKDM7HMOJTVYMDOSXFDK2QJDXCDI3WUK"'),
});

const ThumbnailSchema = z.object({
  height: z.number().optional(),
  width: z.number().optional(),
  url: z.string().optional(),
});

const ThumbnailSetSchema = z.object({
  id: z.string(),
  small: ThumbnailSchema.optional(),
  medium: ThumbnailSchema.optional(),
  large: ThumbnailSchema.optional(),
});

export const getDriveItemThumbnailOutputSchema = z.object({
  thumbnailSets: z.array(ThumbnailSetSchema),
});

export function getDriveItemThumbnailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sharepoint_online_get_drive_item_thumbnail',
    description: 'Retrieve thumbnail URLs for a drive item.',
    inputSchema: getDriveItemThumbnailInputSchema,
    outputSchema: getDriveItemThumbnailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDriveItemThumbnailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/en-us/graph/api/driveitem-list-thumbnails
      const response = await platformProxy.get({
        endpoint: `/v1.0/sites/${encodeURIComponent(input.siteId)}/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/thumbnails`,
        retries: 3,
      });

      const providerSchema = z.object({
        value: z.array(
          z.object({
            id: z.string(),
            small: ThumbnailSchema.optional(),
            medium: ThumbnailSchema.optional(),
            large: ThumbnailSchema.optional(),
          }),
        ),
      });

      const parsed = providerSchema.parse(response.data);

      return {
        thumbnailSets: parsed.value.map(set => ({
          id: set.id,
          ...(set.small !== undefined && { small: set.small }),
          ...(set.medium !== undefined && { medium: set.medium }),
          ...(set.large !== undefined && { large: set.large }),
        })),
      };
    },
  });
}
