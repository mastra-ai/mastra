// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getMessageBatchInputSchema = z.object({
  message_batch_id: z
    .string()
    .describe('The ID of the message batch to retrieve. Example: "msgbatch_01Ab2cDe3Fg4hIj5Kl6mNo7Pq8r"'),
});

const RequestCountsSchema = z.object({
  canceled: z.number().int(),
  errored: z.number().int(),
  expired: z.number().int(),
  processing: z.number().int(),
  succeeded: z.number().int(),
});

export const getMessageBatchOutputSchema = z.object({
  id: z.string(),
  archived_at: z.string().nullable().optional(),
  cancel_initiated_at: z.string().nullable().optional(),
  created_at: z.string(),
  ended_at: z.string().nullable().optional(),
  expires_at: z.string(),
  processing_status: z.enum(['in_progress', 'canceling', 'ended']),
  request_counts: RequestCountsSchema,
  results_url: z.string().nullable().optional(),
  type: z.literal('message_batch'),
});

export function getMessageBatchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'anthropic_get_message_batch',
    description: 'Retrieve a single message batch from Anthropic.',
    inputSchema: getMessageBatchInputSchema,
    outputSchema: getMessageBatchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getMessageBatchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://docs.anthropic.com/en/api/message-batches
        endpoint: `/v1/messages/batches/${encodeURIComponent(input.message_batch_id)}`,
        retries: 3,
      });

      const batch = getMessageBatchOutputSchema.parse(response.data);
      return batch;
    },
  });
}
