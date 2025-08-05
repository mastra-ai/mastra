import type { LanguageModel } from '@mastra/core/llm';
import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';

import { z } from 'zod';
import { getAssistantMessageFromRunOutput, getUserMessageFromRunInput, roundToTwoDecimals } from '../../utils';
import {
  createHallucinationAnalyzePrompt,
  createHallucinationExtractPrompt,
  createHallucinationReasonPrompt,
  HALLUCINATION_AGENT_INSTRUCTIONS,
} from './prompts';

export interface HallucinationMetricOptions {
  scale?: number;
  context: string[];
}

export function createHallucinationScorer({
  model,
  options,
}: {
  model: LanguageModel;
  options?: HallucinationMetricOptions;
}) {
  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Hallucination Scorer',
    description: 'A scorer that evaluates the hallucination of an LLM output to an input',
    judge: {
      model,
      instructions: HALLUCINATION_AGENT_INSTRUCTIONS,
    },
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
      createPrompt: ({ results }) => {
        const prompt = createHallucinationAnalyzePrompt({
          claims: results.preprocessStepResult.claims,
          context: options?.context || [],
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
      createPrompt: ({ run, results, score }) => {
        const prompt = createHallucinationReasonPrompt({
          input: getUserMessageFromRunInput(run.input) ?? '',
          output: getAssistantMessageFromRunOutput(run.output) ?? '',
          context: options?.context || [],
          score,
          scale: options?.scale || 1,
          verdicts: results.analyzeStepResult?.verdicts || [],
        });
        return prompt;
      },
    });
}
