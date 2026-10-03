// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DimensionSchema = z.object({
  magnitude: z.number(),
  unit: z.string(),
});

const SectionStyleInputSchema = z.object({
  marginTop: DimensionSchema.optional(),
  marginBottom: DimensionSchema.optional(),
  marginLeft: DimensionSchema.optional(),
  marginRight: DimensionSchema.optional(),
  pageNumberStart: z.number().int().optional(),
  contentDirection: z.enum(['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT']).optional(),
});

export const insertSectionBreakInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  sectionType: z
    .enum(['NEXT_PAGE', 'CONTINUOUS'])
    .optional()
    .describe('Type of section break to insert. Defaults to NEXT_PAGE.'),
  index: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Zero-based body index where the section break should be inserted. If omitted, inserts at the end of the document body.',
    ),
  tabId: z.string().optional().describe('Tab ID for multi-tab documents. When omitted, applies to the first tab.'),
  sectionStyle: SectionStyleInputSchema.optional().describe(
    'Optional section style updates to apply to the newly created section. Requires index to be provided.',
  ),
});

const BatchUpdateResponseSchema = z.object({
  documentId: z.string(),
  replies: z.array(z.unknown()).optional(),
  writeControl: z
    .object({
      requiredRevisionId: z.string().optional(),
    })
    .optional(),
});

export const insertSectionBreakOutputSchema = z.object({
  documentId: z.string(),
  revisionId: z.string().optional(),
});

export function insertSectionBreakTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_insert_section_break',
    description: 'Insert a section break in the document body.',
    inputSchema: insertSectionBreakInputSchema,
    outputSchema: insertSectionBreakOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof insertSectionBreakOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requests: unknown[] = [];

      const insertPayload: {
        sectionType: string;
        location?: { segmentId: string; index: number; tabId?: string };
        endOfSegmentLocation?: { segmentId: string; tabId?: string };
      } = {
        sectionType: input.sectionType || 'NEXT_PAGE',
      };

      if (input.index !== undefined) {
        insertPayload.location = {
          segmentId: '',
          index: input.index,
          ...(input.tabId && { tabId: input.tabId }),
        };
      } else {
        insertPayload.endOfSegmentLocation = {
          segmentId: '',
          ...(input.tabId && { tabId: input.tabId }),
        };
      }

      requests.push({ insertSectionBreak: insertPayload });

      if (input.sectionStyle) {
        if (input.index === undefined) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'index is required when sectionStyle is provided.',
          });
        }

        const sectionStyle = input.sectionStyle;
        const stylePayload: Record<string, unknown> = {};
        const fieldMasks: string[] = [];

        if (sectionStyle['marginTop'] !== undefined) {
          stylePayload['marginTop'] = sectionStyle['marginTop'];
          fieldMasks.push('marginTop');
        }
        if (sectionStyle['marginBottom'] !== undefined) {
          stylePayload['marginBottom'] = sectionStyle['marginBottom'];
          fieldMasks.push('marginBottom');
        }
        if (sectionStyle['marginLeft'] !== undefined) {
          stylePayload['marginLeft'] = sectionStyle['marginLeft'];
          fieldMasks.push('marginLeft');
        }
        if (sectionStyle['marginRight'] !== undefined) {
          stylePayload['marginRight'] = sectionStyle['marginRight'];
          fieldMasks.push('marginRight');
        }
        if (sectionStyle['pageNumberStart'] !== undefined) {
          stylePayload['pageNumberStart'] = sectionStyle['pageNumberStart'];
          fieldMasks.push('pageNumberStart');
        }
        if (sectionStyle['contentDirection'] !== undefined) {
          stylePayload['contentDirection'] = sectionStyle['contentDirection'];
          fieldMasks.push('contentDirection');
        }

        if (fieldMasks.length > 0) {
          requests.push({
            updateSectionStyle: {
              range: {
                segmentId: '',
                startIndex: input.index,
                endIndex: input.index + 1,
                ...(input.tabId && { tabId: input.tabId }),
              },
              sectionStyle: stylePayload,
              fields: fieldMasks.join(','),
            },
          });
        }
      }

      // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
      const response = await platformProxy.post({
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests,
        },
        retries: 3,
      });

      const result = BatchUpdateResponseSchema.parse(response.data);

      return {
        documentId: result.documentId,
        ...(result.writeControl?.requiredRevisionId && {
          revisionId: result.writeControl.requiredRevisionId,
        }),
      };
    },
  });
}
