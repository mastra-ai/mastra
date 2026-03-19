import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import type { ApiRoute } from '../../server/types';
import { MastraChannel } from '../base';
import type { ChannelSendParams, ChannelSendResult } from '../types';

/**
 * Test channel implementation for integration testing.
 */
class TestChannel extends MastraChannel {
  readonly platform = 'test-platform';

  sentMessages: ChannelSendParams[] = [];
  webhookPath: string;

  constructor(config: { name: string; webhookPath?: string }) {
    super({ name: config.name });
    this.webhookPath = config.webhookPath ?? `/api/agents/__test__/channels/${config.name}/webhook`;
  }

  async send(params: ChannelSendParams): Promise<ChannelSendResult> {
    this.sentMessages.push(params);
    return { ok: true, externalMessageId: `msg-${Date.now()}` };
  }

  getWebhookRoutes(): ApiRoute[] {
    return [
      {
        path: this.webhookPath,
        method: 'POST',
        requiresAuth: false,
        createHandler: async () => {
          return async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
      },
    ];
  }
}

/**
 * Creates a mock agent for testing with AI SDK v5 model.
 */
function createTestAgent(id: string, options?: { responseText?: string; channels?: Record<string, MastraChannel> }) {
  const { responseText = 'Hello from agent', channels } = options ?? {};
  return new Agent({
    id,
    name: `Test Agent ${id}`,
    instructions: 'You are a test agent',
    model: new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: responseText }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: responseText },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      }),
    }),
    channels,
  });
}

describe('Mastra Channel Integration', () => {
  describe('agent-level channel registration', () => {
    it('registers channels on agent', () => {
      const channel = new TestChannel({ name: 'test' });
      const agent = createTestAgent('test-agent', { channels: { test: channel } });

      expect(agent.getChannel('test')).toBe(channel);
      expect(channel.agent).toBe(agent);
    });

    it('registers multiple channels on agent', () => {
      const slack = new TestChannel({ name: 'slack' });
      const discord = new TestChannel({ name: 'discord' });
      const agent = createTestAgent('multi-agent', { channels: { slack, discord } });

      expect(agent.getChannel('slack')).toBe(slack);
      expect(agent.getChannel('discord')).toBe(discord);
    });

    it('throws when getting non-existent channel from agent', () => {
      const agent = createTestAgent('no-channels');

      expect(() => agent.getChannel('nonexistent')).toThrow();
    });

    it('returns all channels via agent.getChannels()', () => {
      const slack = new TestChannel({ name: 'slack' });
      const discord = new TestChannel({ name: 'discord' });
      const agent = createTestAgent('multi-agent', { channels: { slack, discord } });

      const channels = agent.getChannels();
      expect(Object.keys(channels)).toHaveLength(2);
      expect(channels.slack).toBe(slack);
      expect(channels.discord).toBe(discord);
    });

    it('returns empty object when no channels configured', () => {
      const agent = createTestAgent('no-channels');
      expect(agent.getChannels()).toEqual({});
    });
  });

  describe('mastra-level channel aggregation', () => {
    it('aggregates channels from agents via mastra.getChannels()', () => {
      const slackChannel = new TestChannel({ name: 'slack' });
      const discordChannel = new TestChannel({ name: 'discord' });

      const agent1 = createTestAgent('agent1', { channels: { slack: slackChannel } });
      const agent2 = createTestAgent('agent2', { channels: { discord: discordChannel } });

      const mastra = new Mastra({
        logger: false,
        agents: { agent1, agent2 },
      });

      const channels = mastra.getChannels();
      expect(channels['agent1:slack']).toBe(slackChannel);
      expect(channels['agent2:discord']).toBe(discordChannel);
    });

    it('returns empty object when no agents have channels', () => {
      const agent = createTestAgent('no-channels');

      const mastra = new Mastra({
        logger: false,
        agents: { agent },
      });

      expect(mastra.getChannels()).toEqual({});
    });
  });

  describe('webhook route auto-wiring', () => {
    it('adds channel webhook routes to server config when agent is added', () => {
      const channel = new TestChannel({
        name: 'test',
        webhookPath: '/api/agents/test-agent/channels/test/webhook',
      });
      const agent = createTestAgent('test-agent', { channels: { test: channel } });

      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': agent },
      });

      const server = mastra.getServer();
      expect(server?.apiRoutes).toBeDefined();
      expect(server?.apiRoutes?.length).toBeGreaterThan(0);

      const webhookRoute = server?.apiRoutes?.find(r => r.path === '/api/agents/test-agent/channels/test/webhook');
      expect(webhookRoute).toBeDefined();
      expect(webhookRoute?.method).toBe('POST');
      expect(webhookRoute?.requiresAuth).toBe(false);
    });

    it('merges channel routes with existing server routes', () => {
      const channel = new TestChannel({
        name: 'test',
        webhookPath: '/api/agents/test-agent/channels/test/webhook',
      });
      const agent = createTestAgent('test-agent', { channels: { test: channel } });

      const existingRoute: ApiRoute = {
        path: '/api/custom',
        method: 'GET',
        handler: async () => new Response('ok'),
      };

      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': agent },
        server: {
          apiRoutes: [existingRoute],
        },
      });

      const server = mastra.getServer();
      expect(server?.apiRoutes?.length).toBe(2);

      const customRoute = server?.apiRoutes?.find(r => r.path === '/api/custom');
      expect(customRoute).toBeDefined();

      const webhookRoute = server?.apiRoutes?.find(r => r.path === '/api/agents/test-agent/channels/test/webhook');
      expect(webhookRoute).toBeDefined();
    });

    it('adds routes from multiple agents with channels', () => {
      const slack = new TestChannel({
        name: 'slack',
        webhookPath: '/api/agents/agent1/channels/slack/webhook',
      });
      const discord = new TestChannel({
        name: 'discord',
        webhookPath: '/api/agents/agent2/channels/discord/webhook',
      });

      const agent1 = createTestAgent('agent1', { channels: { slack } });
      const agent2 = createTestAgent('agent2', { channels: { discord } });

      const mastra = new Mastra({
        logger: false,
        agents: { agent1, agent2 },
      });

      const server = mastra.getServer();
      expect(server?.apiRoutes?.length).toBe(2);

      expect(server?.apiRoutes?.find(r => r.path === '/api/agents/agent1/channels/slack/webhook')).toBeDefined();
      expect(server?.apiRoutes?.find(r => r.path === '/api/agents/agent2/channels/discord/webhook')).toBeDefined();
    });
  });

  describe('channel-agent relationship', () => {
    it('channel has a reference back to its owning agent', () => {
      const channel = new TestChannel({ name: 'test' });
      const agent = createTestAgent('test-agent', { channels: { test: channel } });

      expect(channel.agent).toBe(agent);
    });

    it('agent is accessible from Mastra after registration', () => {
      const channel = new TestChannel({ name: 'test' });
      const agent = createTestAgent('test-agent', { channels: { test: channel } });

      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': agent },
      });

      expect(mastra.getAgent('test-agent')).toBe(agent);
      expect(mastra.getAgent('test-agent').getChannel('test')).toBe(channel);
    });
  });
});
