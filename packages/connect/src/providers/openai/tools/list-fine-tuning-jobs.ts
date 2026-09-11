// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listFineTuningJobsInputSchema = z.object({
  after: z
    .string()
    .optional()
    .describe('Pagination cursor (job ID) from the previous response. Omit for the first page.'),
  limit: z.number().int().min(1).max(100).optional().describe('Number of jobs to return (1-100). Defaults to 20.'),
});

const FineTuningJobSchema = z.object({
  id: z.string(),
  object: z.string(),
  created_at: z.number(),
  finished_at: z.number().nullable().optional(),
  model: z.string(),
  fine_tuned_model: z.string().nullable().optional(),
  organization_id: z.string(),
  result_files: z.array(z.string()).optional(),
  status: z.enum(['validating_files', 'queued', 'running', 'succeeded', 'failed', 'cancelled']),
  validation_file: z.string().nullable().optional(),
  training_file: z.string(),
  hyperparameters: z
    .object({
      n_epochs: z.union([z.number(), z.string()]).optional(),
      batch_size: z.union([z.number(), z.string()]).optional(),
      learning_rate_multiplier: z.union([z.number(), z.string()]).optional(),
    })
    .loose()
    .optional(),
  trained_tokens: z.number().nullable().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      param: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  seed: z.number().optional(),
  estimated_finish: z.number().nullable().optional(),
  integrations: z.array(z.string()).nullable().optional(),
});

const ProviderResponseSchema = z.object({
  object: z.string(),
  data: z.array(FineTuningJobSchema),
  has_more: z.boolean(),
  first_id: z.string().optional(),
  last_id: z.string().optional(),
});

const OutputItemSchema = z.object({
  id: z.string(),
  object: z.string(),
  created_at: z.number(),
  finished_at: z.number().optional(),
  model: z.string(),
  fine_tuned_model: z.string().optional(),
  organization_id: z.string(),
  result_files: z.array(z.string()).optional(),
  status: z.enum(['validating_files', 'queued', 'running', 'succeeded', 'failed', 'cancelled']),
  validation_file: z.string().optional(),
  training_file: z.string(),
  hyperparameters: z
    .object({
      n_epochs: z.union([z.number(), z.string()]).optional(),
      batch_size: z.union([z.number(), z.string()]).optional(),
      learning_rate_multiplier: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
  trained_tokens: z.number().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      param: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  seed: z.number().optional(),
  estimated_finish: z.number().optional(),
  integrations: z.array(z.string()).optional(),
});

export const listFineTuningJobsOutputSchema = z.object({
  items: z.array(OutputItemSchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional().describe('Use as the "after" parameter for the next page of results'),
});

export function listFineTuningJobsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_list_fine_tuning_jobs',
    description: 'List fine-tuning jobs from OpenAI',
    inputSchema: listFineTuningJobsInputSchema,
    outputSchema: listFineTuningJobsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listFineTuningJobsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://platform.openai.com/docs/api-reference/fine-tuning/list
      const response = await platformProxy.get({
        endpoint: '/v1/fine_tuning/jobs',
        params: {
          ...(input.after !== undefined && { after: input.after }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
        },
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        items: providerData.data.map(job => ({
          id: job.id,
          object: job.object,
          created_at: job.created_at,
          ...(job.finished_at != null && { finished_at: job.finished_at }),
          model: job.model,
          ...(job.fine_tuned_model != null && { fine_tuned_model: job.fine_tuned_model }),
          organization_id: job.organization_id,
          ...(job.result_files !== undefined && { result_files: job.result_files }),
          status: job.status,
          ...(job.validation_file != null && { validation_file: job.validation_file }),
          training_file: job.training_file,
          ...(job.hyperparameters !== undefined && { hyperparameters: job.hyperparameters }),
          ...(job.trained_tokens != null && { trained_tokens: job.trained_tokens }),
          ...(job.error != null && {
            error: {
              code: job.error.code,
              message: job.error.message,
              ...(job.error.param != null && { param: job.error.param }),
            },
          }),
          ...(job.metadata != null && { metadata: job.metadata }),
          ...(job.seed !== undefined && { seed: job.seed }),
          ...(job.estimated_finish != null && { estimated_finish: job.estimated_finish }),
          ...(job.integrations != null && { integrations: job.integrations }),
        })),
        has_more: providerData.has_more,
        ...(providerData.has_more && providerData.last_id !== undefined && { next_cursor: providerData.last_id }),
      };
    },
  });
}
