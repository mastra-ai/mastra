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

/**
 * Lists the background tasks from `outcomes` whose tool results the prompt carries. An `untilIdle`
 * stream reads this to skip its follow-up request for a task the model has already seen. A request
 * processor may have dropped a result, so only results still in `prompt` count.
 *
 * @param outcomes - Snapshot taken by {@link snapshotBackgroundOutcomes} before the prompt was built.
 * @param prompt - The prompt sent to the model, after request processors ran.
 * @returns The task ids, without duplicates.
 */
export function backgroundOutcomesInPrompt(
  outcomes: BackgroundOutcomes,
  prompt: ReadonlyArray<{ content: unknown }>,
): string[] {
  if (outcomes.size === 0) return [];
  const taskIds = new Set<string>();
  for (const message of prompt) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content as Array<{ type?: unknown; toolCallId?: unknown }>) {
      if (part?.type !== 'tool-result' || typeof part.toolCallId !== 'string') continue;
      for (const taskId of outcomes.get(part.toolCallId) ?? []) taskIds.add(taskId);
    }
  }
  return [...taskIds];
}
