import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { MastraError } from '../../error';
import { Mastra } from '../../mastra';
import type { ApiRoute } from '../../server/types';
import { MastraChannel } from '../base';
import type { ChannelEvent, ChannelSendParams, ChannelSendResult } from '../types';

/**
 * Test channel implementation for integration testing.
 */
class TestChannel extends MastraChannel {
  readonly platform = 'test-platform';

  sentMessages: ChannelSendParams[] = [];
  webhookPath: string;

  constructor(config: { name: string; webhookPath?: string; routes: Record<string, { events: string[] }> }) {
    super({ name: config.name, routes: config.routes as any });
    this.webhookPath = config.webhookPath ?? `/channels/${config.name}/webhook`;
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
function createTestAgent(id: string, responseText: string = 'Hello from agent') {
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
  });
}

describe('Mastra Channel Integration', () => {
  describe('channel registration', () => {
    it('registers channels from config', () => {
      const channel = new TestChannel({
        name: 'test',
        routes: { 'test-agent': { events: ['message'] } },
      });

      const mastra = new Mastra({
        logger: false,
        channels: { test: channel },
      });

      expect(mastra.getChannel('test')).toBe(channel);
    });

    it('registers multiple channels', () => {
      const channel1 = new TestChannel({
        name: 'slack',
        routes: { agent1: { events: ['message'] } },
      });
      const channel2 = new TestChannel({
        name: 'discord',
        routes: { agent2: { events: ['message'] } },
      });

      const mastra = new Mastra({
        logger: false,
        channels: { slack: channel1, discord: channel2 },
      });

      expect(mastra.getChannel('slack')).toBe(channel1);
      expect(mastra.getChannel('discord')).toBe(channel2);
    });

    it('throws when getting non-existent channel', () => {
      const mastra = new Mastra({ logger: false });

      expect(() => mastra.getChannel('nonexistent')).toThrow(MastraError);
      expect(() => mastra.getChannel('nonexistent')).toThrow('Channel with name nonexistent not found');
    });

    it('returns all channels via getChannels()', () => {
      const channel1 = new TestChannel({
        name: 'slack',
        routes: { agent1: { events: ['message'] } },
      });
      const channel2 = new TestChannel({
        name: 'discord',
        routes: { agent2: { events: ['message'] } },
      });

      const mastra = new Mastra({
        logger: false,
        channels: { slack: channel1, discord: channel2 },
      });

      const channels = mastra.getChannels();
      expect(Object.keys(channels)).toHaveLength(2);
      expect(channels.slack).toBe(channel1);
      expect(channels.discord).toBe(channel2);
    });

    it('returns empty object when no channels configured', () => {
      const mastra = new Mastra({ logger: false });

      expect(mastra.getChannels()).toEqual({});
    });

    it('skips null/undefined channels in config', () => {
      const validChannel = new TestChannel({
        name: 'valid',
        routes: { agent: { events: ['message'] } },
      });

      const mastra = new Mastra({
        logger: false,
        channels: {
          valid: validChannel,
          nullChannel: null as any,
          undefinedChannel: undefined as any,
        },
      });

      expect(mastra.getChannel('valid')).toBe(validChannel);
      expect(Object.keys(mastra.getChannels())).toHaveLength(1);
    });
  });

  describe('webhook route auto-wiring', () => {
    it('adds channel webhook routes to server config', () => {
      const channel = new TestChannel({
        name: 'test',
        webhookPath: '/channels/test/webhook',
        routes: { agent: { events: ['message'] } },
      });

      const mastra = new Mastra({
        logger: false,
        channels: { test: channel },
      });

      const server = mastra.getServer();
      expect(server?.apiRoutes).toBeDefined();
      expect(server?.apiRoutes?.length).toBeGreaterThan(0);

      const webhookRoute = server?.apiRoutes?.find(r => r.path === '/channels/test/webhook');
      expect(webhookRoute).toBeDefined();
      expect(webhookRoute?.method).toBe('POST');
      expect(webhookRoute?.requiresAuth).toBe(false);
    });

    it('merges channel routes with existing server routes', () => {
      const channel = new TestChannel({
        name: 'test',
        webhookPath: '/channels/test/webhook',
        routes: { agent: { events: ['message'] } },
      });

      const existingRoute: ApiRoute = {
        path: '/api/custom',
        method: 'GET',
        handler: async () => new Response('ok'),
      };

      const mastra = new Mastra({
        logger: false,
        channels: { test: channel },
        server: {
          apiRoutes: [existingRoute],
        },
      });

      const server = mastra.getServer();
      expect(server?.apiRoutes?.length).toBe(2);

      const customRoute = server?.apiRoutes?.find(r => r.path === '/api/custom');
      expect(customRoute).toBeDefined();

      const webhookRoute = server?.apiRoutes?.find(r => r.path === '/channels/test/webhook');
      expect(webhookRoute).toBeDefined();
    });

    it('adds routes from multiple channels', () => {
      const channel1 = new TestChannel({
        name: 'slack',
        webhookPath: '/channels/slack/webhook',
        routes: { agent: { events: ['message'] } },
      });
      const channel2 = new TestChannel({
        name: 'discord',
        webhookPath: '/channels/discord/webhook',
        routes: { agent: { events: ['message'] } },
      });

      const mastra = new Mastra({
        logger: false,
        channels: { slack: channel1, discord: channel2 },
      });

      const server = mastra.getServer();
      expect(server?.apiRoutes?.length).toBe(2);

      expect(server?.apiRoutes?.find(r => r.path === '/channels/slack/webhook')).toBeDefined();
      expect(server?.apiRoutes?.find(r => r.path === '/channels/discord/webhook')).toBeDefined();
    });
  });

  describe('channel with agents', () => {
    it('can access agents registered in the same Mastra instance', () => {
      const agent = createTestAgent('slack-agent');
      const channel = new TestChannel({
        name: 'slack',
        routes: { 'slack-agent': { events: ['message'] } },
      });

      const mastra = new Mastra({
        logger: false,
        agents: { 'slack-agent': agent },
        channels: { slack: channel },
      });

      // Both should be accessible
      expect(mastra.getAgent('slack-agent')).toBe(agent);
      expect(mastra.getChannel('slack')).toBe(channel);
    });
  });

  describe('processWebhookEvent integration', () => {
    it('returns handled: false when no agent is configured for event type', async () => {
      const channel = new TestChannel({
        name: 'test',
        routes: { 'test-agent': { events: ['message'] } },
      });

      const mastra = new Mastra({
        logger: false,
        channels: { test: channel },
      });

      const event: ChannelEvent = {
        type: 'reaction', // Not configured
        platform: 'test-platform',
        externalThreadId: 'thread-1',
        externalChannelId: 'channel-1',
        userId: 'user-1',
        rawEvent: {},
      };

      const result = await channel.processWebhookEvent({ event, mastra });

      expect(result.handled).toBe(false);
      expect(result.agentName).toBeUndefined();
    });

    it('resolves agent correctly for matching event type', async () => {
      const agent = createTestAgent('test-agent', 'Response');
      const channel = new TestChannel({
        name: 'test',
        routes: { 'test-agent': { events: ['message'] } },
      });

      const mastra = new Mastra({
        logger: false,
        agents: { 'test-agent': agent },
        channels: { test: channel },
      });

      // Test that agent resolution works
      const agentName = (channel as any).resolveAgentForEvent('message');
      expect(agentName).toBe('test-agent');

      // And that the agent can be retrieved
      expect(mastra.getAgent('test-agent')).toBe(agent);
    });
  });
});
