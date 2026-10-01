// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const RgbColorSchema = z.object({
  red: z.number().min(0).max(1).optional(),
  green: z.number().min(0).max(1).optional(),
  blue: z.number().min(0).max(1).optional(),
});

const ColorSchema = z.object({
  color: z
    .object({
      rgbColor: RgbColorSchema.optional(),
    })
    .optional(),
});

const LinkSchema = z.object({
  url: z.string().optional(),
  bookmarkId: z.string().optional(),
  headingId: z.string().optional(),
});

const FontSizeSchema = z.object({
  magnitude: z.number(),
  unit: z.string().optional(),
});

const WeightedFontFamilySchema = z.object({
  fontFamily: z.string(),
  weight: z.number().optional(),
});

export const updateTextStyleInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  startIndex: z.number().int().min(0).describe('Start index of the text range (inclusive).'),
  endIndex: z.number().int().min(0).describe('End index of the text range (exclusive).'),
  segmentId: z.string().optional().describe('Segment ID for headers or footers. Omit for body.'),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  foregroundColor: ColorSchema.optional(),
  backgroundColor: ColorSchema.optional(),
  link: LinkSchema.optional(),
  fontSize: FontSizeSchema.optional(),
  weightedFontFamily: WeightedFontFamilySchema.optional(),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.unknown()),
  writeControl: z
    .object({
      requiredRevisionId: z.string().optional(),
    })
    .optional(),
});

export const updateTextStyleOutputSchema = z.object({
  documentId: z.string(),
  revisionId: z.string().optional(),
});

export function updateTextStyleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_update_text_style',
    description: 'Update bold, italic, links, colors, font, or size for text in a range.',
    inputSchema: updateTextStyleInputSchema,
    outputSchema: updateTextStyleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateTextStyleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (input.startIndex >= input.endIndex) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'startIndex must be less than endIndex.',
        });
      }

      const textStyle: Record<string, unknown> = {};
      const fields: string[] = [];

      if (input.bold !== undefined) {
        textStyle['bold'] = input.bold;
        fields.push('bold');
      }
      if (input.italic !== undefined) {
        textStyle['italic'] = input.italic;
        fields.push('italic');
      }
      if (input.underline !== undefined) {
        textStyle['underline'] = input.underline;
        fields.push('underline');
      }
      if (input.strikethrough !== undefined) {
        textStyle['strikethrough'] = input.strikethrough;
        fields.push('strikethrough');
      }
      if (input.foregroundColor !== undefined) {
        textStyle['foregroundColor'] = input.foregroundColor;
        fields.push('foregroundColor');
      }
      if (input.backgroundColor !== undefined) {
        textStyle['backgroundColor'] = input.backgroundColor;
        fields.push('backgroundColor');
      }
      if (input.link !== undefined) {
        textStyle['link'] = input.link;
        fields.push('link');
      }
      if (input.fontSize !== undefined) {
        textStyle['fontSize'] = input.fontSize;
        fields.push('fontSize');
      }
      if (input.weightedFontFamily !== undefined) {
        textStyle['weightedFontFamily'] = input.weightedFontFamily;
        fields.push('weightedFontFamily');
      }

      if (fields.length === 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one text style field must be provided.',
        });
      }

      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              updateTextStyle: {
                range: {
                  startIndex: input.startIndex,
                  endIndex: input.endIndex,
                  ...(input.segmentId !== undefined && { segmentId: input.segmentId }),
                },
                textStyle,
                fields: fields.join(','),
              },
            },
          ],
        },
        retries: 3,
      });

      const parsed = BatchUpdateResponseSchema.parse(response.data);

      return {
        documentId: parsed.documentId,
        ...(parsed.writeControl?.requiredRevisionId && { revisionId: parsed.writeControl.requiredRevisionId }),
      };
    },
  });
}
