import type { MastraLanguageModel } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { z } from 'zod';
import { roundToTwoDecimals } from '../../../metrics/llm/utils';
import { getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '../../utils';
import { createExtractPrompt, createReasonPrompt, createScorePrompt } from './prompts';

export const DEFAULT_OPTIONS: Record<'uncertaintyWeight' | 'scale', number> = {
  uncertaintyWeight: 0.3,
  scale: 1,
};

export const ANSWER_RELEVANCY_AGENT_INSTRUCTIONS = `
    You are a balanced and nuanced answer relevancy evaluator. Your job is to determine if LLM outputs are relevant to the input, including handling partially relevant or uncertain cases.

    Key Principles:
    1. Evaluate whether the output addresses what the input is asking for
    2. Consider both direct answers and related context
    3. Prioritize relevance to the input over correctness
    4. Recognize that responses can be partially relevant
    5. Empty inputs or error messages should always be marked as "no"
    6. Responses that discuss the type of information being asked show partial relevance
`;

const extractOutputSchema = z.object({
  statements: z.array(z.string()),
});

export function createAnswerRelevancyScorer({
  model,
  options = DEFAULT_OPTIONS,
}: {
  model: MastraLanguageModel;
  options?: Record<'uncertaintyWeight' | 'scale', number>;
}) {
  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Answer Relevancy Scorer',
    description: 'A scorer that evaluates the relevancy of an LLM output to an input',
    judge: {
      model,
      instructions: ANSWER_RELEVANCY_AGENT_INSTRUCTIONS,
    },
  })
    .preprocess({
      description: 'Extract relevant statements from the LLM output',
      outputSchema: extractOutputSchema,
      createPrompt: ({ run }) => {
        const assistantMessage = getAssistantMessageFromRunOutput(run.output) ?? '';
        return createExtractPrompt(assistantMessage);
      },
    })
    .analyze({
      description: 'Score the relevance of the statements to the input',
      outputSchema: z.object({ results: z.array(z.object({ result: z.string(), reason: z.string() })) }),
      createPrompt: ({ run, results }) => {
        const input = getUserMessageFromRunInput(run.input) ?? '';
        return createScorePrompt(JSON.stringify(input), results.preprocessStepResult?.statements || []);
      },
    })
    .generateScore(({ results }) => {
      if (!results.analyzeStepResult || results.analyzeStepResult.results.length === 0) {
        return 0;
      }

      const numberOfResults = results.analyzeStepResult.results.length;

      let relevancyCount = 0;
      for (const { result } of results.analyzeStepResult.results) {
        if (result.trim().toLowerCase() === 'yes') {
          relevancyCount++;
        } else if (result.trim().toLowerCase() === 'unsure') {
          relevancyCount += options.uncertaintyWeight;
        }
      }

      const score = relevancyCount / numberOfResults;

      return roundToTwoDecimals(score * options.scale);
    })
    .generateReason({
      description: 'Reason about the results',
      createPrompt: ({ run, results, score }) => {
        return createReasonPrompt({
          input: getUserMessageFromRunInput(run.input) ?? '',
          output: getAssistantMessageFromRunOutput(run.output) ?? '',
          score,
          results: results.analyzeStepResult.results,
          scale: options.scale,
        });
      },
    });
}
