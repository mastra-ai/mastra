// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getChartImageInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'Drive ID containing the workbook. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"',
    ),
  itemId: z.string().describe('Workbook item ID. Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
  worksheetIdOrName: z.string().describe('Worksheet ID or name. Example: "Sheet1"'),
  chartId: z
    .string()
    .describe(
      "Chart ID (GUID). Use the chart's id, not its display name, to avoid URL encoding issues with names containing spaces.",
    ),
});

const ProviderResponseSchema = z.object({
  value: z.string(),
});

export const getChartImageOutputSchema = z.object({
  imageBase64: z.string().describe('Base64-encoded PNG image of the chart.'),
});

export function getChartImageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_get_chart_image',
    description: 'Render a chart as an image.',
    inputSchema: getChartImageInputSchema,
    outputSchema: getChartImageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getChartImageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // OData string literals require embedded single quotes to be doubled.
      const encodedWorksheet = encodeURIComponent(input.worksheetIdOrName.replace(/'/g, "''"));
      const encodedChartId = encodeURIComponent(input.chartId.replace(/'/g, "''"));

      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/resources/excel
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/worksheets('${encodedWorksheet}')/charts('${encodedChartId}')/image`,
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        imageBase64: providerData.value,
      };
    },
  });
}
