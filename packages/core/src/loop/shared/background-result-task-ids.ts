import type { MessageList } from '../../agent/message-list';

/**
 * Lists the background tasks whose final outcome (result or failure) a model request is about to
 * carry. An `untilIdle` stream reads this to skip its follow-up request for a task once the model
 * has already seen the task's outcome.
 *
 * Only the run's own response messages are scanned: tasks in older thread history belong to the
 * turns that ran them. A tool call counts only when its result is still in `prompt`, because a
 * request processor may have dropped it before the call.
 *
 * @param messageList - The run's message list, after background results were reconciled into it.
 * @param prompt - The prompt sent to the model, after request processors ran.
 * @returns The task ids, without duplicates. Empty when the prompt carries no background outcome.
 */
export function collectBackgroundResultTaskIds(
  messageList: MessageList,
  prompt: ReadonlyArray<{ content: unknown }>,
): string[] {
  const promptToolCallIds = new Set<string>();
  for (const message of prompt) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content as Array<{ type?: unknown; toolCallId?: unknown }>) {
      if (part?.type === 'tool-result' && typeof part.toolCallId === 'string') promptToolCallIds.add(part.toolCallId);
    }
  }
  if (promptToolCallIds.size === 0) return [];

  const taskIds = new Set<string>();
  for (const message of messageList.get.response.db()) {
    if (message.role !== 'assistant') continue;
    for (const part of message.content?.parts ?? []) {
      if (part.type !== 'tool-invocation' || !promptToolCallIds.has(part.toolInvocation.toolCallId)) continue;
      const task = (part.providerMetadata as { mastra?: { backgroundTask?: { taskId?: string; status?: string } } })
        ?.mastra?.backgroundTask;
      // `running` marks the placeholder a deferred call returns; only a terminal status means the
      // real outcome replaced it.
      if (task?.taskId && (task.status === 'completed' || task.status === 'failed')) taskIds.add(task.taskId);
    }
  }
  return [...taskIds];
}
