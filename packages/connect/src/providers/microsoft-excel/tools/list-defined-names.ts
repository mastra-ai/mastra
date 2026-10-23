// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listDefinedNamesInputSchema = z.object({
  driveId: z.string().describe('Drive ID containing the workbook. Example: "b!abc123"'),
  itemId: z.string().describe('Workbook item ID. Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
});

const NamedItemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  comment: z.string().optional().nullable(),
  scope: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  value: z.unknown().optional().nullable(),
  visible: z.boolean().optional().nullable(),
});

export const listDefinedNamesOutputSchema = z.object({
  names: z.array(NamedItemSchema),
});

const ProviderResponseSchema = z
  .object({
    value: z.array(
      z
        .object({
          id: z.string().nullish(),
          name: z.string(),
          comment: z.string().nullish(),
          scope: z.string().nullish(),
          type: z.string().nullish(),
          value: z.unknown().nullish(),
          visible: z.boolean().nullish(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export function listDefinedNamesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_list_defined_names',
    description: 'List workbook-level defined names.',
    inputSchema: listDefinedNamesInputSchema,
    outputSchema: listDefinedNamesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDefinedNamesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/resources/nameditem
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/workbook/names`,
        retries: 3,
      });

      const parsed = ProviderResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: `Failed to parse workbook names response: ${parsed.error.message}`,
        });
      }

      const names = parsed.data.value.map(item => {
        return {
          ...(item.id != null && { id: item.id }),
          name: item.name,
          ...(item.comment != null && { comment: item.comment }),
          ...(item.scope != null && { scope: item.scope }),
          ...(item.type != null && { type: item.type }),
          ...(item.value !== undefined && { value: item.value }),
          ...(item.visible != null && { visible: item.visible }),
        };
      });

      return { names };
    },
  });
}
