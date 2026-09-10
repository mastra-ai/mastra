// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getBatchInputSchema = z.object({
  batch_id: z.string().describe('The ID of the batch to retrieve. Example: "batch_abc123"'),
});

const RequestCountsSchema = z.object({
  total: z.number(),
  completed: z.number(),
  failed: z.number(),
});

const ProviderBatchSchema = z.object({
  id: z.string(),
  object: z.literal('batch'),
  status: z.enum([
    'validating',
    'failed',
    'in_progress',
    'finalizing',
    'completed',
    'expired',
    'cancelling',
    'cancelled',
  ]),
  input_file_id: z.string(),
  output_file_id: z.string().optional().nullable(),
  error_file_id: z.string().optional().nullable(),
  endpoint: z.string(),
  request_counts: RequestCountsSchema,
  created_at: z.number(),
  expires_at: z.number().optional().nullable(),
  completed_at: z.number().optional().nullable(),
  metadata: z.any().optional().nullable(),
});

export const getBatchOutputSchema = z.object({
  id: z.string(),
  status: z.enum([
    'validating',
    'failed',
    'in_progress',
    'finalizing',
    'completed',
    'expired',
    'cancelling',
    'cancelled',
  ]),
  input_file_id: z.string(),
  output_file_id: z.string().optional(),
  error_file_id: z.string().optional(),
  endpoint: z.string(),
  request_counts: z.object({
    total: z.number(),
    completed: z.number(),
    failed: z.number(),
  }),
  created_at: z.number(),
  expires_at: z.number().optional(),
  completed_at: z.number().optional(),
});

export function getBatchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_get_batch',
    description: 'Retrieve a single batch from OpenAI',
    inputSchema: getBatchInputSchema,
    outputSchema: getBatchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getBatchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://platform.openai.com/docs/api-reference/batches/get
      const response = await platformProxy.get({
        endpoint: `/v1/batches/${encodeURIComponent(input.batch_id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Batch not found',
          batch_id: input.batch_id,
        });
      }

      const providerBatch = ProviderBatchSchema.parse(response.data);

      return {
        id: providerBatch.id,
        status: providerBatch.status,
        input_file_id: providerBatch.input_file_id,
        endpoint: providerBatch.endpoint,
        request_counts: providerBatch.request_counts,
        created_at: providerBatch.created_at,
        ...(providerBatch.output_file_id != null && {
          output_file_id: providerBatch.output_file_id,
        }),
        ...(providerBatch.error_file_id != null && {
          error_file_id: providerBatch.error_file_id,
        }),
        ...(providerBatch.expires_at != null && {
          expires_at: providerBatch.expires_at,
        }),
        ...(providerBatch.completed_at != null && {
          completed_at: providerBatch.completed_at,
        }),
      };
    },
  });
}
