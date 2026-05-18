import { createScorer } from '@mastra/core/evals';
import type { MastraModelConfig } from '@mastra/core/llm';

import type { JSONSchema7 } from 'json-schema';
import { getAssistantMessageFromRunOutput, roundToTwoDecimals } from '../../utils';
import type { ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge } from '../../utils';
import {
  BIAS_AGENT_INSTRUCTIONS,
  createBiasAnalyzePrompt,
  createBiasExtractPrompt,
  createBiasReasonPrompt,
} from './prompts';

export interface BiasMetricOptions {
  scale?: number;
}

export function createBiasScorer({ model, options }: { model: MastraModelConfig; options?: BiasMetricOptions }) {
  return createScorer<ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge>({
    id: 'bias-scorer',
    name: 'Bias Scorer',
    description: 'A scorer that evaluates the bias of an LLM output to an input',
    judge: {
      model,
      instructions: BIAS_AGENT_INSTRUCTIONS,
    },
    type: 'agent',
  })
    .preprocess<{ opinions: string[] }>({
      description: 'Extract relevant statements from the LLM output',
      outputSchema: {
        type: 'object',
        properties: {
          opinions: { type: 'array', items: { type: 'string' } },
        },
        required: ['opinions'],
      } satisfies JSONSchema7,
      createPrompt: ({ run }) =>
        createBiasExtractPrompt({ output: getAssistantMessageFromRunOutput(run.output) ?? '' }),
    })
    .analyze<{ results: { result: string; reason: string }[] }>({
      description: 'Score the relevance of the statements to the input',
      outputSchema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                result: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['result', 'reason'],
            },
          },
        },
        required: ['results'],
      } satisfies JSONSchema7,
      createPrompt: ({ run, results }) => {
        const prompt = createBiasAnalyzePrompt({
          output: getAssistantMessageFromRunOutput(run.output) ?? '',
          opinions: results.preprocessStepResult?.opinions || [],
        });
        return prompt;
      },
    })
    .generateScore(({ results }) => {
      if (!results.analyzeStepResult || results.analyzeStepResult.results.length === 0) {
        return 0;
      }

      const biasedVerdicts = results.analyzeStepResult.results.filter(v => v.result.toLowerCase() === 'yes');

      const score = biasedVerdicts.length / results.analyzeStepResult.results.length;
      return roundToTwoDecimals(score * (options?.scale || 1));
    })
    .generateReason({
      description: 'Reason about the results',
      createPrompt: ({ score, results }) => {
        return createBiasReasonPrompt({
          score,
          biases: results.analyzeStepResult?.results.map(v => v.reason) || [],
        });
      },
    });
}
