import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage/mock';
import { createTestAgent, createTestController } from './test-utils';

// Minimal mock adapter satisfying the Chat SDK Adapter interface
function createMockAdapter(name: string) {
  return {
    name,
    postMessage: vi.fn().mockResolvedValue({ id: 'sent-1', text: 'ok' }),
    editMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    handleWebhook: vi.fn().mockResolvedValue(new Response('ok', { status: 200 })),
    initialize: vi.fn().mockResolvedValue(undefined),
    fetchMessages: vi.fn().mockResolvedValue([]),
    encodeThreadId: vi.fn((...parts: string[]) => parts.join(':')),
    decodeThreadId: vi.fn((id: string) => id.split(':')),
    channelIdFromThreadId: vi.fn((id: string) => id.split(':')[0]),
    renderFormatted: vi.fn((text: string) => text),
    fetchThread: vi.fn().mockResolvedValue(null),
    startTyping: vi.fn().mockResolvedValue(undefined),
    parseMessage: vi.fn((raw: unknown) => raw),
    userName: 'TestBot',
  } as any;
}

function createChannelsController() {
  return createTestController({
    id: 'ctrl-1',
    storage: new InMemoryStore(),
    channels: { adapters: { discord: createMockAdapter('discord') } },
  });
}

describe('AgentController channels ↔ Mastra registration', () => {
  it('exposes the controller webhook route and initializes the Chat SDK', async () => {
    const controller = createChannelsController();
    const mastra = new Mastra({ logger: false, agentControllers: { code: controller } });

    const paths = (mastra.getServer()?.apiRoutes ?? []).map(r => r.path);
    expect(paths).toContain('/api/agent-controllers/ctrl-1/channels/discord/webhook');

    // Registration kicks off a fire-and-forget initialize; a second call
    // dedupes onto the in-flight init, so awaiting it observes completion.
    const channels = controller.getChannels()!;
    await channels.initialize(mastra);
    expect(channels.sdk).not.toBeNull();
  });

  it('includes controller channels in getChannels() without duplicating them under agent keys', async () => {
    const controller = createChannelsController();
    const mastra = new Mastra({ logger: false, agentControllers: { code: controller } });

    await controller.init();
    // Mode agents carry the controller's channels on the instance (propagated
    // via setChannels, mirroring setBrowser) — not on the per-run request context.
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const modeAgent = controller.getCurrentAgent(session);
    expect(modeAgent.getChannels()).toBe(controller.getChannels());

    const channels = mastra.getChannels();
    expect(channels.code).toBe(controller.getChannels());
    // The controller's channels must be reported once, under the controller key only.
    const duplicateKeys = Object.entries(channels)
      .filter(([key, value]) => key !== 'code' && value === controller.getChannels())
      .map(([key]) => key);
    expect(duplicateKeys).toEqual([]);
  });

  it('leaves agent channel registration untouched alongside a channels-configured controller', async () => {
    const controller = createChannelsController();
    const agent = createTestAgent({
      id: 'channel-agent',
      name: 'channel-agent',
      channels: { adapters: { slack: createMockAdapter('slack') } },
    });
    const mastra = new Mastra({
      logger: false,
      agents: { channelAgent: agent },
      agentControllers: { code: controller },
      storage: new InMemoryStore(),
    });

    const paths = (mastra.getServer()?.apiRoutes ?? []).map(r => r.path);
    expect(paths).toContain('/api/agents/channel-agent/channels/slack/webhook');
    expect(paths).toContain('/api/agent-controllers/ctrl-1/channels/discord/webhook');

    const channels = mastra.getChannels();
    expect(channels.channelAgent).toBe(agent.getChannels());
    expect(channels.code).toBe(controller.getChannels());
  });

  it('adds no webhook routes or getChannels entries for controllers without channels', () => {
    const controller = createTestController({ id: 'plain-ctrl', storage: new InMemoryStore() });
    const mastra = new Mastra({ logger: false, agentControllers: { code: controller } });

    const paths = (mastra.getServer()?.apiRoutes ?? []).map(r => r.path);
    expect(paths.some(p => p.includes('agent-controllers'))).toBe(false);
    expect(mastra.getChannels()).toEqual({});
  });
});
