import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it, vi } from 'vitest';
import { loadMemoryContextMessages } from '../observation-turn/load-memory-context';
import type { MemoryContextProvider } from '../processor';

function message(id: string, role: MastraDBMessage['role'], text: string, time: number): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date(time),
    threadId: 'thread',
    resourceId: 'resource',
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

function context(messages: MastraDBMessage[]) {
  const result = {
    messages,
    systemMessage: 'System context',
    hasObservations: false,
    omRecord: null,
    continuationMessage: undefined,
    otherThreadsContext: undefined,
  };
  const memory: MemoryContextProvider = { getContext: vi.fn(async () => result), persistMessages: vi.fn() };
  return { memory, result };
}

describe('22573 history loader', () => {
  it('preserves incoming same-ID client results without duplicating messages', async () => {
    const pending = message('assistant', 'assistant', '', 2);
    pending.content.parts = [
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'call', toolCallId: 'color', toolName: 'changeColor', args: { color: 'green' } },
      },
    ];
    const incoming = structuredClone(pending);
    incoming.content.parts = [
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'color',
          toolName: 'changeColor',
          args: { color: 'green' },
          result: { applied: true },
        },
      },
    ];
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(incoming, 'input');
    const { memory, result } = context([pending]);
    expect(
      await loadMemoryContextMessages({ memory, messageList: list, threadId: 'thread', resourceId: 'resource' }),
    ).toBe(result);
    expect(list.get.all.db()).toEqual([incoming]);
    expect(memory.persistMessages).not.toHaveBeenCalled();
  });

  it('keeps unrelated historical messages ordered and excludes historical system messages', async () => {
    const earlier = message('earlier', 'user', 'Earlier', 1);
    const later = message('later', 'assistant', 'Later', 2);
    const incoming = message('incoming', 'user', 'Now', 3);
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(incoming, 'input');
    const { memory, result } = context([message('system', 'system', 'Do not insert', 0), earlier, later]);
    expect(
      await loadMemoryContextMessages({ memory, messageList: list, threadId: 'thread', resourceId: 'resource' }),
    ).toBe(result);
    expect(list.get.all.db().map(message => message.id)).toEqual(['earlier', 'later', 'incoming']);
    expect(memory.persistMessages).not.toHaveBeenCalled();
  });

  it('preserves incoming content and metadata beyond tool state', async () => {
    const incoming = message('same', 'user', 'Updated content', 1);
    incoming.content.metadata = { clientRevision: 2 };
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(incoming, 'input');
    const { memory } = context([message('same', 'user', 'Old content', 1)]);
    await loadMemoryContextMessages({ memory, messageList: list, threadId: 'thread', resourceId: 'resource' });
    expect(list.get.all.db()).toEqual([incoming]);
  });
});
