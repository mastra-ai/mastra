import { z } from 'zod';
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
