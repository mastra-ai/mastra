import { z } from 'zod';

import type { AgentMemoryOption, ToolsInput } from '../../agent/types';
import { createScorer } from '../../evals';
import type { ScorerJudgeConfig } from '../../evals';
import type { MastraModelConfig } from '../../llm';
import type { MastraMemory } from '../../memory';
import { DEFAULT_GOAL_JUDGE_PROMPT, GOAL_SCORE_WAITING, GOAL_SCORER_ID } from './objective';

// The goal scorer is an LLM-as-judge that grades the agent's latest output
// against the objective and returns a tri-state decision mapped to a score:
//   - "done"     -> score 1   (goal complete; loop stops)
//   - "continue" -> score 0   (keep working; reason is the next instruction)
//   - "waiting"  -> score GOAL_SCORE_WAITING (explicit user checkpoint; the goal
//                   step stops the auto-loop but keeps the record active)
// The generic completion reducer only treats `score === 1` as complete, so both
// "continue" and "waiting" read as "not complete" there; the goal step inspects
// the exact `waiting` score to distinguish a waiting goal from one that iterates.

const analyzeOutputSchema = z.object({
  decision: z
    .enum(['done', 'continue', 'waiting'])
    .describe(
      'Whether the goal is done, should continue autonomously, or is at an explicit user checkpoint required by the goal',
    ),
  reason: z.string().describe('Brief explanation of what was accomplished or what remains to be done'),
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

function truncateForJudge(value: string): string {
  return value.length > 4000 ? `${value.slice(0, 4000)}\n...[truncated]` : value;
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return null;
      })
      .filter((text: string | null): text is string => Boolean(text))
      .join('\n');
  }
  return String(content ?? '');
}

function getLatestUserContext(run: { input?: unknown }): { lastUserContent: string | null; assistantStepsSinceLastUser: number } {
  const input = run.input as Record<string, unknown> | undefined;
  const messages = Array.isArray(input?.messages) ? input.messages : [];
  let lastUserIndex = -1;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as any;
    if (msg?.role === 'user') {
      lastUserIndex = i;
      break;
    }
  }

  const lastUserContent = lastUserIndex >= 0 ? extractTextContent((messages[lastUserIndex] as any)?.content) : null;
  const assistantStepsSinceLastUser =
    lastUserIndex >= 0 ? messages.slice(lastUserIndex + 1).filter((msg: any) => msg?.role === 'assistant').length : 0;

  return { lastUserContent, assistantStepsSinceLastUser };
}

/**
 * Build the default goal scorer: an LLM judge using `judgeModel` and the
 * effective `prompt` (the ported MastraCode judge prompt unless overridden).
 * The objective and the agent's latest output are passed by the goal step on the
 * scorer run input (`originalTask`/`currentText`).
 *
 * When `tools` is provided, the judge agent can call them (read-only verification
 * tools) before deciding, matching the original MastraCode judge's tool surface.
 */
export function createGoalScorer({
  judgeModel,
  prompt,
  tools,
  memory,
  defaultMemoryOptions,
  onStream,
}: {
  judgeModel: MastraModelConfig;
  prompt?: string;
  tools?: ToolsInput;
  memory?: MastraMemory;
  defaultMemoryOptions?: AgentMemoryOption;
  onStream?: ScorerJudgeConfig['onStream'];
}) {
  const hasTools = !!tools && Object.keys(tools).length > 0;
  const instructions = prompt ?? DEFAULT_GOAL_JUDGE_PROMPT;
  return createScorer({
    id: GOAL_SCORER_ID,
    name: 'Goal (LLM)',
    description:
      "Judges the agent's objective status, returning 1 when complete, 0 to keep working, and a waiting score for an explicit user checkpoint.",
    judge: {
      model: judgeModel,
      instructions,
      ...(hasTools ? { tools } : {}),
      ...(memory ? { memory } : {}),
      ...(defaultMemoryOptions ? { defaultMemoryOptions } : {}),
      ...(onStream ? { onStream } : {}),
    },
  })
    .analyze({
      description: 'Judge the latest output against the objective',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run }) => {
        const objective = getObjectiveText(run);
        const output = getOutputText(run);
        const { lastUserContent, assistantStepsSinceLastUser } = getLatestUserContext(run);
        const recentUser = lastUserContent
          ? `\n\nLatest user message:\n${truncateForJudge(lastUserContent)}\n\nAssistant steps since that user message: ${assistantStepsSinceLastUser}`
          : '';
        return `Goal: ${objective}${recentUser}\n\nLatest assistant message:\n${output}`;
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
