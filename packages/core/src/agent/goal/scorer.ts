import { z } from 'zod';

import type { ToolsInput } from '../../agent/types';
import { createScorer } from '../../evals';
import type { MastraModelConfig } from '../../llm';
import { DEFAULT_GOAL_JUDGE_PROMPT, GOAL_SCORE_WAITING } from './objective';

// The goal scorer is an LLM-as-judge that grades the agent's latest output
// against the objective and returns a tri-state decision mapped to a score:
//   - "done"     -> score 1   (goal complete; loop stops)
//   - "continue" -> score 0   (keep working; reason is the next instruction)
//   - "waiting"  -> score GOAL_SCORE_WAITING (explicit user checkpoint; the goal
//                   step parks the objective as `paused` with the reason)
// The generic completion reducer only treats `score === 1` as complete, so both
// "continue" and "waiting" read as "not complete" there; the goal step inspects
// the exact `waiting` score to distinguish a parked goal from one that iterates.

const analyzeOutputSchema = z.object({
  decision: z
    .enum(['done', 'continue', 'waiting'])
    .describe(
      'done = goal fully achieved; continue = keep working autonomously; waiting = the goal explicitly asks to stop and wait for the user.',
    ),
  reason: z
    .string()
    .describe(
      'Brief explanation. For "continue", an instruction for what the assistant should do next. For "waiting", a note on what is being waited on from the user.',
    ),
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
 * Summarize the tool calls/results from the latest turn (passed by the goal step
 * on the scorer run input) so the judge sees what the agent actually did, not
 * just the prose. Truncated to keep the judge prompt bounded.
 */
function getToolActivityText(run: { input?: unknown }): string {
  const input = run.input as Record<string, unknown> | undefined;
  const toolCalls = Array.isArray(input?.toolCalls) ? (input!.toolCalls as Array<{ name?: unknown }>) : [];
  if (toolCalls.length === 0) return '';
  const names = toolCalls
    .map(tc => (typeof tc?.name === 'string' ? tc.name : undefined))
    .filter((n): n is string => !!n);
  if (names.length === 0) return '';
  return names.join(', ');
}

/**
 * Appended to the judge instructions only when the judge has verification tools.
 * Without this, a tool-less judge would be told to use tools it does not have.
 */
const VERIFY_WITH_TOOLS_CLAUSE = `

You have read-only verification tools available. Before deciding, use them to independently confirm the assistant's claims against the actual workspace state (e.g. read files, search content) rather than trusting the assistant's prose alone. Do not modify anything. Once you have verified, return your decision.`;

/**
 * Build the default goal scorer: an LLM judge using `judgeModel` and the
 * effective `prompt` (the ported MastraCode judge prompt unless overridden).
 * The objective and the agent's latest output are passed by the goal step on the
 * scorer run input (`originalTask`/`currentText`).
 *
 * When `tools` is provided, the judge agent can call them (read-only verification
 * tools) before deciding, restoring the original MastraCode judge's ability to
 * inspect the workspace and verify the work was actually done — not just grade
 * the assistant's text. The judge prompt is augmented to instruct tool use only
 * in that case.
 */
export function createGoalScorer({
  judgeModel,
  prompt,
  tools,
}: {
  judgeModel: MastraModelConfig;
  prompt?: string;
  tools?: ToolsInput;
}) {
  const hasTools = !!tools && Object.keys(tools).length > 0;
  const instructions = (prompt ?? DEFAULT_GOAL_JUDGE_PROMPT) + (hasTools ? VERIFY_WITH_TOOLS_CLAUSE : '');
  return createScorer({
    id: 'goal-scorer',
    name: 'Goal (LLM)',
    description:
      'Judges the agent\'s objective status, returning 1 when complete, 0 to keep working, and a waiting score for an explicit user checkpoint.',
    judge: {
      model: judgeModel,
      instructions,
      ...(hasTools ? { tools } : {}),
    },
  })
    .analyze({
      description: 'Judge the latest output against the objective',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run }) => {
        const objective = getObjectiveText(run);
        const output = getOutputText(run);
        const toolActivity = getToolActivityText(run);
        const toolActivityLine = toolActivity ? `\n\nTOOLS THE ASSISTANT USED THIS TURN: ${toolActivity}` : '';
        return `GOAL:\n${objective}\n\nASSISTANT'S LATEST OUTPUT:\n${output || '(no assistant output yet)'}${toolActivityLine}\n\nDecide the goal's status. Respond with "decision" (one of "done", "continue", "waiting") and "reason" (a brief explanation; for "continue" phrase it as an instruction for what the assistant should do next, for "waiting" note what you are waiting on the user for).`;
      },
    })
    .generateScore(({ results }) => {
      const analysis = results.analyzeStepResult as GoalAnalysis | undefined;
      switch (analysis?.decision) {
        case 'done':
          return 1;
        case 'waiting':
          return GOAL_SCORE_WAITING;
        default:
          return 0;
      }
    })
    .generateReason(({ results }) => {
      const analysis = results.analyzeStepResult as GoalAnalysis | undefined;
      return analysis?.reason ?? '';
    });
}
