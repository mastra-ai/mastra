import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Mastra } from '../../mastra';
import type { StorageThreadType } from '../../memory/types';
import type { ApiRoute } from '../../server/types';
import type { MemoryStorage } from '../../storage';

import { MastraChannel } from '../base';
import type { ChannelSendParams, ChannelSendResult, ChannelEvent } from '../types';

/**
 * Concrete test implementation of MastraChannel for testing the base class.
 */
class TestChannel extends MastraChannel {
  readonly platform = 'test';

  sentMessages: ChannelSendParams[] = [];

  async send(params: ChannelSendParams): Promise<ChannelSendResult> {
    this.sentMessages.push(params);
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

function createMockMastra(memoryStore: MemoryStorage | null = null, agents: Record<string, any> = {}) {
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
    getAgent: vi.fn().mockImplementation((name: string) => {
      const agent = agents[name];
      if (!agent) throw new Error(`Agent ${name} not found`);
      return agent;
    }),
  } as unknown as Mastra;
}

function createMockAgent(responseText: string = 'Hello from agent') {
  return {
    generate: vi.fn().mockResolvedValue({ text: responseText }),
  };
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
  });

  describe('processWebhookEvent', () => {
    it('resolves the correct agent and invokes generate', async () => {
      const memoryStore = createMockMemoryStore([]);
      const agent = createMockAgent('Hi there!');
      const mastra = createMockMastra(memoryStore, { 'my-agent': agent });

      const event: ChannelEvent = {
        type: 'message',
        platform: 'test',
        externalThreadId: 'thread-1',
        externalChannelId: 'channel-1',
        userId: 'user-1',
        text: 'Hello',
        rawEvent: {},
      };

      const result = await channel.processWebhookEvent({ event, mastra });

      expect(result.handled).toBe(true);
      expect(result.agentName).toBe('my-agent');
      expect(result.responseText).toBe('Hi there!');
      expect(agent.generate).toHaveBeenCalledWith('Hello', {
        memory: {
          thread: expect.objectContaining({ resourceId: 'test:channel-1:thread-1' }),
          resource: 'test:user-1',
        },
      });
    });

    it('sends the response back to the platform', async () => {
      const memoryStore = createMockMemoryStore([]);
      const agent = createMockAgent('Reply text');
      const mastra = createMockMastra(memoryStore, { 'my-agent': agent });

      const event: ChannelEvent = {
        type: 'message',
        platform: 'test',
        externalThreadId: 'thread-1',
        externalChannelId: 'channel-1',
        userId: 'user-1',
        text: 'Hello',
        rawEvent: {},
      };

      await channel.processWebhookEvent({ event, mastra });

      expect(channel.sentMessages).toHaveLength(1);
      expect(channel.sentMessages[0]).toEqual({
        channelId: 'channel-1',
        threadId: 'thread-1',
        content: { text: 'Reply text' },
      });
    });

    it('returns handled: false when no agent is configured', async () => {
      const mastra = createMockMastra(null);

      const event: ChannelEvent = {
        type: 'slash_command',
        platform: 'test',
        externalThreadId: 'thread-1',
        externalChannelId: 'channel-1',
        userId: 'user-1',
        rawEvent: {},
      };

      const result = await channel.processWebhookEvent({ event, mastra });

      expect(result.handled).toBe(false);
      expect(result.agentName).toBeUndefined();
    });

    it('does not send when agent returns no text', async () => {
      const memoryStore = createMockMemoryStore([]);
      const agent = createMockAgent('');
      const mastra = createMockMastra(memoryStore, { 'my-agent': agent });

      const event: ChannelEvent = {
        type: 'message',
        platform: 'test',
        externalThreadId: 'thread-1',
        externalChannelId: 'channel-1',
        userId: 'user-1',
        text: 'Hello',
        rawEvent: {},
      };

      const result = await channel.processWebhookEvent({ event, mastra });

      expect(result.handled).toBe(true);
      expect(channel.sentMessages).toHaveLength(0);
      expect(result.sendResult).toBeUndefined();
    });
  });
});
