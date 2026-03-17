import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Mastra } from '../../mastra';
import type { StorageThreadType } from '../../memory/types';
import type { ApiRoute } from '../../server/types';
import type { MemoryStorage } from '../../storage';

import { MastraChannel } from '../base';
import type { ChannelEvent, ChannelSendParams, ChannelSendResult } from '../types';

/**
 * Concrete test implementation of MastraChannel for testing the base class.
 */
class TestChannel extends MastraChannel {
  readonly platform = 'test';

  async verifyWebhook(_request: Request): Promise<boolean> {
    return true;
  }

  async parseWebhookEvent(_request: Request): Promise<ChannelEvent> {
    return {
      type: 'message',
      platform: 'test',
      externalThreadId: 'thread-1',
      externalChannelId: 'channel-1',
      userId: 'user-1',
      text: 'hello',
      rawEvent: {},
    };
  }

  async send(_params: ChannelSendParams): Promise<ChannelSendResult> {
    return { ok: true, externalMessageId: 'msg-1' };
  }

  getWebhookRoutes(): ApiRoute[] {
    return [];
  }
}

function createMockMemoryStore(existingThreads: StorageThreadType[] = []) {
  return {
    listThreads: vi.fn().mockResolvedValue({ threads: existingThreads }),
    saveThread: vi.fn().mockImplementation(({ thread }) => Promise.resolve(thread)),
  } as unknown as MemoryStorage;
}

function createMockMastra(memoryStore: MemoryStorage | null = null) {
  const storage = memoryStore
    ? {
        getStore: vi.fn().mockImplementation((name: string) => {
          if (name === 'memory') return Promise.resolve(memoryStore);
          return Promise.resolve(null);
        }),
      }
    : null;

  return {
    getStorage: vi.fn().mockReturnValue(storage),
  } as unknown as Mastra;
}

describe('MastraChannel', () => {
  let channel: TestChannel;

  beforeEach(() => {
    channel = new TestChannel({
      name: 'test',
      routes: {
        'my-agent': { events: ['message', 'mention'] },
        'reaction-agent': { events: ['reaction'] },
      },
    });
  });

  describe('resolveAgentForEvent', () => {
    it('returns the agent name for a matching event type', () => {
      // resolveAgentForEvent is protected, access via any
      const result = (channel as any).resolveAgentForEvent('message');
      expect(result).toBe('my-agent');
    });

    it('returns the correct agent for different event types', () => {
      const result = (channel as any).resolveAgentForEvent('reaction');
      expect(result).toBe('reaction-agent');
    });

    it('returns undefined for unknown event types', () => {
      const result = (channel as any).resolveAgentForEvent('unknown');
      expect(result).toBeUndefined();
    });

    it('matches mention events', () => {
      const result = (channel as any).resolveAgentForEvent('mention');
      expect(result).toBe('my-agent');
    });
  });

  describe('getOrCreateThread', () => {
    it('creates a new thread when none exists', async () => {
      const memoryStore = createMockMemoryStore([]);
      const mastra = createMockMastra(memoryStore);

      const thread = await channel.getOrCreateThread({
        externalThreadId: 'ext-thread-1',
        channelId: 'ext-channel-1',
        resourceId: 'user-1',
        mastra,
      });

      expect(memoryStore.listThreads).toHaveBeenCalledWith({
        filter: {
          metadata: {
            'channel.platform': 'test',
            'channel.externalThreadId': 'ext-thread-1',
            'channel.externalChannelId': 'ext-channel-1',
          },
        },
        perPage: 1,
      });

      expect(memoryStore.saveThread).toHaveBeenCalledWith({
        thread: expect.objectContaining({
          resourceId: 'user-1',
          metadata: {
            'channel.platform': 'test',
            'channel.externalThreadId': 'ext-thread-1',
            'channel.externalChannelId': 'ext-channel-1',
          },
        }),
      });

      expect(thread.resourceId).toBe('user-1');
      expect(thread.metadata).toEqual({
        'channel.platform': 'test',
        'channel.externalThreadId': 'ext-thread-1',
        'channel.externalChannelId': 'ext-channel-1',
      });
    });

    it('returns existing thread when one matches', async () => {
      const existingThread: StorageThreadType = {
        id: 'existing-thread-id',
        resourceId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          'channel.platform': 'test',
          'channel.externalThreadId': 'ext-thread-1',
          'channel.externalChannelId': 'ext-channel-1',
        },
      };

      const memoryStore = createMockMemoryStore([existingThread]);
      const mastra = createMockMastra(memoryStore);

      const thread = await channel.getOrCreateThread({
        externalThreadId: 'ext-thread-1',
        channelId: 'ext-channel-1',
        resourceId: 'user-1',
        mastra,
      });

      expect(thread.id).toBe('existing-thread-id');
      expect(memoryStore.saveThread).not.toHaveBeenCalled();
    });

    it('throws when storage is not configured', async () => {
      const mastra = createMockMastra(null);

      await expect(
        channel.getOrCreateThread({
          externalThreadId: 'ext-thread-1',
          channelId: 'ext-channel-1',
          resourceId: 'user-1',
          mastra,
        }),
      ).rejects.toThrow('Storage is required');
    });

    it('generates a valid UUID for new thread IDs', async () => {
      const memoryStore = createMockMemoryStore([]);
      const mastra = createMockMastra(memoryStore);

      await channel.getOrCreateThread({
        externalThreadId: 'ext-thread-1',
        channelId: 'ext-channel-1',
        resourceId: 'user-1',
        mastra,
      });

      const savedThread = (memoryStore.saveThread as any).mock.calls[0][0].thread;
      // UUID v4 format
      expect(savedThread.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });
});
