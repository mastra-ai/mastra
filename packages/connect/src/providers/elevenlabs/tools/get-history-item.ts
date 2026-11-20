// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getHistoryItemInputSchema = z.object({
  history_item_id: z.string().describe('ID of the history item to retrieve. Example: "JveLb9l9aA9OP7eF6zYH"'),
});

const FeedbackResponseSchema = z.object({
  thumbs_up: z.boolean().optional(),
  feedback: z.string().optional(),
  emotions: z.boolean().optional(),
  inaccurate_clone: z.boolean().optional(),
  glitches: z.boolean().optional(),
  audio_quality: z.boolean().optional(),
  other: z.boolean().optional(),
  review_status: z.string().optional(),
});

const HistoryAlignmentResponseSchema = z.object({
  characters: z.array(z.string()),
  character_start_times_seconds: z.array(z.number()),
  character_end_times_seconds: z.array(z.number()),
});

const HistoryAlignmentsResponseSchema = z.object({
  alignment: HistoryAlignmentResponseSchema,
  normalized_alignment: HistoryAlignmentResponseSchema,
});

const DialogueInputResponseSchema = z.object({
  text: z.string(),
  voice_id: z.string(),
  voice_name: z.string(),
});

const ProviderHistoryItemSchema = z.object({
  history_item_id: z.string(),
  request_id: z.string().nullable().optional(),
  voice_id: z.string().nullable().optional(),
  model_id: z.string().nullable().optional(),
  voice_name: z.string().nullable().optional(),
  voice_category: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  date_unix: z.number(),
  character_count_change_from: z.number(),
  character_count_change_to: z.number(),
  content_type: z.string(),
  state: z.unknown().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
  feedback: FeedbackResponseSchema.nullable().optional(),
  share_link_id: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  alignments: HistoryAlignmentsResponseSchema.nullable().optional(),
  dialogue: z.array(DialogueInputResponseSchema).nullable().optional(),
  output_format: z.string().nullable().optional(),
});

export const getHistoryItemOutputSchema = z.object({
  history_item_id: z.string(),
  request_id: z.string().optional(),
  voice_id: z.string().optional(),
  model_id: z.string().optional(),
  voice_name: z.string().optional(),
  voice_category: z.string().optional(),
  text: z.string().optional(),
  date_unix: z.number(),
  character_count_change_from: z.number(),
  character_count_change_to: z.number(),
  content_type: z.string(),
  state: z.unknown().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  feedback: FeedbackResponseSchema.optional(),
  share_link_id: z.string().optional(),
  source: z.string().optional(),
  alignments: HistoryAlignmentsResponseSchema.optional(),
  dialogue: z.array(DialogueInputResponseSchema).optional(),
  output_format: z.string().optional(),
});

export function getHistoryItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_get_history_item',
    description: 'Retrieve history item metadata.',
    inputSchema: getHistoryItemInputSchema,
    outputSchema: getHistoryItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getHistoryItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://elevenlabs.io/docs/api-reference/history/get
      const response = await platformProxy.get({
        endpoint: `/v1/history/${encodeURIComponent(input.history_item_id)}`,
        retries: 3,
      });

      const providerItem = ProviderHistoryItemSchema.parse(response.data);

      return {
        history_item_id: providerItem.history_item_id,
        date_unix: providerItem.date_unix,
        character_count_change_from: providerItem.character_count_change_from,
        character_count_change_to: providerItem.character_count_change_to,
        content_type: providerItem.content_type,
        ...(providerItem.request_id != null && { request_id: providerItem.request_id }),
        ...(providerItem.voice_id != null && { voice_id: providerItem.voice_id }),
        ...(providerItem.model_id != null && { model_id: providerItem.model_id }),
        ...(providerItem.voice_name != null && { voice_name: providerItem.voice_name }),
        ...(providerItem.voice_category != null && { voice_category: providerItem.voice_category }),
        ...(providerItem.text != null && { text: providerItem.text }),
        ...(providerItem.state !== undefined && { state: providerItem.state }),
        ...(providerItem.settings != null && { settings: providerItem.settings }),
        ...(providerItem.feedback != null && { feedback: providerItem.feedback }),
        ...(providerItem.share_link_id != null && { share_link_id: providerItem.share_link_id }),
        ...(providerItem.source != null && { source: providerItem.source }),
        ...(providerItem.alignments != null && { alignments: providerItem.alignments }),
        ...(providerItem.dialogue != null && { dialogue: providerItem.dialogue }),
        ...(providerItem.output_format != null && { output_format: providerItem.output_format }),
      };
    },
  });
}
