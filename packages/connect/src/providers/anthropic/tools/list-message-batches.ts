// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listMessageBatchesInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  before_id: z
    .string()
    .optional()
    .describe('ID of the object to use as a cursor for pagination. Returns the page immediately before this object.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Number of items to return per page. Defaults to 20. Ranges from 1 to 1000.'),
});

const MessageBatchRequestCountsSchema = z.object({
  canceled: z.number(),
  errored: z.number(),
  expired: z.number(),
  processing: z.number(),
  succeeded: z.number(),
});

const MessageBatchSchema = z.object({
  id: z.string(),
  archived_at: z.string().nullable().optional(),
  cancel_initiated_at: z.string().nullable().optional(),
  created_at: z.string(),
  ended_at: z.string().nullable().optional(),
  expires_at: z.string(),
  processing_status: z.enum(['in_progress', 'canceling', 'ended']),
  request_counts: MessageBatchRequestCountsSchema,
  results_url: z.string().nullable().optional(),
  type: z.literal('message_batch'),
});

const ProviderResponseSchema = z.object({
  data: z.array(MessageBatchSchema),
  first_id: z.string().nullable(),
  has_more: z.boolean(),
  last_id: z.string().nullable(),
});

const OutputItemSchema = z.object({
  id: z.string(),
  archived_at: z.string().optional(),
  cancel_initiated_at: z.string().optional(),
  created_at: z.string(),
  ended_at: z.string().optional(),
  expires_at: z.string(),
  processing_status: z.enum(['in_progress', 'canceling', 'ended']),
  request_counts: z.object({
    canceled: z.number(),
    errored: z.number(),
    expired: z.number(),
    processing: z.number(),
    succeeded: z.number(),
  }),
  results_url: z.string().optional(),
  type: z.literal('message_batch'),
});

export const listMessageBatchesOutputSchema = z.object({
  items: z.array(OutputItemSchema),
  next_cursor: z.string().optional(),
});

export function listMessageBatchesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'anthropic_list_message_batches',
    description: 'List message batches from Anthropic.',
    inputSchema: listMessageBatchesInputSchema,
    outputSchema: listMessageBatchesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listMessageBatchesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: { after_id?: string; before_id?: string; limit?: number } = {};
      if (input.cursor !== undefined) {
        params.after_id = input.cursor;
      }
      if (input.before_id !== undefined) {
        params.before_id = input.before_id;
      }
      if (input.limit !== undefined) {
        params.limit = input.limit;
      }

      const response = await platformProxy.get({
        // https://docs.anthropic.com/en/api/message-batches/list
        endpoint: '/v1/messages/batches',
        params,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const items = providerResponse.data.map(batch => ({
        id: batch.id,
        created_at: batch.created_at,
        expires_at: batch.expires_at,
        processing_status: batch.processing_status,
        request_counts: batch.request_counts,
        type: batch.type,
        ...(batch.archived_at != null && { archived_at: batch.archived_at }),
        ...(batch.cancel_initiated_at != null && { cancel_initiated_at: batch.cancel_initiated_at }),
        ...(batch.ended_at != null && { ended_at: batch.ended_at }),
        ...(batch.results_url != null && { results_url: batch.results_url }),
      }));

      return {
        items,
        ...(providerResponse.has_more &&
          providerResponse.last_id !== null && { next_cursor: providerResponse.last_id }),
      };
    },
  });
}
