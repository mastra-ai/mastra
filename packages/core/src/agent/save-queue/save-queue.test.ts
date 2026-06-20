import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('propagates save failures to flushMessages callers instead of swallowing them', async () => {
    mockMemory.saveMessages = vi.fn(async () => {
      throw new Error('storage down');
    });

    const manager = new SaveQueueManager({ memory: mockMemory });
    const list = new MessageList({ threadId: 'thread-fail' });
    list.add(makeTestMessage('m1', 'thread-fail', 'user', 'Hello'), 'user');

    await expect(manager.flushMessages(list, 'thread-fail')).rejects.toThrow('storage down');
  });

  it('re-queues messages when a save fails so the next flush retries them', async () => {
    let shouldFail = true;
    mockMemory.saveMessages = vi.fn(async ({ messages }) => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('transient failure');
      }
      saved.push(...messages);
    });

    const manager = new SaveQueueManager({ memory: mockMemory });
    const list = new MessageList({ threadId: 'thread-retry' });
    list.add(makeTestMessage('m1', 'thread-retry', 'user', 'Hello'), 'user');

    // First flush fails — messages must NOT be dropped.
    await expect(manager.flushMessages(list, 'thread-retry')).rejects.toThrow('transient failure');
    expect(list.getUnsavedMessages().length).toBe(1);

    // A later flush succeeds and persists the previously failed message.
    await manager.flushMessages(list, 'thread-retry');
    expect(saved.map(m => m.id)).toContain('m1');
    expect(list.getUnsavedMessages().length).toBe(0);
  });

  it('does not stall later saves after a failed save', async () => {
    let call = 0;
    mockMemory.saveMessages = vi.fn(async ({ messages }) => {
      call++;
      if (call === 1) throw new Error('boom');
      saved.push(...messages);
    });

    const manager = new SaveQueueManager({ memory: mockMemory });
    const list1 = new MessageList({ threadId: 'thread-q' });
    list1.add(makeTestMessage('m1', 'thread-q', 'user', 'first'), 'user');
    const failing = manager.flushMessages(list1, 'thread-q');

    const list2 = new MessageList({ threadId: 'thread-q' });
    list2.add(makeTestMessage('m2', 'thread-q', 'user', 'second'), 'user');
    const succeeding = manager.flushMessages(list2, 'thread-q');

    await expect(failing).rejects.toThrow('boom');
    await expect(succeeding).resolves.toBeUndefined();
    expect(saved.map(m => m.id)).toContain('m2');
  });

  it('settles superseded debounce promises when the batched save completes', async () => {
    const manager = new SaveQueueManager({ memory: mockMemory });
    const list = new MessageList({ threadId: 'thread-debounce' });

    list.add(makeTestMessage('m1', 'thread-debounce', 'user', 'Hello'), 'user');
    const first = manager.batchMessages(list, 'thread-debounce');
    list.add(makeTestMessage('m2', 'thread-debounce', 'user', 'World'), 'user');
    const second = manager.batchMessages(list, 'thread-debounce');

    // The superseded first promise must settle, not hang.
    await expect(Promise.all([first, second])).resolves.toBeDefined();
    expect(saveCalls).toBe(1);
    expect(saved.length).toBe(2);
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
