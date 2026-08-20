import { compileSchema } from '@internal/types-builder/compile-zod';
import { createScorer } from '@mastra/core/evals';
import type { MastraModelConfig } from '@mastra/core/llm';
import { z } from 'zod/v4';
import { extractAgentResponseMessages, isScorerRunOutputForAgent } from '../../utils';
import type { ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge } from '../../utils';
import { MULTI_TURN_JUDGE_INSTRUCTIONS, createAnalyzePrompt, formatMultiTurnJudgeReason } from './prompts';
import type { AssistantTurn, MultiTurnJudgeAnalysisResult } from './prompts';

export interface MultiTurnJudgeScorerOptions {
  /** Scale applied to the final score. Defaults to 1, so the scorer returns 1 or 0. */
  scale?: number;
}

const analyzeOutputSchema = compileSchema(
  z.object({
    satisfied: z.boolean(),
    reasoning: z.string(),
  }),
);

/**
 * Collect every assistant turn from the run output, in order. Multi-turn `runEvals` accumulates the
 * output messages of every turn into `run.output`, so this is the whole conversation the agent
 * produced. Empty assistant messages (for example, a turn that only carried tool calls) are dropped
 * so they do not show up as blank turns in the prompt. Output that is neither a message array nor a
 * string yields no turns, so the judge grades an empty transcript instead of throwing.
 */
function getAssistantTurns(output: ScorerRunOutputForLLMJudge): AssistantTurn[] {
  if (isScorerRunOutputForAgent(output)) {
    return extractAgentResponseMessages(output)
      .map(text => text.trim())
      .filter(text => text.length > 0)
      .map(text => ({ text }));
  }

  if (typeof output === 'string' && output.trim().length > 0) {
    return [{ text: output.trim() }];
  }

  return [];
}

/**
 * Creates an LLM-as-judge scorer that grades a **whole multi-turn conversation** against a single
 * plain-English criterion and returns a **binary** score: `1` when the criterion is satisfied,
 * otherwise `0`.
 *
 * Unlike the other prebuilt LLM judges, which read a single assistant message, this scorer reads
 * every assistant turn accumulated in `run.output`, so it works with the multi-turn `inputs` form of
 * `runEvals`:
 *
 * @example
 * ```typescript
 * import { runEvals } from '@mastra/core/evals';
 * import { createMultiTurnJudgeScorer } from '@mastra/evals/scorers/prebuilt';
 *
 * const result = await runEvals({
 *   data: [{ inputs: ["How's the weather in London?", 'And Paris?', 'Should I pack an umbrella?'] }],
 *   target: weatherAgent,
 *   scorers: [
 *     {
 *       scorer: createMultiTurnJudgeScorer({
 *         model: 'anthropic/claude-haiku-4-5',
 *         criterion: 'The agent gave forecasts for London and Paris, and weather-appropriate packing advice.',
 *       }),
 *       threshold: 1,
 *     },
 *   ],
 * });
 * ```
 *
 * To persist scores, register an instance under the same id on the Mastra instance. Only the id is
 * used to resolve scorer metadata, so the registered instance's `criterion` can be a placeholder.
 */
export function createMultiTurnJudgeScorer({
  model,
  criterion,
  options,
}: {
  model: MastraModelConfig;
  /** What the conversation must satisfy, in plain English. */
  criterion: string;
  options?: MultiTurnJudgeScorerOptions;
}) {
  const scale = options?.scale ?? 1;

  if (!Number.isFinite(scale)) {
    throw new Error('createMultiTurnJudgeScorer: options.scale must be a finite number');
  }

  return createScorer<ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge>({
    id: 'multi-turn-judge-scorer',
    name: 'Multi-turn Judge (LLM)',
    description: 'Grades every assistant turn of a conversation against a plain-English criterion',
    judge: {
      model,
      instructions: MULTI_TURN_JUDGE_INSTRUCTIONS,
    },
  })
    .analyze({
      description: 'Judge the whole conversation against the criterion',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run }) => createAnalyzePrompt({ criterion, turns: getAssistantTurns(run.output) }),
    })
    .generateScore(({ results }) => {
      const analysis = results.analyzeStepResult as MultiTurnJudgeAnalysisResult | undefined;

      return (analysis?.satisfied ? 1 : 0) * scale;
    })
    .generateReason(({ results, score }) => {
      const analysis = results.analyzeStepResult as MultiTurnJudgeAnalysisResult | undefined;

      return formatMultiTurnJudgeReason({ score, criterion, analysis });
    });
}
