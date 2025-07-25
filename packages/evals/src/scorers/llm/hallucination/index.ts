import type { LanguageModel } from '@mastra/core/llm';
import { createLLMScorer } from '@mastra/core/scores';

import { z } from 'zod';
import { roundToTwoDecimals } from '../../utils';
import {
  createHallucinationAnalyzePrompt,
  createHallucinationExtractPrompt,
  createHallucinationReasonPrompt,
  HALLUCINATION_AGENT_INSTRUCTIONS,
} from './prompts';

export interface HallucinationMetricOptions {
  scale?: number;
}

export function createHallucinationScorer({
  model,
  options,
}: {
  model: LanguageModel;
  options?: HallucinationMetricOptions;
}) {
  return createLLMScorer({
    name: 'Hallucination Scorer',
    description: 'A scorer that evaluates the hallucination of an LLM output to an input',
    judge: {
      model,
      instructions: HALLUCINATION_AGENT_INSTRUCTIONS,
    },
    extract: {
      description: 'Extract all claims from the given output',
      outputSchema: z.object({
        claims: z.array(z.string()),
      }),
      createPrompt: ({ run }) => {
        const prompt = createHallucinationExtractPrompt({ output: run.output.text });
        return prompt;
      },
    },
    analyze: {
      description: 'Score the relevance of the statements to the input',
      outputSchema: z.object({
        verdicts: z.array(z.object({ statement: z.string(), verdict: z.string(), reason: z.string() })),
      }),
      createPrompt: ({ run }) => {
        const prompt = createHallucinationAnalyzePrompt({
          claims: run.extractStepResult.claims,
          context: run.additionalContext?.context || [],
        });
        return prompt;
      },
    },
    calculateScore: ({ run }) => {
      const totalStatements = run.analyzeStepResult.verdicts.length;
      const contradictedStatements = run.analyzeStepResult.verdicts.filter(v => v.verdict === 'yes').length;

      if (totalStatements === 0) {
        return 0;
      }

      const score = (contradictedStatements / totalStatements) * (options?.scale || 1);

      return roundToTwoDecimals(score);
    },
    reason: {
      description: 'Reason about the results',
      createPrompt: ({ run }) => {
        const prompt = createHallucinationReasonPrompt({
          input: run.input.map(input => input.content).join(', '),
          output: run.output.text,
          context: run?.additionalContext?.context || [],
          score: run.score,
          scale: options?.scale || 1,
          verdicts: run.analyzeStepResult?.verdicts || [],
        });
        return prompt;
      },
    },
  });
}
