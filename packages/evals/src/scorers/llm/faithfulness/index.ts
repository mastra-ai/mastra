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
        let context = options?.context ?? [];

        // Extract context from tool invocations in the output messages
        if (!options?.context && run.output) {
          const toolContexts: string[] = [];
          for (const message of run.output) {
            if (message.toolInvocations) {
              for (const invocation of message.toolInvocations) {
                if (invocation.state === 'result' && invocation.result) {
                  toolContexts.push(JSON.stringify(invocation.result));
                }
              }
            }
          }
          context = toolContexts;
        }

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
        // Extract context from tool invocations
        let context: string[] = options?.context ?? [];
        if (!options?.context && run.output) {
          const toolContexts: string[] = [];
          for (const message of run.output) {
            if (message.toolInvocations) {
              for (const invocation of message.toolInvocations) {
                if (invocation.state === 'result' && invocation.result) {
                  toolContexts.push(JSON.stringify(invocation.result));
                }
              }
            }
          }
          context = toolContexts;
        }

        const prompt = createFaithfulnessReasonPrompt({
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
