import { z } from 'zod';

export type SamplingConfig = { type: 'none' } | { type: 'ratio'; rate: number };

export type ScoringSource = 'LIVE' | 'TEST';
export type ScoringEntityType = 'AGENT' | 'WORKFLOW';

export type ScoringPrompts = {
  description: string;
  prompt: string;
};

export type ScoringRun = {
  runId: string;
  traceId?: string;
  scorer: Record<string, any>;
  input: Record<string, any>[];
  output: Record<string, any>;
  metadata?: Record<string, any>;
  additionalContext?: Record<string, any>;
  resourceId?: string;
  threadId?: string;
  source: ScoringSource;
  entity: Record<string, any>;
  entityType: ScoringEntityType;
  runtimeContext: Record<string, any>;
  structuredOutput?: boolean;
};

export const extractStepResultSchema = z.record(z.string(), z.any());

export type ExtractStepResult = z.infer<typeof extractStepResultSchema>;

export const scoreSchema = z.number();

const resultSchema = z.array(
  z.object({
    result: z.string(),
    reason: z.string(),
  }),
);

export const scoreResultSchema = z.object({
  analyzeStepResult: z
    .object({
      results: resultSchema.optional(),
    })
    .optional(),
  score: scoreSchema,
  analyzePrompt: z.string().optional(),
});

export type ScoreResult = z.infer<typeof scoreResultSchema>;

export type ScoringRunWithExtractStepResult<TExtract = any> = ScoringRun & {
  extractStepResult?: TExtract;
  extractPrompt?: string;
};

export type ScoringRunWithExtractStepResultAndScore<
  TExtract = any,
  TScore = any,
> = ScoringRunWithExtractStepResult<TExtract> & {
  score?: number;
  results?: z.infer<typeof resultSchema>;
  analyzeStepResult?: TScore;
  analyzePrompt?: string;
};

export type ScoringRunWithExtractStepResultAndScoreAndReason = ScoringRunWithExtractStepResultAndScore & {
  reason: string;
  reasonPrompt?: string;
};

export type ScoreRowData = ScoringRunWithExtractStepResultAndScoreAndReason & {
  id: string;
  entityId: string;
  scorerId: string;
  createdAt: Date;
  updatedAt: Date;
};
