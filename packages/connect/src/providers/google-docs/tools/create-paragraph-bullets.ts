// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const BulletGlyphPresetSchema = z.enum([
  'BULLET_DISC_CIRCLE_SQUARE',
  'BULLET_DIAMONDX_ARROW3D_SQUARE',
  'BULLET_CHECKBOX',
  'BULLET_ARROW_DIAMOND_DISC',
  'BULLET_STAR_CIRCLE_SQUARE',
  'BULLET_ARROW3D_CIRCLE_SQUARE',
  'BULLET_LEFTTRIANGLE_DIAMOND_DISC',
  'BULLET_DIAMONDX_HOLLOWDIAMOND_SQUARE',
  'BULLET_DIAMOND_CIRCLE_SQUARE',
  'NUMBERED_DECIMAL_ALPHA_ROMAN',
  'NUMBERED_DECIMAL_ALPHA_ROMAN_PARENS',
  'NUMBERED_DECIMAL_NESTED',
  'NUMBERED_UPPERALPHA_ALPHA_ROMAN',
  'NUMBERED_UPPERROMAN_UPPERALPHA_DECIMAL',
  'NUMBERED_ZERODECIMAL_ALPHA_ROMAN',
]);

export const createParagraphBulletsInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  startIndex: z.number().int().describe('Start index (inclusive) of the range to apply bullets to.'),
  endIndex: z.number().int().describe('End index (exclusive) of the range to apply bullets to.'),
  bulletPreset: BulletGlyphPresetSchema.optional().describe(
    'Bullet preset to use. Defaults to BULLET_DISC_CIRCLE_SQUARE.',
  ),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  revisionId: z.string().optional(),
  replies: z.array(z.unknown()).optional(),
});

export const createParagraphBulletsOutputSchema = z.object({
  documentId: z.string(),
  revisionId: z.string().optional(),
});

export function createParagraphBulletsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_create_paragraph_bullets',
    description: 'Apply a bullet or numbered list preset to paragraphs in a range.',
    inputSchema: createParagraphBulletsInputSchema,
    outputSchema: createParagraphBulletsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createParagraphBulletsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              createParagraphBullets: {
                range: {
                  startIndex: input.startIndex,
                  endIndex: input.endIndex,
                  segmentId: '',
                },
                bulletPreset: input.bulletPreset || 'BULLET_DISC_CIRCLE_SQUARE',
              },
            },
          ],
        },
        retries: 3,
      });

      const parsed = BatchUpdateResponseSchema.parse(response.data);

      return {
        documentId: parsed.documentId,
        ...(parsed.revisionId !== undefined && { revisionId: parsed.revisionId }),
      };
    },
  });
}
