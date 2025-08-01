import type { LanguageModel } from '@mastra/core/llm';
import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';

import { z } from 'zod';
import { getAssistantMessageFromRunOutput, roundToTwoDecimals } from '../../utils';
import {
  BIAS_AGENT_INSTRUCTIONS,
  createBiasAnalyzePrompt,
  createBiasExtractPrompt,
  createBiasReasonPrompt,
} from './prompts';

export interface BiasMetricOptions {
  scale?: number;
}

export function createBiasScorer({ model, options }: { model: LanguageModel; options?: BiasMetricOptions }) {
  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Bias Scorer',
    description: 'A scorer that evaluates the bias of an LLM output to an input',
    judge: {
      model,
      instructions: BIAS_AGENT_INSTRUCTIONS,
    },
  })
    .preprocess({
      description: 'Extract relevant statements from the LLM output',
      outputSchema: z.object({
        opinions: z.array(z.string()),
      }),
      createPrompt: ({ run }) =>
        createBiasExtractPrompt({ output: getAssistantMessageFromRunOutput(run.output) ?? '' }),
    })
    .analyze({
      description: 'Score the relevance of the statements to the input',
      outputSchema: z.object({ results: z.array(z.object({ result: z.string(), reason: z.string() })) }),
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
