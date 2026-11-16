// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listWorksheetsInputSchema = z.object({
  driveId: z.string().describe('Drive ID containing the workbook. Example: "b!abc123"'),
  itemId: z.string().describe('Item ID of the workbook file. Example: "01RFYLAY..."'),
});

const ProviderWorksheetSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().optional(),
  visibility: z.string().optional(),
});

const WorksheetSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().optional(),
  visibility: z.string().optional(),
});

export const listWorksheetsOutputSchema = z.object({
  worksheets: z.array(WorksheetSchema),
});

export function listWorksheetsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_list_worksheets',
    description: 'List worksheets in a workbook.',
    inputSchema: listWorksheetsInputSchema,
    outputSchema: listWorksheetsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWorksheetsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const proxyConfig: PlatformProxyRequest = {
        // https://learn.microsoft.com/en-us/graph/api/worksheet-list
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/worksheets`,
        paginate: {
          type: 'link',
          link_path_in_response_body: '@odata.nextLink',
          response_path: 'value',
          limit: 100,
          limit_name_in_request: '$top',
        },
        retries: 3,
      };

      const worksheets: z.infer<typeof WorksheetSchema>[] = [];

      for await (const batch of platformProxy.paginate(proxyConfig)) {
        const parsedBatch = z.array(ProviderWorksheetSchema).parse(batch);

        worksheets.push(
          ...parsedBatch.map(worksheet => ({
            id: worksheet.id,
            name: worksheet.name,
            ...(worksheet.position !== undefined && { position: worksheet.position }),
            ...(worksheet.visibility !== undefined && { visibility: worksheet.visibility }),
          })),
        );
      }

      return { worksheets };
    },
  });
}
