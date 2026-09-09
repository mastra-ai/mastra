import type { MessageList } from '@mastra/core/agent';
import type { MemoryRunState } from '@mastra/core/memory';

import type { MemoryContextProvider } from '../processor';

export async function loadMemoryContextMessages({
  memory,
  messageList,
  threadId,
  resourceId,
  runState,
}: {
  memory: MemoryContextProvider;
  messageList: MessageList;
  threadId: string;
  resourceId?: string;
  runState?: MemoryRunState;
}): Promise<Awaited<ReturnType<MemoryContextProvider['getContext']>>> {
  const ctx = await memory.getContext({ threadId, resourceId, runState });

  // Historical context must not overwrite newer messages already supplied to this run.
  const existingIds = new Set(
    messageList.get.all
      .db()
      .map(message => message.id)
      .filter(Boolean),
  );
  for (const msg of ctx.messages) {
    if (msg.role !== 'system' && (!msg.id || !existingIds.has(msg.id))) {
      messageList.add(msg, 'memory');
    }
  }

  return ctx;
}
