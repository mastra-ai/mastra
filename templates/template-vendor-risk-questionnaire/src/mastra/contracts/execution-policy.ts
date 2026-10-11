import { z } from 'zod';

export const executionPolicySchema = z
  .object({
    version: z.literal(1),
    model: z.literal('openai/gpt-6.1-sol'),
    api: z.literal('responses'),
    reasoningEffort: z.literal('medium'),
    serviceTier: z.literal('default'),
    concurrency: z.int().positive().max(16),
    budgetUsd: z.number().positive().max(100),
    maxPhysicalCalls: z.int().positive().max(10000),
    maxRunElapsedMs: z.int().positive().max(86400000),
    callTimeoutMs: z.int().positive().max(60000),
    maxInputTokens: z.int().positive().max(8000),
    maxOutputTokens: z.int().positive().max(4000),
    draftTurns: z.int().positive().max(3),
    transientRetries: z.int().nonnegative().max(2),
    maxDetectorAttemptsPerPayload: z.int().positive().max(6),
    confidenceThreshold: z.number().min(0).max(1),
    injectionThreshold: z.number().min(0).max(1),
    piiThreshold: z.number().min(0).max(1),
    rates: z
      .object({ asOf: z.literal('2026-10-10'), inputUsdPerMillion: z.literal(2), outputUsdPerMillion: z.literal(10) })
      .strict(),
  })
  .strict();
export const defaultExecutionPolicy = executionPolicySchema.parse({
  version: 1,
  model: 'openai/gpt-6.1-sol',
  api: 'responses',
  reasoningEffort: 'medium',
  serviceTier: 'default',
  concurrency: 4,
  budgetUsd: 5,
  maxPhysicalCalls: 100,
  maxRunElapsedMs: 1800000,
  callTimeoutMs: 60000,
  maxInputTokens: 8000,
  maxOutputTokens: 4000,
  draftTurns: 3,
  transientRetries: 2,
  maxDetectorAttemptsPerPayload: 6,
  confidenceThreshold: 0.8,
  injectionThreshold: 0.7,
  piiThreshold: 0.6,
  rates: { asOf: '2026-10-10', inputUsdPerMillion: 2, outputUsdPerMillion: 10 },
});
export type ExecutionPolicy = z.infer<typeof executionPolicySchema>;
