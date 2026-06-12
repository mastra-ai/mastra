import { z } from 'zod';

import { createScorer } from '../../evals';
import type { MastraModelConfig } from '../../llm';
import { DEFAULT_GOAL_JUDGE_PROMPT } from './objective';

// The goal scorer is an LLM-as-judge that grades the agent's latest output
// against the objective and returns a **binary** score: 1 when the goal is
// complete, else 0. `isTaskComplete`/the goal step treat `score === 1` as
// complete and inject the reason back as feedback so the agent iterates.

const analyzeOutputSchema = z.object({
  complete: z.boolean().describe('Whether the goal has been fully achieved'),
  reason: z
    .string()
    .describe('Brief explanation. When not complete, an instruction for what the assistant should do next.'),
});

type GoalAnalysis = z.infer<typeof analyzeOutputSchema>;

function getOutputText(run: { input?: unknown; output?: unknown }): string {
  // The goal step passes the in-progress text on `run.input.currentText`
  // (via StreamCompletionContext), mirroring isTaskComplete.
  const input = run.input as Record<string, unknown> | undefined;
  if (input && typeof input.currentText === 'string') return input.currentText;
  return typeof run.output === 'string' ? run.output : '';
}

function getObjectiveText(run: { input?: unknown }): string {
  const input = run.input as Record<string, unknown> | undefined;
  if (input && typeof input.originalTask === 'string') return input.originalTask;
  return '';
}

/**
 * Build the default goal scorer: an LLM judge using `judgeModel` and the
 * effective `prompt` (the ported MastraCode judge prompt unless overridden).
 * The objective and the agent's latest output are passed by the goal step on the
 * scorer run input (`originalTask`/`currentText`).
 */
export function createGoalScorer({ judgeModel, prompt }: { judgeModel: MastraModelConfig; prompt?: string }) {
  return createScorer({
    id: 'goal-scorer',
    name: 'Goal (LLM)',
    description: 'Judges whether the agent has achieved its objective, returning 1 when complete and 0 otherwise.',
    judge: {
      model: judgeModel,
      instructions: prompt ?? DEFAULT_GOAL_JUDGE_PROMPT,
    },
  })
    .analyze({
      description: 'Judge the latest output against the objective',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run }) => {
        const objective = getObjectiveText(run);
        const output = getOutputText(run);
        return `GOAL:\n${objective}\n\nASSISTANT'S LATEST OUTPUT:\n${output || '(no assistant output yet)'}\n\nDecide whether the goal has been fully achieved. Respond with "complete" (boolean) and "reason" (a brief explanation; when not complete, phrase it as an instruction for what the assistant should do next).`;
      },
    })
    .generateScore(({ results }) => {
      const analysis = results.analyzeStepResult as GoalAnalysis | undefined;
      return analysis?.complete ? 1 : 0;
    })
    .generateReason(({ results }) => {
      const analysis = results.analyzeStepResult as GoalAnalysis | undefined;
      return analysis?.reason ?? '';
    });
}
