import type { CoreMessage, CoreSystemMessage } from '@internal/ai-sdk-v4';
import { z } from 'zod';
import type { MastraDBMessage } from '../agent';
import { SpanType } from '../observability';
import type { TracingContext } from '../observability';
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
// Base Scoring Input (used for scorer functions)
// ============================================================================

export const scoringInputSchema = z.object({
  runId: z.string().optional(),
  input: z.any().optional(),
  output: z.any(),
  additionalContext: z.record(z.string(), z.any()).optional(),
  requestContext: z.record(z.string(), z.any()).optional(),
  // Note: tracingContext is not serializable, so we don't include it in the schema
  // It's added at runtime when needed
});

export type ScoringInput = z.infer<typeof scoringInputSchema> & {
  tracingContext?: TracingContext;
};

// ============================================================================
// Scoring Hook Input
// ============================================================================

export const scoringHookInputSchema = z.object({
  runId: z.string().optional(),
  scorer: z.record(z.string(), z.any()),
  input: z.any(),
  output: z.any(),
  metadata: z.record(z.string(), z.any()).optional(),
  additionalContext: z.record(z.string(), z.any()).optional(),
  source: scoringSourceSchema,
  entity: z.record(z.string(), z.any()),
  entityType: scoringEntityTypeSchema,
  requestContext: z.record(z.string(), z.any()).optional(),
  structuredOutput: z.boolean().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
  // Note: tracingContext is not serializable, so we don't include it in the schema
});

export type ScoringHookInput = z.infer<typeof scoringHookInputSchema> & {
  tracingContext?: TracingContext;
};

// ============================================================================
// Extract Step Result
// ============================================================================

export const scoringExtractStepResultSchema = z.record(z.string(), z.any()).optional();

export type ScoringExtractStepResult = z.infer<typeof scoringExtractStepResultSchema>;

// ============================================================================
// Analyze Step Result (Score Result)
// ============================================================================

export const scoringValueSchema = z.number();

export const scoreResultSchema = z.object({
  result: z.record(z.string(), z.any()).optional(),
  score: scoringValueSchema,
  prompt: z.string().optional(),
});

export type ScoringAnalyzeStepResult = z.infer<typeof scoreResultSchema>;

// ============================================================================
// Composite Input Types (for scorer step functions)
// ============================================================================

export const scoringInputWithExtractStepResultSchema = scoringInputSchema.extend({
  runId: z.string(), // Required in this context
  extractStepResult: z.record(z.string(), z.any()).optional(),
  extractPrompt: z.string().optional(),
});

export type ScoringInputWithExtractStepResult<TExtract = any> = Omit<
  z.infer<typeof scoringInputWithExtractStepResultSchema>,
  'extractStepResult'
> & {
  extractStepResult?: TExtract;
  tracingContext?: TracingContext;
};

export const scoringInputWithExtractStepResultAndAnalyzeStepResultSchema =
  scoringInputWithExtractStepResultSchema.extend({
    score: z.number(),
    analyzeStepResult: z.record(z.string(), z.any()).optional(),
    analyzePrompt: z.string().optional(),
  });

export type ScoringInputWithExtractStepResultAndAnalyzeStepResult<TExtract = any, TScore = any> = Omit<
  z.infer<typeof scoringInputWithExtractStepResultAndAnalyzeStepResultSchema>,
  'extractStepResult' | 'analyzeStepResult'
> & {
  extractStepResult?: TExtract;
  analyzeStepResult?: TScore;
  tracingContext?: TracingContext;
};

export const scoringInputWithExtractStepResultAndScoreAndReasonSchema =
  scoringInputWithExtractStepResultAndAnalyzeStepResultSchema.extend({
    reason: z.string().optional(),
    reasonPrompt: z.string().optional(),
  });

export type ScoringInputWithExtractStepResultAndScoreAndReason = z.infer<
  typeof scoringInputWithExtractStepResultAndScoreAndReasonSchema
> & {
  tracingContext?: TracingContext;
};

// ============================================================================
// Score Row Data (stored in DB)
// ============================================================================

export const scoreRowDataSchema = z.object({
  id: z.string(),
  scorerId: z.string(),
  entityId: z.string(),

  // From ScoringInputWithExtractStepResultAndScoreAndReason
  runId: z.string(),
  input: z.any().optional(),
  output: z.any(),
  additionalContext: z.record(z.string(), z.any()).optional(),
  requestContext: z.record(z.string(), z.any()).optional(),
  extractStepResult: z.record(z.string(), z.any()).optional(),
  extractPrompt: z.string().optional(),
  score: z.number(),
  analyzeStepResult: z.record(z.string(), z.any()).optional(),
  analyzePrompt: z.string().optional(),
  reason: z.string().optional(),
  reasonPrompt: z.string().optional(),

  // From ScoringHookInput
  scorer: z.record(z.string(), z.any()),
  metadata: z.record(z.string(), z.any()).optional(),
  source: scoringSourceSchema,
  entity: z.record(z.string(), z.any()),
  entityType: scoringEntityTypeSchema.optional(),
  structuredOutput: z.boolean().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),

  // Additional ScoreRowData fields
  preprocessStepResult: z.record(z.string(), z.any()).optional(),
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

/** @deprecated Use SaveScorePayload instead */
export type ValidatedSaveScorePayload = SaveScorePayload;
