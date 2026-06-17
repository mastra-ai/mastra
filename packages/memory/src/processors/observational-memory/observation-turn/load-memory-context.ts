import type { MessageList } from '@mastra/core/agent';

import type { MemoryContextProvider } from '../processor';

export async function loadMemoryContextMessages({
  memory,
  messageList,
  threadId,
  resourceId,
}: {
  memory: MemoryContextProvider;
  messageList: MessageList;
  threadId: string;
  resourceId?: string;
}): Promise<Awaited<ReturnType<MemoryContextProvider['getContext']>>> {
  const ctx = await memory.getContext({ threadId, resourceId });

  for (const msg of ctx.messages) {
    if (msg.role !== 'system') {
      messageList.add(msg, 'memory');
    }
  }

  return ctx;
}
