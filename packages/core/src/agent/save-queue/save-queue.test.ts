import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryDB, InMemoryMemory } from '../../storage';
import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../types';
import { SaveQueueManager } from './index';

function makeTestMessage(id: string, threadId: string, role: 'user' | 'assistant', content: string): MastraDBMessage {
  return {
    id,
    role,
    content: { content, parts: [], format: 2 },
    createdAt: new Date(),
    threadId,
  };
}

describe('SaveQueueManager', () => {
  let saved: any[];
  let saveCalls: number;
  let manager: SaveQueueManager;
  let mockMemory: any;
  beforeEach(() => {
    saved = [];
    saveCalls = 0;
    mockMemory = {
      saveMessages: vi.fn(async ({ messages }) => {
        saveCalls++;
        saved.push(...messages);
      }),
    };
    manager = new SaveQueueManager({ memory: mockMemory });
  });

  it('batches saves with debounce', async () => {
    const list = new MessageList({ threadId: 'thread-1' });
    list.add(makeTestMessage('m1', 'thread-1', 'user', 'Hello'), 'user');
    manager.batchMessages(list, 'thread-1');
    list.add(makeTestMessage('m2', 'thread-1', 'user', 'Hello'), 'user');
    manager.batchMessages(list, 'thread-1');
    await new Promise(res => setTimeout(res, manager['debounceMs'] + 10));
    expect(saveCalls).toBe(1);
    expect(saved.length).toBe(2);
  });

  it('does nothing if no unsaved messages', async () => {
    const list = new MessageList({ threadId: 'thread-4' });
    await manager.flushMessages(list, 'thread-4');
    expect(saveCalls).toBe(0);
  });

  it('does not drain messages when no writer is configured', async () => {
    const list = new MessageList({ threadId: 'no-writer' });
    list.add(makeTestMessage('answer', 'no-writer', 'assistant', 'Answer'), 'response');
    await new SaveQueueManager({}).flushMessages(list, 'no-writer');
    expect(list.get.response.db().map(message => message.id)).toEqual(['answer']);
  });

  it('preserves edits made during a successful write for the following flush', async () => {
    const list = new MessageList({ threadId: 'success-mutation' });
    list.add(makeTestMessage('answer', 'success-mutation', 'assistant', 'First'), 'response');
    mockMemory.saveMessages.mockImplementationOnce(async ({ messages }) => {
      saved.push(...messages);
      list.removeByIds(['answer']);
      list.add(makeTestMessage('answer', 'success-mutation', 'assistant', 'Later'), 'response');
    });
    await manager.flushMessages(list, 'success-mutation');
    expect(list.get.response.db().map(message => message.id)).toEqual(['answer']);
    await manager.flushMessages(list, 'success-mutation');
    expect(saved.map(message => message.content.content)).toEqual(['First', 'Later']);
    expect(list.drainUnsavedMessages()).toEqual([]);
  });

  it('exposes a partial backend write and retries stable IDs only when explicitly flushed again', async () => {
    const backend = new InMemoryMemory({ db: new InMemoryDB() });
    const list = new MessageList({ threadId: 'partial' });
    list.add(makeTestMessage('input', 'partial', 'user', 'Question'), 'user');
    list.add(makeTestMessage('answer', 'partial', 'assistant', 'Answer'), 'response');
    const failure = new Error('Backend saved one row then failed');
    mockMemory.saveMessages
      .mockImplementationOnce(async ({ messages }) => {
        await backend.saveMessages({ messages: messages.slice(0, 1) });
        throw failure;
      })
      .mockImplementation(({ messages }) => backend.saveMessages({ messages }));
    await expect(manager.flushMessages(list, 'partial')).rejects.toBe(failure);
    expect(
      (await backend.listMessagesById({ messageIds: ['input', 'answer'] })).messages.map(message => message.id),
    ).toEqual(['input']);
    const restored = new MessageList().deserialize(list.serialize());
    expect(restored.get.input.db().map(message => message.id)).toEqual(['input']);
    expect(restored.get.response.db().map(message => message.id)).toEqual(['answer']);
    await manager.flushMessages(restored, 'partial');
    expect(
      (await backend.listMessagesById({ messageIds: ['input', 'answer'] })).messages.map(message => message.id),
    ).toEqual(['input', 'answer']);
    expect(mockMemory.saveMessages).toHaveBeenCalledTimes(2);
  });

  it('rejects a failed write and retains it for an explicit later flush', async () => {
    const list = new MessageList({ threadId: 'failed-write' });
    list.add(makeTestMessage('answer', 'failed-write', 'assistant', 'Answer'), 'response');
    mockMemory.saveMessages.mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(manager.flushMessages(list, 'failed-write')).rejects.toThrow('Storage unavailable');
    expect(saved).toEqual([]);
    expect(list.get.response.db().map(message => message.id)).toEqual(['answer']);
    await manager.flushMessages(list, 'failed-write');
    expect(saved.map(message => message.id)).toEqual(['answer']);
    expect(list.drainUnsavedMessages()).toEqual([]);
  });

  it('does not poison a queued save after the preceding write fails', async () => {
    const failed = new MessageList({ threadId: 'same-thread' });
    failed.add(makeTestMessage('failed', 'same-thread', 'assistant', 'Failed'), 'response');
    const healthy = new MessageList({ threadId: 'same-thread' });
    healthy.add(makeTestMessage('healthy', 'same-thread', 'assistant', 'Healthy'), 'response');
    mockMemory.saveMessages.mockRejectedValueOnce(new Error('First write failed'));
    const results = await Promise.allSettled([
      manager.flushMessages(failed, 'same-thread'),
      manager.flushMessages(healthy, 'same-thread'),
    ]);
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled']);
    expect(saved.map(message => message.id)).toEqual(['healthy']);
    expect(failed.get.response.db().map(message => message.id)).toEqual(['failed']);
  });

  it('retains current content and new input without resurrecting messages deleted during a failed write', async () => {
    const list = new MessageList({ threadId: 'mutation' });
    list.add(makeTestMessage('edited', 'mutation', 'assistant', 'Old text'), 'response');
    list.add(makeTestMessage('deleted', 'mutation', 'assistant', 'Remove me'), 'response');
    let failWrite!: (error: Error) => void;
    let writing!: () => void;
    const started = new Promise<void>(resolve => {
      writing = resolve;
    });
    mockMemory.saveMessages.mockImplementationOnce(async () => {
      writing();
      await new Promise<void>((_resolve, reject) => {
        failWrite = reject;
      });
    });
    const result = manager.flushMessages(list, 'mutation').then(
      () => undefined,
      error => error,
    );
    await started;
    list.removeByIds(['edited', 'deleted']);
    list.add(makeTestMessage('edited', 'mutation', 'assistant', 'Current text'), 'response');
    list.add(makeTestMessage('new-input', 'mutation', 'user', 'New input'), 'user');
    failWrite(new Error('Write failed during mutation'));
    expect(await result).toEqual(new Error('Write failed during mutation'));
    expect(list.get.response.db().map(message => message.id)).toEqual(['edited']);
    expect(list.get.input.db().map(message => message.id)).toEqual(['new-input']);
    await manager.flushMessages(list, 'mutation');
    expect(saved.map(message => message.id)).toEqual(['edited', 'new-input']);
    expect(saved.find(message => message.id === 'edited').content.content).toBe('Current text');
  });

  it('does not undo an explicit source change during a failed save', async () => {
    const list = new MessageList({ threadId: 'source-change' });
    list.add(makeTestMessage('answer', 'source-change', 'assistant', 'Answer'), 'response');
    mockMemory.saveMessages.mockImplementationOnce(async () => {
      list.removeByIds(['answer']);
      list.add(makeTestMessage('answer', 'source-change', 'assistant', 'Remembered answer'), 'memory');
      throw new Error('Write failed');
    });
    await expect(manager.flushMessages(list, 'source-change')).rejects.toThrow('Write failed');
    expect(list.get.response.db()).toEqual([]);
    expect(list.get.remembered.db().map(message => message.id)).toEqual(['answer']);
  });

  it('retains unsaved messages if transcript preparation itself fails', async () => {
    const list = new MessageList({ threadId: 'transform-failure' });
    list.add(makeTestMessage('answer', 'transform-failure', 'assistant', 'Answer'), 'response');
    const transform = vi.spyOn(list as any, 'transformMessageForTranscript').mockImplementationOnce(() => {
      throw new Error('Transcript preparation failed');
    });
    await expect(manager.flushMessages(list, 'transform-failure')).rejects.toThrow('Transcript preparation failed');
    expect(list.get.response.db().map(message => message.id)).toEqual(['answer']);
    expect(mockMemory.saveMessages).not.toHaveBeenCalled();
    transform.mockRestore();
    await manager.flushMessages(list, 'transform-failure');
    expect(saved.map(message => message.id)).toEqual(['answer']);
  });

  it('handles batchMessages with stale messages (forces flush)', async () => {
    const list = new MessageList({ threadId: 'thread-5' });
    const old = Date.now() - SaveQueueManager['MAX_STALENESS_MS'] - 100;
    const msg = makeTestMessage('m1', 'thread-5', 'user', 'Hello');
    msg.createdAt = new Date(old); // Ensure createdAt is stale
    list.add(msg, 'user');
    await manager.batchMessages(list, 'thread-5');
    expect(saveCalls).toBe(1);
    expect(saved[0].id).toBe('m1');
  });

  it('clearDebounce cancels pending debounce', async () => {
    const list = new MessageList({ threadId: 'thread-6' });
    list.add(makeTestMessage('m1', 'thread-6', 'user', 'Hello'), 'user');
    manager.batchMessages(list, 'thread-6');
    manager.clearDebounce('thread-6');
    await new Promise(res => setTimeout(res, manager['debounceMs'] + 10));
    expect(saveCalls).toBe(0);
  });

  it('should serialize saves with a save queue under rapid step completion', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    let totalSaves = 0;

    // Spy on saveMessages to track concurrency
    mockMemory.saveMessages = vi.fn(async ({ messages }) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(res => setTimeout(res, 20));
      concurrent--;
      saved.push(...messages);
      totalSaves++;
    });

    const manager = new SaveQueueManager({ memory: mockMemory });
    const list = new MessageList({ threadId: 'thread-concurrency' });
    const threadId = 'thread-concurrency';

    // Add and trigger saves rapidly
    const savePromises: Promise<void>[] = [];
    for (let i = 0; i < 10; i++) {
      list.add(makeTestMessage(`m${i}`, threadId, 'user', `message ${i}`), 'user');
      savePromises.push(manager.flushMessages(list, threadId));
    }
    await Promise.all(savePromises);

    expect(maxConcurrent).toBe(1);
    expect(totalSaves).toBeGreaterThan(0);
  });

  it('should flush buffered parts via drainUnsavedMessages before persisting', async () => {
    let savedMessages: any[] = [];

    mockMemory.saveMessages = async function (...args) {
      savedMessages.push(...args[0].messages);
    };

    const manager = new SaveQueueManager({ memory: mockMemory });
    const list = new MessageList({ threadId: 'thread-drain' });
    const threadId = 'thread-drain';

    list.add(makeTestMessage('m1', threadId, 'user', 'Hello'), 'user');
    list.add(makeTestMessage('m2', threadId, 'assistant', 'Hi there!'), 'response');
    list.add(makeTestMessage('m3', threadId, 'user', 'How are you?'), 'user');

    expect(savedMessages.length).toBe(0);

    await manager.flushMessages(list, threadId);

    expect(savedMessages.length).toBe(3);
    expect(list.drainUnsavedMessages().length).toBe(0);
  });
});
