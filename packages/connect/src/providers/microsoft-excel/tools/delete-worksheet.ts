// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteWorksheetInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'Drive ID containing the workbook. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"',
    ),
  itemId: z.string().describe('Item ID of the workbook. Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
  worksheetIdOrName: z.string().describe('Worksheet ID or name to delete. Example: "Sheet1" or "RegistrySeedSheet2"'),
});

export const deleteWorksheetOutputSchema = z.object({
  success: z.boolean(),
  driveId: z.string(),
  itemId: z.string(),
  worksheetIdOrName: z.string(),
});

export function deleteWorksheetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_delete_worksheet',
    description: 'Delete a worksheet from a workbook.',
    inputSchema: deleteWorksheetInputSchema,
    outputSchema: deleteWorksheetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteWorksheetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // OData string literals require embedded single quotes to be doubled.
      const encodedWorksheet = encodeURIComponent(input.worksheetIdOrName.replace(/'/g, "''"));

      // https://learn.microsoft.com/en-us/graph/api/worksheet-delete
      const response = await platformProxy.delete({
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/worksheets('${encodedWorksheet}')`,
        retries: 3,
      });

      if (response.status !== 204) {
        throw new platformProxy.ActionError({
          type: 'unexpected_status',
          message: `Expected 204 No Content, but received ${response.status}`,
          driveId: input.driveId,
          itemId: input.itemId,
          worksheetIdOrName: input.worksheetIdOrName,
        });
      }

      return {
        success: true,
        driveId: input.driveId,
        itemId: input.itemId,
        worksheetIdOrName: input.worksheetIdOrName,
      };
    },
  });
}
