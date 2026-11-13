// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteWordDocumentInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  itemId: z.string().describe('DriveItem ID of the Word document. Example: "01RFYLAYGCHWM67HNJIZBJNCQTFNXT6YGT"'),
});

export const deleteWordDocumentOutputSchema = z.object({
  success: z.boolean(),
  itemId: z.string(),
});

export function deleteWordDocumentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_word_delete_word_document',
    description: 'Delete a Word document.',
    inputSchema: deleteWordDocumentInputSchema,
    outputSchema: deleteWordDocumentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteWordDocumentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/en-us/graph/api/driveitem-delete
      await platformProxy.delete({
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}`,
        retries: 10,
      });

      return {
        success: true,
        itemId: input.itemId,
      };
    },
  });
}
