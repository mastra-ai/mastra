// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addDefinedNameInputSchema = z.object({
  driveId: z.string().describe('Drive ID. Example: b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0'),
  itemId: z.string().describe('Drive item (workbook) ID. Example: 01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU'),
  name: z.string().describe('Defined name. Example: MyNamedRange'),
  reference: z.string().describe('Reference formula or range. Example: =Sheet1!$B$1:$B$3'),
  comment: z.string().optional().describe('Optional comment for the defined name.'),
});

const ProviderWorksheetSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
});

const ProviderNamedItemSchema = z.object({
  name: z.string(),
  value: z.string().optional(),
  comment: z.string().optional(),
  scope: z.string().optional(),
  type: z.string().optional(),
  visible: z.boolean().optional(),
  worksheet: ProviderWorksheetSchema.optional().nullable(),
});

export const addDefinedNameOutputSchema = z.object({
  name: z.string(),
  value: z.string().optional(),
  comment: z.string().optional(),
  scope: z.string().optional(),
  type: z.string().optional(),
  visible: z.boolean().optional(),
  worksheetId: z.string().optional(),
  worksheetName: z.string().optional(),
});

export function addDefinedNameTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_add_defined_name',
    description: 'Create a workbook-level defined name (named range or formula).',
    inputSchema: addDefinedNameInputSchema,
    outputSchema: addDefinedNameOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addDefinedNameOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://learn.microsoft.com/en-us/graph/api/workbooknameditemcollection-add
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/names/add`,
        data: {
          name: input.name,
          reference: input.reference,
          ...(input.comment !== undefined && { comment: input.comment }),
        },
        retries: 3,
      });

      const providerItem = ProviderNamedItemSchema.parse(response.data);

      return {
        name: providerItem.name,
        ...(providerItem.value !== undefined && { value: providerItem.value }),
        ...(providerItem.comment !== undefined && { comment: providerItem.comment }),
        ...(providerItem.scope !== undefined && { scope: providerItem.scope }),
        ...(providerItem.type !== undefined && { type: providerItem.type }),
        ...(providerItem.visible !== undefined && { visible: providerItem.visible }),
        ...(providerItem.worksheet?.id !== undefined && { worksheetId: providerItem.worksheet.id }),
        ...(providerItem.worksheet?.name !== undefined && { worksheetName: providerItem.worksheet.name }),
      };
    },
  });
}
