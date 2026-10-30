// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addChartInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  itemId: z.string().describe('Workbook item ID. Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
  worksheetIdOrName: z.string().describe('Worksheet ID or name. Example: "Sheet1"'),
  type: z.string().describe('Chart type. Example: "ColumnClustered"'),
  sourceData: z.string().describe('Source data range. Example: "Sheet1!B1:B3"'),
  seriesBy: z.string().optional().describe('How the series is arranged. Example: "Auto"'),
});

const ProviderChartSchema = z.object({
  id: z.string(),
  name: z.string(),
  height: z.number().optional(),
  width: z.number().optional(),
  top: z.number().optional(),
  left: z.number().optional(),
});

export const addChartOutputSchema = ProviderChartSchema;

export function addChartTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_add_chart',
    description: 'Create a chart on a worksheet from a data range.',
    inputSchema: addChartInputSchema,
    outputSchema: addChartOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addChartOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // OData string literals require embedded single quotes to be doubled.
      const encodedWorksheet = encodeURIComponent(input.worksheetIdOrName.replace(/'/g, "''"));

      const response = await platformProxy.post({
        // https://learn.microsoft.com/en-us/graph/api/chartcollection-add
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/worksheets('${encodedWorksheet}')/charts/add`,
        data: {
          type: input.type,
          sourceData: input.sourceData,
          ...(input.seriesBy !== undefined && { seriesBy: input.seriesBy }),
        },
        retries: 3,
      });

      return ProviderChartSchema.parse(response.data);
    },
  });
}
