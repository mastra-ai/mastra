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
