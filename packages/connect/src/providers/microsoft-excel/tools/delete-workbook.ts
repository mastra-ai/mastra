// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteWorkbookInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'Drive ID containing the workbook. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"',
    ),
  itemId: z.string().describe('Workbook item ID to delete. Example: "01RFYLAYBTFQ2CLBMYRNEJOWXIFFJQOYW2"'),
});

export const deleteWorkbookOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteWorkbookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_delete_workbook',
    description: 'Delete a workbook file.',
    inputSchema: deleteWorkbookInputSchema,
    outputSchema: deleteWorkbookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteWorkbookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/en-us/graph/api/driveitem-delete
      await platformProxy.delete({
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}`,
        retries: 3,
      });

      return { success: true };
    },
  });
}
