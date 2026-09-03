import { z } from 'zod/v4';
import { SpanType } from '../types/tracing';
import { dbTimestamps } from './shared';

/** Reusable schema for required record fields (e.g., scorer, entity). */
export const scoreRowRecordSchema = z.record(z.string(), z.unknown());

/** Reusable schema for optional record fields in persisted scorer results. */
export const optionalScoreRowRecordSchema = scoreRowRecordSchema.optional();

export const scoringSourceSchema = z.enum(['LIVE', 'TEST']);

export type ScoringSource = z.infer<typeof scoringSourceSchema>;

export const scoringEntityTypeSchema = z.enum([
  'AGENT',
  'WORKFLOW',
  'TRAJECTORY',
  'STEP',
  'EXTERNAL',
  ...Object.values(SpanType),
] as [string, string, ...string[]]);

export type ScoringEntityType = z.infer<typeof scoringEntityTypeSchema>;

/** Persisted score payload shared by evals and observability trace responses. */
export const scoreRowDataSchema = z.object({
  id: z.string(),
  scorerId: z.string(),
  entityId: z.string(),
  runId: z.string(),
  input: z.unknown().optional(),
  output: z.unknown(),
  additionalContext: optionalScoreRowRecordSchema,
  requestContext: optionalScoreRowRecordSchema,
  extractStepResult: optionalScoreRowRecordSchema,
  extractPrompt: z.string().optional(),
  score: z.number(),
  analyzeStepResult: optionalScoreRowRecordSchema,
  analyzePrompt: z.string().optional(),
  reason: z.string().optional(),
  reasonPrompt: z.string().optional(),
  scorer: scoreRowRecordSchema,
  metadata: optionalScoreRowRecordSchema,
  source: scoringSourceSchema,
  entity: scoreRowRecordSchema,
  entityType: scoringEntityTypeSchema.optional(),
  structuredOutput: z.boolean().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
  organizationId: z.string().nullish(),
  projectId: z.string().nullish(),
  batchId: z.string().nullish(),
  datasetId: z.string().nullish(),
  datasetItemId: z.string().nullish(),
  preprocessStepResult: optionalScoreRowRecordSchema,
  preprocessPrompt: z.string().optional(),
  generateScorePrompt: z.string().optional(),
  generateReasonPrompt: z.string().optional(),
  ...dbTimestamps,
});

export type ScoreRowData = z.infer<typeof scoreRowDataSchema>;
