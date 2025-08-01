import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createStep, createWorkflow } from '../workflows';
import type {
  PreprocessStepFn,
  InternalReasonStepFn,
  InternalAnalyzeStepFn,
  ScorerOptions,
  GenerateScoreStepFn,
  ScoringInput,
  ScoringSamplingConfig,
} from './types';

const analyzeStepResultSchema = z.object({
  result: z.record(z.string(), z.any()).optional(),
  prompt: z.string().optional(),
});

const scoreOnlySchema = z.number();

const reasonStepResultSchema = z.object({
  preprocessStepResult: z.any().optional(),
  analyzeStepResult: z.any().optional(),
  analyzePrompt: z.string().optional(),
  preprocessPrompt: z.string().optional(),
  score: z.number(),
  reason: z.string().optional(),
  reasonPrompt: z.string().optional(),
});

export const scoringPreprocessStepResultSchema = z.record(z.string(), z.any()).optional();

export class MastraScorer<TResult = any> {
  name: string;
  description: string;
  preprocess?: PreprocessStepFn;
  analyze?: InternalAnalyzeStepFn;
  generateScore: GenerateScoreStepFn;
  reason?: InternalReasonStepFn;
  metadata?: Record<string, any>;

  constructor(opts: ScorerOptions) {
    this.name = opts.name;
    this.description = opts.description;
    this.preprocess = opts.preprocess;
    this.analyze = opts.analyze;
    this.generateScore = opts.generateScore;
    this.reason = opts.reason;
    this.metadata = {};

    if (opts.metadata) {
      this.metadata = opts.metadata;
    }
  }

  async run(input: ScoringInput): Promise<TResult> {
    let runId = input.runId;
    if (!runId) {
      runId = randomUUID();
    }

    const preprocessStep = createStep({
      id: 'preprocess',
      description: 'Preprocess relevant element from the run',
      inputSchema: z.any(),
      outputSchema: scoringPreprocessStepResultSchema,
      execute: async ({ inputData }) => {
        if (!this.preprocess) {
          return;
        }

        const preprocessStepResult = await this.preprocess({ run: inputData });

        return preprocessStepResult;
      },
    });

    const analyzeStep = createStep({
      id: 'analyze',
      description: 'Analyze the preprocessed element',
      inputSchema: scoringPreprocessStepResultSchema,
      outputSchema: analyzeStepResultSchema,
      execute: async ({ inputData }) => {
        if (!this.analyze) {
          return {
            result: undefined,
            prompt: undefined,
          };
        }

        const analyzeStepResult = await this.analyze({
          run: { ...input, runId, preprocessStepResult: inputData?.result },
        });

        return analyzeStepResult;
      },
    });

    const generateScoreStep = createStep({
      id: 'generateScore',
      description: 'Generate score from analysis',
      inputSchema: analyzeStepResultSchema,
      outputSchema: scoreOnlySchema,
      execute: async ({ getStepResult }) => {
        const preprocessStepRes = getStepResult(preprocessStep);
        const analyzeStepRes = getStepResult(analyzeStep);

        const score = await this.generateScore({
          run: {
            ...input,
            runId,
            preprocessStepResult: preprocessStepRes?.result,
            // Only include analyze results if analyze step was executed
            ...(analyzeStepRes?.result !== undefined && {
              analyzeStepResult: analyzeStepRes.result,
              analyzePrompt: analyzeStepRes.prompt,
            }),
          },
        });

        return score;
      },
    });

    const reasonStep = createStep({
      id: 'reason',
      description: 'Reason about the score',
      inputSchema: z.number(),
      outputSchema: reasonStepResultSchema,
      execute: async ({ getStepResult }) => {
        const analyzeStepRes = getStepResult(analyzeStep);
        const preprocessStepResult = getStepResult(preprocessStep);
        const scoreResult = getStepResult(generateScoreStep);

        if (!this.reason) {
          return {
            preprocessStepResult: preprocessStepResult?.result,
            analyzeStepResult: analyzeStepRes?.result,
            analyzePrompt: analyzeStepRes?.prompt,
            preprocessPrompt: preprocessStepResult?.prompt,
            score: scoreResult,
          };
        }

        const reasonResult = await this.reason({
          run: {
            ...input,
            preprocessStepResult: preprocessStepResult?.result,
            analyzeStepResult: analyzeStepRes?.result,
            score: scoreResult,
            runId,
          },
        });

        return {
          preprocessStepResult: preprocessStepResult?.result,
          analyzeStepResult: analyzeStepRes?.result,
          analyzePrompt: analyzeStepRes?.prompt,
          preprocessPrompt: preprocessStepResult?.prompt,
          score: scoreResult,
          ...(reasonResult?.reason ? { reason: reasonResult.reason } : {}),
          ...(reasonResult?.prompt ? { reasonPrompt: reasonResult.prompt } : {}),
        };
      },
    });

    const scoringPipeline = createWorkflow({
      id: `scoring-pipeline-${this.name}`,
      inputSchema: z.any(),
      outputSchema: z.any(),
      steps: [preprocessStep, analyzeStep, generateScoreStep, reasonStep],
    })
      .then(preprocessStep)
      .then(analyzeStep)
      .then(generateScoreStep)
      .then(reasonStep)
      .commit();

    const workflowRun = await scoringPipeline.createRunAsync();

    const execution = await workflowRun.start({
      inputData: input,
    });

    if (execution.status !== 'success') {
      throw new Error(
        `Scoring pipeline failed: ${execution.status}`,
        execution.status === 'failed' ? execution.error : undefined,
      );
    }

    return { runId, ...execution.result };
  }
}
export type MastraScorerEntry = {
  scorer: MastraScorer<any>;
  sampling?: ScoringSamplingConfig;
};

export type MastraScorers = Record<string, MastraScorerEntry>;
