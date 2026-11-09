// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateWorksheetInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  itemId: z.string().describe('Workbook item ID. Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
  worksheetIdOrName: z.string().describe('Worksheet ID or name. Example: "Sheet1"'),
  name: z.string().optional().describe('New name for the worksheet.'),
  position: z.number().int().optional().describe('New zero-based position index for the worksheet tab.'),
});

const ProviderWorksheetSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().int(),
  visibility: z.string().optional(),
});

export const updateWorksheetOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().int(),
  visibility: z.string().optional(),
});

export function updateWorksheetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_update_worksheet',
    description: 'Rename a worksheet and/or change its tab position.',
    inputSchema: updateWorksheetInputSchema,
    outputSchema: updateWorksheetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateWorksheetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (input.name === undefined && input.position === undefined) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one of "name" or "position" must be provided.',
        });
      }

      const body: { name?: string; position?: number } = {};
      if (input.name !== undefined) {
        body.name = input.name;
      }
      if (input.position !== undefined) {
        body.position = input.position;
      }

      // OData string literals require embedded single quotes to be doubled.
      const encodedWorksheet = encodeURIComponent(input.worksheetIdOrName.replace(/'/g, "''"));

      // https://learn.microsoft.com/en-us/graph/api/worksheet-update
      const response = await platformProxy.patch({
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/worksheets('${encodedWorksheet}')`,
        data: body,
        retries: 3,
      });

      const providerWorksheet = ProviderWorksheetSchema.parse(response.data);

      return {
        id: providerWorksheet.id,
        name: providerWorksheet.name,
        position: providerWorksheet.position,
        ...(providerWorksheet.visibility !== undefined && { visibility: providerWorksheet.visibility }),
      };
    },
  });
}
