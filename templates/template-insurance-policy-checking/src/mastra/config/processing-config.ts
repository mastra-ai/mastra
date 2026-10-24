import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { IntakeError } from '../domain/operation-errors.js';
import { processingBudgetSchema } from '../domain/reconciliation-contracts.js';
import { projectRoot } from '../runtime/storage-paths.js';

// Processing stays disabled until an operator supplies an explicitly approved budget.
export const processingConfigurationSchema = z
  .object({
    model: z
      .string()
      .regex(/^gpt-[a-zA-Z0-9.-]+$/)
      .describe('Approved model identifier used for structured processing.'),
    budget: processingBudgetSchema
      .nullable()
      .describe('Explicitly approved processing ceilings; null disables paid dispatch.'),
  })
  .strict();
function readProcessingBudget(path: string | undefined): unknown {
  if (!path) return null;
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
