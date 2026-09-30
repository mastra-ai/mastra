// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addWorksheetInputSchema = z.object({
  driveId: z.string().describe('Drive ID. Example: "b!abc123"'),
  itemId: z.string().describe('Workbook item (file) ID. Example: "01RFYLAY..."'),
  name: z.string().optional().describe('Name for the new worksheet. If omitted, Excel auto-generates a name.'),
});

const ProviderWorksheetSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  visibility: z.string().optional(),
});

export const addWorksheetOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  visibility: z.string().optional(),
});

export function addWorksheetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_add_worksheet',
    description: 'Add a new worksheet to a workbook.',
    inputSchema: addWorksheetInputSchema,
    outputSchema: addWorksheetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addWorksheetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const urlPath = `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/worksheets/add`;

      // https://learn.microsoft.com/en-us/graph/api/worksheetcollection-add
      const response = await platformProxy.post({
        endpoint: urlPath,
        data: {
          ...(input.name !== undefined && { name: input.name }),
        },
        retries: 3,
      });

      const worksheet = ProviderWorksheetSchema.parse(response.data);

      return {
        id: worksheet.id,
        name: worksheet.name,
        position: worksheet.position,
        ...(worksheet.visibility !== undefined && { visibility: worksheet.visibility }),
      };
    },
  });
}
