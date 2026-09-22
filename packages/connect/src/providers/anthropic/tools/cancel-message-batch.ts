// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const cancelMessageBatchInputSchema = z.object({
  message_batch_id: z
    .string()
    .describe('ID of the Message Batch to cancel. Example: "msgbatch_013Zva2CMHLNnXjNJJKqJ2EF"'),
});

const ProviderRequestCountsSchema = z.object({
  canceled: z.number(),
  errored: z.number(),
  expired: z.number(),
  processing: z.number(),
  succeeded: z.number(),
});

const ProviderMessageBatchSchema = z.object({
  id: z.string(),
  archived_at: z.string().optional(),
  cancel_initiated_at: z.string().optional(),
  created_at: z.string(),
  ended_at: z.string().optional(),
  expires_at: z.string(),
  processing_status: z.enum(['in_progress', 'canceling', 'ended']),
  request_counts: ProviderRequestCountsSchema,
  results_url: z.string().optional(),
  type: z.literal('message_batch'),
});

export const cancelMessageBatchOutputSchema = z.object({
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

export function cancelMessageBatchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'anthropic_cancel_message_batch',
    description: 'Cancel an Anthropic Message Batch.',
    inputSchema: cancelMessageBatchInputSchema,
    outputSchema: cancelMessageBatchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof cancelMessageBatchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://docs.anthropic.com/en/api/canceling-message-batches
      const response = await platformProxy.post({
        endpoint: `/v1/messages/batches/${encodeURIComponent(input.message_batch_id)}/cancel`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Message Batch not found',
          message_batch_id: input.message_batch_id,
        });
      }

      const batch = ProviderMessageBatchSchema.parse(response.data);

      return {
        id: batch.id,
        ...(batch.archived_at !== undefined && { archived_at: batch.archived_at }),
        ...(batch.cancel_initiated_at !== undefined && { cancel_initiated_at: batch.cancel_initiated_at }),
        created_at: batch.created_at,
        ...(batch.ended_at !== undefined && { ended_at: batch.ended_at }),
        expires_at: batch.expires_at,
        processing_status: batch.processing_status,
        request_counts: batch.request_counts,
        ...(batch.results_url !== undefined && { results_url: batch.results_url }),
        type: batch.type,
      };
    },
  });
}
