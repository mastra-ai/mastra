// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPresentationInputSchema = z.object({
  driveId: z
    .string()
    .describe(
      'The ID of the drive containing the presentation. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"',
    ),
  itemId: z
    .string()
    .describe('The ID of the driveItem representing the presentation. Example: "01RFYLAYBX27CGEGAJH5HZMVYI6Y3NGGYJ"'),
});

export const getPresentationOutputSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    size: z.number().nullable().optional(),
    webUrl: z.string().nullable().optional(),
    createdDateTime: z.string().nullable().optional(),
    lastModifiedDateTime: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    file: z
      .object({
        mimeType: z.string().optional(),
        hashes: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
    parentReference: z
      .object({
        driveId: z.string().optional(),
        id: z.string().optional(),
        path: z.string().optional(),
      })
      .optional(),
    createdBy: z
      .object({
        user: z
          .object({
            displayName: z.string().optional(),
            email: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    lastModifiedBy: z
      .object({
        user: z
          .object({
            displayName: z.string().optional(),
            email: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .passthrough();

export function getPresentationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_get_presentation',
    description: 'Retrieve driveItem metadata for a presentation',
    inputSchema: getPresentationInputSchema,
    outputSchema: getPresentationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPresentationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-get
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}`,
        retries: 3,
      });

      if (response.status === 404) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Presentation not found',
          driveId: input.driveId,
          itemId: input.itemId,
        });
      }

      const driveItem = getPresentationOutputSchema.parse(response.data);
      return driveItem;
    },
  });
}
