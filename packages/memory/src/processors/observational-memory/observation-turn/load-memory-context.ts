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

  const messages = ctx.messages.filter(msg => msg.role !== 'system');
  if (messages.length) messageList.add(messages, 'memory');

  return ctx;
}
