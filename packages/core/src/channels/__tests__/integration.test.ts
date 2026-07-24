import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { ConsoleLogger } from '../../logger';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage/mock';
import { AgentChannels } from '../agent-channels';
import type { ChannelConfig } from '../types';

// Minimal mock adapter satisfying the Chat SDK Adapter interface
function createMockAdapter(name: string) {
  return {
    name,
    postMessage: async () => ({ id: 'msg-1', text: '' }),
    editMessage: async () => {},
    deleteMessage: async () => {},
    addReaction: async () => {},
    removeReaction: async () => {},
    handleWebhook: async () => new Response('ok'),
    initialize: async () => {},
    fetchMessages: async () => [],
    encodeThreadId: (...parts: string[]) => parts.join(':'),
    decodeThreadId: (id: string) => id.split(':'),
    channelIdFromThreadId: (id: string) => id.split(':').slice(0, 2).join(':'),
    renderFormatted: (t: string) => t,
    fetchThread: async () => null,
    startTyping: async () => {},
    parseMessage: (raw: unknown) => raw,
    userName: 'Bot',
  } as any;
}

function createTestAgent(id: string, options?: { channels?: ChannelConfig }) {
  return new Agent({
    id,
    name: `Test Agent ${id}`,
    instructions: 'You are a test agent',
    model: new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Hello' }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 't-1' },
          { type: 'text-delta', id: 't-1', delta: 'Hello' },
          { type: 'text-end', id: 't-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      }),
    }),
    channels: options?.channels,
  });
}

describe('Mastra Channel Integration', () => {
  describe('agent-level channel registration', () => {
    it('creates AgentChannels when channels are provided', () => {
      const agent = createTestAgent('bot-1', {
        channels: { adapters: { discord: createMockAdapter('discord') } },
      });
      expect(agent.getChannels()).not.toBeNull();
    });

    it('returns null AgentChannels when no channels', () => {
      const agent = createTestAgent('no-channels');
      expect(agent.getChannels()).toBeNull();
    });

    it('exposes adapters through AgentChannels', () => {
      const agent = createTestAgent('bot-1', {
        channels: {
          adapters: {
            discord: createMockAdapter('discord'),
            slack: createMockAdapter('slack'),
          },
        },
      });
      const channels = agent.getChannels()!;
      expect(Object.keys(channels.adapters)).toEqual(['discord', 'slack']);
    });
  });

  describe('mastra-level channel aggregation', () => {
    it('aggregates AgentChannels instances from agents', () => {
      const agent1 = createTestAgent('agent1', {
        channels: { adapters: { discord: createMockAdapter('discord') } },
      });
      const agent2 = createTestAgent('agent2', {
        channels: { adapters: { slack: createMockAdapter('slack') } },
      });

      const mastra = new Mastra({
        logger: false,
        agents: { agent1, agent2 },
        storage: new InMemoryStore(),
      });

      const channels = mastra.getChannels();
      expect(Object.keys(channels)).toEqual(['agent1', 'agent2']);
    });

    it('returns empty when no agents have channels', () => {
      const agent = createTestAgent('no-channels');
      const mastra = new Mastra({
        logger: false,
        agents: { agent },
      });
      expect(mastra.getChannels()).toEqual({});
    });
  });

  describe('logger propagation', () => {
    it('propagates the Mastra logger to AgentChannels when registered', () => {
      const agent = createTestAgent('bot-1', {
        channels: { adapters: { discord: createMockAdapter('discord') } },
      });

      const mastra = new Mastra({
        agents: { 'bot-1': agent },
        storage: new InMemoryStore(),
      });

      const channels = mastra.getChannels()['bot-1']!;
      // AgentChannels.__setLogger stores the logger on its internal field; assert
      // a logger has been propagated from the agent (Mastra wires a DualLogger
      // on register) rather than remaining unset.
      const channelLogger = (channels as any).logger;
      expect(channelLogger).toBeDefined();
      expect(typeof channelLogger.info).toBe('function');
      expect(typeof channelLogger.debug).toBe('function');
      expect(typeof channelLogger.warn).toBe('function');
    });
  });

  describe('webhook route auto-wiring', () => {
    it('adds channel webhook routes to server config', () => {
      const agent = createTestAgent('bot-1', {
        channels: { adapters: { discord: createMockAdapter('discord') } },
      });

      const mastra = new Mastra({
        logger: false,
        agents: { 'bot-1': agent },
        storage: new InMemoryStore(),
      });

      const server = mastra.getServer();
      const paths = (server?.apiRoutes ?? []).map(r => r.path);
      expect(paths).toContain('/api/agents/bot-1/channels/discord/webhook');
    });

    it('merges channel routes with existing server routes', () => {
      const agent = createTestAgent('bot-1', {
        channels: { adapters: { discord: createMockAdapter('discord') } },
      });

      const mastra = new Mastra({
        logger: false,
        agents: { 'bot-1': agent },
        storage: new InMemoryStore(),
        server: {
          apiRoutes: [
            {
              path: '/api/custom',
              method: 'GET',
              createHandler: async () => async () => new Response('ok'),
            },
          ],
        },
      });

      const server = mastra.getServer();
      const paths = (server?.apiRoutes ?? []).map(r => r.path);
      expect(paths).toContain('/api/custom');
      expect(paths).toContain('/api/agents/bot-1/channels/discord/webhook');
      expect(paths.length).toBe(2);
    });
  });

  describe('onSdkReady', () => {
    it('fires callbacks registered before init once the Chat SDK exists, and immediately after', async () => {
      const agent = createTestAgent('bot-1', {
        channels: { adapters: { discord: createMockAdapter('discord') } },
      });
      const channels = agent.getChannels()!;

      const beforeInit = vi.fn();
      channels.onSdkReady(beforeInit);
      expect(beforeInit).not.toHaveBeenCalled();

      new Mastra({ logger: false, agents: { 'bot-1': agent }, storage: new InMemoryStore() });
      await vi.waitFor(() => expect(channels.sdk).not.toBeNull());

      expect(beforeInit).toHaveBeenCalledTimes(1);
      expect(beforeInit).toHaveBeenCalledWith(channels.sdk);

      // Post-init registration runs synchronously with the live instance.
      const afterInit = vi.fn();
      channels.onSdkReady(afterInit);
      expect(afterInit).toHaveBeenCalledTimes(1);
      expect(afterInit).toHaveBeenCalledWith(channels.sdk);
    });
  });

  describe('channel initialization error handling', () => {
    it('logs an error instead of swallowing the rejection when channel initialization fails', async () => {
      const logger = new ConsoleLogger({ level: 'error' });
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      // Force initialization to fail. Registration fires channel init as a
      // background promise; previously that rejection was swallowed by an
      // un-awaited `void initialize()`, leaving the channel silently dead.
      const initSpy = vi
        .spyOn(AgentChannels.prototype, 'initialize')
        .mockRejectedValue(new Error('channel init failed'));

      try {
        const agent = createTestAgent('bot-1', {
          channels: { adapters: { discord: createMockAdapter('discord') } },
        });

        new Mastra({ logger, agents: { 'bot-1': agent }, storage: new InMemoryStore() });

        await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to initialize channels for agent bot-1'),
          expect.any(Error),
        );
      } finally {
        initSpy.mockRestore();
      }
    });
  });
});
