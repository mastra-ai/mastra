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
    sendMessage: vi.fn().mockReturnValue({
      accepted: Promise.resolve({ action: 'deliver', runId: 'run-1' }),
    }),
    subscribeToThread: vi.fn().mockResolvedValue({
      stream: (async function* () {})(),
      activeRunId: () => null,
      abort: () => false,
      unsubscribe: vi.fn(),
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

  describe('message routing', () => {
    it('routes inbound channel messages through sendMessage with channel metadata', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChannels.initialize(mockMastra);

      const chatThread = {
        id: 'channel-1:thread-1',
        channelId: 'channel-1',
        isDM: false,
        adapter: agentChannels.adapters.discord,
        isSubscribed: vi.fn().mockResolvedValue(true),
        subscribe: vi.fn().mockResolvedValue(undefined),
        mentionUser: vi.fn((userId: string) => `<@${userId}>`),
        messages: (async function* () {})(),
      } as any;
      const message = {
        id: 'message-1',
        text: 'hello from discord',
        author: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes' },
        attachments: [],
      } as any;

      await (agentChannels as any).processChatMessage(chatThread, message, mockMastra);

      expect(mockAgent.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        {
          contents: 'hello from discord',
          attributes: {
            messageId: 'message-1',
            authorName: 'Tyler Barnes',
            authorId: 'user-1',
            authorMention: '<@user-1>',
          },
          providerOptions: {
            mastra: {
              channels: {
                discord: {
                  messageId: 'message-1',
                  author: {
                    userId: 'user-1',
                    userName: 'tyler',
                    fullName: 'Tyler Barnes',
                    mention: '<@user-1>',
                  },
                },
              },
            },
          },
        },
        expect.objectContaining({
          resourceId: 'discord:user-1',
          threadId: expect.any(String),
          ifIdle: expect.objectContaining({
            behavior: 'wake',
            streamOptions: expect.objectContaining({
              requestContext: expect.any(Object),
              memory: expect.objectContaining({ resource: 'discord:user-1' }),
            }),
          }),
        }),
      );
    });

    it('consumes the run stream when the signal outcome is `wake`', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChannels.initialize(mockMastra);

      const consumeStream = vi.fn().mockResolvedValue(undefined);
      mockAgent.sendMessage.mockReturnValueOnce({
        accepted: Promise.resolve({ action: 'wake', runId: 'run-1', output: { consumeStream } }),
      });

      const chatThread = {
        id: 'channel-1:thread-1',
        channelId: 'channel-1',
        isDM: false,
        adapter: agentChannels.adapters.discord,
        isSubscribed: vi.fn().mockResolvedValue(true),
        subscribe: vi.fn().mockResolvedValue(undefined),
        mentionUser: vi.fn((userId: string) => `<@${userId}>`),
        messages: (async function* () {})(),
      } as any;
      const message = {
        id: 'message-1',
        text: 'hello',
        author: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes' },
        attachments: [],
      } as any;

      await (agentChannels as any).processChatMessage(chatThread, message, mockMastra);

      expect(consumeStream).toHaveBeenCalledTimes(1);
    });

    it('does not consume a stream when the signal outcome is not `wake`', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChannels.initialize(mockMastra);

      // Stub resolves the outcome to `deliver` (signal handed off) with a consumeStream spy.
      const consumeStream = vi.fn().mockResolvedValue(undefined);
      mockAgent.sendMessage.mockReturnValueOnce({
        accepted: Promise.resolve({ action: 'deliver', runId: 'run-1', output: { consumeStream } }),
      });

      const chatThread = {
        id: 'channel-1:thread-1',
        channelId: 'channel-1',
        isDM: false,
        adapter: agentChannels.adapters.discord,
        isSubscribed: vi.fn().mockResolvedValue(true),
        subscribe: vi.fn().mockResolvedValue(undefined),
        mentionUser: vi.fn((userId: string) => `<@${userId}>`),
        messages: (async function* () {})(),
      } as any;
      const message = {
        id: 'message-1',
        text: 'hello',
        author: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes' },
        attachments: [],
      } as any;

      await expect((agentChannels as any).processChatMessage(chatThread, message, mockMastra)).resolves.not.toThrow();
      expect(consumeStream).not.toHaveBeenCalled();
    });
  });

  describe('resolveResourceId', () => {
    function makeChatThread(overrides: Record<string, unknown> = {}) {
      return {
        id: 'channel-1:thread-1',
        channelId: 'channel-1',
        isDM: false,
        adapter: undefined as any, // set per-test from the channels instance
        isSubscribed: vi.fn().mockResolvedValue(true),
        subscribe: vi.fn().mockResolvedValue(undefined),
        mentionUser: vi.fn((userId: string) => `<@${userId}>`),
        messages: (async function* () {})(),
        ...overrides,
      } as any;
    }

    const message = {
      id: 'message-1',
      text: 'hi',
      author: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes' },
      attachments: [],
    } as any;

    function makeMastra() {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      return {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;
    }

    it('uses the default `${platform}:${author.userId}` when no resolver is set', async () => {
      const mockMastra = makeMastra();
      await agentChannels.initialize(mockMastra);
      const chatThread = makeChatThread({ adapter: agentChannels.adapters.discord });

      await (agentChannels as any).processChatMessage(chatThread, message, mockMastra);

      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          resourceId: 'discord:user-1',
          ifIdle: expect.objectContaining({
            streamOptions: expect.objectContaining({
              memory: expect.objectContaining({ resource: 'discord:user-1' }),
            }),
          }),
        }),
      );
    });

    it('uses the resolver return value as the new thread resourceId (DM uses bare SSO id)', async () => {
      const resolveResourceId = vi.fn(async () => 'sso-user-42');
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        resolveResourceId,
      });
      channels.__setAgent(mockAgent);

      const mockMastra = makeMastra();
      await channels.initialize(mockMastra);
      const chatThread = makeChatThread({ adapter: channels.adapters.discord, isDM: true });

      await (channels as any).processChatMessage(chatThread, message, mockMastra);

      expect(resolveResourceId).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'discord',
          thread: chatThread,
          message,
          defaultResourceId: 'discord:user-1',
        }),
      );
      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          resourceId: 'sso-user-42',
          ifIdle: expect.objectContaining({
            streamOptions: expect.objectContaining({
              memory: expect.objectContaining({ resource: 'sso-user-42' }),
            }),
          }),
        }),
      );
    });

    it('scopes a group chat to its channelId while keeping the sender as actor', async () => {
      const resolveResourceId = vi.fn(async ({ thread, defaultResourceId }: any) =>
        thread.isDM ? defaultResourceId : thread.channelId,
      );
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        resolveResourceId,
      });
      channels.__setAgent(mockAgent);

      const mockMastra = makeMastra();
      await channels.initialize(mockMastra);
      const chatThread = makeChatThread({ adapter: channels.adapters.discord, isDM: false });

      await (channels as any).processChatMessage(chatThread, message, mockMastra);

      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        // actor identity stays the sender
        expect.objectContaining({
          attributes: expect.objectContaining({ authorId: 'user-1' }),
        }),
        // memory owner is the group/channel
        expect.objectContaining({
          resourceId: 'channel-1',
          ifIdle: expect.objectContaining({
            streamOptions: expect.objectContaining({
              memory: expect.objectContaining({ resource: 'channel-1' }),
            }),
          }),
        }),
      );
    });

    it('returning defaultResourceId keeps the built-in behavior', async () => {
      const resolveResourceId = vi.fn(async ({ defaultResourceId }: any) => defaultResourceId);
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        resolveResourceId,
      });
      channels.__setAgent(mockAgent);

      const mockMastra = makeMastra();
      await channels.initialize(mockMastra);
      const chatThread = makeChatThread({ adapter: channels.adapters.discord });

      await (channels as any).processChatMessage(chatThread, message, mockMastra);

      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ resourceId: 'discord:user-1' }),
      );
    });

    it('does not run the resolver when reusing an existing thread (keeps stored owner)', async () => {
      const resolveResourceId = vi.fn(async () => 'should-not-be-used');
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        resolveResourceId,
      });
      channels.__setAgent(mockAgent);

      const mockMastra = makeMastra();
      await channels.initialize(mockMastra);

      // Pre-create the mastra thread with a fixed owner, using the same channel metadata
      // the handler queries on, so getOrCreateThread reuses it instead of creating a new one.
      const memoryStore = await mockMastra.getStorage().getStore('memory');
      await memoryStore.saveThread({
        thread: {
          id: 'pre-existing',
          title: 'discord conversation',
          resourceId: 'original-owner',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            channel_platform: 'discord',
            channel_externalThreadId: 'channel-1:thread-1',
            channel_externalChannelId: 'channel-1',
          },
        },
      });

      const chatThread = makeChatThread({ adapter: channels.adapters.discord });
      await (channels as any).processChatMessage(chatThread, message, mockMastra);

      // The reused thread's stored owner drives memory, and the resolver is never
      // called; existing conversations don't depend on the resolver being available.
      expect(resolveResourceId).not.toHaveBeenCalled();
      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          resourceId: 'original-owner',
          ifIdle: expect.objectContaining({
            streamOptions: expect.objectContaining({
              memory: expect.objectContaining({ resource: 'original-owner' }),
            }),
          }),
        }),
      );
    });

    it('does not fail an existing thread when the resolver throws', async () => {
      const resolveResourceId = vi.fn(async () => {
        throw new Error('SSO unavailable');
      });
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        resolveResourceId,
      });
      channels.__setAgent(mockAgent);

      const mockMastra = makeMastra();
      await channels.initialize(mockMastra);

      // Pre-create the thread so the handler reuses it instead of creating one.
      const memoryStore = await mockMastra.getStorage().getStore('memory');
      await memoryStore.saveThread({
        thread: {
          id: 'pre-existing',
          title: 'discord conversation',
          resourceId: 'original-owner',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            channel_platform: 'discord',
            channel_externalThreadId: 'channel-1:thread-1',
            channel_externalChannelId: 'channel-1',
          },
        },
      });

      const chatThread = makeChatThread({ adapter: channels.adapters.discord });

      // A flaky resolver must not break message handling on an existing thread.
      await expect((channels as any).processChatMessage(chatThread, message, mockMastra)).resolves.not.toThrow();
      expect(resolveResourceId).not.toHaveBeenCalled();
      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ resourceId: 'original-owner' }),
      );
    });
  });

  describe('resolveThreadId', () => {
    function makeChatThread(overrides: Record<string, unknown> = {}) {
      return {
        id: 'channel-1:thread-1',
        channelId: 'channel-1',
        isDM: false,
        adapter: undefined as any,
        isSubscribed: vi.fn().mockResolvedValue(true),
        subscribe: vi.fn().mockResolvedValue(undefined),
        mentionUser: vi.fn((userId: string) => `<@${userId}>`),
        messages: (async function* () {})(),
        ...overrides,
      } as any;
    }

    const message = {
      id: 'message-1',
      text: 'hi',
      author: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes' },
      attachments: [],
    } as any;

    function makeMastra() {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      return {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;
    }

    it('creates the new thread with the resolver id, after the resourceId resolves', async () => {
      const resolveResourceId = vi.fn(async () => 'session-abc');
      const resolveThreadId = vi.fn(async ({ resourceId }: any) => resourceId);
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        resolveResourceId,
        resolveThreadId,
      });
      channels.__setAgent(mockAgent);

      const mockMastra = makeMastra();
      await channels.initialize(mockMastra);
      const chatThread = makeChatThread({ adapter: channels.adapters.discord, isDM: true });

      await (channels as any).processChatMessage(chatThread, message, mockMastra);

      // The hook saw the resolved owner and the built-in default.
      expect(resolveThreadId).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'discord',
          thread: chatThread,
          message,
          resourceId: 'session-abc',
          defaultThreadId: expect.any(String),
        }),
      );
      // The stored thread carries the hook's id (= the session id here), so a
      // host addressing threads by session id resolves this thread directly.
      const memoryStore = await mockMastra.getStorage().getStore('memory');
      const stored = await memoryStore.getThreadById({ threadId: 'session-abc' });
      expect(stored).toMatchObject({ id: 'session-abc', resourceId: 'session-abc' });
      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          ifIdle: expect.objectContaining({
            streamOptions: expect.objectContaining({
              memory: expect.objectContaining({ thread: 'session-abc' }),
            }),
          }),
        }),
      );
    });

    it('returning defaultThreadId keeps the built-in random id', async () => {
      const resolveThreadId = vi.fn(async ({ defaultThreadId }: any) => defaultThreadId);
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        resolveThreadId,
      });
      channels.__setAgent(mockAgent);

      const mockMastra = makeMastra();
      await channels.initialize(mockMastra);
      const chatThread = makeChatThread({ adapter: channels.adapters.discord });

      await (channels as any).processChatMessage(chatThread, message, mockMastra);

      const [{ defaultThreadId }] = resolveThreadId.mock.calls[0]!;
      const memoryStore = await mockMastra.getStorage().getStore('memory');
      const stored = await memoryStore.getThreadById({ threadId: defaultThreadId });
      expect(stored).toMatchObject({ id: defaultThreadId, resourceId: 'discord:user-1' });
    });

    it('does not run the resolver when reusing an existing thread (keeps stored id)', async () => {
      const resolveThreadId = vi.fn(async () => 'should-not-be-used');
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        resolveThreadId,
      });
      channels.__setAgent(mockAgent);

      const mockMastra = makeMastra();
      await channels.initialize(mockMastra);

      const memoryStore = await mockMastra.getStorage().getStore('memory');
      await memoryStore.saveThread({
        thread: {
          id: 'pre-existing',
          title: 'discord conversation',
          resourceId: 'original-owner',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            channel_platform: 'discord',
            channel_externalThreadId: 'channel-1:thread-1',
            channel_externalChannelId: 'channel-1',
          },
        },
      });

      const chatThread = makeChatThread({ adapter: channels.adapters.discord });
      await (channels as any).processChatMessage(chatThread, message, mockMastra);

      expect(resolveThreadId).not.toHaveBeenCalled();
      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          ifIdle: expect.objectContaining({
            streamOptions: expect.objectContaining({
              memory: expect.objectContaining({ thread: 'pre-existing' }),
            }),
          }),
        }),
      );
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
