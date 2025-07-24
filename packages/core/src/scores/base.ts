import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createStep, createWorkflow } from '../workflows';
import { scoreResultSchema, scoringExtractStepResultSchema } from './types';
import type {
  ExtractionStepFn,
  ReasonStepFn,
  ScorerOptions,
  AnalyzeStepFn,
  ScoringInput,
  ScoringInputWithExtractStepResultAndScoreAndReason,
  ScoringSamplingConfig,
} from './types';

export class MastraScorer {
  name: string;
  description: string;
  extract?: ExtractionStepFn;
  analyze: AnalyzeStepFn;
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

  async run(input: ScoringInput): Promise<ScoringInputWithExtractStepResultAndScoreAndReason> {
    let runId = input.runId;
    if (!runId) {
      runId = randomUUID();
    }

    const extractStep = createStep({
      id: 'extract',
      description: 'Extract relevant element from the run',
      inputSchema: z.any(),
      outputSchema: scoringExtractStepResultSchema,
      execute: async ({ inputData }) => {
        if (!this.extract) {
          return;
        }

        const extractStepResult = await this.extract(inputData);

        return extractStepResult;
      },
    });

    const analyzeStep = createStep({
      id: 'analyze',
      description: 'Score the extracted element',
      inputSchema: scoringExtractStepResultSchema,
      outputSchema: scoreResultSchema,
      execute: async ({ inputData }) => {
        const analyzeStepResult = await this.analyze({ ...input, runId, extractStepResult: inputData?.result });

        return analyzeStepResult;
      },
    });

    const reasonStep = createStep({
      id: 'reason',
      description: 'Reason about the score',
      inputSchema: scoreResultSchema,
      outputSchema: z.any(),
      execute: async ({ getStepResult }) => {
        const analyzeStepRes = getStepResult(analyzeStep);
        const extractStepResult = getStepResult(extractStep);

        if (!this.reason) {
          return {
            extractStepResult: extractStepResult?.result,
            analyzeStepResult: analyzeStepRes?.result,
            analyzePrompt: analyzeStepRes?.prompt,
            extractPrompt: extractStepResult?.prompt,
            score: analyzeStepRes?.score,
          };
        }

        const reasonResult = await this.reason({
          ...input,
          analyzeStepResult: analyzeStepRes.result,
          score: analyzeStepRes.score,
          runId,
        });

        return {
          extractStepResult: extractStepResult?.result,
          analyzeStepResult: analyzeStepRes?.result,
          analyzePrompt: analyzeStepRes?.prompt,
          extractPrompt: extractStepResult?.prompt,
          score: analyzeStepRes?.score,
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
  scorer: MastraScorer;
  sampling?: ScoringSamplingConfig;
};

export type MastraScorers = Record<string, MastraScorerEntry>;
