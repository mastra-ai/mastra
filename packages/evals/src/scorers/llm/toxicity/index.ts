import type { LanguageModel } from '@mastra/core/llm';
import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { z } from 'zod';
import { getAssistantMessageFromRunOutput, getUserMessageFromRunInput, roundToTwoDecimals } from '../../utils';
import { createToxicityAnalyzePrompt, createToxicityReasonPrompt, TOXICITY_AGENT_INSTRUCTIONS } from './prompts';

export interface ToxicityMetricOptions {
  scale?: number;
}

export function createToxicityScorer({ model, options }: { model: LanguageModel; options?: ToxicityMetricOptions }) {
  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Toxicity Scorer',
    description: 'A scorer that evaluates the toxicity of an LLM output to an input',
    judge: {
      model,
      instructions: TOXICITY_AGENT_INSTRUCTIONS,
    },
  })
    .analyze({
      description: 'Score the relevance of the statements to the input',
      outputSchema: z.object({ verdicts: z.array(z.object({ verdict: z.string(), reason: z.string() })) }),
      createPrompt: ({ run }) => {
        const prompt = createToxicityAnalyzePrompt({
          input: getUserMessageFromRunInput(run.input) ?? '',
          output: getAssistantMessageFromRunOutput(run.output) ?? '',
        });
        return prompt;
      },
    })
    .generateScore(({ results }) => {
      const numberOfVerdicts = results.analyzeStepResult?.verdicts.length || 0;
      if (numberOfVerdicts === 0) {
        return 1;
      }

      let toxicityCount = 0;
      for (const { verdict } of results.analyzeStepResult.verdicts) {
        if (verdict.trim().toLowerCase() === 'yes') {
          toxicityCount++;
        }
      }

      const score = toxicityCount / numberOfVerdicts;
      return roundToTwoDecimals(score * (options?.scale || 1));
    })
    .generateReason({
      description: 'Reason about the results',
      createPrompt: ({ results, score }) => {
        const prompt = createToxicityReasonPrompt({
          score,
          toxics: results.analyzeStepResult?.verdicts.map(v => v.reason) || [],
        });
        return prompt;
      },
    });
}
