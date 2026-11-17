// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listHistoryInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  page_size: z
    .number()
    .optional()
    .describe('How many history items to return at maximum. Can not exceed 1000, defaults to 100.'),
  voice_id: z.string().optional().describe('ID of the voice to be filtered for.'),
  model_id: z.string().optional().describe('Filter history items by model ID.'),
  search: z.string().optional().describe('Search term used for filtering.'),
  source: z.string().optional().describe('Source of the generated history item.'),
  date_before_unix: z
    .number()
    .optional()
    .describe('Unix timestamp to filter history items before this date (exclusive).'),
  date_after_unix: z
    .number()
    .optional()
    .describe('Unix timestamp to filter history items after this date (inclusive).'),
  sort_direction: z.string().optional().describe('Sort direction for the results.'),
});

const ProviderFeedbackSchema = z.object({
  thumbs_up: z.boolean(),
  feedback: z.string(),
  emotions: z.boolean(),
  inaccurate_clone: z.boolean(),
  glitches: z.boolean(),
  audio_quality: z.boolean(),
  other: z.boolean(),
  review_status: z.string(),
});

const ProviderHistoryItemSchema = z
  .object({
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
    feedback: ProviderFeedbackSchema.nullable().optional(),
    share_link_id: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
    alignments: z.unknown().nullable().optional(),
    dialogue: z.array(z.unknown()).nullable().optional(),
    output_format: z.string().nullable().optional(),
  })
  .passthrough();

const ProviderHistoryResponseSchema = z.object({
  history: z.array(ProviderHistoryItemSchema),
  last_history_item_id: z.string().nullable().optional(),
  has_more: z.boolean(),
  scanned_until: z.number().nullable().optional(),
});

export const listHistoryOutputSchema = z.object({
  items: z.array(ProviderHistoryItemSchema),
  next_cursor: z.string().optional(),
  has_more: z.boolean(),
});

export function listHistoryTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_list_history',
    description: 'List generated history items.',
    inputSchema: listHistoryInputSchema,
    outputSchema: listHistoryOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listHistoryOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://elevenlabs.io/docs/api-reference/history/list
        endpoint: '/v1/history',
        params: {
          ...(input.cursor !== undefined && { start_after_history_item_id: input.cursor }),
          ...(input.page_size !== undefined && { page_size: input.page_size }),
          ...(input.voice_id !== undefined && { voice_id: input.voice_id }),
          ...(input.model_id !== undefined && { model_id: input.model_id }),
          ...(input.search !== undefined && { search: input.search }),
          ...(input.source !== undefined && { source: input.source }),
          ...(input.date_before_unix !== undefined && { date_before_unix: input.date_before_unix }),
          ...(input.date_after_unix !== undefined && { date_after_unix: input.date_after_unix }),
          ...(input.sort_direction !== undefined && { sort_direction: input.sort_direction }),
        },
        retries: 3,
      });

      const providerResponse = ProviderHistoryResponseSchema.parse(response.data);

      return {
        items: providerResponse.history,
        ...(providerResponse.last_history_item_id != null &&
          providerResponse.has_more && { next_cursor: providerResponse.last_history_item_id }),
        has_more: providerResponse.has_more,
      };
    },
  });
}
