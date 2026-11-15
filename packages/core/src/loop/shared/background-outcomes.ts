import type { MessageList } from '../../agent/message-list';

/** Tool call id to the ids of the background tasks behind it whose final outcome is in the conversation. */
export type BackgroundOutcomes = Map<string, Set<string>>;

/**
 * Records which background tasks already have their final outcome (result or failure) in the run's
 * response messages. Take it before building the prompt: an outcome that lands while the prompt is
 * built or processed may be missing from what the model receives, so it must not count.
 *
 * Reads the persisted response view because a memory save drains the unsaved one. Tasks in older
 * thread history belong to the turns that ran them and are skipped.
 *
 * @param messageList - The run's message list.
 * @returns The outcomes by tool call id. Empty when no background task has finished.
 */
export function snapshotBackgroundOutcomes(messageList: MessageList): BackgroundOutcomes {
  const outcomes: BackgroundOutcomes = new Map();
  for (const message of messageList.getPersisted.response.db()) {
    if (message.role !== 'assistant') continue;
    for (const part of message.content?.parts ?? []) {
      if (part.type !== 'tool-invocation') continue;
      const task = part.providerMetadata?.mastra?.backgroundTask as { taskId?: string; status?: string } | undefined;
      // `running` marks the placeholder a deferred call returns; only a terminal status means the
      // real outcome replaced it.
      if (!task?.taskId || (task.status !== 'completed' && task.status !== 'failed')) continue;
      const toolCallId = part.toolInvocation.toolCallId;
      const taskIds = outcomes.get(toolCallId) ?? new Set<string>();
      taskIds.add(task.taskId);
      outcomes.set(toolCallId, taskIds);
    }
  }
  return outcomes;
}

type PromptLike = ReadonlyArray<{ content: unknown }>;

/** Each tool result in a prompt as its tool call id and serialized output. */
function promptToolResults(prompt: PromptLike): Array<{ toolCallId: string; output: string }> {
  const results: Array<{ toolCallId: string; output: string }> = [];
  for (const message of prompt) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content as Array<Record<string, unknown>>) {
      if (part?.type !== 'tool-result' || typeof part.toolCallId !== 'string') continue;
      // `output` on current prompt versions, `result` on older ones. Provider options are left out
      // because processors add markers such as cache control to them without touching the result.
      results.push({ toolCallId: part.toolCallId, output: JSON.stringify(part.output ?? part.result) ?? '' });
    }
  }
  return results;
}

/**
 * Lists the background tasks from `outcomes` whose results the model receives. An `untilIdle`
 * stream reads this to skip its follow-up request for a task the model has already seen. A request
 * processor may have dropped or replaced a result, so a result counts only when `prompt` still
 * carries it as `builtPrompt` did.
 *
 * @param outcomes - Snapshot taken by {@link snapshotBackgroundOutcomes} before the prompt was built.
 * @param builtPrompt - The prompt built from the message list, before request processors ran.
 * @param prompt - The prompt sent to the model, after request processors ran.
 * @returns The task ids, without duplicates.
 */
export function backgroundOutcomesInPrompt(
  outcomes: BackgroundOutcomes,
  builtPrompt: PromptLike,
  prompt: PromptLike,
): string[] {
  if (outcomes.size === 0) return [];
  const built = new Set(
    promptToolResults(builtPrompt)
      .filter(result => outcomes.has(result.toolCallId))
      .map(result => `${result.toolCallId}\n${result.output}`),
  );
  const taskIds = new Set<string>();
  for (const result of promptToolResults(prompt)) {
    if (!built.has(`${result.toolCallId}\n${result.output}`)) continue;
    for (const taskId of outcomes.get(result.toolCallId) ?? []) taskIds.add(taskId);
  }
  return [...taskIds];
}
