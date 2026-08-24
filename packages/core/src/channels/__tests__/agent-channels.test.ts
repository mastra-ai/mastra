import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Agent } from '../../agent';
import { RequestContext } from '../../request-context';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../storage/domains/memory/inmemory';
import { AgentChannels } from '../agent-channels';
import { getChatModule } from '../chat-lazy';
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

  describe('channel tools are not auto-injected into an agent toolset', () => {
    it('resolves a channel-bearing agent toolset without the channel tools', async () => {
      // getTools() still returns the channel tools (the explicit opt-in)...
      const channels = new AgentChannels({ adapters: { discord: createMockAdapter('discord') } });
      expect(Object.keys(channels.getTools())).toContain('add_reaction');

      // ...but attaching channels to an agent does not inject them into the
      // agent's resolved toolset.
      const agent = new Agent({
        id: 'no-auto-tools',
        name: 'no-auto-tools',
        instructions: 'test',
        model: 'openai/gpt-4o',
      });
      agent.setChannels(channels);

      const resolved = await agent.getToolsForExecution({});
      const toolNames = Object.keys(resolved);
      expect(toolNames).not.toContain('add_reaction');
      expect(toolNames).not.toContain('remove_reaction');
    });

    it('resolves the channel tools when passed explicitly via tools: { ...channels.getTools() }', async () => {
      const channels = new AgentChannels({ adapters: { discord: createMockAdapter('discord') } });
      const agent = new Agent({
        id: 'explicit-tools',
        name: 'explicit-tools',
        instructions: 'test',
        model: 'openai/gpt-4o',
        tools: { ...(channels.getTools() as Record<string, any>) },
      });
      agent.setChannels(channels);

      const resolved = await agent.getToolsForExecution({});
      const toolNames = Object.keys(resolved);
      expect(toolNames).toContain('add_reaction');
      expect(toolNames).toContain('remove_reaction');
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

  describe('slash command handling', () => {
    it('registers a catch-all slash command handler and routes commands to the agent', async () => {
      const chatMod = await getChatModule();
      let registeredHandler: ((event: any) => Promise<void>) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onSlashCommand').mockImplementation((handler: any) => {
        registeredHandler = handler;
      });
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      try {
        await agentChannels.initialize(mockMastra);
        expect(registeredHandler).toBeDefined();

        await registeredHandler!({
          adapter: agentChannels.adapters.discord,
          channel: { id: 'channel-1', isDM: false, channelVisibility: 'public' },
          command: '/weather',
          text: 'London',
          triggerId: 'interaction-1',
          user: {
            userId: 'user-1',
            userName: 'tyler',
            fullName: 'Tyler Barnes',
            isBot: false,
            isMe: false,
          },
          raw: { id: 'interaction-1' },
          openModal: vi.fn(),
        });

        expect(mockAgent.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({ contents: '/weather London' }),
          expect.objectContaining({ resourceId: 'discord:user-1' }),
        );
      } finally {
        spy.mockRestore();
      }
    });

    it('supports custom slash command handlers', async () => {
      const chatMod = await getChatModule();
      let registeredHandler: ((event: any) => Promise<void>) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onSlashCommand').mockImplementation((handler: any) => {
        registeredHandler = handler;
      });
      const customHandler = vi.fn().mockResolvedValue(undefined);
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        handlers: { onSlashCommand: customHandler },
      });
      channels.__setAgent(mockAgent);
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = { getStorage: () => ({ getStore: () => memoryStore }), getServer: () => null } as any;
      const event = { command: '/help' } as any;

      try {
        await channels.initialize(mockMastra);
        await registeredHandler!(event);
        expect(customHandler).toHaveBeenCalledWith(
          event,
          expect.any(Function),
          expect.objectContaining({ mastra: mockMastra }),
        );
        expect(mockAgent.sendMessage).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    it('does not register slash command handling when disabled', async () => {
      const chatMod = await getChatModule();
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onSlashCommand');
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        handlers: { onSlashCommand: false },
      });
      channels.__setAgent(mockAgent);
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = { getStorage: () => ({ getStore: () => memoryStore }), getServer: () => null } as any;

      try {
        await channels.initialize(mockMastra);
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
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

      await (agentChannels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

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

    it('skips messages with no text and no attachments', async () => {
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
        isDM: true,
        adapter: agentChannels.adapters.discord,
        isSubscribed: vi.fn().mockResolvedValue(true),
        subscribe: vi.fn().mockResolvedValue(undefined),
        mentionUser: vi.fn((userId: string) => `<@${userId}>`),
        messages: (async function* () {})(),
      } as any;
      // Shape of a read receipt lifted into a Message by the iMessage adapter.
      const message = {
        id: 'spc-msg-abc:read:1004514015',
        text: '',
        author: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes' },
        attachments: [],
      } as any;

      await (agentChannels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

      expect(mockAgent.sendMessage).not.toHaveBeenCalled();
    });

    it('runs on an attachment-only message with no text', async () => {
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
        isDM: true,
        adapter: agentChannels.adapters.discord,
        isSubscribed: vi.fn().mockResolvedValue(true),
        subscribe: vi.fn().mockResolvedValue(undefined),
        mentionUser: vi.fn((userId: string) => `<@${userId}>`),
        messages: (async function* () {})(),
      } as any;
      const message = {
        id: 'message-1',
        text: '',
        author: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes' },
        attachments: [{ type: 'image', mimeType: 'image/png', url: 'https://cdn.example.com/a.png' }],
      } as any;

      await (agentChannels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

      expect(mockAgent.sendMessage).toHaveBeenCalledTimes(1);
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

      await (agentChannels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

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

      await expect(
        (agentChannels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext()),
      ).resolves.not.toThrow();
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

      await (agentChannels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

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

      await (channels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

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

      await (channels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

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

      await (channels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

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
      await (channels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

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
      await expect(
        (channels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext()),
      ).resolves.not.toThrow();
      expect(resolveResourceId).not.toHaveBeenCalled();
      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ resourceId: 'original-owner' }),
      );
    });

    it('does not create a thread when an approval action has no mapping', async () => {
      const adapter = createMockAdapter('discord');
      adapter.channelIdFromThreadId.mockImplementation((id: string) => id.split(':')[0]);
      const resolveResourceId = vi.fn(async () => 'sso-owner');
      const resolveThreadId = vi.fn(async () => 'resolved-thread');
      const channels = new AgentChannels({
        adapters: { discord: adapter },
        resolveResourceId,
        resolveThreadId,
      });
      channels.__setAgent(mockAgent);

      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      channels.__setLogger(logger as any);
      const mockMastra = makeMastra();
      await channels.initialize(mockMastra);

      await (channels.sdk as any).processAction({
        actionId: 'tool_approve:tool-call-1',
        adapter,
        messageId: 'approval-card-1',
        threadId: 'channel-1:thread-1',
        user: { userId: 'clicker-1', userName: 'clicker', fullName: 'Clicker' },
        raw: {},
      });

      const memoryStore = await mockMastra.getStorage().getStore('memory');
      const { threads } = await memoryStore.listThreads({
        filter: {
          metadata: {
            channel_platform: 'discord',
            channel_externalThreadId: 'channel-1:thread-1',
            channel_externalChannelId: 'channel-1',
          },
        },
        perPage: 10,
      });
      expect(threads).toHaveLength(0);
      expect(resolveResourceId).not.toHaveBeenCalled();
      expect(resolveThreadId).not.toHaveBeenCalled();
      expect(adapter.editMessage).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No mapped channel thread found for tool approval action'),
        expect.anything(),
      );
    });
  });

  describe('per-agent thread identity', () => {
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

    const legacyFilter = {
      channel_platform: 'discord',
      channel_externalThreadId: 'channel-1:thread-1',
      channel_externalChannelId: 'channel-1',
    };

    it('stamps a newly created thread with the owning agent id', async () => {
      const mockMastra = makeMastra();
      await agentChannels.initialize(mockMastra);
      const chatThread = makeChatThread({ adapter: agentChannels.adapters.discord });

      await (agentChannels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

      const memoryStore = await mockMastra.getStorage().getStore('memory');
      const { threads } = await memoryStore.listThreads({
        filter: { metadata: legacyFilter },
        perPage: 10,
      });
      expect(threads).toHaveLength(1);
      expect(threads[0]!.metadata).toMatchObject({
        ...legacyFilter,
        channel_ownerId: 'test-agent',
      });
    });

    it('adopts an unclaimed legacy thread and stamps the agent id onto it', async () => {
      const mockMastra = makeMastra();
      await agentChannels.initialize(mockMastra);

      // Pre-upgrade thread: the three legacy metadata keys, no channel_ownerId.
      const memoryStore = await mockMastra.getStorage().getStore('memory');
      await memoryStore.saveThread({
        thread: {
          id: 'legacy-thread',
          title: 'discord conversation',
          resourceId: 'original-owner',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { ...legacyFilter },
        },
      });

      const chatThread = makeChatThread({ adapter: agentChannels.adapters.discord });
      await (agentChannels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

      // The same thread is reused (no new thread) and now carries the agent id
      // while preserving its stored owner and existing metadata keys.
      const { threads } = await memoryStore.listThreads({
        filter: { metadata: legacyFilter },
        perPage: 10,
      });
      expect(threads).toHaveLength(1);
      expect(threads[0]!.id).toBe('legacy-thread');
      expect(threads[0]!.resourceId).toBe('original-owner');
      expect(threads[0]!.metadata).toMatchObject({
        ...legacyFilter,
        channel_ownerId: 'test-agent',
      });
    });

    it('never steals a thread claimed by a different agent', async () => {
      const mockMastra = makeMastra();
      await agentChannels.initialize(mockMastra);

      const memoryStore = await mockMastra.getStorage().getStore('memory');
      await memoryStore.saveThread({
        thread: {
          id: 'other-agents-thread',
          title: 'discord conversation',
          resourceId: 'other-owner',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { ...legacyFilter, channel_ownerId: 'other-agent' },
        },
      });

      const chatThread = makeChatThread({ adapter: agentChannels.adapters.discord });
      await (agentChannels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

      const { threads } = await memoryStore.listThreads({
        filter: { metadata: legacyFilter },
        perPage: 10,
      });
      expect(threads).toHaveLength(2);

      // The other agent's thread is untouched.
      const otherThread = threads.find(t => t.id === 'other-agents-thread')!;
      expect(otherThread.resourceId).toBe('other-owner');
      expect(otherThread.metadata).toMatchObject({ ...legacyFilter, channel_ownerId: 'other-agent' });

      // A fresh thread was created for this agent, stamped with its own id.
      const ownThread = threads.find(t => t.id !== 'other-agents-thread')!;
      expect(ownThread.metadata).toMatchObject({ ...legacyFilter, channel_ownerId: 'test-agent' });
    });

    it('gives two agents their own threads for the same external conversation', async () => {
      const mockMastra = makeMastra();

      const agentA = createMockAgent('agent-a');
      const channelsA = new AgentChannels({ adapters: { discord: createMockAdapter('discord') } });
      channelsA.__setAgent(agentA);
      await channelsA.initialize(mockMastra);

      const agentB = createMockAgent('agent-b');
      const channelsB = new AgentChannels({ adapters: { discord: createMockAdapter('discord') } });
      channelsB.__setAgent(agentB);
      await channelsB.initialize(mockMastra);

      await (channelsA as any).processChatMessage(
        makeChatThread({ adapter: channelsA.adapters.discord }),
        message,
        mockMastra,
        new RequestContext(),
      );
      await (channelsB as any).processChatMessage(
        makeChatThread({ adapter: channelsB.adapters.discord }),
        message,
        mockMastra,
        new RequestContext(),
      );

      const memoryStore = await mockMastra.getStorage().getStore('memory');
      const { threads } = await memoryStore.listThreads({
        filter: { metadata: legacyFilter },
        perPage: 10,
      });
      expect(threads).toHaveLength(2);
      const agentIds = threads.map(t => (t.metadata as any).channel_ownerId).sort();
      expect(agentIds).toEqual(['agent-a', 'agent-b']);
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

      await (channels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

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

      await (channels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

      const [{ defaultThreadId }] = resolveThreadId.mock.calls[0]!;
      const memoryStore = await mockMastra.getStorage().getStore('memory');
      const stored = await memoryStore.getThreadById({ threadId: defaultThreadId });
      expect(stored).toMatchObject({ id: defaultThreadId, resourceId: 'discord:user-1' });
    });

    it('falls back to the generated id when the resolver id already belongs to another thread', async () => {
      const resolveThreadId = vi.fn(async () => 'taken-id');
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        resolveThreadId,
      });
      channels.__setAgent(mockAgent);

      const mockMastra = makeMastra();
      await channels.initialize(mockMastra);

      // An unrelated thread already owns the id the resolver returns.
      const memoryStore = await mockMastra.getStorage().getStore('memory');
      const original = {
        id: 'taken-id',
        title: 'someone elses thread',
        resourceId: 'other-owner',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { unrelated: true },
      };
      await memoryStore.saveThread({ thread: original });

      const chatThread = makeChatThread({ adapter: channels.adapters.discord });
      await (channels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

      // The original thread is untouched (saveThread upserts by id, so a
      // collision would have overwritten its owner and metadata).
      const kept = await memoryStore.getThreadById({ threadId: 'taken-id' });
      expect(kept).toMatchObject({ resourceId: 'other-owner', title: 'someone elses thread' });
      expect(kept?.metadata).toMatchObject({ unrelated: true });

      // The channel conversation got its own thread under a generated id.
      const { threads } = await memoryStore.listThreads({
        filter: { metadata: { channel_externalThreadId: 'channel-1:thread-1' } },
        perPage: 10,
      });
      expect(threads).toHaveLength(1);
      expect(threads[0]!.id).not.toBe('taken-id');
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
      await (channels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());

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

  describe('handler context', () => {
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

    function makeChatThread(overrides: Record<string, unknown> = {}) {
      return {
        id: 'channel-1:thread-1',
        channelId: 'channel-1',
        isDM: true,
        isSubscribed: vi.fn().mockResolvedValue(true),
        subscribe: vi.fn().mockResolvedValue(undefined),
        mentionUser: vi.fn((userId: string) => `<@${userId}>`),
        messages: (async function* () {})(),
        ...overrides,
      } as any;
    }

    it('passes the resolved Mastra instance to a custom handler as ctx.mastra', async () => {
      const chatMod = await getChatModule();
      // Capture the wrapper AgentChannels registers with the Chat SDK so we can
      // drive it directly and inspect what it forwards to our custom handler.
      let registeredDMWrapper: ((thread: any, message: any) => unknown) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onDirectMessage').mockImplementation((handler: any) => {
        registeredDMWrapper = handler;
      });

      const onDirectMessage = vi.fn(async () => {});
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        handlers: { onDirectMessage },
      });
      channels.__setAgent(mockAgent);

      const mockMastra = makeMastra();
      await channels.initialize(mockMastra);

      expect(registeredDMWrapper).toBeTypeOf('function');

      const chatThread = makeChatThread({ adapter: channels.adapters.discord });
      await registeredDMWrapper!(chatThread, message);

      expect(onDirectMessage).toHaveBeenCalledTimes(1);
      // 4th arg is the per-message handler context carrying the resolved
      // Mastra instance plus run-level and Signal-level context.
      const ctx = onDirectMessage.mock.calls[0]![3];
      expect(ctx).toEqual({
        mastra: mockMastra,
        requestContext: expect.any(RequestContext),
        signalMetadata: {},
      });

      spy.mockRestore();
    });

    it('gives a custom handler the request context for the run', async () => {
      const chatMod = await getChatModule();
      let registeredDMWrapper: ((thread: any, message: any) => unknown) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onDirectMessage').mockImplementation((handler: any) => {
        registeredDMWrapper = handler;
      });

      const onDirectMessage = vi.fn(async () => {});
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        handlers: { onDirectMessage },
      });
      channels.__setAgent(mockAgent);
      await channels.initialize(makeMastra());

      const chatThread = makeChatThread({ adapter: channels.adapters.discord });
      await registeredDMWrapper!(chatThread, message);

      const ctx = onDirectMessage.mock.calls[0]![3] as { requestContext: RequestContext };
      expect(ctx.requestContext).toBeInstanceOf(RequestContext);

      spy.mockRestore();
    });

    it('carries a handler write on the request context through to dispatch', async () => {
      const chatMod = await getChatModule();
      let registeredDMWrapper: ((thread: any, message: any) => unknown) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onDirectMessage').mockImplementation((handler: any) => {
        registeredDMWrapper = handler;
      });

      // A custom handler stamps the tenant, then defers to the default handler —
      // this is the seam the Slack host uses to run under the linked user.
      const onDirectMessage = vi.fn(async (thread: any, msg: any, defaultHandler: any, ctx: any) => {
        ctx.requestContext.set('user', { id: 'user-from-handler' });
        await defaultHandler(thread, msg);
      });

      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        handlers: { onDirectMessage },
      });
      channels.__setAgent(mockAgent);
      await channels.initialize(makeMastra());

      // Intercept the dispatch to read the request context the run receives.
      let dispatched: RequestContext | undefined;
      vi.spyOn(channels as any, 'dispatchInboundMessage').mockImplementation(async (args: any) => {
        dispatched = args.requestContext;
      });

      const chatThread = makeChatThread({ adapter: channels.adapters.discord });
      await registeredDMWrapper!(chatThread, message);

      expect(dispatched).toBeDefined();
      // The handler's write survived, and core's own enrichment sits alongside it.
      expect(dispatched!.get('user')).toEqual({ id: 'user-from-handler' });
      expect(dispatched!.get('channel')).toBeDefined();

      spy.mockRestore();
    });

    it('forwards handler signal metadata to sendMessage', async () => {
      const chatMod = await getChatModule();
      let registeredDMWrapper: ((thread: any, message: any) => unknown) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onDirectMessage').mockImplementation((handler: any) => {
        registeredDMWrapper = handler;
      });

      const onDirectMessage = vi.fn(async (thread: any, msg: any, defaultHandler: any, ctx: any) => {
        ctx.signalMetadata.attachments = [{ id: 'file-1', mediaType: 'application/pdf' }];
        await defaultHandler(thread, msg);
      });

      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        handlers: { onDirectMessage },
      });
      channels.__setAgent(mockAgent);
      await channels.initialize(makeMastra());

      const chatThread = makeChatThread({ adapter: channels.adapters.discord });
      await registeredDMWrapper!(chatThread, message);

      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            attachments: [{ id: 'file-1', mediaType: 'application/pdf' }],
          },
        }),
        expect.anything(),
      );

      spy.mockRestore();
    });

    it('does not leak one message handler context into the next', async () => {
      const chatMod = await getChatModule();
      let registeredDMWrapper: ((thread: any, message: any) => unknown) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onDirectMessage').mockImplementation((handler: any) => {
        registeredDMWrapper = handler;
      });

      const seen: (unknown | undefined)[] = [];
      const seenSignalMetadata: (unknown | undefined)[] = [];
      const onDirectMessage = vi.fn(async (_thread: any, _msg: any, _defaultHandler: any, ctx: any) => {
        // Record what this message's context already carried on arrival, then
        // write a marker that must not survive into the next message.
        seen.push(ctx.requestContext.get('leak-marker'));
        ctx.requestContext.set('leak-marker', 'from-first-message');
        seenSignalMetadata.push(ctx.signalMetadata['leak-marker']);
        ctx.signalMetadata['leak-marker'] = 'from-first-message';
      });

      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        handlers: { onDirectMessage },
      });
      channels.__setAgent(mockAgent);
      await channels.initialize(makeMastra());

      const chatThread = makeChatThread({ adapter: channels.adapters.discord });
      // Sequential, not Promise.all: concurrent dispatch could pass by
      // interleaving rather than by genuine per-message isolation.
      await registeredDMWrapper!(chatThread, message);
      await registeredDMWrapper!(chatThread, message);

      expect(seen).toHaveLength(2);
      expect(seen[0]).toBeUndefined();
      // The second message must start clean — a shared context would carry the marker.
      expect(seen[1]).toBeUndefined();
      expect(seenSignalMetadata).toEqual([undefined, undefined]);

      const first = onDirectMessage.mock.calls[0]![3] as {
        requestContext: RequestContext;
        signalMetadata: Record<string, unknown>;
      };
      const second = onDirectMessage.mock.calls[1]![3] as {
        requestContext: RequestContext;
        signalMetadata: Record<string, unknown>;
      };
      expect(first.requestContext).not.toBe(second.requestContext);
      expect(first.signalMetadata).not.toBe(second.signalMetadata);

      spy.mockRestore();
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
