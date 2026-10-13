import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../message-list';
import { createSignal } from '../signals';
import type { MastraDBMessage } from '../types';
import { SaveQueueManager } from './index';

function makeTestMessage(id: string, threadId: string, role: 'user' | 'assistant', content: string): MastraDBMessage {
  return {
    id,
    role,
    content: { content, parts: [{ type: 'text', text: content }], format: 2 },
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

  it('filters internal working-memory and transient signal messages before saving', async () => {
    const threadId = 'thread-filter';
    const list = new MessageList({ threadId });
    const transientSignal = createSignal({
      id: 'signal-transient',
      type: 'reactive',
      contents: 'Delivery only',
      transient: true,
    }).toDBMessage({ threadId });
    const workingMemoryMessage: MastraDBMessage = {
      id: 'wm-message',
      role: 'assistant',
      createdAt: new Date(),
      threadId,
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'wm-call',
              toolName: 'updateWorkingMemory',
              args: { memory: '# Profile\n- Name: Ada' },
              result: { success: true },
            },
          },
        ],
      },
    };

    list.add(transientSignal, 'response');
    list.add(workingMemoryMessage, 'response');
    list.add(makeTestMessage('visible-message', threadId, 'assistant', 'Saved your profile.'), 'response');

    await manager.flushMessages(list, threadId);

    expect(mockMemory.saveMessages).toHaveBeenCalledOnce();
    expect(saved).toHaveLength(1);
    expect(saved[0].role).toBe('assistant');
    expect(saved[0].content.parts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'Saved your profile.' })]),
    );
    expect(saved[0].content.parts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'tool-invocation' })]),
    );
  });

  describe('beforePersist', () => {
    it('runs before the save and persists when it resolves', async () => {
      const order: string[] = [];
      mockMemory.saveMessages = vi.fn(async () => {
        order.push('save');
      });
      const list = new MessageList({ threadId: 'thread-guard' });
      list.add(makeTestMessage('m1', 'thread-guard', 'user', 'Hello'), 'user');

      await manager.flushMessages(list, 'thread-guard', undefined, {
        beforePersist: async () => {
          order.push('guard');
        },
      });

      expect(order).toEqual(['guard', 'save']);
    });

    it('skips the save, keeps the messages unsaved, and rejects when it rejects', async () => {
      const list = new MessageList({ threadId: 'thread-guard' });
      list.add(makeTestMessage('m1', 'thread-guard', 'user', 'Hello'), 'user');
      const guardError = new Error('superseded');

      await expect(
        manager.flushMessages(list, 'thread-guard', undefined, { beforePersist: () => Promise.reject(guardError) }),
      ).rejects.toBe(guardError);

      expect(saveCalls).toBe(0);
      expect(list.drainUnsavedMessages().map(m => m.id)).toEqual(['m1']);
    });

    it('does not poison later saves on the same thread', async () => {
      const list = new MessageList({ threadId: 'thread-guard' });
      list.add(makeTestMessage('m1', 'thread-guard', 'user', 'Hello'), 'user');

      const rejected = manager.flushMessages(list, 'thread-guard', undefined, {
        beforePersist: () => Promise.reject(new Error('superseded')),
      });
      const later = manager.flushMessages(list, 'thread-guard');

      await expect(rejected).rejects.toThrow('superseded');
      await expect(later).resolves.toBeUndefined();
      expect(saved.map(m => m.id)).toEqual(['m1']);
    });

    it('still logs storage errors instead of rejecting', async () => {
      const logger = { error: vi.fn() } as any;
      mockMemory.saveMessages = vi.fn(async () => {
        throw new Error('db down');
      });
      const manager = new SaveQueueManager({ memory: mockMemory, logger });
      const list = new MessageList({ threadId: 'thread-guard' });
      list.add(makeTestMessage('m1', 'thread-guard', 'user', 'Hello'), 'user');

      await expect(
        manager.flushMessages(list, 'thread-guard', undefined, { beforePersist: async () => {} }),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith('Error in enqueueSave', expect.anything());
    });
  });
});
