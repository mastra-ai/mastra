import { z } from 'zod';
import { Agent } from '../agent';
import { AvailableHooks, executeHook } from '../hooks';
import type { MastraLanguageModel } from '../memory';
import { createStep, createWorkflow } from '../workflows';

export type SamplingConfig = { type: 'none' } | { type: 'ratio'; rate: number };

export type MastraScorer = {
  scorer: Scorer;
  sampling?: SamplingConfig;
};

export type Scorers = Record<string, MastraScorer>;

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

const scoreResultSchema = z.object({
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
};

export type ScoreRowData = ScoringRunWithExtractStepResultAndScoreAndReason & {
  id: string;
  entityId: string;
  scorerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ExtractionStepFn = (run: ScoringRun) => Promise<Record<string, any>>;
export type ScoreStepFn = (run: ScoringRunWithExtractStepResult) => Promise<ScoreResult>;
export type ReasonStepFn = (
  run: ScoringRunWithExtractStepResultAndScore,
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

export class Scorer {
  name: string;
  description: string;
  extract?: ExtractionStepFn;
  analyze: ScoreStepFn;
  reason?: ReasonStepFn;
  metadata?: Record<string, any>;
  isLLMScorer?: boolean;

  constructor(opts: ScorerOptions) {
    this.name = opts.name;
    this.description = opts.description;
    this.extract = opts.extract;
    this.analyze = opts.analyze;
    this.reason = opts.reason;
    this.metadata = {};
    this.isLLMScorer = opts.isLLMScorer;

    if (opts.metadata) {
      this.metadata = opts.metadata;
    }
  }

  async evaluate(run: ScoringRun): Promise<ScoringRunWithExtractStepResultAndScoreAndReason> {
    const extractStep = createStep({
      id: 'extract',
      description: 'Extract relevant element from the run',
      inputSchema: z.any(),
      outputSchema: extractStepResultSchema,
      execute: async ({ inputData }) => {
        if (!this.extract) {
          return {};
        }

        const extractStepResult = await this.extract(inputData);
        return extractStepResult;
      },
    });

    const analyzeStep = createStep({
      id: 'analyze',
      description: 'Score the extracted element',
      inputSchema: extractStepResultSchema,
      outputSchema: scoreResultSchema,
      execute: async ({ inputData }) => {
        const extractStepResult = this.isLLMScorer ? inputData.extractStepResult : inputData;
        const analyzeStepResult = await this.analyze({ ...run, extractStepResult });

        if (this.isLLMScorer) {
          return analyzeStepResult;
        }

        const { score, ...rest } = analyzeStepResult;

        // TODO: fix types for non-LLM scorers.
        // non-LLM scorers do not have analyzeStepResult they should just return score
        // and additional information
        return { score, analyzeStepResult: rest as any };
      },
    });

    const reasonStep = createStep({
      id: 'reason',
      description: 'Reason about the score',
      inputSchema: scoreResultSchema,
      outputSchema: z.any(),
      execute: async ({ inputData, getStepResult }) => {
        const { score, analyzeStepResult, analyzePrompt } = getStepResult(analyzeStep);
        const { extractStepResult, extractPrompt } = getStepResult(extractStep);
        if (!this.reason) {
          return {
            extractStepResult,
            analyzeStepResult,
            analyzePrompt,
            extractPrompt,
            score,
          };
        }

        const reasonResult = await this.reason({
          ...run,
          analyzeStepResult,
          score,
        });
        return {
          extractStepResult,
          analyzeStepResult,
          analyzePrompt,
          extractPrompt,
          score,
          ...reasonResult,
        };
      },
    });

    const scoringPipeline = createWorkflow({
      id: `scoring-pipeline-${this.name}`,
      inputSchema: z.any(),
      outputSchema: z.any(),
      steps: [extractStep, analyzeStep],
    })
      .then(extractStep)
      .then(analyzeStep)
      .then(reasonStep)
      .commit();

    const workflowRun = await scoringPipeline.createRunAsync();

    const execution = await workflowRun.start({
      inputData: run,
    });

    if (execution.status !== 'success') {
      throw new Error(
        `Scoring pipeline failed: ${execution.status}`,
        execution.status === 'failed' ? execution.error : undefined,
      );
    }

    return { ...run, ...execution.result };
  }
}

export function createScorer(opts: ScorerOptions) {
  const scorer = new Scorer({
    name: opts.name,
    description: opts.description,
    extract: opts.extract,
    analyze: opts.analyze,
    reason: opts.reason,
  });

  return scorer;
}

type LLMJudge = {
  model: MastraLanguageModel;
  instructions: string;
};

export type LLMScorerOptions<TExtractOutput extends Record<string, any> = any, TScoreOutput = any> = {
  name: string;
  description: string;
  judge: LLMJudge;
  extract?: {
    description: string;
    judge?: LLMJudge;
    outputSchema: z.ZodType<TExtractOutput>;
    createPrompt: ({ run }: { run: ScoringRun }) => string;
  };
  analyze: {
    description: string;
    judge?: LLMJudge;
    outputSchema: z.ZodType<TScoreOutput>;
    createPrompt: ({ run }: { run: ScoringRun & { extractStepResult: TExtractOutput } }) => string;
  };
  reason?: {
    description: string;
    judge?: LLMJudge;
    createPrompt: ({
      run,
    }: {
      run: ScoringRun & { extractStepResult: TExtractOutput; analyzeStepResult: TScoreOutput; score: number };
    }) => string;
  };
  calculateScore: ({
    run,
  }: {
    run: ScoringRun & { extractStepResult: TExtractOutput; analyzeStepResult: TScoreOutput };
  }) => number;
};

export function createLLMScorer<TExtractOutput extends Record<string, any> = any, TScoreOutput = any>(
  opts: LLMScorerOptions<TExtractOutput, TScoreOutput>,
) {
  const model = opts.judge.model;

  const llm = new Agent({
    name: opts.name,
    instructions: opts.judge.instructions,
    model: model,
  });

  const scorer = new Scorer({
    name: opts.name,
    description: opts.description,
    metadata: opts,
    isLLMScorer: true,
    ...(opts.extract && {
      extract: async run => {
        const prompt = opts.extract!.createPrompt({ run });
        const extractResult = await llm.generate(prompt, {
          output: opts.extract!.outputSchema,
        });

        return {
          extractStepResult: extractResult.object as Record<string, any>,
          extractPrompt: prompt,
        };
      },
    }),
    analyze: async run => {
      const runWithExtractResult = {
        ...run,
        extractStepResult: run.extractStepResult,
      };

      const prompt = opts.analyze.createPrompt({ run: runWithExtractResult });

      const analyzeResult = await llm.generate(prompt, {
        output: opts.analyze.outputSchema,
      });

      let score = 0;

      const runWithScoreResult = {
        ...runWithExtractResult,
        analyzeStepResult: analyzeResult.object,
      };

      if (opts.calculateScore) {
        score = opts.calculateScore({ run: runWithScoreResult });
      }

      (runWithScoreResult as ScoringRunWithExtractStepResultAndScore).score = score;

      return {
        analyzeStepResult: analyzeResult.object!,
        score: score,
        analyzePrompt: prompt,
      };
    },
    reason: opts.reason
      ? async run => {
          // Prepare run with both extract and score results
          const runWithAllResults = {
            ...run,
            extractStepResult: run.extractStepResult,
            analyzeStepResult: run.analyzeStepResult, // Use results as fallback
            score: run.score || 0,
          };

          const prompt = opts.reason?.createPrompt({ run: runWithAllResults })!;

          const reasonResult = await llm.generate(prompt, {
            output: z.object({
              reason: z.string(),
            }),
          });

          return {
            reason: reasonResult.object.reason,
            reasonPrompt: prompt,
          };
        }
      : undefined,
  });

  return scorer;
}

export type ScoringSource = 'LIVE';
export type ScoringEntityType = 'AGENT' | 'WORKFLOW';

export function runScorer({
  runId,
  scorerId,
  scorerObject,
  input,
  output,
  runtimeContext,
  entity,
  structuredOutput,
  source,
  entityType,
}: {
  scorerId: string;
  scorerObject: MastraScorer;
  runId: string;
  input: Record<string, any>[];
  output: Record<string, any>;
  runtimeContext: Record<string, any>;
  entity: Record<string, any>;
  structuredOutput: boolean;
  source: ScoringSource;
  entityType: ScoringEntityType;
}) {
  let shouldExecute = false;

  if (!scorerObject?.sampling || scorerObject?.sampling?.type === 'none') {
    shouldExecute = true;
  }

  if (scorerObject?.sampling?.type) {
    switch (scorerObject?.sampling?.type) {
      case 'ratio':
        shouldExecute = Math.random() < scorerObject?.sampling?.rate;
        break;
      default:
        shouldExecute = true;
    }
  }

  if (!shouldExecute) {
    return;
  }

  const payload: ScoringRun = {
    scorer: {
      id: scorerId,
      name: scorerObject.scorer.name,
      description: scorerObject.scorer.description,
    },
    input,
    output,
    runtimeContext: Object.fromEntries(runtimeContext.entries()),
    runId,
    source,
    entity,
    structuredOutput,
    entityType,
  };

  console.log('payload', payload);

  executeHook(AvailableHooks.ON_SCORER_RUN, payload);
}
