import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { IntakeError } from '../domain/operation-errors.js';
import { processingBudgetSchema } from '../domain/reconciliation-contracts.js';
import { projectRoot } from '../runtime/storage-paths.js';

// Conservative defaults bound each analysis; an optional JSON file replaces the whole policy.
export const defaultProcessingBudget = processingBudgetSchema.parse({
  maxAttempts: 1,
  maxRequests: 5,
  maxInputTokensPerRequest: 100000,
  maxOutputTokensPerRequest: 8000,
  maxTotalTokens: 300000,
  maxCostMicros: 5000000,
  inputMicrosPerToken: 10,
  outputMicrosPerToken: 50,
  pricingAssumption: 'Conservative USD estimate: $10/M input and $50/M output; not live billing.',
  timeoutMs: 120000,
  maxResponseBytes: 1024 * 1024,
});
export const processingConfigurationSchema = z
  .object({
    model: z
      .string()
      .regex(/^gpt-[a-zA-Z0-9.-]+$/)
      .describe('Approved model identifier used for structured processing.'),
    budget: processingBudgetSchema
      .nullable()
      .describe('Default or custom processing ceilings; null disables paid dispatch for programmatic callers.'),
  })
  .strict();
function readProcessingBudget(path: string | undefined): unknown {
  if (!path?.trim()) return defaultProcessingBudget;
  const budgetPath = resolve(projectRoot(), path);
  try {
    return JSON.parse(readFileSync(budgetPath, 'utf8'));
  } catch {
    throw new IntakeError(
      'PROCESSING_BUDGET_FILE',
      'The processing budget file could not be read as JSON.',
      'Set POLICY_PROCESSING_BUDGET to a readable JSON file path, relative to the project root or absolute.',
    );
  }
}

export const processingConfiguration = processingConfigurationSchema.parse({
  model: process.env.POLICY_EXTRACTION_MODEL ?? 'gpt-6.1-sol',
  budget: readProcessingBudget(process.env.POLICY_PROCESSING_BUDGET),
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
