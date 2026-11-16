// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getWorkbookInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'The unique identifier of the drive. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"',
    ),
  itemId: z
    .string()
    .describe('The unique identifier of the drive item (workbook). Example: "01RFYLAYDQCQAOBGW2GVAYDEQMDDBL6JYU"'),
});

const FileFacetSchema = z.object({
  mimeType: z.string().optional(),
});

const ParentReferenceSchema = z.object({
  driveId: z.string().optional(),
  id: z.string().optional(),
  path: z.string().optional(),
});

export const getWorkbookOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().optional(),
  webUrl: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  file: FileFacetSchema.optional(),
  parentReference: ParentReferenceSchema.optional(),
});

export function getWorkbookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_excel_get_workbook',
    description: 'Retrieve driveItem metadata for a workbook.',
    inputSchema: getWorkbookInputSchema,
    outputSchema: getWorkbookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getWorkbookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-get
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}`,
        retries: 3,
      });

      const providerItem = z
        .object({
          id: z.string(),
          name: z.string(),
          size: z.number().optional(),
          webUrl: z.string().optional(),
          createdDateTime: z.string().optional(),
          lastModifiedDateTime: z.string().optional(),
          file: z
            .object({
              mimeType: z.string().optional(),
            })
            .optional(),
          parentReference: z
            .object({
              driveId: z.string().optional(),
              id: z.string().optional(),
              path: z.string().optional(),
            })
            .optional(),
        })
        .parse(response.data);

      return {
        id: providerItem.id,
        name: providerItem.name,
        ...(providerItem.size !== undefined && { size: providerItem.size }),
        ...(providerItem.webUrl !== undefined && { webUrl: providerItem.webUrl }),
        ...(providerItem.createdDateTime !== undefined && { createdDateTime: providerItem.createdDateTime }),
        ...(providerItem.lastModifiedDateTime !== undefined && {
          lastModifiedDateTime: providerItem.lastModifiedDateTime,
        }),
        ...(providerItem.file !== undefined && {
          file: {
            ...(providerItem.file.mimeType !== undefined && { mimeType: providerItem.file.mimeType }),
          },
        }),
        ...(providerItem.parentReference !== undefined && {
          parentReference: {
            ...(providerItem.parentReference.driveId !== undefined && {
              driveId: providerItem.parentReference.driveId,
            }),
            ...(providerItem.parentReference.id !== undefined && { id: providerItem.parentReference.id }),
            ...(providerItem.parentReference.path !== undefined && { path: providerItem.parentReference.path }),
          },
        }),
      };
    },
  });
}
