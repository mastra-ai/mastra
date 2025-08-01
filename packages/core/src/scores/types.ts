import type { z } from 'zod';
import type { MastraLanguageModel } from '../memory';

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
  structuredOutput?: boolean;
  traceId?: string;
  resourceId?: string;
  threadId?: string;
};

export type ScoringInputWithPreprocessStepResult<TPreprocess = any> = ScoringInput & {
  runId: string;
  preprocessStepResult?: TPreprocess;
  preprocessPrompt?: string;
};

export type ScoringInputWithPreprocessStepResultOnly<TPreprocess = any> = ScoringInput & {
  runId: string;
  preprocessStepResult?: TPreprocess;
  preprocessPrompt?: string;
};

export type ScoringInputWithPreprocessStepResultAndAnalyzeStepResult<
  TPreprocess = any,
  TAnalyze = any,
> = ScoringInputWithPreprocessStepResult<TPreprocess> & {
  analyzeStepResult?: TAnalyze;
  analyzePrompt?: string;
};

export type ScoringInputWithPreprocessStepResultAndAnalyzeStepResultAndScore<
  TPreprocess = any,
  TAnalyze = any,
> = ScoringInputWithPreprocessStepResultAndAnalyzeStepResult<TPreprocess, TAnalyze> & {
  score: number;
};

export type ScoringInputWithPreprocessStepResultAndScoreAndReason =
  ScoringInputWithPreprocessStepResultAndAnalyzeStepResultAndScore & {
    reason?: string;
    reasonPrompt?: string;
  };

export type ScoreRowData = ScoringInputWithPreprocessStepResultAndScoreAndReason &
  ScoringHookInput & {
    id: string;
    entityId: string;
    scorerId: string;
    createdAt: Date;
    updatedAt: Date;
    /** @deprecated Use preprocessStepResult instead */
    extractStepResult?: any;
    /** @deprecated Use preprocessPrompt instead */
    extractPrompt?: string;
  };

export type PreprocessStepFn<TOutput = any> = {
  (input: { run: ScoringInput }): TOutput | Promise<TOutput>;
};

export type LLMJudge = {
  model: MastraLanguageModel;
  instructions: string;
};

export type PreprocessStepConfig<TOutput = any> = {
  description: string;
  judge?: LLMJudge;
  outputSchema?: z.ZodType<TOutput>;
  createPrompt: ({ run }: { run: ScoringInput }) => string;
};

export type PreprocessStep<TOutput = any> = PreprocessStepFn<TOutput> | PreprocessStepConfig<TOutput>;

export type AnalyzeStepFn<TPreprocessOutput = any, TAnalyzeOutput = any> = {
  (input: { run: ScoringInputWithPreprocessStepResult<TPreprocessOutput> }): TAnalyzeOutput | Promise<TAnalyzeOutput>;
};

export type AnalyzeStepConfig<TPreprocessOutput = any, TAnalyzeOutput = any> = {
  description: string;
  judge?: LLMJudge;
  outputSchema?: z.ZodType<TAnalyzeOutput>;
  createPrompt: ({ run }: { run: ScoringInputWithPreprocessStepResult<TPreprocessOutput> }) => string;
};

export type AnalyzeStep<TPreprocessOutput = any, TAnalyzeOutput = any> =
  | AnalyzeStepFn<TPreprocessOutput, TAnalyzeOutput>
  | AnalyzeStepConfig<TPreprocessOutput, TAnalyzeOutput>;

export type GenerateScoreStepFn<TPreprocessOutput = any, TAnalyzeOutput = any> = {
  (input: {
    run: ScoringInputWithPreprocessStepResultAndAnalyzeStepResult<TPreprocessOutput, TAnalyzeOutput>;
  }): number | Promise<number>;
};

export type GenerateScoreStepFnWithoutAnalyze<TPreprocessOutput = any> = {
  (input: { run: ScoringInputWithPreprocessStepResultOnly<TPreprocessOutput> }): number | Promise<number>;
};

export type GenerateScoreStepConfig<TPreprocessOutput = any, TAnalyzeOutput = any> = {
  description: string;
  judge?: LLMJudge;
  outputSchema?: z.ZodType<number>;
  createPrompt: ({
    run,
  }: {
    run: ScoringInputWithPreprocessStepResultAndAnalyzeStepResult<TPreprocessOutput, TAnalyzeOutput>;
  }) => string;
};

export type GenerateScoreStep<TPreprocessOutput = any, TAnalyzeOutput = any> =
  | GenerateScoreStepFn<TPreprocessOutput, TAnalyzeOutput>
  | GenerateScoreStepConfig<TPreprocessOutput, TAnalyzeOutput>;

export type ReasonStepFn<TPreprocessOutput = any, TAnalyzeOutput = any> = {
  (input: {
    run: ScoringInputWithPreprocessStepResultAndAnalyzeStepResultAndScore<TPreprocessOutput, TAnalyzeOutput>;
  }): string | null | Promise<string | null>;
};

export type ReasonStepConfig<TPreprocessOutput = any, TAnalyzeOutput = any> = {
  description: string;
  judge?: LLMJudge;
  createPrompt: ({
    run,
  }: {
    run: ScoringInputWithPreprocessStepResultAndAnalyzeStepResultAndScore<TPreprocessOutput, TAnalyzeOutput>;
  }) => string;
};

export type ReasonStep<TPreprocessOutput = any, TAnalyzeOutput = any> =
  | ReasonStepFn<TPreprocessOutput, TAnalyzeOutput>
  | ReasonStepConfig<TPreprocessOutput, TAnalyzeOutput>;

// Type guard helper

// Internal types for the base class (with proper wrapping)
export type InternalAnalyzeStepFn = (input: {
  run: ScoringInputWithPreprocessStepResult;
}) => Promise<{ result: any; prompt?: string }>;

export type InternalReasonStepFn = (input: {
  run: ScoringInputWithPreprocessStepResultAndAnalyzeStepResultAndScore;
}) => Promise<{ reason: string; prompt?: string } | null>;

export type ScorerOptions = {
  name: string;
  description: string;
  preprocess?: PreprocessStepFn;
  analyze?: InternalAnalyzeStepFn;
  generateScore: GenerateScoreStepFn;
  reason?: InternalReasonStepFn;
  metadata?: Record<string, any>;
  isLLMScorer?: boolean;
};

// New generic scorer options that support type flow with union types
export type TypedScorerOptions<TPreprocessOutput = any, TAnalyzeOutput = any> = {
  name: string;
  description: string;
  preprocess?: PreprocessStep<TPreprocessOutput>;
  analyze?: AnalyzeStep<TPreprocessOutput, TAnalyzeOutput>;
  generateScore: GenerateScoreStep<TPreprocessOutput, TAnalyzeOutput>;
  generateReason?: ReasonStep<TPreprocessOutput, TAnalyzeOutput>;
  metadata?: Record<string, any>;
  judge?: LLMJudge;
};
