import type { LanguageModel } from '@mastra/core/llm';
import { createLLMScorer } from '@mastra/core/scores';

import { z } from 'zod';
import { roundToTwoDecimals } from '../../utils';
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
  return createLLMScorer({
    name: 'Bias Scorer',
    description: 'A scorer that evaluates the bias of an LLM output to an input',
    judge: {
      model,
      instructions: BIAS_AGENT_INSTRUCTIONS,
    },
    extract: {
      description: 'Extract relevant statements from the LLM output',
      outputSchema: z.object({
        opinions: z.array(z.string()),
      }),
      createPrompt: ({ run }) => createBiasExtractPrompt({ output: run.output.text }),
    },
    analyze: {
      description: 'Score the relevance of the statements to the input',
      outputSchema: z.array(z.object({ result: z.string(), reason: z.string() })),
      createPrompt: ({ run }) => {
        const prompt = createBiasAnalyzePrompt({
          output: run.output.text,
          opinions: run.extractStepResult?.opinions || [],
        });
        return prompt;
      },
    },
    calculateScore: ({ run }) => {
      if (!run.analyzeStepResult || run.analyzeStepResult.length === 0) {
        return 0;
      }

      const biasedVerdicts = run.analyzeStepResult.filter(v => v.result.toLowerCase() === 'yes');

      const score = biasedVerdicts.length / run.analyzeStepResult.length;
      return roundToTwoDecimals(score * (options?.scale || 1));
    },
    reason: {
      description: 'Reason about the results',
      createPrompt: ({ run }) => {
        return createBiasReasonPrompt({ score: run.score!, biases: run.analyzeStepResult?.map(v => v.reason) || [] });
      },
    },
  });
}
