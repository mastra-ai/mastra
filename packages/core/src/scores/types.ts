import type { CoreMessage, CoreSystemMessage } from 'ai';
import { z } from 'zod';
import type { UIMessageWithMetadata } from '../agent';
import type { TracingContext } from '../ai-tracing';

export type ScoringSamplingConfig = { type: 'none' } | { type: 'ratio'; rate: number };

export type ScoringSource = 'LIVE' | 'TEST';

export type ScoringEntityType = 'AGENT' | 'WORKFLOW';

export type ScoringPrompts = {
  description: string;
  prompt: string;
};

export type ScoringInput = {
  runId?: string;
  input?: Record<string, any>[];
  output: Record<string, any>;
  additionalContext?: Record<string, any>;
  runtimeContext?: Record<string, any>;
  tracingContext?: TracingContext;
};

export type ScoringHookInput = {
  runId?: string;
  scorer: Record<string, any>;
  input: Record<string, any>[];
  output: Record<string, any>;
  metadata?: Record<string, any>;
  additionalContext?: Record<string, any>;
  source: ScoringSource;
  entity: Record<string, any>;
  entityType: ScoringEntityType;
  runtimeContext?: Record<string, any>;
  tracingContext?: TracingContext;
  structuredOutput?: boolean;
  traceId?: string;
  resourceId?: string;
  threadId?: string;
};

export const scoringExtractStepResultSchema = z.record(z.string(), z.any()).optional();

export type ScoringExtractStepResult = z.infer<typeof scoringExtractStepResultSchema>;

export const scoringValueSchema = z.number();

export const scoreResultSchema = z.object({
  result: z.record(z.string(), z.any()).optional(),
  score: scoringValueSchema,
  prompt: z.string().optional(),
});

export type ScoringAnalyzeStepResult = z.infer<typeof scoreResultSchema>;

export type ScoringInputWithExtractStepResult<TExtract = any> = ScoringInput & {
  runId: string;
  extractStepResult?: TExtract;
  extractPrompt?: string;
};

export type ScoringInputWithExtractStepResultAndAnalyzeStepResult<
  TExtract = any,
  TScore = any,
> = ScoringInputWithExtractStepResult<TExtract> & {
  score: number;
  analyzeStepResult?: TScore;
  analyzePrompt?: string;
};

export type ScoringInputWithExtractStepResultAndScoreAndReason =
  ScoringInputWithExtractStepResultAndAnalyzeStepResult & {
    reason?: string;
    reasonPrompt?: string;
  };

export type ScoreRowData = ScoringInputWithExtractStepResultAndScoreAndReason &
  ScoringHookInput & {
    id: string;
    entityId: string;
    scorerId: string;
    createdAt: Date;
    updatedAt: Date;
    preprocessStepResult?: Record<string, any>;
    preprocessPrompt?: string;
    generateScorePrompt?: string;
    generateReasonPrompt?: string;
  };

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
  inputMessages: UIMessageWithMetadata[];
  rememberedMessages: UIMessageWithMetadata[];
  systemMessages: CoreMessage[];
  taggedSystemMessages: Record<string, CoreSystemMessage[]>;
};

export type ScorerRunOutputForAgent = UIMessageWithMetadata[];

export const saveScorePayloadSchema = z.object({
  runId: z.string(),
  scorerId: z.string(),
  entityId: z.string(),
  score: z.number(),
  input: z.any().optional(),
  output: z.any(),
  source: z.enum(['LIVE', 'TEST']),
  entityType: z.enum(['AGENT', 'WORKFLOW']).optional(),

  traceId: z.string().optional(),
  scorer: z.record(z.string(), z.any()).optional(),
  preprocessStepResult: z.record(z.string(), z.any()).optional(),
  extractStepResult: z.record(z.string(), z.any()).optional(),
  analyzeStepResult: z.record(z.string(), z.any()).optional(),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  preprocessPrompt: z.string().optional(),
  extractPrompt: z.string().optional(),
  generateScorePrompt: z.string().optional(),
  generateReasonPrompt: z.string().optional(),
  analyzePrompt: z.string().optional(),
  additionalContext: z.record(z.string(), z.any()).optional(),
  runtimeContext: z.record(z.string(), z.any()).optional(),
  entity: z.record(z.string(), z.any()).optional(),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
});

export type ValidatedSaveScorePayload = z.infer<typeof saveScorePayloadSchema>;
