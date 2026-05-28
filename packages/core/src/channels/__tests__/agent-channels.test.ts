import { describe, it, expect, vi, beforeEach } from 'vitest';

import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../storage/domains/memory/inmemory';
import { AgentChannels } from '../agent-channels';
import { matchesDomain, extractUrls } from '../inline-media';

// Minimal mock adapter that satisfies the Chat SDK's Adapter interface
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
    channelIdFromThreadId: vi.fn((id: string) => id.split(':').slice(0, 2).join(':')),
    renderFormatted: vi.fn((text: string) => text),
    fetchThread: vi.fn().mockResolvedValue(null),
    startTyping: vi.fn().mockResolvedValue(undefined),
    parseMessage: vi.fn((raw: unknown) => raw),
    userName: 'TestBot',
  } as any;
}

function createMockAgent(name = 'test-agent') {
  return {
    id: name,
    name,
    stream: vi.fn().mockResolvedValue({
      textStream: new ReadableStream({
        start(controller) {
          controller.enqueue('Hello!');
          controller.close();
        },
      }),
    }),
    getMemory: vi.fn().mockResolvedValue(null),
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  } as any;
}

describe('AgentChannels', () => {
  let agentChannels: AgentChannels;
  let mockAgent: ReturnType<typeof createMockAgent>;

  beforeEach(() => {
    mockAgent = createMockAgent();
    agentChannels = new AgentChannels({
      adapters: {
        discord: createMockAdapter('discord'),
        slack: createMockAdapter('slack'),
      },
    });
    agentChannels.__setAgent(mockAgent);
  });

  describe('adapters', () => {
    it('returns all adapters', () => {
      expect(Object.keys(agentChannels.adapters)).toEqual(['discord', 'slack']);
    });

    it('returns a specific adapter by key', () => {
      const adapter = agentChannels.adapters['discord'];
      expect(adapter).toBeDefined();
      expect(adapter!.name).toBe('discord');
    });

    it('returns undefined for unknown adapter key', () => {
      expect(agentChannels.adapters['teams']).toBeUndefined();
    });
  });

  describe('getTools', () => {
    it('generates reaction tools', () => {
      const tools = agentChannels.getTools();
      const toolNames = Object.keys(tools);

      expect(toolNames).toContain('add_reaction');
      expect(toolNames).toContain('remove_reaction');
      expect(toolNames).toHaveLength(2);
    });

    it('returns no tools when tools: false', () => {
      const disabled = new AgentChannels({
        adapters: { test: createMockAdapter('test') },
        tools: false,
      });
      expect(Object.keys(disabled.getTools())).toHaveLength(0);
    });
  });

  describe('getInputProcessors', () => {
    it('adds ChatChannelProcessor by default', () => {
      const processors = agentChannels.getInputProcessors();
      expect(processors).toHaveLength(1);
      expect(processors[0]!.id).toBe('chat-channel-context');
    });

    it('skips ChatChannelProcessor entirely when threadContext.addSystemMessage is false', () => {
      const disabled = new AgentChannels({
        adapters: { test: createMockAdapter('test') },
        threadContext: { addSystemMessage: false },
      });
      expect(disabled.getInputProcessors()).toEqual([]);
    });

    it('skips when the user already provided a ChatChannelProcessor', () => {
      const userProcessor = { id: 'chat-channel-context', processInputStep: () => undefined } as any;
      expect(agentChannels.getInputProcessors([userProcessor])).toEqual([]);
    });
  });

  describe('channelConfig', () => {
    it('exposes the original ChannelConfig (round-trippable)', () => {
      const discord = createMockAdapter('discord');
      const slack = createMockAdapter('slack');
      const handlers = { onDirectMessage: false } as const;
      const originalConfig = {
        adapters: { discord, slack: { adapter: slack, gateway: true } },
        handlers,
        inlineMedia: ['image/png', 'image/jpeg'],
        inlineLinks: ['imgur.com'],
        userName: 'TestBot',
        threadContext: { maxMessages: 5 },
        tools: false,
        chatOptions: { dedupeTtlMs: 1000 },
      };
      const channels = new AgentChannels(originalConfig as any);

      expect(channels.channelConfig).toBe(originalConfig);
    });

    it('preserves the per-adapter streaming option', () => {
      const adapter = createMockAdapter('test');
      const streaming = new AgentChannels({
        adapters: { test: { adapter, streaming: { updateIntervalMs: 250 } } },
      });
      expect(streaming.channelConfig.adapters.test).toMatchObject({
        streaming: { updateIntervalMs: 250 },
      });

      const buffered = new AgentChannels({ adapters: { test: createMockAdapter('test') } });
      // No adapter config wrapping means no streaming opt-in.
      expect((buffered.channelConfig.adapters.test as any).streaming).toBeUndefined();
    });

    it('lets a provider rebuild AgentChannels while preserving existing adapters', () => {
      // Simulate the SlackProvider merge pattern: agent author configured Discord,
      // then a provider needs to inject Slack without losing Discord.
      const discord = createMockAdapter('discord');
      const original = new AgentChannels({
        adapters: { discord },
        userName: 'OriginalBot',
      });

      const slack = createMockAdapter('slack');
      const merged = new AgentChannels({
        ...original.channelConfig,
        adapters: { ...original.channelConfig.adapters, slack },
        userName: 'ProviderBot',
      });

      expect(Object.keys(merged.adapters).sort()).toEqual(['discord', 'slack']);
      expect(merged.adapters.discord).toBe(discord);
      expect(merged.adapters.slack).toBe(slack);
    });
  });

  describe('getWebhookRoutes', () => {
    it('generates one route per adapter', () => {
      const routes = agentChannels.getWebhookRoutes();
      expect(routes).toHaveLength(2);
    });

    it('generates routes with correct paths', () => {
      const routes = agentChannels.getWebhookRoutes();
      const paths = routes.map(r => r.path);

      expect(paths).toContain('/api/agents/test-agent/channels/discord/webhook');
      expect(paths).toContain('/api/agents/test-agent/channels/slack/webhook');
    });

    it('generates POST routes without auth', () => {
      const routes = agentChannels.getWebhookRoutes();

      for (const route of routes) {
        expect(route.method).toBe('POST');
        expect(route.requiresAuth).toBe(false);
      }
    });

    it('adds adapter CORS config to generated webhook routes', () => {
      const channels = new AgentChannels({
        adapters: {
          web: {
            adapter: createMockAdapter('web'),
            cors: {
              origin: ['https://customer-saas.example'],
              credentials: true,
            },
          },
        },
      });
      channels.__setAgent(mockAgent);

      const route = channels.getWebhookRoutes()[0];

      expect(route?.cors).toEqual({
        origin: ['https://customer-saas.example'],
        credentials: true,
      });
    });

    it('handles Hono contexts without ExecutionContext without throwing', async () => {
      const webhookFn = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      (agentChannels as any).initPromise = Promise.resolve();
      (agentChannels as any).chat = { webhooks: { slack: webhookFn } };

      const slackRoute = agentChannels.getWebhookRoutes().find(route => route.path.endsWith('/slack/webhook')) as any;
      expect(slackRoute).toBeDefined();

      const handler = await slackRoute.createHandler({} as any);
      const request = new Request('http://localhost/api/agents/test-agent/channels/slack/webhook', {
        method: 'POST',
        body: JSON.stringify({ type: 'url_verification', challenge: 'abc' }),
        headers: { 'content-type': 'application/json' },
      });

      const ctx = {
        req: { raw: request },
        json: (body: unknown, status?: number) => new Response(JSON.stringify(body), { status: status ?? 200 }),
        get executionCtx() {
          throw new Error('This context has no ExecutionContext');
        },
      } as any;

      await expect(handler(ctx)).resolves.toBeInstanceOf(Response);
      expect(webhookFn).toHaveBeenCalledTimes(1);
      expect(webhookFn).toHaveBeenCalledWith(request, undefined);
    });
  });

  describe('sdk getter', () => {
    it('returns null before initialization', () => {
      expect(agentChannels.sdk).toBeNull();
    });

    it('returns Chat instance after initialization', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChannels.initialize(mockMastra);

      expect(agentChannels.sdk).not.toBeNull();
      expect(agentChannels.sdk).toHaveProperty('onDirectMessage');
      expect(agentChannels.sdk).toHaveProperty('onNewMention');
      expect(agentChannels.sdk).toHaveProperty('onReaction');
    });

    it('allows registering additional event handlers', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChannels.initialize(mockMastra);

      const handler = vi.fn();
      // Should not throw - handler is added alongside our internal handlers
      agentChannels.sdk!.onReaction(handler);

      // Verify handler was registered (Chat SDK uses array, so multiple handlers work)
      expect(agentChannels.sdk).not.toBeNull();
    });

    it('exposes Chat SDK methods for custom event handling', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChannels.initialize(mockMastra);

      // Verify common Chat SDK methods are available
      expect(typeof agentChannels.sdk!.onDirectMessage).toBe('function');
      expect(typeof agentChannels.sdk!.onNewMention).toBe('function');
      expect(typeof agentChannels.sdk!.onReaction).toBe('function');
      expect(typeof agentChannels.sdk!.onNewMessage).toBe('function');
    });
  });

  describe('close', () => {
    it('unsubscribes all cached thread subscriptions', () => {
      const unsubscribeA = vi.fn();
      const unsubscribeB = vi.fn();
      // Seed the internal cache with two fake subscriptions to verify close() drains them.
      (agentChannels as any).threadSubscriptions.set('thread-a', {
        subscription: { unsubscribe: unsubscribeA },
        consumer: Promise.resolve(),
      });
      (agentChannels as any).threadSubscriptions.set('thread-b', {
        subscription: { unsubscribe: unsubscribeB },
        consumer: Promise.resolve(),
      });

      (agentChannels as any).pendingApprovalCards.set('run-1', { channel: 'C', ts: '123' });

      agentChannels.close();

      expect(unsubscribeA).toHaveBeenCalledTimes(1);
      expect(unsubscribeB).toHaveBeenCalledTimes(1);
      expect((agentChannels as any).threadSubscriptions.size).toBe(0);
      expect((agentChannels as any).pendingApprovalCards.size).toBe(0);
    });

    it('is safe to call without any subscriptions', () => {
      expect(() => agentChannels.close()).not.toThrow();
    });

    it('swallows errors from individual unsubscribe calls', () => {
      const failing = vi.fn(() => {
        throw new Error('boom');
      });
      const succeeding = vi.fn();
      (agentChannels as any).threadSubscriptions.set('thread-a', {
        subscription: { unsubscribe: failing },
        consumer: Promise.resolve(),
      });
      (agentChannels as any).threadSubscriptions.set('thread-b', {
        subscription: { unsubscribe: succeeding },
        consumer: Promise.resolve(),
      });

      expect(() => agentChannels.close()).not.toThrow();
      expect(failing).toHaveBeenCalledTimes(1);
      expect(succeeding).toHaveBeenCalledTimes(1);
      expect((agentChannels as any).threadSubscriptions.size).toBe(0);
    });
  });

  describe('getOrCreateThread caching', () => {
    function makeMastraStub() {
      const listThreads = vi.fn().mockResolvedValue({
        threads: [
          {
            id: 'mastra-thread-1',
            resourceId: 'discord:user1',
            title: 'Test',
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {},
          },
        ],
      });
      const saveThread = vi.fn();
      const memoryStore = { listThreads, saveThread } as any;
      const storage = { getStore: vi.fn().mockResolvedValue(memoryStore) } as any;
      const mastra = { getStorage: vi.fn().mockReturnValue(storage) } as any;
      return { mastra, listThreads, saveThread, memoryStore };
    }

    it('only hits storage once for repeated lookups of the same external thread id', async () => {
      const { mastra, listThreads } = makeMastraStub();

      const a = await (agentChannels as any).getOrCreateThread({
        externalThreadId: 'discord:guild:chan:thread-x',
        channelId: 'discord:guild:chan',
        platform: 'discord',
        resourceId: 'discord:user1',
        mastra,
      });
      const b = await (agentChannels as any).getOrCreateThread({
        externalThreadId: 'discord:guild:chan:thread-x',
        channelId: 'discord:guild:chan',
        platform: 'discord',
        resourceId: 'discord:user1',
        mastra,
      });

      expect(a).toEqual({ id: 'mastra-thread-1', resourceId: 'discord:user1' });
      expect(b).toEqual(a);
      expect(listThreads).toHaveBeenCalledTimes(1);
    });

    it('scopes the cache by platform', async () => {
      const { mastra, listThreads } = makeMastraStub();

      await (agentChannels as any).getOrCreateThread({
        externalThreadId: 'shared:thread-id',
        channelId: 'shared:chan',
        platform: 'slack',
        resourceId: 'slack:user1',
        mastra,
      });
      await (agentChannels as any).getOrCreateThread({
        externalThreadId: 'shared:thread-id',
        channelId: 'shared:chan',
        platform: 'discord',
        resourceId: 'discord:user1',
        mastra,
      });

      // Same externalThreadId but different platform must not collide.
      expect(listThreads).toHaveBeenCalledTimes(2);
    });

    it('caches newly created threads too', async () => {
      const { mastra, listThreads, saveThread } = makeMastraStub();
      listThreads.mockResolvedValue({ threads: [] });
      saveThread.mockResolvedValue({
        id: 'mastra-thread-new',
        resourceId: 'discord:user1',
        title: 'created',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      });

      const args = {
        externalThreadId: 'discord:guild:chan:fresh',
        channelId: 'discord:guild:chan',
        platform: 'discord',
        resourceId: 'discord:user1',
        mastra,
      };
      const first = await (agentChannels as any).getOrCreateThread(args);
      const second = await (agentChannels as any).getOrCreateThread(args);

      expect(first).toEqual({ id: 'mastra-thread-new', resourceId: 'discord:user1' });
      expect(second).toEqual(first);
      expect(listThreads).toHaveBeenCalledTimes(1);
      expect(saveThread).toHaveBeenCalledTimes(1);
    });
  });
});

describe('matchesDomain', () => {
  it('matches exact hostname', () => {
    expect(matchesDomain('https://youtube.com/watch?v=123', 'youtube.com')).toBe(true);
  });

  it('matches subdomain', () => {
    expect(matchesDomain('https://www.youtube.com/watch?v=123', 'youtube.com')).toBe(true);
  });

  it('rejects unrelated domain', () => {
    expect(matchesDomain('https://example.com/page', 'youtube.com')).toBe(false);
  });

  it('wildcard matches everything', () => {
    expect(matchesDomain('https://anything.example.org/path', '*')).toBe(true);
  });

  it('returns false for invalid URL', () => {
    expect(matchesDomain('not-a-url', 'example.com')).toBe(false);
  });

  it('does not match partial domain names', () => {
    expect(matchesDomain('https://notyoutube.com/watch', 'youtube.com')).toBe(false);
  });
});

describe('extractUrls', () => {
  it('extracts http and https URLs', () => {
    const text = 'Check out https://example.com and http://other.org/page';
    expect(extractUrls(text)).toEqual(['https://example.com', 'http://other.org/page']);
  });

  it('returns empty array for no URLs', () => {
    expect(extractUrls('just plain text')).toEqual([]);
  });

  it('handles URLs with query params and fragments', () => {
    const text = 'Watch https://youtube.com/watch?v=abc123&t=10#section';
    const urls = extractUrls(text);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('youtube.com/watch?v=abc123');
  });

  it('extracts multiple URLs from one message', () => {
    const text = 'See https://a.com and https://b.com and https://c.com';
    expect(extractUrls(text)).toHaveLength(3);
  });

  it('stops at closing angle brackets and parens', () => {
    const text = 'Link: <https://example.com> or (https://other.com)';
    expect(extractUrls(text)).toEqual(['https://example.com', 'https://other.com']);
  });
});
