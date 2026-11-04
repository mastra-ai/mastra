import { z } from 'zod';
import { id, hash } from './primitives.ts';
import { executionPolicySchema } from './execution-policy.ts';
import { reasonSchema, questionResultSchema } from './answer.ts';

export const securityOutcomeSchema = z
  .object({
    runId: id,
    questionId: id,
    policyVersion: z.literal(1),
    boundary: z.enum(['question', 'evidence', 'tool_result', 'draft', 'reviewer', 'export']),
    gate: z.enum(['SEC-001', 'SEC-002']),
    status: z.enum(['passed', 'blocked', 'failed']),
    reason: z.enum(['PASSED', 'REGEX_BLOCKED', 'INJECTION_BLOCKED', 'PII_BLOCKED', 'DETECTOR_FAILED']),
    retryEligible: z.literal(false),
  })
  .strict()
  .refine(
    v =>
      v.status === 'passed'
        ? v.reason === 'PASSED'
        : v.status === 'failed'
          ? v.reason === 'DETECTOR_FAILED'
          : ['REGEX_BLOCKED', 'INJECTION_BLOCKED', 'PII_BLOCKED'].includes(v.reason),
    'Security status and reason must agree.',
  );
export const processingRunSchema = z
  .object({
    runId: id,
    intakeDigest: hash,
    evidenceDigest: hash,
    policyDigest: hash,
    policy: executionPolicySchema,
    state: z.enum(['processing', 'awaiting_review', 'failed']),
    stopReason: reasonSchema.nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    // Optional for runs saved before active processing time was tracked separately.
    clock: z.object({ elapsedMs: z.int().nonnegative(), startedAt: z.iso.datetime().nullable() }).strict().optional(),
  })
  .strict();
export const usageRecordSchema = z
  .object({
    id,
    runId: id,
    questionId: id,
    phase: z.enum(['injection', 'pii', 'interpretation', 'draft', 'verification']),
    attempt: z.int().positive(),
    inputReserved: z.int().positive(),
    outputReserved: z.int().positive(),
    inputTokens: z.int().nonnegative().nullable(),
    outputTokens: z.int().nonnegative().nullable(),
    reasoningTokens: z.int().nonnegative().nullable(),
    estimatedUsd: z.number().nonnegative(),
    status: z.enum(['reserved', 'observed', 'uncertain']),
    reason: reasonSchema.nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict()
  .refine(
    v =>
      v.status === 'observed'
        ? v.inputTokens !== null &&
          v.outputTokens !== null &&
          (v.reasoningTokens === null || v.reasoningTokens <= v.outputTokens)
        : v.inputTokens === null && v.outputTokens === null && v.reasoningTokens === null,
    'Observed usage requires tokens; uncertain usage retains reservations.',
  );
export const processingStatusSchema = z
  .object({
    run: processingRunSchema,
    results: z.array(questionResultSchema).max(100),
    usage: z.array(usageRecordSchema),
    security: z.array(securityOutcomeSchema),
  })
  .strict();
export type ProcessingRun = z.infer<typeof processingRunSchema>;
export type UsageRecord = z.infer<typeof usageRecordSchema>;
export type SecurityOutcome = z.infer<typeof securityOutcomeSchema>;
