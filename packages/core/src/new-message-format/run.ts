import type { LanguageModel, ToolSet } from '@internal/ai-v7';
import { stepCountIs, streamText } from '@internal/ai-v7';
import { streamActions } from './from-ai-sdk';
import { createActionIdGenerator } from './storage';
import type { ListActionsQuery } from './storage';
import type { ActionDraft, AgentInput } from './to-actions';
import { toActions } from './to-actions';
import { toModelMessages } from './to-model-messages';
import type { ActionBase, MastraAction, PersistableAction } from './types';
import { isPersistable } from './types';

export type ActionStore = {
  saveActions(args: { actions: PersistableAction[] }): Promise<void>;
  listActions(query: ListActionsQuery): Promise<PersistableAction[]>;
  getLatestActionId(threadId: string): Promise<string | null>;
};

export type RunAgentOptions = {
  model: Exclude<LanguageModel, string>;
  instructions?: string;
  tools?: ToolSet;
  input?: AgentInput;
  /** Actions appended after the input, e.g. a tool approval response when resuming. */
  append?: ActionDraft[];
  threadId: string;
  resourceId?: string;
  runId?: string;
  memory?: ActionStore;
  /** Prior actions to recall from the thread; defaults to all of them. */
  recall?: (history: PersistableAction[]) => PersistableAction[];
  maxTurns?: number;
  abortSignal?: AbortSignal;
  generateId?: () => string;
};

/** Recall window keeping the last `count` runs whole, so tool calls are never split from their results. */
export function lastRuns(count: number): (history: PersistableAction[]) => PersistableAction[] {
  return history => {
    const runs = [...new Set(history.map(a => a.runId))].slice(-count);
    return count > 0 ? history.filter(a => runs.includes(a.runId)) : [];
  };
}

/**
 * One agent run over actions: input → actions, thread recall → prompt, model stream → actions.
 * Every action is yielded; persistable ones are saved at each `turn-end` and when the run finishes.
 */
export async function* runAgent(options: RunAgentOptions): AsyncGenerator<MastraAction> {
  const { model, threadId, resourceId, memory } = options;
  const runId = options.runId ?? crypto.randomUUID();
  const generateId = options.generateId ?? (await createActionIdGenerator(memory, threadId));
  const modelId = typeof model === 'object' && 'modelId' in model ? model.modelId : 'unknown';

  const history = memory ? await memory.listActions({ threadId }) : [];
  const recalled = options.recall ? options.recall(history) : history;

  const { system, actions: drafts } = toActions(options.input ?? []);
  const stamp = (): ActionBase => ({
    id: generateId(),
    threadId,
    createdAt: new Date(),
    runId,
    ...(resourceId !== undefined ? { resourceId } : {}),
  });
  const input = [...drafts, ...(options.append ?? [])].map(draft => ({ ...stamp(), ...draft }) as PersistableAction);

  let pending: PersistableAction[] = [...input];
  const flush = async () => {
    if (!memory || pending.length === 0) return;
    const batch = pending;
    pending = [];
    await memory.saveActions({ actions: batch });
  };

  try {
    for (const action of input) yield action;

    // A run with several approval requests resumes only once every one of them has an answer.
    const runLog = [...history.filter(a => a.runId === runId), ...input];
    const answered = new Set(runLog.flatMap(a => (a.type === 'tool-approval-responded' ? [a.approvalId] : [])));
    if (runLog.some(a => a.type === 'tool-approval-requested' && !answered.has(a.approvalId))) return;

    const instructions = [options.instructions, ...system].filter(Boolean).join('\n\n');
    const result = streamText({
      model,
      ...(instructions ? { system: instructions } : {}),
      messages: toModelMessages([...recalled, ...input]),
      tools: options.tools,
      stopWhen: stepCountIs(options.maxTurns ?? 5),
      abortSignal: options.abortSignal,
    });

    let ended = false;
    for await (const action of streamActions(result.fullStream, { threadId, resourceId, runId, modelId, generateId })) {
      if (isPersistable(action)) pending.push(action);
      yield action;
      if (action.type === 'run-end' || action.type === 'run-aborted') ended = true;
      if (action.type === 'turn-end') await flush();
    }
    // A provider error ends the stream without a finish part; every run still closes.
    if (!ended) {
      const runEnd: PersistableAction = { ...stamp(), type: 'run-end', finishReason: 'error', usage: {} };
      pending.push(runEnd);
      yield runEnd;
    }
  } finally {
    await flush();
  }
}
