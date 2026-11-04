// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const replaceImageInputSchema = z.object({
  documentId: z
    .string()
    .describe(
      'The ID of the document containing the image to replace. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"',
    ),
  imageObjectId: z.string().describe('The ID of the existing image to replace. Example: "kix.q9j8vk2w9bbp"'),
  uri: z.string().describe('Publicly accessible URI of the new image. Example: "https://example.com/image.png"'),
  imageReplaceMethod: z
    .enum(['CENTER_CROP'])
    .optional()
    .describe('Replacement method. CENTER_CROP scales and centers the image to fill the original bounds.'),
  tabId: z.string().optional().describe('The tab containing the image. When omitted, the first tab is used.'),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.record(z.string(), z.unknown())).optional(),
  writeControl: z.record(z.string(), z.unknown()).optional(),
});

export const replaceImageOutputSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.record(z.string(), z.unknown())).optional(),
  writeControl: z.record(z.string(), z.unknown()).optional(),
});

export function replaceImageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_replace_image',
    description: 'Replace an existing inline or positioned image with a new image from a URL.',
    inputSchema: replaceImageInputSchema,
    outputSchema: replaceImageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof replaceImageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        imageObjectId: input.imageObjectId,
        uri: input.uri,
      };

      if (input.imageReplaceMethod !== undefined) {
        requestBody['imageReplaceMethod'] = input.imageReplaceMethod;
      }

      if (input.tabId !== undefined) {
        requestBody['tabId'] = input.tabId;
      }

      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      const response = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              replaceImage: requestBody,
            },
          ],
        },
        retries: 3,
      });

      const parsed = BatchUpdateResponseSchema.safeParse(response.data);

      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'The Google Docs API returned an unexpected response format.',
          details: parsed.error.format(),
        });
      }

      return {
        documentId: parsed.data.documentId,
        ...(parsed.data.replies !== undefined && { replies: parsed.data.replies }),
        ...(parsed.data.writeControl !== undefined && { writeControl: parsed.data.writeControl }),
      };
    },
  });
}
