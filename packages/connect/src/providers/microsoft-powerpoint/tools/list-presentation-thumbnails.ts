// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ThumbnailSizeSchema = z.object({
  height: z.number().optional(),
  width: z.number().optional(),
  url: z.string(),
});

const ThumbnailSetSchema = z.object({
  id: z.string(),
  large: ThumbnailSizeSchema.optional(),
  medium: ThumbnailSizeSchema.optional(),
  small: ThumbnailSizeSchema.optional(),
});

const ProviderResponseSchema = z.object({
  value: z.array(ThumbnailSetSchema),
});

export const listPresentationThumbnailsInputSchema = z.object({
  driveId: z.string().describe('Drive ID. Example: "b!abc123"'),
  itemId: z.string().describe('Item ID of the presentation. Example: "01RFYLAY..."'),
});

export const listPresentationThumbnailsOutputSchema = z.object({
  thumbnails: z.array(
    z.object({
      id: z.string(),
      smallUrl: z.string().optional(),
      mediumUrl: z.string().optional(),
      largeUrl: z.string().optional(),
    }),
  ),
});

export function listPresentationThumbnailsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_list_presentation_thumbnails',
    description: 'Get thumbnail image URLs for a presentation.',
    inputSchema: listPresentationThumbnailsInputSchema,
    outputSchema: listPresentationThumbnailsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPresentationThumbnailsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const encodedDriveId = encodeURIComponent(input.driveId);
      const encodedItemId = encodeURIComponent(input.itemId);

      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-list-thumbnails
        endpoint: `/v1.0/drives/${encodedDriveId}/items/${encodedItemId}/thumbnails`,
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      const thumbnails = providerData.value.map(set => ({
        id: set.id,
        ...(set.small != null && { smallUrl: set.small.url }),
        ...(set.medium != null && { mediumUrl: set.medium.url }),
        ...(set.large != null && { largeUrl: set.large.url }),
      }));

      return { thumbnails };
    },
  });
}
