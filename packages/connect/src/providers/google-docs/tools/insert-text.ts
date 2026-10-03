// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const LocationSchema = z.object({
  index: z.number().int().min(0).describe('The zero-based index in the segment where the text will be inserted.'),
  segmentId: z
    .string()
    .optional()
    .describe('The ID of the header, footer or footnote segment. Omit or use empty string for the body.'),
  tabId: z.string().optional().describe('The ID of the tab for multi-tab documents.'),
});

const EndOfSegmentLocationSchema = z.object({
  segmentId: z
    .string()
    .optional()
    .describe('The ID of the header, footer or footnote segment. Omit or use empty string for the body.'),
  tabId: z.string().optional().describe('The ID of the tab for multi-tab documents.'),
});

export const insertTextInputSchema = z.object({
  documentId: z.string().describe('The ID of the document to edit. Example: "abc123"'),
  text: z.string().describe('The text to insert into the document.'),
  location: LocationSchema.optional().describe(
    'A specific index location. Provide either location or endOfSegmentLocation, not both.',
  ),
  endOfSegmentLocation: EndOfSegmentLocationSchema.optional().describe(
    'Insert at the end of a segment. Provide either location or endOfSegmentLocation, not both.',
  ),
});

const ReplySchema = z.object({}).passthrough();

export const insertTextOutputSchema = z.object({
  documentId: z.string().optional(),
  replies: z.array(ReplySchema).optional(),
});

export function insertTextTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_insert_text',
    description: 'Insert text at an index or at the end of a segment.',
    inputSchema: insertTextInputSchema,
    outputSchema: insertTextOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof insertTextOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const hasLocation = input.location !== undefined;
      const hasEndOfSegment = input.endOfSegmentLocation !== undefined;

      if (hasLocation && hasEndOfSegment) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Only one of location or endOfSegmentLocation may be provided, not both.',
        });
      }

      if (!hasLocation && !hasEndOfSegment) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Either location or endOfSegmentLocation must be provided.',
        });
      }

      const insertTextRequest: Record<string, unknown> = {
        text: input.text,
      };

      if (hasLocation && input.location) {
        const location: Record<string, unknown> = {
          index: input.location.index,
        };

        if (input.location.segmentId !== undefined) {
          location['segmentId'] = input.location.segmentId;
        }

        if (input.location.tabId !== undefined) {
          location['tabId'] = input.location.tabId;
        }

        insertTextRequest['location'] = location;
      } else if (hasEndOfSegment && input.endOfSegmentLocation) {
        const endOfSegmentLocation: Record<string, unknown> = {};

        if (input.endOfSegmentLocation.segmentId !== undefined) {
          endOfSegmentLocation['segmentId'] = input.endOfSegmentLocation.segmentId;
        }

        if (input.endOfSegmentLocation.tabId !== undefined) {
          endOfSegmentLocation['tabId'] = input.endOfSegmentLocation.tabId;
        }

        insertTextRequest['endOfSegmentLocation'] = endOfSegmentLocation;
      }

      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              insertText: insertTextRequest,
            },
          ],
        },
        retries: 3,
      });

      const BatchUpdateResponseSchema = z.object({
        documentId: z.string().optional(),
        replies: z.array(z.object({}).passthrough()).optional(),
      });

      const parsed = BatchUpdateResponseSchema.parse(response.data);

      return {
        ...(parsed.documentId !== undefined && { documentId: parsed.documentId }),
        ...(parsed.replies !== undefined && { replies: parsed.replies }),
      };
    },
  });
}
