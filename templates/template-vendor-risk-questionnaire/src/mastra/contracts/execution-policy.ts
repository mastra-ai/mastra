import { z } from 'zod';

export const executionPolicySchema = z
  .object({
    version: z.literal(1),
    model: z.templateLiteral(['openai/', z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/)]),
    api: z.literal('responses'),
    reasoningEffort: z.literal('medium'),
    serviceTier: z.literal('default'),
    concurrency: z.int().positive().max(16),
    budgetUsd: z.number().positive(),
    maxPhysicalCalls: z.int().positive(),
    maxRunElapsedMs: z.int().positive(),
    callTimeoutMs: z.int().positive().max(60000),
    maxInputTokens: z.int().positive().max(8000),
    maxOutputTokens: z.int().positive().max(4000),
    transientRetries: z.int().nonnegative().max(2),
    maxDetectorAttemptsPerPayload: z.int().positive().max(6),
    confidenceThreshold: z.number().min(0).max(1),
    injectionThreshold: z.number().min(0).max(1),
    piiThreshold: z.number().min(0).max(1),
    rates: z
      .object({
        asOf: z.iso.date(),
        inputUsdPerMillion: z.number().nonnegative(),
        outputUsdPerMillion: z.number().nonnegative(),
      })
      .strict(),
  })
  .strict();
export const defaultExecutionPolicy = executionPolicySchema.parse({
  version: 1,
  model: process.env.VRQ_MODEL?.trim() || 'openai/gpt-6.1-sol',
  api: 'responses',
  reasoningEffort: 'medium',
  serviceTier: 'default',
  concurrency: 4,
  budgetUsd: 5,
  maxPhysicalCalls: 1000,
  maxRunElapsedMs: 1800000,
  callTimeoutMs: 60000,
  maxInputTokens: 8000,
  maxOutputTokens: 4000,
  transientRetries: 2,
  maxDetectorAttemptsPerPayload: 6,
  confidenceThreshold: 0.8,
  injectionThreshold: 0.7,
  piiThreshold: 0.6,
  rates: { asOf: '2026-10-11', inputUsdPerMillion: 2, outputUsdPerMillion: 10 },
});
export type ExecutionPolicy = z.infer<typeof executionPolicySchema>;
