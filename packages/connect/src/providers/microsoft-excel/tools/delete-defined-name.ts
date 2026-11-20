// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteDefinedNameInputSchema = z.object({
  driveId: z.string().describe('Drive ID containing the workbook. Example: "b!abc123"'),
  itemId: z.string().describe('Workbook file item ID. Example: "01RFYLAYBTFQ2CLBMYRNEJOWXIFFJQOYW2"'),
  name: z.string().describe('Defined name to delete. Example: "DryrunDeleteTestName"'),
});

export const deleteDefinedNameOutputSchema = z.object({
  success: z.boolean(),
  driveId: z.string(),
  itemId: z.string(),
  name: z.string(),
});

export function deleteDefinedNameTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_delete_defined_name',
    description: 'Delete a workbook-level defined name.',
    inputSchema: deleteDefinedNameInputSchema,
    outputSchema: deleteDefinedNameOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteDefinedNameOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/en-us/graph/api/resources/workbooknameditem
      const response = await platformProxy.delete({
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/names('${encodeURIComponent(input.name)}')`,
        retries: 3,
      });

      if (response.status !== 204) {
        throw new platformProxy.ActionError({
          type: 'unexpected_status',
          message: `Expected 204 No Content, but received ${response.status}`,
          driveId: input.driveId,
          itemId: input.itemId,
          name: input.name,
        });
      }

      return {
        success: true,
        driveId: input.driveId,
        itemId: input.itemId,
        name: input.name,
      };
    },
  });
}
