import { describe, expect, it, vi } from 'vitest';

import type { MastraDBMessage } from '../agent/message-list';
import { persistGeneratedMessages, persistMessagesWithThreadCreation } from './internal';
import { MockMemory } from './mock';

const message = (id: string): MastraDBMessage => ({
  id,
  role: 'assistant',
  type: 'text',
  threadId: 'thread',
  resourceId: 'resource',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  content: { format: 2, parts: [{ type: 'text', text: id }] },
});

describe('persistGeneratedMessages', () => {
  it('delegates an empty generated-ID set to ordinary persistence', async () => {
    const memory = new MockMemory();
    const save = vi.spyOn(memory, 'saveMessages').mockResolvedValue({ messages: [message('one')] });

    await persistGeneratedMessages(
      memory,
      {
        messages: [message('one')],
        thread: {
          id: 'thread',
          resourceId: 'resource',
          title: '',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      [],
    );

    expect(save).toHaveBeenCalledWith({ messages: [message('one')] });
  });

  it.each([
    { messages: [message('one'), message('one')], ids: ['one'], error: 'every input message ID' },
    { messages: [message('one')], ids: ['one', 'one'], error: 'duplicate generated message IDs' },
    { messages: [message('one')], ids: ['missing'], error: 'unknown generated message ID' },
  ])('rejects malformed generated-ID provenance atomically', async ({ messages, ids, error }) => {
    const memory = new MockMemory();
    const save = vi.spyOn(memory, 'saveMessages');

    await expect(persistGeneratedMessages(memory, { messages }, ids)).rejects.toThrow(error);

    expect(save).not.toHaveBeenCalled();
  });

  it('uses the concrete protected hook without relying on module identity', async () => {
    class HookMemory extends MockMemory {
      calls: readonly string[][] = [];

      protected override async __mastraPersistGeneratedMessages(
        input: Parameters<MockMemory['saveMessages']>[0],
        generatedMessageIds: readonly string[],
      ) {
        this.calls = [...this.calls, [...generatedMessageIds]];
        return { messages: input.messages };
      }
    }
    const memory = new HookMemory();

    await persistGeneratedMessages(memory, { messages: [message('one')] }, ['one']);

    expect(memory.calls).toEqual([['one']]);
  });

  it('dispatches an empty generated-ID set when atomic thread creation is requested', async () => {
    const hook = vi.fn(async input => ({ messages: input.messages }));
    const saveMessages = vi.fn();
    const memory = {
      saveMessages,
      __mastraPersistGeneratedMessages: hook,
    } as unknown as MockMemory;
    const thread = {
      id: 'thread',
      resourceId: 'resource',
      title: '',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await persistMessagesWithThreadCreation(memory, { messages: [message('one')], thread }, []);

    expect(hook).toHaveBeenCalledWith({ messages: [message('one')], thread }, []);
    expect(saveMessages).not.toHaveBeenCalled();
  });

  it('dispatches to a string-named hook on a memory object from another module instance', async () => {
    const hook = vi.fn(async input => ({ messages: input.messages }));
    const saveMessages = vi.fn();
    const memory = {
      saveMessages,
      __mastraPersistGeneratedMessages: hook,
    } as unknown as MockMemory;

    await persistGeneratedMessages(memory, { messages: [message('one')] }, ['one']);

    expect(hook).toHaveBeenCalledWith({ messages: [message('one')] }, ['one']);
    expect(saveMessages).not.toHaveBeenCalled();
  });
});
