import type { CoreMessage, CoreSystemMessage } from '@internal/ai-sdk-v4';
import { z } from 'zod/v4';
import type { MastraDBMessage } from '../agent';
import { SpanType } from '../observability';
import type { ObservabilityContext } from '../observability';
import { dbTimestamps, paginationInfoSchema } from '../storage/domains/shared';

// ============================================================================
// Sampling Config
// ============================================================================

export type ScoringSamplingConfig = { type: 'none' } | { type: 'ratio'; rate: number };

// ============================================================================
// Scoring Source & Entity Type
// ============================================================================

export const scoringSourceSchema = z.enum(['LIVE', 'TEST']);

export type ScoringSource = z.infer<typeof scoringSourceSchema>;

export const scoringEntityTypeSchema = z.enum(['AGENT', 'WORKFLOW', ...Object.values(SpanType)] as [
  string,
  string,
  ...string[],
]);

export type ScoringEntityType = z.infer<typeof scoringEntityTypeSchema>;

// ============================================================================
// Scoring Prompts
// ============================================================================

export const scoringPromptsSchema = z.object({
  description: z.string(),
  prompt: z.string(),
});

export type ScoringPrompts = z.infer<typeof scoringPromptsSchema>;

// ============================================================================
// Shared Record Schemas
// ============================================================================

/** Reusable schema for required record fields (e.g., scorer, entity) */
const recordSchema = z.record(z.string(), z.unknown());

/** Reusable schema for optional record fields (e.g., metadata, additionalContext) */
const optionalRecordSchema = recordSchema.optional();

// ============================================================================
// Base Scoring Input (used for scorer functions)
// ============================================================================

export const scoringInputSchema = z.object({
  runId: z.string().optional(),
  input: z.unknown().optional(),
  output: z.unknown(),
  additionalContext: optionalRecordSchema,
  requestContext: optionalRecordSchema,
  // Note: observabilityContext is not serializable, so we don't include it in the schema
  // It's added at runtime when needed
});

export type ScoringInput = z.infer<typeof scoringInputSchema> & Partial<ObservabilityContext>;

// ============================================================================
// Scoring Hook Input
// ============================================================================

export const scoringHookInputSchema = z.object({
  runId: z.string().optional(),
  scorer: recordSchema,
  input: z.unknown(),
  output: z.unknown(),
  metadata: optionalRecordSchema,
  additionalContext: optionalRecordSchema,
  source: scoringSourceSchema,
  entity: recordSchema,
  entityType: scoringEntityTypeSchema,
  requestContext: optionalRecordSchema,
  structuredOutput: z.boolean().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
  // Note: observabilityContext is not serializable, so we don't include it in the schema
});

export type ScoringHookInput = z.infer<typeof scoringHookInputSchema> & Partial<ObservabilityContext>;

// ============================================================================
// Extract Step Result
// ============================================================================

export const scoringExtractStepResultSchema = optionalRecordSchema;

export type ScoringExtractStepResult = z.infer<typeof scoringExtractStepResultSchema>;

// ============================================================================
// Analyze Step Result (Score Result)
// ============================================================================

export const scoringValueSchema = z.number();

export const scoreResultSchema = z.object({
  result: optionalRecordSchema,
  score: scoringValueSchema,
  prompt: z.string().optional(),
});

export type ScoringAnalyzeStepResult = z.infer<typeof scoreResultSchema>;

// ============================================================================
// Composite Input Types (for scorer step functions)
// ============================================================================

export const scoringInputWithExtractStepResultSchema = scoringInputSchema.extend({
  runId: z.string(), // Required in this context
  extractStepResult: optionalRecordSchema,
  extractPrompt: z.string().optional(),
});

export type ScoringInputWithExtractStepResult<TExtract = any> = Omit<
  z.infer<typeof scoringInputWithExtractStepResultSchema>,
  'extractStepResult'
> & {
  extractStepResult?: TExtract;
} & Partial<ObservabilityContext>;

export const scoringInputWithExtractStepResultAndAnalyzeStepResultSchema =
  scoringInputWithExtractStepResultSchema.extend({
    score: z.number(),
    analyzeStepResult: optionalRecordSchema,
    analyzePrompt: z.string().optional(),
  });

export type ScoringInputWithExtractStepResultAndAnalyzeStepResult<TExtract = any, TScore = any> = Omit<
  z.infer<typeof scoringInputWithExtractStepResultAndAnalyzeStepResultSchema>,
  'extractStepResult' | 'analyzeStepResult'
> & {
  extractStepResult?: TExtract;
  analyzeStepResult?: TScore;
} & Partial<ObservabilityContext>;

export const scoringInputWithExtractStepResultAndScoreAndReasonSchema =
  scoringInputWithExtractStepResultAndAnalyzeStepResultSchema.extend({
    reason: z.string().optional(),
    reasonPrompt: z.string().optional(),
  });

export type ScoringInputWithExtractStepResultAndScoreAndReason = z.infer<
  typeof scoringInputWithExtractStepResultAndScoreAndReasonSchema
> &
  Partial<ObservabilityContext>;

// ============================================================================
// Score Row Data (stored in DB)
// ============================================================================

export const scoreRowDataSchema = z.object({
  id: z.string(),
  scorerId: z.string(),
  entityId: z.string(),

  // From ScoringInputWithExtractStepResultAndScoreAndReason
  runId: z.string(),
  input: z.unknown().optional(),
  output: z.unknown(),
  additionalContext: optionalRecordSchema,
  requestContext: optionalRecordSchema,
  extractStepResult: optionalRecordSchema,
  extractPrompt: z.string().optional(),
  score: z.number(),
  analyzeStepResult: optionalRecordSchema,
  analyzePrompt: z.string().optional(),
  reason: z.string().optional(),
  reasonPrompt: z.string().optional(),

  // From ScoringHookInput
  scorer: recordSchema,
  metadata: optionalRecordSchema,
  source: scoringSourceSchema,
  entity: recordSchema,
  entityType: scoringEntityTypeSchema.optional(),
  structuredOutput: z.boolean().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),

  // Additional ScoreRowData fields
  preprocessStepResult: optionalRecordSchema,
  preprocessPrompt: z.string().optional(),
  generateScorePrompt: z.string().optional(),
  generateReasonPrompt: z.string().optional(),

  // Timestamps
  ...dbTimestamps,
});

export type ScoreRowData = z.infer<typeof scoreRowDataSchema>;

// ============================================================================
// Save Score Payload (for creating new scores)
// ============================================================================

export const saveScorePayloadSchema = scoreRowDataSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SaveScorePayload = z.infer<typeof saveScorePayloadSchema>;

// ============================================================================
// List Scores Response
// ============================================================================

export const listScoresResponseSchema = z.object({
  pagination: paginationInfoSchema,
  scores: z.array(scoreRowDataSchema),
});

export type ListScoresResponse = z.infer<typeof listScoresResponseSchema>;

export type ExtractionStepFn = (input: ScoringInput) => Promise<Record<string, any>>;

export type AnalyzeStepFn = (input: ScoringInputWithExtractStepResult) => Promise<ScoringAnalyzeStepResult>;

export type ReasonStepFn = (
  input: ScoringInputWithExtractStepResultAndAnalyzeStepResult,
) => Promise<{ reason: string; reasonPrompt?: string } | null>;

export type ScorerOptions = {
  name: string;
  description: string;
  extract?: ExtractionStepFn;
  analyze: AnalyzeStepFn;
  reason?: ReasonStepFn;
  metadata?: Record<string, any>;
  isLLMScorer?: boolean;
};

export type ScorerRunInputForAgent = {
  inputMessages: MastraDBMessage[];
  rememberedMessages: MastraDBMessage[];
  systemMessages: CoreMessage[];
  taggedSystemMessages: Record<string, CoreSystemMessage[]>;
};

export type ScorerRunOutputForAgent = MastraDBMessage[];
