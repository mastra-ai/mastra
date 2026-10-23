import { z } from 'zod';
import { securityOutcomeSchema, usageRecordSchema } from './processing.ts';
import { reasonSchema, draftInvariantSchema } from './answer.ts';
const count = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional();
export const processingDiagnosticSchema = z
  .object({
    questionId: z.string().regex(/^[a-f0-9]{24}$/),
    at: z.iso.datetime(),
    phase: usageRecordSchema.shape.phase,
    boundary: securityOutcomeSchema.shape.boundary.optional(),
    origin: z.enum(['origin', 'sibling_cancelled', 'downstream']),
    category: z.enum([
      'STORAGE_FAILURE',
      'INPUT_ENVELOPE',
      'RUN_STOPPED',
      'TURN_LIMIT',
      'FINAL_TOOL_CALL',
      'MODEL_SCHEMA',
      'JSON_DECODE',
      'RESPONSE_SCHEMA',
      'CALLBACK_SCHEMA',
      'BATCH_IDENTITY',
      'REQUEST_GROUNDING',
      'MODEL_STREAM',
      'NATIVE_STRUCTURED_OUTPUT',
    ]),
    reason: reasonSchema,
    inputBytes: count,
    promptBytes: count,
    schemaBytes: count,
    toolsBytes: count,
    messages: count,
    tools: count,
    turn: count,
    schemaInvariants: z.array(draftInvariantSchema).min(1).max(3).optional(),
    schemaIssueCount: z.int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .strict()
  .refine(
    v =>
      v.schemaIssueCount === undefined
        ? v.schemaInvariants === undefined
        : v.category === 'CALLBACK_SCHEMA' &&
          v.phase === 'draft' &&
          v.reason === 'INVALID_MODEL_OUTPUT' &&
          v.schemaInvariants !== undefined &&
          new Set(v.schemaInvariants).size === v.schemaInvariants.length &&
          v.schemaIssueCount >= v.schemaInvariants.length,
    { message: 'Schema invariant diagnostics require a draft callback failure and consistent counts.' },
  );
export type ProcessingDiagnostic = z.infer<typeof processingDiagnosticSchema>;
