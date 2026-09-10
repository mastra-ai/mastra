// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const cancelFineTuningJobInputSchema = z.object({
  fine_tuning_job_id: z.string().describe('The ID of the fine-tuning job to cancel. Example: "ftjob-abc123"'),
});

const HyperparametersSchema = z
  .object({
    n_epochs: z.union([z.number(), z.string()]).optional(),
    batch_size: z.union([z.number(), z.string()]).optional(),
    learning_rate_multiplier: z.union([z.number(), z.string()]).optional(),
  })
  .loose();

const FineTuningJobErrorSchema = z
  .object({
    code: z.string().optional(),
    message: z.string().optional(),
    param: z.string().nullable().optional(),
    line: z.number().nullable().optional(),
  })
  .loose()
  .nullable()
  .optional();

export const cancelFineTuningJobOutputSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    created_at: z.number(),
    finished_at: z.number().nullable().optional(),
    model: z.string(),
    fine_tuned_model: z.string().nullable().optional(),
    organization_id: z.string(),
    result_files: z.array(z.string()),
    status: z.string(),
    validation_file: z.string().nullable().optional(),
    training_file: z.string(),
    hyperparameters: HyperparametersSchema,
    trained_tokens: z.number().nullable().optional(),
    error: FineTuningJobErrorSchema,
  })
  .loose();

export function cancelFineTuningJobTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_cancel_fine_tuning_job',
    description: 'Cancel an OpenAI fine-tuning job.',
    inputSchema: cancelFineTuningJobInputSchema,
    outputSchema: cancelFineTuningJobOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof cancelFineTuningJobOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let response;
      // @allowTryCatch We catch HTTP errors to convert them into structured ActionError
      // payloads so callers receive a predictable error shape.
      try {
        response = await platformProxy.post({
          // https://platform.openai.com/docs/api-reference/fine-tuning/cancel
          endpoint: `/v1/fine_tuning/jobs/${encodeURIComponent(input.fine_tuning_job_id)}/cancel`,
          retries: 3,
        });
      } catch (error) {
        const errorShape = z.object({
          status: z.number().optional(),
          message: z.string().optional(),
        });
        const parsedError = errorShape.safeParse(error);
        const status = parsedError.success ? parsedError.data.status : undefined;
        const message = parsedError.success ? parsedError.data.message : undefined;
        if (status === 404) {
          throw new platformProxy.ActionError({
            type: 'not_found',
            message: `Fine-tuning job ${input.fine_tuning_job_id} not found.`,
          });
        }
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: `Failed to cancel fine-tuning job: ${message || 'Unknown error'}`,
        });
      }

      const parsed = cancelFineTuningJobOutputSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'parse_error',
          message: 'Failed to parse fine-tuning job response.',
          details: parsed.error.issues,
        });
      }

      return parsed.data;
    },
  });
}
