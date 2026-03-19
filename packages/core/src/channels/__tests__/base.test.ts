import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Agent } from '../../agent';
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

function createMockAgent(responseText: string = 'Hello from agent') {
  return {
    generate: vi.fn().mockResolvedValue({ text: responseText }),
    mastra: createMockMastra(createMockMemoryStore()),
  } as unknown as Agent;
}

describe('MastraChannel', () => {
  let channel: TestChannel;

  beforeEach(() => {
    channel = new TestChannel({ name: 'test' });
  });

  describe('agent ownership', () => {
    it('throws when accessing agent before registration', () => {
      expect(() => channel.agent).toThrow('Channel "test" has no owning agent');
    });

    it('returns agent after registration', () => {
      const mockAgent = createMockAgent();
      channel.__setAgent(mockAgent);
      expect(channel.agent).toBe(mockAgent);
    });
  });

  describe('commands', () => {
    it('resolves registered commands', () => {
      const channelWithCommands = new TestChannel({
        name: 'test',
      });
      // Access the protected method via a subclass or cast
      (channelWithCommands as any).commands = {
        '/summarize': { description: 'Summarize', prompt: 'Please summarize the conversation.' },
      };

      const command = (channelWithCommands as any).resolveCommand('/summarize');
      expect(command).toBeDefined();
      expect(command.prompt).toBe('Please summarize the conversation.');
    });

    it('returns undefined for unknown commands', () => {
      const command = (channel as any).resolveCommand('/unknown');
      expect(command).toBeUndefined();
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
            channel_platform: 'test',
            channel_externalThreadId: 'ext-thread-1',
            channel_externalChannelId: 'ext-channel-1',
          },
        },
        perPage: 1,
      });

      expect(memoryStore.saveThread).toHaveBeenCalledWith({
        thread: expect.objectContaining({
          resourceId: 'user-1',
          metadata: {
            channel_platform: 'test',
            channel_externalThreadId: 'ext-thread-1',
            channel_externalChannelId: 'ext-channel-1',
          },
        }),
      });

      expect(thread.resourceId).toBe('user-1');
      expect(thread.metadata).toEqual({
        channel_platform: 'test',
        channel_externalThreadId: 'ext-thread-1',
        channel_externalChannelId: 'ext-channel-1',
      });
    });

    it('returns existing thread when one matches', async () => {
      const existingThread: StorageThreadType = {
        id: 'existing-thread-id',
        resourceId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          channel_platform: 'test',
          channel_externalThreadId: 'ext-thread-1',
          channel_externalChannelId: 'ext-channel-1',
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
      ).rejects.toThrow('Storage is required for channel thread mapping');
    });
  });

  describe('processWebhookEvent', () => {
    it('routes message events to the owning agent', async () => {
      const memoryStore = createMockMemoryStore([]);
      const mastra = createMockMastra(memoryStore);
      const mockAgent = createMockAgent('Hello from agent');
      // Override the mock mastra on the agent
      (mockAgent as any).mastra = mastra;
      channel.__setAgent(mockAgent);

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
      expect(result.responseText).toBe('Hello from agent');
      expect(mockAgent.generate).toHaveBeenCalledWith('Hello', expect.any(Object));
    });

    it('handles slash commands with registered prompts', async () => {
      const memoryStore = createMockMemoryStore([]);
      const mastra = createMockMastra(memoryStore);
      const mockAgent = createMockAgent('Summary result');
      (mockAgent as any).mastra = mastra;

      const commandChannel = new TestChannel({ name: 'test-commands' });
      (commandChannel as any).commands = {
        '/summarize': { description: 'Summarize', prompt: 'Please summarize the conversation.' },
      };
      commandChannel.__setAgent(mockAgent);

      const event: ChannelEvent = {
        type: 'slash_command',
        platform: 'test',
        externalThreadId: 'thread-1',
        externalChannelId: 'channel-1',
        userId: 'user-1',
        text: 'last 10 messages',
        commandName: '/summarize',
        rawEvent: {},
      };

      const result = await commandChannel.processWebhookEvent({ event, mastra });

      expect(result.handled).toBe(true);
      expect(mockAgent.generate).toHaveBeenCalledWith(
        'Please summarize the conversation.\n\nlast 10 messages',
        expect.any(Object),
      );
    });

    it('returns handled: false for unknown slash commands', async () => {
      const memoryStore = createMockMemoryStore([]);
      const mastra = createMockMastra(memoryStore);
      const mockAgent = createMockAgent();
      (mockAgent as any).mastra = mastra;
      channel.__setAgent(mockAgent);

      const event: ChannelEvent = {
        type: 'slash_command',
        platform: 'test',
        externalThreadId: 'thread-1',
        externalChannelId: 'channel-1',
        userId: 'user-1',
        commandName: '/unknown',
        rawEvent: {},
      };

      const result = await channel.processWebhookEvent({ event, mastra });
      expect(result.handled).toBe(false);
    });

    it('sends the agent response back to the channel', async () => {
      const memoryStore = createMockMemoryStore([]);
      const mastra = createMockMastra(memoryStore);
      const mockAgent = createMockAgent('Response text');
      (mockAgent as any).mastra = mastra;
      channel.__setAgent(mockAgent);

      const event: ChannelEvent = {
        type: 'message',
        platform: 'test',
        externalThreadId: 'thread-1',
        externalChannelId: 'channel-1',
        userId: 'user-1',
        text: 'Test message',
        rawEvent: {},
      };

      const result = await channel.processWebhookEvent({ event, mastra });

      expect(result.sendResult?.ok).toBe(true);
      expect(channel.sentMessages).toHaveLength(1);
      expect(channel.sentMessages[0]!.content.text).toBe('Response text');
    });
  });
});
