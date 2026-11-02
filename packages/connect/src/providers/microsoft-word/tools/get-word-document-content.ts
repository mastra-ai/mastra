// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getWordDocumentContentInputSchema = z.object({
  driveId: z
    .string()
    .describe('Drive ID. Example: "b!PkCXTGMWc0aQ-tL4aQtFEDRX0SkZPfZDl2tD7OP_gahvi-nd5TAvTJG6KTmx6Mm0"'),
  itemId: z.string().describe('Item ID (driveItem ID). Example: "01RFYLAYGCHWM67HNJIZBJNCQTFNXT6YGT"'),
});

export const getWordDocumentContentOutputSchema = z.object({
  content: z.string().describe('Base64-encoded raw .docx content'),
});

export function getWordDocumentContentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_word_get_word_document_content',
    description: 'Download the raw .docx content of a Word document.',
    inputSchema: getWordDocumentContentInputSchema,
    outputSchema: getWordDocumentContentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getWordDocumentContentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.proxy({
        // https://learn.microsoft.com/en-us/graph/api/driveitem-get-content
        endpoint: `/v1.0/drives/${encodeURIComponent(input.driveId)}/items/${encodeURIComponent(input.itemId)}/content`,
        retries: 3,
        responseType: 'arraybuffer',
      });

      if (response.data === undefined || response.data === null) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Word document content not found',
        });
      }

      let base64Content: string;
      const data: unknown = response.data;

      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
        base64Content = data.toString('base64');
      } else if (data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(data);
        const buffer = Buffer.from(bytes);
        base64Content = buffer.toString('base64');
      } else if (
        typeof data === 'object' &&
        data !== null &&
        'type' in data &&
        typeof data.type === 'string' &&
        data.type === 'Buffer' &&
        'data' in data &&
        Array.isArray(data.data)
      ) {
        const numbers = data.data.map(value => Number(value));
        const buffer = Buffer.from(numbers);
        base64Content = buffer.toString('base64');
      } else if (typeof data === 'string') {
        const buffer = Buffer.from(data, 'utf8');
        base64Content = buffer.toString('base64');
      } else {
        throw new platformProxy.ActionError({
          type: 'unexpected_format',
          message: 'Unexpected response format for Word document content',
        });
      }

      return {
        content: base64Content,
      };
    },
  });
}
