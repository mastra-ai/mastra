// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const calculateWorkbookInputSchema = z.object({
  driveId: z.string().describe('The ID of the drive containing the workbook. Example: "b!abc123"'),
  itemId: z
    .string()
    .describe('The ID of the workbook file (drive item). Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
  calculationType: z
    .enum(['Recalculate', 'Full', 'FullRebuild'])
    .optional()
    .describe('The calculation type. Defaults to "Recalculate".'),
});

export const calculateWorkbookOutputSchema = z.object({
  success: z.literal(true),
});

export function calculateWorkbookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_calculate_workbook',
    description: 'Force recalculation of all formulas in the workbook.',
    inputSchema: calculateWorkbookInputSchema,
    outputSchema: calculateWorkbookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof calculateWorkbookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/en-us/graph/api/resources/excel
      await platformProxy.post({
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/application/calculate`,
        data: {
          calculationType: input.calculationType ?? 'Recalculate',
        },
        retries: 3,
      });

      return { success: true };
    },
  });
}
