import { createScorer } from '@mastra/core/evals';
import type { MastraModelConfig } from '@mastra/core/llm';
import type { JSONSchema7 } from 'json-schema';
import { roundToTwoDecimals, getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '../../utils';
import type { ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge } from '../../utils';
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

const extractOutputSchema = {
  type: 'object',
  properties: {
    statements: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['statements'],
} satisfies JSONSchema7;

const analyzeOutputSchema = {
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
} satisfies JSONSchema7;

export function createAnswerRelevancyScorer({
  model,
  options = DEFAULT_OPTIONS,
}: {
  model: MastraModelConfig;
  options?: Record<'uncertaintyWeight' | 'scale', number>;
}) {
  return createScorer<ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge>({
    id: 'answer-relevancy-scorer',
    name: 'Answer Relevancy Scorer',
    description: 'A scorer that evaluates the relevancy of an LLM output to an input',
    judge: {
      model,
      instructions: ANSWER_RELEVANCY_AGENT_INSTRUCTIONS,
    },
    type: 'agent',
  })
    .preprocess<{ statements: string[] }>({
      description: 'Extract relevant statements from the LLM output',
      outputSchema: extractOutputSchema,
      createPrompt: ({ run }) => {
        const assistantMessage = getAssistantMessageFromRunOutput(run.output) ?? '';
        return createExtractPrompt(assistantMessage);
      },
    })
    .analyze<{ results: { result: string; reason: string }[] }>({
      description: 'Score the relevance of the statements to the input',
      outputSchema: analyzeOutputSchema,
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
