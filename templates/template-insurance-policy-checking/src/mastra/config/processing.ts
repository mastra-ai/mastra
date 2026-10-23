import { z } from 'zod';
import { IntakeError } from '../domain/errors.js';
import { processingBudgetSchema } from '../domain/reconciliation-contracts.js';

// Spending authorization is deliberately absent until an operator supplies approved Q-004 values.
export const processingConfigurationSchema = z
  .object({
    model: z.string().regex(/^gpt-[a-zA-Z0-9.-]+$/),
    budget: processingBudgetSchema.nullable(),
  })
  .strict();
export const processingConfiguration = processingConfigurationSchema.parse({
  model: process.env.POLICY_EXTRACTION_MODEL ?? 'gpt-6.1-sol',
  budget: null,
});

export function processingEndpoint(endpoint = 'https://api.openai.com/v1') {
  if (
    endpoint !== 'https://api.openai.com/v1' &&
    (process.env.NODE_ENV !== 'test' || !/^http:\/\/127\.0\.0\.1:\d+\/v1$/.test(endpoint))
  )
    throw new IntakeError(
      'MODEL_CONFIGURATION',
      'Processing endpoint overrides are limited to controlled loopback tests.',
      'Use the default OpenAI endpoint outside tests.',
    );
  return endpoint;
}
