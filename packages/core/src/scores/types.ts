import { z } from 'zod';

export type ScoringSamplingConfig = { type: 'none' } | { type: 'ratio'; rate: number };

export type ScoringSource = 'LIVE' | 'TEST';

export type ScoringEntityType = 'AGENT' | 'WORKFLOW';

export type ScoringPrompts = {
  description: string;
  prompt: string;
};

export type ScoringInput = {
  runId: string;
  scorer: Record<string, any>;
  input: Record<string, any>[];
  output: Record<string, any>;
  metadata?: Record<string, any>;
  additionalContext?: Record<string, any>;
  source: ScoringSource;
  entity: Record<string, any>;
  entityType: ScoringEntityType;
  runtimeContext: Record<string, any>;
  structuredOutput?: boolean;
  traceId?: string;
  resourceId?: string;
  threadId?: string;
};

export const scoringExtractStepResultSchema = z.record(z.string(), z.any());

export type ScoringExtractStepResult = z.infer<typeof scoringExtractStepResultSchema>;

export const scoringValueSchema = z.number();

export const scoringResultSchema = z.array(
  z.object({
    result: z.string(),
    reason: z.string(),
  }),
);

export const scoreResultSchema = z.object({
  analyzeStepResult: z
    .object({
      results: scoringResultSchema.optional(),
    })
    .optional(),
  score: scoringValueSchema,
  analyzePrompt: z.string().optional(),
});

export type ScoringResult = z.infer<typeof scoreResultSchema>;

export type ScoringInputWithExtractStepResult<TExtract = any> = ScoringInput & {
  extractStepResult?: TExtract;
  extractPrompt?: string;
};

export type ScoringInputWithExtractStepResultAndScore<
  TExtract = any,
  TScore = any,
> = ScoringInputWithExtractStepResult<TExtract> & {
  score?: number;
  analyzeStepResult?: TScore;
  analyzePrompt?: string;
};

export type ScoringInputWithExtractStepResultAndScoreAndReason = ScoringInputWithExtractStepResultAndScore & {
  reason: string;
  reasonPrompt?: string;
};

export type ScoreRowData = ScoringInputWithExtractStepResultAndScoreAndReason & {
  id: string;
  entityId: string;
  scorerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ExtractionStepFn = (run: ScoringInput) => Promise<Record<string, any>>;
export type ScoreStepFn = (run: ScoringInputWithExtractStepResult) => Promise<ScoringResult>;
export type ReasonStepFn = (
  run: ScoringInputWithExtractStepResultAndScore,
) => Promise<{ reason: string; reasonPrompt?: string } | null>;

export type ScorerOptions = {
  name: string;
  description: string;
  extract?: ExtractionStepFn;
  analyze: ScoreStepFn;
  reason?: ReasonStepFn;
  metadata?: Record<string, any>;
  isLLMScorer?: boolean;
};
