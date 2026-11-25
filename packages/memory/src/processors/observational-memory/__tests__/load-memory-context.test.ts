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

describe('history batch insertion', () => {
  it.each([false, true])('places tied live input exactly like sequential loads (reverse: %s)', async reverse => {
    const history = Array.from({ length: 80 }, (_, i) =>
      message(`stored-${i}`, i % 2 ? 'assistant' : 'user', `Stored fact ${i}`, i + 1),
    );
    history.push(structuredClone(history[10]!));
    if (reverse) history.reverse();
    history.push(message('system', 'system', 'Excluded stored system prompt', 0));
    const incoming = message('incoming', 'user', 'Current request', 80);
    incoming.content.parts = [{ type: 'text', text: 'Current request', createdAt: 80 }];
    const expected = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    expected.add(structuredClone(incoming), 'input');
    for (const item of structuredClone(history)) {
      if (item.role !== 'system') expected.add(item, 'memory');
    }
    const actual = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    actual.add(structuredClone(incoming), 'input');
    const add = vi.spyOn(actual, 'add');
    const { memory } = context(structuredClone(history));
    await loadMemoryContextMessages({ memory, messageList: actual, threadId: 'thread', resourceId: 'resource' });
    expect(actual.get.all.db()).toEqual(expected.get.all.db());
    expect(actual.get.input.db()).toEqual(expected.get.input.db());
    expect(actual.get.response.db()).toEqual([]);
    expect(actual.get.all.db().map(item => item.id)).not.toContain('system');
    expect(actual.get.all.db().filter(item => item.id === 'stored-10')).toHaveLength(1);
    expect(add).toHaveBeenCalledTimes(1);
    expect(actual.drainUnsavedMessagesForSave().messages.map(item => item.id)).toEqual(['incoming']);
  });
});

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
    expect(list.get.all.db()).toHaveLength(1);
    expect(list.get.all.db()[0]).toMatchObject({
      id: 'assistant',
      createdAt: pending.createdAt,
      content: {
        parts: [
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
        ],
      },
    });
    expect(list.get.input.db()).toHaveLength(1);
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

  it('keeps the stored content and metadata when the client resends a stored message', async () => {
    const incoming = message('same', 'user', 'Updated content', 1);
    incoming.content.metadata = { clientRevision: 2 };
    const stored = message('same', 'user', 'Old content', 1);
    const list = new MessageList({ threadId: 'thread', resourceId: 'resource' });
    list.add(incoming, 'input');
    const { memory } = context([stored]);
    await loadMemoryContextMessages({ memory, messageList: list, threadId: 'thread', resourceId: 'resource' });
    const messages = list.get.all.db();
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content.parts).toEqual([{ type: 'text', text: 'Old content' }]);
    expect(messages[0]!.content.metadata).toBeUndefined();
  });
});
