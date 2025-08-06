import type { LanguageModel } from '@mastra/core/llm';
import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { z } from 'zod';
import { roundToTwoDecimals, getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '../../utils';
import {
  createFaithfulnessAnalyzePrompt,
  createFaithfulnessExtractPrompt,
  createFaithfulnessReasonPrompt,
  FAITHFULNESS_AGENT_INSTRUCTIONS,
} from './prompts';

export interface FaithfulnessMetricOptions {
  scale?: number;
  context?: string[];
}

export function createFaithfulnessScorer({
  model,
  options,
}: {
  model: LanguageModel;
  options?: FaithfulnessMetricOptions;
}) {
  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
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
        const prompt = createFaithfulnessExtractPrompt({ output: getAssistantMessageFromRunOutput(run.output) ?? '' });
        return prompt;
      },
    })
    .analyze({
      description: 'Score the relevance of the statements to the input',
      outputSchema: z.object({ verdicts: z.array(z.object({ verdict: z.string(), reason: z.string() })) }),
      createPrompt: ({ results, run }) => {
        // Use the context provided by the user, or the context from the tool invocations
        const context =
          options?.context ??
          run.output
            .find(({ role }) => role === 'assistant')
            ?.toolInvocations?.map(toolCall => (toolCall.state === 'result' ? JSON.stringify(toolCall.result) : '')) ??
          [];
        const prompt = createFaithfulnessAnalyzePrompt({
          claims: results.preprocessStepResult || [],
          context,
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
          input: getUserMessageFromRunInput(run.input) ?? '',
          output: getAssistantMessageFromRunOutput(run.output) ?? '',
          context:
            run.output
              .find(({ role }) => role === 'assistant')
              ?.toolInvocations?.map(toolCall => JSON.stringify(toolCall)) || [],
          score,
          scale: options?.scale || 1,
          verdicts: results.analyzeStepResult?.verdicts || [],
        });
        return prompt;
      },
    });
}
