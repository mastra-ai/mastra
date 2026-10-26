// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPresentationAsPdfInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  itemId: z.string().describe('Item ID of the presentation. Example: "01RFYLAYBX27CGEGAJH5HZMVYI6Y3NGGYJ"'),
});

export const getPresentationAsPdfOutputSchema = z.object({
  content: z.string().describe('Base64-encoded PDF content'),
  contentType: z.string().optional(),
  size: z.number().optional(),
});

export function getPresentationAsPdfTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_powerpoint_get_presentation_as_pdf',
    description: 'Download a presentation converted to PDF',
    inputSchema: getPresentationAsPdfInputSchema,
    outputSchema: getPresentationAsPdfOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPresentationAsPdfOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-get-content-format
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/content`,
        params: {
          format: 'pdf',
        },
        responseType: 'arraybuffer',
        retries: 3,
      });

      const rawData: unknown = response.data;
      let buffer: Buffer;

      const BufferLikeSchema = z.object({ data: z.array(z.number()) });
      const bufferLike = BufferLikeSchema.safeParse(rawData);

      if (rawData instanceof ArrayBuffer) {
        buffer = Buffer.from(rawData);
      } else if (Buffer.isBuffer(rawData)) {
        buffer = rawData;
      } else if (typeof rawData === 'string') {
        buffer = Buffer.from(rawData, 'binary');
      } else if (bufferLike.success) {
        buffer = Buffer.from(bufferLike.data.data);
      } else {
        throw new platformProxy.ActionError({
          type: 'unexpected_response',
          message: 'Expected binary response but received unexpected type',
        });
      }

      const contentTypeHeader = response.headers['content-type'];
      const contentType = typeof contentTypeHeader === 'string' ? contentTypeHeader : 'application/pdf';

      return {
        content: buffer.toString('base64'),
        contentType,
        size: buffer.length,
      };
    },
  });
}
