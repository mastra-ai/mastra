// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const moveWordDocumentInputSchema = z.object({
  driveId: z.string().describe('Drive ID containing the document. Example: "b!abc123"'),
  itemId: z.string().describe('ID of the Word document (driveItem) to move. Example: "01RFYLAY..."'),
  destinationFolderId: z
    .string()
    .describe('ID of the destination folder (driveItem) within the same drive. Example: "01RFYLAY..."'),
});

const ProviderParentReferenceSchema = z.object({
  id: z.string().nullish(),
  driveId: z.string().nullish(),
  path: z.string().nullish(),
});

const ProviderDriveItemSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  webUrl: z.string().nullish(),
  size: z.number().nullish(),
  createdDateTime: z.string().nullish(),
  lastModifiedDateTime: z.string().nullish(),
  parentReference: ProviderParentReferenceSchema.nullish(),
});

export const moveWordDocumentOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  webUrl: z.string().optional(),
  size: z.number().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  parentReference: ProviderParentReferenceSchema.optional(),
});

export function moveWordDocumentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_word_move_word_document',
    description: 'Move a Word document to a different folder.',
    inputSchema: moveWordDocumentInputSchema,
    outputSchema: moveWordDocumentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof moveWordDocumentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-move
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}`,
        data: {
          parentReference: {
            id: input.destinationFolderId,
          },
        },
        retries: 3,
      });

      const providerItem = ProviderDriveItemSchema.parse(response.data);
      const parentReference = providerItem.parentReference;

      return {
        id: providerItem.id,
        ...(providerItem.name != null && { name: providerItem.name }),
        ...(providerItem.webUrl != null && { webUrl: providerItem.webUrl }),
        ...(providerItem.size != null && { size: providerItem.size }),
        ...(providerItem.createdDateTime != null && { createdDateTime: providerItem.createdDateTime }),
        ...(providerItem.lastModifiedDateTime != null && { lastModifiedDateTime: providerItem.lastModifiedDateTime }),
        ...(parentReference != null && {
          parentReference: {
            ...(parentReference.id != null && { id: parentReference.id }),
            ...(parentReference.driveId != null && { driveId: parentReference.driveId }),
            ...(parentReference.path != null && { path: parentReference.path }),
          },
        }),
      };
    },
  });
}
