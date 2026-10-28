// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPresentationContentInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  itemId: z.string().describe('Item ID. Example: "01RFYLAYBX27CGEGAJH5HZMVYI6Y3NGGYJ"'),
});

export const getPresentationContentOutputSchema = z.object({
  content: z.string().describe('Base64-encoded .pptx content'),
});

export function getPresentationContentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_get_presentation_content',
    description: 'Download the raw .pptx content of a presentation.',
    inputSchema: getPresentationContentInputSchema,
    outputSchema: getPresentationContentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPresentationContentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/en-us/graph/api/driveitem-get-content
      const response = await platformProxy.get({
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/content`,
        responseType: 'arraybuffer',
        retries: 3,
      });

      const raw = response.data;
      if (raw == null) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Presentation content not found.',
        });
      }
      if (typeof raw === 'string') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Expected binary content but received text.',
        });
      }
      if (Array.isArray(raw)) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Expected binary content but received an array.',
        });
      }

      const buffer = Buffer.from(raw);
      const content = buffer.toString('base64');

      return {
        content,
      };
    },
  });
}
