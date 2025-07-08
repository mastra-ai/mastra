import type { MastraLanguageModel } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import { MastraError } from '@mastra/core/error';
import type { LLMScorerScoreResult } from '@mastra/core/eval';
import { LLMScorer } from '@mastra/core/eval';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { roundToTwoDecimals } from '../../../metrics/llm/utils';
import { EXTRACT_PROMPT, extractPrompt, REASON_PROMPT, reasonPrompt, SCORE_PROMPT, scorePrompt } from './prompts';

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

export function createAnswerRelevancyJudge({ model }: { model: MastraLanguageModel }) {
  return new Agent({
    name: 'Answer Relevancy Judge',
    instructions: ANSWER_RELEVANCY_AGENT_INSTRUCTIONS,
    model,
  });
}

export interface AnswerRelevancyMetricOptions {
  uncertaintyWeight?: number;
  scale?: number;
}

export const resultSchema = z.object({
  result: z.string(),
  reason: z.string(),
});

export const resultsSchema = z.array(resultSchema);

export type zResultsSchema = z.infer<typeof resultsSchema>;

export const scoringResultsSchema = z.object({
  results: resultsSchema,
});

export const scoringResultsWithReasonSchema = z.object({
  results: resultsSchema,
  reason: z.string(),
  score: z.number(),
});

export function calculateScore({
  results,
  uncertaintyWeight = DEFAULT_OPTIONS.uncertaintyWeight,
  scale = DEFAULT_OPTIONS.scale,
}: {
  results: zResultsSchema;
  uncertaintyWeight: number;
  scale: number;
}): number {
  const numberOfResults = results?.length || 0;

  if (numberOfResults === 0) {
    return 1;
  }

  let relevancyCount = 0;
  for (const { result } of results) {
    if (result.trim().toLowerCase() === 'yes') {
      relevancyCount++;
    } else if (result.trim().toLowerCase() === 'unsure') {
      relevancyCount += uncertaintyWeight;
    }
  }

  const score = relevancyCount / numberOfResults;
  return roundToTwoDecimals(score * scale);
}

export class AnswerRelevancyScorer extends LLMScorer {
  #agent: Agent;
  #options: AnswerRelevancyMetricOptions;

  name = 'Answer Relevancy Scorer';
  description = 'A scorer that evaluates the relevancy of an LLM output to an input';

  constructor({
    model,
    options = DEFAULT_OPTIONS,
  }: {
    model: MastraLanguageModel;
    options?: AnswerRelevancyMetricOptions;
  }) {
    super();

    this.#agent = createAnswerRelevancyJudge({ model });
    this.#options = options || DEFAULT_OPTIONS;
  }

  prompts() {
    return {
      extract: {
        prompt: EXTRACT_PROMPT,
        description: 'Extract relevant statements from the LLM output',
      },
      score: {
        prompt: SCORE_PROMPT,
        description: 'Score the relevance of the statements to the input',
      },
      reason: {
        prompt: REASON_PROMPT,
        description: 'Reason about the results',
      },
    };
  }

  async score({ input, output }: { input: string; output: string }): Promise<LLMScorerScoreResult> {
    const agent = this.#agent;

    const extractStatementsStep = createStep({
      id: 'extract-statements',
      description: 'Extract statements from the input and output',
      inputSchema: z.object({
        input: z.string(),
        output: z.string(),
      }),
      outputSchema: z.object({
        statements: z.array(z.string()),
      }),
      execute: async () => {
        const statementPrompt = extractPrompt({ output });

        const result = await agent.generate(statementPrompt, {
          output: z.object({
            statements: z.array(z.string()),
          }),
        });

        return {
          statements: result.object.statements,
        };
      },
    });

    const evaluateStep = createStep({
      id: 'evaluate',
      description: 'Evaluate the statements',
      inputSchema: z.object({
        statements: z.array(z.string()),
      }),
      outputSchema: scoringResultsSchema,
      execute: async ({ inputData }) => {
        const prompt = scorePrompt({ input, statements: inputData.statements });
        const result = await agent.generate(prompt, {
          output: scoringResultsSchema,
        });

        return result.object;
      },
    });

    const reasoningStep = createStep({
      id: 'reasoning',
      description: 'Reason about the results',
      inputSchema: scoringResultsSchema,
      outputSchema: scoringResultsWithReasonSchema,
      execute: async ({ inputData }) => {
        const results = inputData.results;

        const score = calculateScore({
          results,
          uncertaintyWeight: this.#options.uncertaintyWeight || DEFAULT_OPTIONS.uncertaintyWeight,
          scale: this.#options.scale || DEFAULT_OPTIONS.scale,
        });

        const prompt = reasonPrompt({
          input,
          output,
          score,
          scale: this.#options.scale || DEFAULT_OPTIONS.scale,
          results,
        });

        const result = await agent.generate(prompt, {
          output: z.object({
            reason: z.string(),
          }),
        });

        return {
          results,
          reason: result.object.reason,
          score,
        };
      },
    });

    const scoringWorkflow = createWorkflow({
      id: 'Answer Relevancy Scoring Workflow',
      inputSchema: z.object({}),
      outputSchema: scoringResultsWithReasonSchema,
      steps: [extractStatementsStep, evaluateStep, reasoningStep],
    })
      .then(extractStatementsStep)
      .then(evaluateStep)
      .then(reasoningStep)
      .commit();

    const run = await scoringWorkflow.createRunAsync();

    const wfResult = await run.start({});

    if (wfResult.status !== 'success') {
      let error;

      if (wfResult.status === 'failed') {
        error = wfResult.error;
      } else {
        error = new Error('Answer Relevancy Scorer failed to run');
      }
      throw new MastraError(
        {
          category: 'UNKNOWN',
          details: {
            steps: JSON.stringify(wfResult.steps),
          },
          domain: 'EVAL',
          id: 'ANSWER_RELEVANCY_SCORER_FAILED',
        },
        error,
      );
    }

    return {
      input,
      output,
      ...wfResult.result,
    };
  }
}
