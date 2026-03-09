import { createScorer } from '@mastra/core/evals';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/evals';
import type { MastraModelConfig } from '@mastra/core/llm';
import type { TracingContext } from '@mastra/core/observability';

import { z } from 'zod';
import { getAssistantMessageFromRunOutput, getUserMessageFromRunInput, roundToTwoDecimals } from '../../utils';
import {
  createHallucinationAnalyzePrompt,
  createHallucinationExtractPrompt,
  createHallucinationReasonPrompt,
  HALLUCINATION_AGENT_INSTRUCTIONS,
} from './prompts';

export interface GetContextRun {
  input?: ScorerRunInputForAgent;
  output: ScorerRunOutputForAgent;
  runId?: string;
  requestContext?: Record<string, any>;
  tracingContext?: TracingContext;
}

export interface GetContextParams {
  run: GetContextRun;
  results: Record<string, any>;
  score?: number;
  step: 'analyze' | 'generateReason';
}

export type GetContextFn = (params: GetContextParams) => string[] | Promise<string[]>;

export interface HallucinationMetricOptions {
  scale?: number;
  context?: string[];
  getContext?: GetContextFn;
}

export function createHallucinationScorer({
  model,
  options,
}: {
  model: MastraModelConfig;
  options?: HallucinationMetricOptions;
}) {
  return createScorer({
    id: 'hallucination-scorer',
    name: 'Hallucination Scorer',
    description: 'A scorer that evaluates the hallucination of an LLM output to an input',
    judge: {
      model,
      instructions: HALLUCINATION_AGENT_INSTRUCTIONS,
    },
    type: 'agent',
  })
    .preprocess({
      description: 'Extract all claims from the given output',
      outputSchema: z.object({
        claims: z.array(z.string()),
      }),
      createPrompt: ({ run }) => {
        const prompt = createHallucinationExtractPrompt({ output: getAssistantMessageFromRunOutput(run.output) ?? '' });
        return prompt;
      },
    })
    .analyze({
      description: 'Score the relevance of the statements to the input',
      outputSchema: z.object({
        verdicts: z.array(z.object({ statement: z.string(), verdict: z.string(), reason: z.string() })),
      }),
      createPrompt: async ({ run, results }) => {
        let context: string[];
        if (options?.getContext) {
          context = await options.getContext({ run, results, step: 'analyze' });
        } else {
          context = options?.context ?? [];
        }

        const prompt = createHallucinationAnalyzePrompt({
          claims: results.preprocessStepResult.claims,
          context,
        });
        return prompt;
      },
    })
    .generateScore(({ results }) => {
      const totalStatements = results.analyzeStepResult.verdicts.length;
      const contradictedStatements = results.analyzeStepResult.verdicts.filter(v => v.verdict === 'yes').length;

      if (totalStatements === 0) {
        return 0;
      }

      const score = (contradictedStatements / totalStatements) * (options?.scale || 1);

      return roundToTwoDecimals(score);
    })
    .generateReason({
      description: 'Reason about the results',
      createPrompt: async ({ run, results, score }) => {
        let context: string[];
        if (options?.getContext) {
          context = await options.getContext({ run, results, score, step: 'generateReason' });
        } else {
          context = options?.context ?? [];
        }

        const prompt = createHallucinationReasonPrompt({
          input: getUserMessageFromRunInput(run.input) ?? '',
          output: getAssistantMessageFromRunOutput(run.output) ?? '',
          context,
          score,
          scale: options?.scale || 1,
          verdicts: results.analyzeStepResult?.verdicts || [],
        });
        return prompt;
      },
    });
}
