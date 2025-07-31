import type { LanguageModel } from '@mastra/core/llm';
import { createScorer } from '@mastra/core/scores';

import { z } from 'zod';
import { roundToTwoDecimals } from '../../utils';
import {
  createFaithfulnessAnalyzePrompt,
  createFaithfulnessExtractPrompt,
  createFaithfulnessReasonPrompt,
  FAITHFULNESS_AGENT_INSTRUCTIONS,
} from './prompts';

export interface FaithfulnessMetricOptions {
  scale?: number;
  context: string[];
}

export function createFaithfulnessScorer({
  model,
  options,
}: {
  model: LanguageModel;
  options?: FaithfulnessMetricOptions;
}) {
  return createScorer({
    name: 'Faithfulness Scorer',
    description: 'A scorer that evaluates the faithfulness of an LLM output to an input',
    judge: {
      model,
      instructions: FAITHFULNESS_AGENT_INSTRUCTIONS,
    },
  })
    .preprocess({
      description: 'Extract relevant statements from the LLM output',
      outputSchema: z.array(z.string()),
      createPrompt: ({ run }) => {
        const prompt = createFaithfulnessExtractPrompt({ output: run.output.text });
        return prompt;
      },
    })
    .analyze({
      description: 'Score the relevance of the statements to the input',
      outputSchema: z.object({ verdicts: z.array(z.object({ verdict: z.string(), reason: z.string() })) }),
      createPrompt: ({ results }) => {
        const prompt = createFaithfulnessAnalyzePrompt({
          claims: results.preprocessStepResult || [],
          context: options?.context || [],
        });
        return prompt;
      },
    })
    .generateScore(({ results }) => {
      const totalClaims = results.analyzeStepResult.verdicts.length;
      const supportedClaims = results.analyzeStepResult.verdicts.filter(v => v.verdict === 'yes').length;

      if (totalClaims === 0) {
        return 0;
      }

      const score = (supportedClaims / totalClaims) * (options?.scale || 1);

      return roundToTwoDecimals(score);
    })
    .generateReason({
      description: 'Reason about the results',
      createPrompt: ({ run, results, score }) => {
        const prompt = createFaithfulnessReasonPrompt({
          input: run.input?.map((input: { content: string }) => input.content).join(', ') || '',
          output: run.output.text,
          context: options?.context || [],
          score,
          scale: options?.scale || 1,
          verdicts: results.analyzeStepResult?.verdicts || [],
        });
        return prompt;
      },
    });
}
