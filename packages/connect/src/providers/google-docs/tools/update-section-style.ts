// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DimensionSchema = z.object({
  magnitude: z.number(),
  unit: z.string(),
});

const SectionColumnPropertiesSchema = z.object({
  paddingEnd: DimensionSchema.optional(),
  width: DimensionSchema.optional(),
});

const SectionStyleInputSchema = z.object({
  marginTop: DimensionSchema.optional(),
  marginBottom: DimensionSchema.optional(),
  marginLeft: DimensionSchema.optional(),
  marginRight: DimensionSchema.optional(),
  marginHeader: DimensionSchema.optional(),
  marginFooter: DimensionSchema.optional(),
  pageNumberStart: z.number().optional(),
  useFirstPageHeaderFooter: z.boolean().optional(),
  flipPageOrientation: z.boolean().optional(),
  columnSeparatorStyle: z.string().optional(),
  contentDirection: z.string().optional(),
  columnProperties: z.array(SectionColumnPropertiesSchema).optional(),
});

export const updateSectionStyleInputSchema = z.object({
  documentId: z.string().describe('Google Docs document ID. Example: "1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c"'),
  startIndex: z.number().describe('Start index of the range overlapping the sections to style.'),
  endIndex: z.number().describe('End index of the range overlapping the sections to style.'),
  sectionStyle: SectionStyleInputSchema.describe('The section style properties to update.'),
  fields: z.string().describe('Field mask specifying which fields to update. Example: "marginTop"'),
});

const BatchUpdateResponseSchema = z.object({
  replies: z.array(z.object({}).passthrough()),
  documentId: z.string(),
  writeControl: z
    .object({
      requiredRevisionId: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export const updateSectionStyleOutputSchema = z.object({
  documentId: z.string(),
  replyCount: z.number().describe('Number of replies returned by the batch update.'),
});

export function updateSectionStyleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_docs_update_section_style',
    description: 'Update section-level layout settings.',
    inputSchema: updateSectionStyleInputSchema,
    outputSchema: updateSectionStyleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateSectionStyleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        endpoint: `/v1/documents/${encodeURIComponent(input.documentId)}:batchUpdate`,
        data: {
          requests: [
            {
              updateSectionStyle: {
                range: {
                  startIndex: input.startIndex,
                  endIndex: input.endIndex,
                },
                sectionStyle: input.sectionStyle,
                fields: input.fields,
              },
            },
          ],
        },
        retries: 3,
      });

      const batchResponse = BatchUpdateResponseSchema.parse(response.data);

      return {
        documentId: batchResponse.documentId,
        replyCount: batchResponse.replies.length,
      };
    },
  });
}
