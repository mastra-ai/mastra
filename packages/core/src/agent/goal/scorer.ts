import { z } from 'zod';

import type { AgentMemoryOption, ToolsInput } from '../../agent/types';
import { createScorer } from '../../evals';
import type { ScorerJudgeConfig } from '../../evals';
import type { MastraModelConfig } from '../../llm';
import type { StreamCompletionContext } from '../../loop/network/validation';
import type { Mastra } from '../../mastra';
import type { MastraMemory } from '../../memory';
import type { RequestContext } from '../../request-context';
import type { MastraDBMessage, MastraMessageContentV2, MastraMessagePart } from '../message-list';
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

type GoalScorerInput = Partial<Pick<StreamCompletionContext, 'currentText' | 'originalTask' | 'messages'>>;

type GoalScorerRun = {
  input?: GoalScorerInput;
  output?: string;
};

type TextMessagePart = Extract<MastraMessagePart, { type: 'text' }>;

function getOutputText(run: GoalScorerRun): string {
  // The goal step passes the in-progress text on `run.input.currentText`
  // (via StreamCompletionContext), mirroring isTaskComplete.
  return run.input?.currentText ?? run.output ?? '';
}

function getObjectiveText(run: GoalScorerRun): string {
  return run.input?.originalTask ?? '';
}

function truncateForJudge(value: string): string {
  return value.length > 4000 ? `${value.slice(0, 4000)}\n...[truncated]` : value;
}

function isTextPart(part: MastraMessagePart): part is TextMessagePart {
  return part.type === 'text';
}

function extractTextContent(content: MastraMessageContentV2): string {
  return (content.parts ?? [])
    .filter(isTextPart)
    .map(part => part.text)
    .filter(Boolean)
    .join('\n');
}

function hasUserSignalMetadata(signal: unknown): signal is { type: 'user' } {
  return (
    signal !== null &&
    typeof signal === 'object' &&
    !Array.isArray(signal) &&
    'type' in signal &&
    signal.type === 'user'
  );
}

function isUserMessageForGoal(message: MastraDBMessage): boolean {
  return (
    message.role === 'user' || (message.role === 'signal' && hasUserSignalMetadata(message.content.metadata?.signal))
  );
}

function isSyntheticReminderContent(content: string): boolean {
  const trimmed = content.trimStart();
  return trimmed.startsWith('<system-reminder') || trimmed.startsWith('<current-objective');
}

function isLatestUserCandidateForGoal(message: MastraDBMessage): boolean {
  if (!isUserMessageForGoal(message)) return false;
  const textContent = extractTextContent(message.content);
  return textContent.trim() !== '' && !isSyntheticReminderContent(textContent);
}

function getLatestUserContext(run: GoalScorerRun): {
  lastUserContent: string | null;
  assistantStepsSinceLastUser: number;
} {
  const messages = run.input?.messages ?? [];
  const lastUserIndex = messages.findLastIndex(isLatestUserCandidateForGoal);

  const lastUserContent = lastUserIndex >= 0 ? extractTextContent(messages[lastUserIndex]!.content) : null;
  const assistantStepsSinceLastUser =
    lastUserIndex >= 0 ? messages.slice(lastUserIndex + 1).filter(msg => msg.role === 'assistant').length : 0;

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
  maxSteps,
  mastra,
  requestContext,
}: {
  judgeModel: MastraModelConfig;
  prompt?: string;
  tools?: ToolsInput;
  memory?: MastraMemory;
  defaultMemoryOptions?: AgentMemoryOption;
  onStream?: ScorerJudgeConfig['onStream'];
  maxSteps?: number;
  mastra?: Mastra;
  requestContext?: RequestContext<any>;
}) {
  const hasTools = !!tools && Object.keys(tools).length > 0;
  const instructions = prompt ?? DEFAULT_GOAL_JUDGE_PROMPT;
  const scorer = createScorer({
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
      ...(maxSteps ? { maxSteps } : {}),
      ...(requestContext ? { requestContext } : {}),
    },
  });
  if (mastra) {
    scorer.__registerMastra(mastra);
  }
  return scorer
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
