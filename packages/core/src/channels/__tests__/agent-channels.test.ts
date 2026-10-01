import { format } from 'node:util';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Agent } from '../../agent';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { ConsoleLogger } from '../../logger';
import type { IMastraLogger, LogFilter } from '../../logger';
import { RequestContext } from '../../request-context';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../storage/domains/memory/inmemory';
import { AgentChannels } from '../agent-channels';
import { getChatModule } from '../chat-lazy';
import { ChannelSessionRejectedError } from '../errors';
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

  describe('repeated initialization', () => {
    it('does not accumulate duplicate handler registrations when initialize is called again', async () => {
      const chatMod = await getChatModule();
      const registrationMethods = [
        'onDirectMessage',
        'onNewMention',
        'onSubscribedMessage',
        'onSlashCommand',
        'onAction',
      ] as const;
      let slashHandlers: ((event: any) => Promise<void>)[] = [];
      const spies = registrationMethods.map(method => {
        const spy = vi.spyOn(chatMod.Chat.prototype as any, method);
        if (method === 'onSlashCommand') {
          spy.mockImplementation((handler: any) => {
            slashHandlers.push(handler);
          });
        }
        return spy;
      });
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      try {
        await agentChannels.initialize(mockMastra);
        const firstSdk = agentChannels.sdk;
        expect(firstSdk).not.toBeNull();

        // Second, sequential initialization after the first has fully resolved
        await agentChannels.initialize(mockMastra);

        // Same Chat SDK instance — a second instance would carry its own handlers
        expect(agentChannels.sdk).toBe(firstSdk);

        // Each inbound handler is registered exactly once
        for (const spy of spies) {
          expect(spy).toHaveBeenCalledTimes(1);
        }

        // One emitted event reaches exactly one callback and produces one agent send
        expect(slashHandlers).toHaveLength(1);
        await slashHandlers[0]!({
          adapter: agentChannels.adapters.discord,
          channel: { id: 'channel-1', isDM: false, channelVisibility: 'public' },
          command: '/weather',
          text: 'London',
          triggerId: 'interaction-1',
          user: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes', isBot: false, isMe: false },
          raw: { id: 'interaction-1' },
          openModal: vi.fn(),
        });
        expect(mockAgent.sendMessage).toHaveBeenCalledTimes(1);
      } finally {
        for (const spy of spies) {
          spy.mockRestore();
        }
      }
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

  describe('action handling', () => {
    function makeMastra() {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      return { getStorage: () => ({ getStore: () => memoryStore }), getServer: () => null } as any;
    }

    function makeActionEvent(adapter: any, actionId: string) {
      return {
        actionId,
        adapter,
        messageId: 'card-1',
        threadId: 'channel-1:thread-1',
        user: { userId: 'clicker-1', userName: 'clicker', fullName: 'Clicker' },
        raw: {},
      };
    }

    it('ignores non-approval action ids by default', async () => {
      const adapter = createMockAdapter('discord');
      const channels = new AgentChannels({ adapters: { discord: adapter } });
      channels.__setAgent(mockAgent);
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      channels.__setLogger(logger as any);
      await channels.initialize(makeMastra());

      await expect((channels.sdk as any).processAction(makeActionEvent(adapter, 'retry'))).resolves.not.toThrow();

      expect(mockAgent.sendMessage).not.toHaveBeenCalled();
      expect(adapter.editMessage).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('passes action events to a custom handler with defaultHandler and context', async () => {
      const chatMod = await getChatModule();
      let registeredHandler: ((event: any) => Promise<void>) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onAction').mockImplementation((handler: any) => {
        registeredHandler = handler;
      });
      const customHandler = vi.fn().mockResolvedValue(undefined);
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        handlers: { onAction: customHandler },
      });
      channels.__setAgent(mockAgent);
      const mockMastra = makeMastra();
      const event = { actionId: 'retry' } as any;

      try {
        await channels.initialize(mockMastra);
        expect(registeredHandler).toBeDefined();
        await registeredHandler!(event);
        expect(customHandler).toHaveBeenCalledWith(
          event,
          expect.any(Function),
          expect.objectContaining({ mastra: mockMastra, requestContext: expect.any(RequestContext) }),
        );
        expect(mockAgent.sendMessage).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    it('runs the built-in approval handling when a custom handler delegates to defaultHandler', async () => {
      const adapter = createMockAdapter('discord');
      adapter.channelIdFromThreadId.mockImplementation((id: string) => id.split(':')[0]);
      const onAction = vi.fn(async (_event: any, defaultHandler: () => Promise<void>) => {
        await defaultHandler();
      });
      const channels = new AgentChannels({ adapters: { discord: adapter }, handlers: { onAction } });
      channels.__setAgent(mockAgent);
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      channels.__setLogger(logger as any);
      await channels.initialize(makeMastra());

      await (channels.sdk as any).processAction(makeActionEvent(adapter, 'tool_approve:tool-call-1'));

      expect(onAction).toHaveBeenCalledTimes(1);
      // The approval body ran: it reached the thread-mapping lookup and warned about the missing mapping.
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No mapped channel thread found for tool approval action'),
        expect.anything(),
      );
    });

    it('passes values a custom handler stamps on ctx.requestContext through to dispatchApproval', async () => {
      const adapter = createMockAdapter('discord');
      const onAction = vi.fn(async (_event: any, defaultHandler: () => Promise<void>, ctx: any) => {
        ctx.requestContext.set('tenantId', 'tenant-42');
        await defaultHandler();
      });
      const channels = new AgentChannels({ adapters: { discord: adapter }, handlers: { onAction } });
      channels.__setAgent(mockAgent);
      channels.__setLogger({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any);
      await channels.initialize(makeMastra());

      (channels as any).findThreadMapping = vi
        .fn()
        .mockResolvedValue({ thread: { id: 'mastra-thread-1', resourceId: 'resource-1' } });
      (channels as any).pendingApprovalCards.set('tool-call-1', {
        runId: 'run-1',
        toolName: 'lookup',
        args: {},
      });
      const dispatchApproval = vi.fn().mockResolvedValue(undefined);
      (channels as any).dispatchApproval = dispatchApproval;

      await (channels.sdk as any).processAction({
        ...makeActionEvent(adapter, 'tool_approve:tool-call-1'),
        thread: { id: 'channel-1:thread-1', channelId: 'channel-1', isDM: false },
      });

      expect(dispatchApproval).toHaveBeenCalledTimes(1);
      const { requestContext } = dispatchApproval.mock.calls[0]![0];
      expect(requestContext.get('tenantId')).toBe('tenant-42');
      expect(requestContext.get('channel')).toBeDefined();
    });

    describe('function-form toolDisplay owns the resolved approval card (#23512)', () => {
      async function setup(toolDisplay: (event: any) => any, isDM = false) {
        const adapter = createMockAdapter('slack');
        (adapter as any).isDM = vi.fn(() => isDM);
        const channels = new AgentChannels({ adapters: { slack: { adapter, toolDisplay } } });
        channels.__setAgent(mockAgent);
        channels.__setLogger({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any);
        await channels.initialize(makeMastra());
        (channels as any).findThreadMapping = vi
          .fn()
          .mockResolvedValue({ thread: { id: 'mastra-thread-1', resourceId: 'resource-1' } });
        (channels as any).pendingApprovalCards.set('tool-call-1', {
          runId: 'run-1',
          toolName: 'deleteCustomerTool',
          args: { id: 'c-1' },
        });
        const dispatchApproval = vi.fn().mockResolvedValue(undefined);
        const dispatchDecline = vi.fn().mockResolvedValue(undefined);
        (channels as any).dispatchApproval = dispatchApproval;
        (channels as any).dispatchDecline = dispatchDecline;
        const click = (actionId: string) =>
          (channels.sdk as any).processAction({
            ...makeActionEvent(adapter, actionId),
            thread: { id: 'channel-1:thread-1', channelId: 'channel-1', isDM: false },
          });
        return { adapter, click, dispatchApproval, dispatchDecline };
      }

      it('edits the card with the renderer output on approve', async () => {
        const toolDisplay = vi.fn((event: any) =>
          event.kind === 'approved' ? { kind: 'post', message: 'Onaylandı' } : undefined,
        );
        const { adapter, click, dispatchApproval } = await setup(toolDisplay);

        await click('tool_approve:tool-call-1');

        expect(toolDisplay).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: 'approved',
            toolCallId: 'tool-call-1',
            toolName: 'deleteCustomerTool',
            args: { id: 'c-1' },
          }),
          { mode: 'static', platform: 'slack' },
        );
        expect(adapter.editMessage).toHaveBeenCalledWith('channel-1:thread-1', 'card-1', 'Onaylandı');
        expect(dispatchApproval).toHaveBeenCalledTimes(1);
      });

      it('edits the card with the renderer output on deny and passes byUser', async () => {
        const toolDisplay = vi.fn((event: any) =>
          event.kind === 'denied' ? { kind: 'post', message: `Reddedildi: ${event.byUser}` } : undefined,
        );
        const { adapter, click, dispatchDecline } = await setup(toolDisplay);

        await click('tool_deny:tool-call-1');

        expect(toolDisplay).toHaveBeenCalledWith(
          expect.objectContaining({ kind: 'denied', byUser: 'Clicker' }),
          expect.anything(),
        );
        expect(adapter.editMessage).toHaveBeenCalledWith('channel-1:thread-1', 'card-1', 'Reddedildi: Clicker');
        expect(dispatchDecline).toHaveBeenCalledTimes(1);
      });

      it('passes byUser as undefined when denied in a DM', async () => {
        const toolDisplay = vi.fn(() => undefined);
        const { click } = await setup(toolDisplay, true);

        await click('tool_deny:tool-call-1');

        expect(toolDisplay).toHaveBeenCalledWith(
          expect.objectContaining({ kind: 'denied', byUser: undefined }),
          expect.anything(),
        );
      });

      const fallbackRenderers: [string, (event: any) => any][] = [
        ['returns undefined', () => undefined],
        ['returns a blank message', () => ({ kind: 'post', message: '  ' })],
        [
          'throws',
          () => {
            throw new Error('boom');
          },
        ],
      ];

      describe.each([
        ['approve', 'tool_approve:tool-call-1', 'Approved', 'dispatchApproval'],
        ['deny', 'tool_deny:tool-call-1', 'Denied', 'dispatchDecline'],
      ] as const)('on %s', (_action, actionId, expected, dispatchKey) => {
        it.each(fallbackRenderers)(
          'falls back to the default card when the renderer %s',
          async (_label, toolDisplay) => {
            const ctx = await setup(toolDisplay);

            await ctx.click(actionId);

            expect(ctx.adapter.editMessage).toHaveBeenCalledTimes(1);
            const message = ctx.adapter.editMessage.mock.calls[0]![2];
            expect(typeof message === 'string' ? message.trim() : message).toBeTruthy();
            expect(JSON.stringify(message)).toContain(expected);
            expect(ctx[dispatchKey]).toHaveBeenCalledTimes(1);
          },
        );
      });
    });

    describe('approval requester check', () => {
      async function setup(record: Record<string, unknown>, mastra = makeMastra()) {
        const adapter = createMockAdapter('discord');
        const channels = new AgentChannels({ adapters: { discord: adapter } });
        channels.__setAgent(mockAgent);
        const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        channels.__setLogger(logger as any);
        await channels.initialize(mastra);
        (channels as any).findThreadMapping = vi
          .fn()
          .mockResolvedValue({ thread: { id: 'mastra-thread-1', resourceId: 'resource-1' } });
        (channels as any).pendingApprovalCards.set('tool-call-1', {
          runId: 'run-1',
          toolName: 'lookup',
          args: {},
          ...record,
        });
        const dispatchApproval = vi.fn().mockResolvedValue(undefined);
        const dispatchDecline = vi.fn().mockResolvedValue(undefined);
        (channels as any).dispatchApproval = dispatchApproval;
        (channels as any).dispatchDecline = dispatchDecline;
        const click = (actionId: string, userId: string) =>
          (channels.sdk as any).processAction({
            ...makeActionEvent(adapter, actionId),
            user: { userId, userName: userId, fullName: userId },
            thread: { id: 'channel-1:thread-1', channelId: 'channel-1', isDM: false },
          });
        return { adapter, channels, logger, dispatchApproval, dispatchDecline, click };
      }

      it('ignores approve and decline clicks from a user other than the requester', async () => {
        const { adapter, logger, dispatchApproval, dispatchDecline, click } = await setup({ requesterId: 'alice' });

        await click('tool_approve:tool-call-1', 'mallory');
        await click('tool_deny:tool-call-1', 'mallory');

        expect(dispatchApproval).not.toHaveBeenCalled();
        expect(dispatchDecline).not.toHaveBeenCalled();
        expect(adapter.editMessage).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('only alice may answer'), expect.anything());
      });

      it('lets the requester approve', async () => {
        const { dispatchApproval, click } = await setup({ requesterId: 'alice' });
        await click('tool_approve:tool-call-1', 'alice');
        expect(dispatchApproval).toHaveBeenCalledTimes(1);
      });

      it('checks the requester when the approval is recovered from stored messages', async () => {
        const messages = [
          {
            role: 'assistant',
            content: {
              metadata: {
                pendingToolApprovals: {
                  lookup: { toolCallId: 'tool-call-1', runId: 'run-1', toolName: 'lookup', args: {} },
                },
              },
            },
          },
          {
            role: 'user',
            content: {
              providerMetadata: { mastra: { channels: { discord: { author: { userId: 'alice' } } } } },
            },
          },
        ];
        const { channels, dispatchApproval, click } = await setup({}, {
          getStorage: () => ({ getStore: async () => ({ listMessages: async () => ({ messages }) }) }),
          getServer: () => null,
        } as any);
        (channels as any).pendingApprovalCards.clear();

        await click('tool_approve:tool-call-1', 'mallory');
        expect(dispatchApproval).not.toHaveBeenCalled();

        await click('tool_approve:tool-call-1', 'alice');
        expect(dispatchApproval).toHaveBeenCalledTimes(1);
      });

      it('ignores all clicks when stored messages cannot identify a single requester', async () => {
        const author = (userId: string) => ({
          role: 'user',
          content: { providerMetadata: { mastra: { channels: { discord: { author: { userId } } } } } },
        });
        const messages = [
          {
            role: 'assistant',
            content: {
              metadata: {
                pendingToolApprovals: {
                  lookup: { toolCallId: 'tool-call-1', runId: 'run-1', toolName: 'lookup', args: {} },
                },
              },
            },
          },
          author('bob'),
          author('alice'),
        ];
        const { channels, dispatchApproval, click } = await setup({}, {
          getStorage: () => ({ getStore: async () => ({ listMessages: async () => ({ messages }) }) }),
          getServer: () => null,
        } as any);
        (channels as any).pendingApprovalCards.clear();

        await click('tool_approve:tool-call-1', 'bob');
        await click('tool_approve:tool-call-1', 'alice');
        expect(dispatchApproval).not.toHaveBeenCalled();
      });

      it('keeps a stashed requester when the run id is recovered from stored messages', async () => {
        const author = (userId: string) => ({
          role: 'user',
          content: { providerMetadata: { mastra: { channels: { discord: { author: { userId } } } } } },
        });
        const messages = [
          {
            role: 'assistant',
            content: {
              metadata: {
                pendingToolApprovals: {
                  lookup: { toolCallId: 'tool-call-1', runId: 'run-1', toolName: 'lookup', args: {} },
                },
              },
            },
          },
          author('bob'),
          author('alice'),
        ];
        const { dispatchApproval, click } = await setup({ requesterId: 'alice' }, {
          getStorage: () => ({ getStore: async () => ({ listMessages: async () => ({ messages }) }) }),
          getServer: () => null,
        } as any);

        await click('tool_approve:tool-call-1', 'bob');
        expect(dispatchApproval).not.toHaveBeenCalled();
        await click('tool_approve:tool-call-1', 'alice');
        expect(dispatchApproval).toHaveBeenCalledTimes(1);
      });

      it('keeps the permissive behavior when no requester was recorded', async () => {
        const { dispatchApproval, click } = await setup({});
        await click('tool_approve:tool-call-1', 'mallory');
        expect(dispatchApproval).toHaveBeenCalledTimes(1);
      });

      it('stamps the requester onto approval records posted through the render context', async () => {
        const { channels } = await setup({});
        const ctx = (channels as any)._buildRenderContext(
          { id: 'channel-1:thread-1', channelId: 'channel-1' },
          'discord',
          { requesterId: 'alice' },
        );
        ctx.onApprovalPosted('tool-call-2', { displayName: 'x', argsSummary: '', startedAt: 0 });
        expect((channels as any).pendingApprovalCards.get('tool-call-2').requesterId).toBe('alice');
      });
    });

    it('does not register action handling when disabled', async () => {
      const chatMod = await getChatModule();
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onAction');
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        handlers: { onAction: false },
      });
      channels.__setAgent(mockAgent);

      try {
        await channels.initialize(makeMastra());
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

    describe('bot display name (#25603)', () => {
      async function sendAndGetChannel(channels: AgentChannels, mockMastra: any, messageId: string) {
        const chatThread = {
          id: 'channel-1:thread-1',
          channelId: 'channel-1',
          isDM: false,
          adapter: channels.adapters.slack,
          isSubscribed: vi.fn().mockResolvedValue(true),
          subscribe: vi.fn().mockResolvedValue(undefined),
          mentionUser: vi.fn((userId: string) => `<@${userId}>`),
          messages: (async function* () {})(),
        } as any;
        const message = {
          id: messageId,
          text: '@helper say hi',
          author: { userId: 'user-1', userName: 'tyler', fullName: 'Tyler Barnes' },
          attachments: [],
        } as any;
        mockAgent.sendMessage.mockClear();
        await (channels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());
        expect(mockAgent.sendMessage).toHaveBeenCalledTimes(1);
        const options = mockAgent.sendMessage.mock.calls[0]![1];
        return options.ifIdle.streamOptions.requestContext.get('channel');
      }

      async function setup(adapterOverrides: Record<string, unknown>) {
        const adapter = Object.assign(createMockAdapter('slack'), {
          userName: 'acme-bot',
          botUserId: 'UBOT',
          ...adapterOverrides,
        });
        const channels = new AgentChannels({ adapters: { slack: adapter } });
        channels.__setAgent(mockAgent);
        channels.__setLogger({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any);
        const memoryStore = new InMemoryMemory({ db: new InMemoryDB() });
        const mockMastra = { getStorage: () => ({ getStore: () => memoryStore }), getServer: () => null } as any;
        await channels.initialize(mockMastra);
        return { channels, mockMastra };
      }

      it('adds the current display name from adapter.getUser and resolves it once', async () => {
        const getUser = vi
          .fn()
          .mockResolvedValue({ userId: 'UBOT', userName: 'helper', fullName: 'Helper', isBot: true });
        const { channels, mockMastra } = await setup({ getUser });

        const first = await sendAndGetChannel(channels, mockMastra, 'message-1');
        expect(first).toMatchObject({
          botUserId: 'UBOT',
          botUserName: 'acme-bot',
          botDisplayName: 'helper',
          botMention: '<@UBOT>',
        });

        const second = await sendAndGetChannel(channels, mockMastra, 'message-2');
        expect(second.botDisplayName).toBe('helper');
        expect(getUser).toHaveBeenCalledTimes(1);
        expect(getUser).toHaveBeenCalledWith('UBOT');
      });

      it('omits the display name when it matches the adapter userName', async () => {
        const getUser = vi.fn().mockResolvedValue({ userId: 'UBOT', userName: 'acme-bot', fullName: '', isBot: true });
        const { channels, mockMastra } = await setup({ getUser });

        const channel = await sendAndGetChannel(channels, mockMastra, 'message-1');
        expect(channel.botUserName).toBe('acme-bot');
        expect(channel).not.toHaveProperty('botDisplayName');
      });

      it('omits the display name when the adapter has no getUser', async () => {
        const { channels, mockMastra } = await setup({});

        const channel = await sendAndGetChannel(channels, mockMastra, 'message-1');
        expect(channel.botUserName).toBe('acme-bot');
        expect(channel).not.toHaveProperty('botDisplayName');
      });

      it('still processes the message when getUser fails and retries on the next event', async () => {
        const getUser = vi
          .fn()
          .mockRejectedValueOnce(new Error('users.info failed'))
          .mockResolvedValueOnce({ userId: 'UBOT', userName: 'helper', fullName: 'Helper', isBot: true });
        const { channels, mockMastra } = await setup({ getUser });

        const first = await sendAndGetChannel(channels, mockMastra, 'message-1');
        expect(first).not.toHaveProperty('botDisplayName');

        const second = await sendAndGetChannel(channels, mockMastra, 'message-2');
        expect(second.botDisplayName).toBe('helper');
        expect(getUser).toHaveBeenCalledTimes(2);
      });

      it('retries on the next event when getUser resolves to null', async () => {
        const getUser = vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ userId: 'UBOT', userName: 'helper', fullName: 'Helper', isBot: true });
        const { channels, mockMastra } = await setup({ getUser });

        const first = await sendAndGetChannel(channels, mockMastra, 'message-1');
        expect(first).not.toHaveProperty('botDisplayName');

        const second = await sendAndGetChannel(channels, mockMastra, 'message-2');
        expect(second.botDisplayName).toBe('helper');
        expect(getUser).toHaveBeenCalledTimes(2);
      });

      it('resolves each bot identity separately when one adapter serves several installations', async () => {
        const names: Record<string, string> = { UBOT_A: 'helper-a', UBOT_B: 'helper-b' };
        const getUser = vi.fn(async (userId: string) => ({
          userId,
          userName: names[userId]!,
          fullName: names[userId]!,
          isBot: true,
        }));
        const { channels, mockMastra } = await setup({ getUser, botUserId: 'UBOT_A' });
        const adapter = channels.adapters.slack as any;

        const a1 = await sendAndGetChannel(channels, mockMastra, 'message-1');
        adapter.botUserId = 'UBOT_B';
        const b1 = await sendAndGetChannel(channels, mockMastra, 'message-2');
        adapter.botUserId = 'UBOT_A';
        const a2 = await sendAndGetChannel(channels, mockMastra, 'message-3');
        adapter.botUserId = 'UBOT_B';
        const b2 = await sendAndGetChannel(channels, mockMastra, 'message-4');

        expect([a1, a2].map(c => [c.botUserId, c.botDisplayName])).toEqual([
          ['UBOT_A', 'helper-a'],
          ['UBOT_A', 'helper-a'],
        ]);
        expect([b1, b2].map(c => [c.botUserId, c.botDisplayName])).toEqual([
          ['UBOT_B', 'helper-b'],
          ['UBOT_B', 'helper-b'],
        ]);
        expect(getUser.mock.calls).toEqual([['UBOT_A'], ['UBOT_B']]);
      });
    });

    describe('suspended tool auto-resume', () => {
      async function dispatch(channels: AgentChannels, platform: string) {
        const memoryStore = new InMemoryMemory({ db: new InMemoryDB() });
        const mockMastra = {
          getStorage: () => ({ getStore: () => memoryStore }),
          getServer: () => null,
        } as any;
        await channels.initialize(mockMastra);
        const chatThread = {
          id: 'channel-1:thread-1',
          channelId: 'channel-1',
          isDM: true,
          adapter: channels.adapters[platform],
          isSubscribed: vi.fn().mockResolvedValue(true),
          subscribe: vi.fn().mockResolvedValue(undefined),
          mentionUser: vi.fn((userId: string) => `<@${userId}>`),
          messages: (async function* () {})(),
        } as any;
        const message = {
          id: 'message-1',
          text: 'hi',
          author: { userId: 'user-1', userName: 'u', fullName: 'U' },
          attachments: [],
        } as any;
        await (channels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext());
        return mockAgent.sendMessage.mock.calls[0][1].ifIdle.streamOptions;
      }

      function channelsWith(platform: string, config: Record<string, unknown>) {
        const channels = new AgentChannels({
          adapters: { [platform]: { adapter: createMockAdapter(platform), ...config } },
        } as any);
        channels.__setAgent(mockAgent);
        return channels;
      }

      it("auto-resumes with toolDisplay 'hidden' on a platform without approval buttons", async () => {
        const streamOptions = await dispatch(channelsWith('imessage', { toolDisplay: 'hidden' }), 'imessage');
        expect(streamOptions.autoResumeSuspendedTools).toBe(true);
      });

      it("keeps approval flow with toolDisplay 'hidden' on Slack", async () => {
        const streamOptions = await dispatch(channelsWith('slack', { toolDisplay: 'hidden' }), 'slack');
        expect('autoResumeSuspendedTools' in streamOptions).toBe(false);
      });

      it('honors an explicit approvalButtons override', async () => {
        const streamOptions = await dispatch(
          channelsWith('custom', { toolDisplay: 'hidden', approvalButtons: true }),
          'custom',
        );
        expect('autoResumeSuspendedTools' in streamOptions).toBe(false);
      });

      it("auto-resumes with toolDisplay 'text'", async () => {
        const streamOptions = await dispatch(channelsWith('slack', { toolDisplay: 'text' }), 'slack');
        expect(streamOptions.autoResumeSuspendedTools).toBe(true);
      });

      it('warns when an inbound message does not wake a run', async () => {
        const logger = { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } as any;
        const channels = channelsWith('slack', {});
        channels.__setLogger(logger);
        mockAgent.sendMessage.mockReturnValueOnce({ accepted: Promise.resolve({ action: 'persist' }) });
        await dispatch(channels, 'slack');
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('did not start a run (action: persist)'),
          expect.anything(),
        );
      });
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

    it('surfaces a stream-setup rejection instead of treating the message as sent', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChannels.initialize(mockMastra);

      // `accepted` rejects when the agent throws before the run starts
      // (workspace, instructions, tools, model resolution).
      mockAgent.sendMessage.mockReturnValueOnce({
        accepted: Promise.reject(new Error('instructions resolution failed')),
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
      ).rejects.toThrow('instructions resolution failed');
    });

    it('keeps a consume failure on an already-started run at debug', async () => {
      const db = new InMemoryDB();
      const memoryStore = new InMemoryMemory({ db });
      const mockMastra = {
        getStorage: () => ({ getStore: () => memoryStore }),
        getServer: () => null,
      } as any;

      await agentChannels.initialize(mockMastra);

      const consumeStream = vi.fn().mockRejectedValue(new Error('mid-run failure'));
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

      await expect(
        (agentChannels as any).processChatMessage(chatThread, message, mockMastra, new RequestContext()),
      ).resolves.not.toThrow();
      expect(consumeStream).toHaveBeenCalledTimes(1);
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

    describe('handler error diagnostics', () => {
      afterEach(() => vi.restoreAllMocks());

      function embeddedRecord(line: string) {
        const json = line.slice(line.indexOf('Error handling message ') + 'Error handling message '.length);
        for (let end = 1; end <= json.length; end++) {
          if (json[end - 1] !== '}') continue;
          try {
            return JSON.parse(json.slice(0, end));
          } catch {
            // Nested objects and trailing console metadata are not the complete record.
          }
        }
        throw new Error('No complete JSON diagnostic on the first physical line');
      }

      async function fixture(
        thrown: unknown,
        options: {
          platform?: string;
          threadId?: string;
          formatError?: (error: Error) => string;
          logger?: IMastraLogger;
        } = {},
      ) {
        const chatMod = await getChatModule();
        let handler: (...args: any[]) => Promise<void> = async () => {
          throw new Error('Handler not registered');
        };
        vi.spyOn(chatMod.Chat.prototype, 'onDirectMessage').mockImplementation(fn => {
          handler = fn as typeof handler;
          return chatMod.Chat.prototype;
        });
        const platform = options.platform ?? 'slack';
        const channels = new AgentChannels({
          adapters: { [platform]: { adapter: createMockAdapter(platform), formatError: options.formatError } },
        });
        channels.__setAgent(mockAgent);
        const mastra = makeMastra();
        await channels.initialize(mastra);
        const storage = vi.spyOn(mastra, 'getStorage').mockImplementation(() => {
          throw thrown;
        });
        const output = vi.spyOn(console, 'error').mockImplementation(() => {});
        channels.__setLogger(options.logger ?? new ConsoleLogger());
        const thread = makeChatThread({
          id: options.threadId ?? 'slack:C123:1790610846.868069',
          adapter: channels.adapters[platform],
          post: vi.fn().mockResolvedValue(undefined),
        });
        const incoming = { ...message, id: '1790610846.868069', author: { userId: 'U123' } };
        return {
          thread,
          incoming,
          storage,
          output,
          run: (skipped: any[] = []) => handler(thread, incoming, {}, { skipped }),
          record: () => {
            expect(output).toHaveBeenCalledTimes(1);
            const rendered = format(...output.mock.calls[0]!);
            expect(rendered).toMatch(/^\[CHANNEL\] \[/);
            const record = embeddedRecord(rendered.split('\n')[0]!);
            expect(JSON.parse(JSON.stringify(output.mock.calls[0]![1]))).toEqual({ args: [record] });
            return record;
          },
        };
      }

      it('puts selected pre-session error messages and exact correlation on the first console line', async () => {
        const cause = new Error('SYNTHETIC_DATABASE_CAUSE');
        const error = new Error('SYNTHETIC_PRE_SESSION_FAILURE', { cause });
        const f = await fixture(error);
        await f.run();
        expect(f.storage).toHaveBeenCalled();
        expect(mockAgent.sendMessage).not.toHaveBeenCalled();
        expect(f.record()).toEqual({
          platform: 'slack',
          threadId: 'slack:C123:1790610846.868069',
          messageId: '1790610846.868069',
          authorId: 'U123',
          error: {
            message: error.message,
            cause: { message: cause.message },
          },
        });
        expect(f.thread.post).toHaveBeenCalledExactlyOnceWith('❌ Error: SYNTHETIC_PRE_SESSION_FAILURE');
      });

      it('logs a string throw as a message', async () => {
        const f = await fixture('plain string');
        await f.run();
        expect(f.record().error).toEqual({ message: 'plain string' });
        expect(f.thread.post).toHaveBeenCalledExactlyOnceWith('❌ Error: plain string');
      });

      it('passes the original Error to the custom formatter', async () => {
        const error = new Error('failure');
        const formatError = vi.fn(() => 'custom feedback');
        const f = await fixture(error, { formatError });
        await f.run();
        expect(f.record().error.message).toBe('failure');
        expect(formatError).toHaveBeenCalledExactlyOnceWith(error);
        expect(f.thread.post).toHaveBeenCalledExactlyOnceWith('custom feedback');
      });

      it.each(['toJSON', 'frozen', 'circular', 'bigint', 'cause', 'toString'])(
        'extracts selected fields and continues to later senders for %s',
        async kind => {
          const error = new Error('failure');
          if (kind === 'toJSON') {
            Object.assign(error, {
              toJSON: () => {
                throw new Error('serializer failed');
              },
            });
          } else if (kind === 'frozen') {
            Object.freeze(error);
          } else if (kind === 'circular') {
            Object.assign(error, { self: error });
          } else if (kind === 'bigint') {
            Object.assign(error, { value: 1n });
          } else if (kind === 'toString') {
            Object.assign(error, {
              value: 1n,
              toString: () => {
                throw new Error('coercion failed');
              },
            });
          } else {
            error.cause = error;
          }
          const f = await fixture(error);
          f.storage.mockImplementationOnce(() => {
            throw error;
          });
          f.storage.mockImplementationOnce(() => {
            throw new Error('later failure');
          });
          await expect(f.run([{ ...f.incoming, id: 'earlier', author: { userId: 'OTHER' } }])).resolves.toBeUndefined();
          expect(f.thread.post).toHaveBeenNthCalledWith(1, '❌ Error: failure');
          expect(f.thread.post).toHaveBeenNthCalledWith(2, '❌ Error: later failure');
          expect(f.output).toHaveBeenCalledTimes(2);
          const records = f.output.mock.calls.map(call => embeddedRecord(format(...call).split('\n')[0]!));
          expect(records[0].error).toEqual({
            message: 'failure',
            ...(kind === 'cause' ? { cause: { message: 'failure' } } : {}),
          });
          expect(records[1].error.message).toBe('later failure');
          expect(records.map(record => record.authorId)).toEqual(['OTHER', 'U123']);
        },
      );

      it('omits payloads, stacks and deeper causes without invoking custom serializers', async () => {
        const toJSON = vi.fn(() => ({ message: 'SENTINEL_SERIALIZER' }));
        const stack = vi.fn(() => 'SENTINEL_STACK');
        const cause = Object.assign(new Error('database unavailable'), {
          cause: new Error('SENTINEL_DEEP_CAUSE'),
          request: { headers: { authorization: 'SENTINEL_TOKEN' } },
          toJSON,
        });
        const error = Object.assign(new Error('session failed', { cause }), {
          details: { errorMessage: 'SENTINEL_UNUSED_FALLBACK', body: 'SENTINEL_BODY' },
          response: { body: 'SENTINEL_RESPONSE' },
          toJSON,
        });
        Object.defineProperty(error, 'stack', { get: stack });
        Object.defineProperty(cause, 'stack', { get: stack });
        const f = await fixture(error);
        await f.run();
        expect(f.record().error).toEqual({
          message: 'session failed',
          cause: { message: 'database unavailable' },
        });
        expect(toJSON).not.toHaveBeenCalled();
        expect(stack).not.toHaveBeenCalled();
        expect(format(...f.output.mock.calls[0]!)).not.toContain('SENTINEL');
        expect(JSON.stringify(f.output.mock.calls[0]![1])).not.toContain('SENTINEL');
        expect(f.thread.post).toHaveBeenCalledExactlyOnceWith('❌ Error: session failed');
      });

      it('includes Mastra classification without details or custom toJSON output', async () => {
        const error = new MastraError(
          {
            id: 'CHANNEL_STORAGE_FAILED',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.SYSTEM,
            text: 'session failed',
            details: { errorMessage: 'SENTINEL_UNUSED_FALLBACK', token: 'SENTINEL_TOKEN' },
          },
          new Error('database unavailable'),
        );
        const toJSON = vi.spyOn(error, 'toJSON');
        const formatError = vi.fn(() => 'custom feedback');
        const f = await fixture(error, { formatError });
        await f.run();
        expect(f.record().error).toEqual({
          message: 'session failed',
          code: 'CHANNEL_STORAGE_FAILED',
          domain: 'STORAGE',
          category: 'SYSTEM',
          cause: { message: 'database unavailable' },
        });
        expect(toJSON).not.toHaveBeenCalled();
        expect(format(...f.output.mock.calls[0]!)).not.toContain('SENTINEL');
        expect(formatError).toHaveBeenCalledExactlyOnceWith(error);
      });

      it('does not serialize non-string Mastra classification fields', async () => {
        const toJSON = vi.fn(() => 'SENTINEL_CLASSIFICATION');
        const error = Object.assign(
          new MastraError({
            id: 'INVALID_CLASSIFICATION',
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.SYSTEM,
            text: 'failure',
          }),
          { id: { toJSON }, domain: { toJSON }, category: { toJSON } },
        );
        const f = await fixture(error);
        await f.run();
        expect(f.record().error).toEqual({ message: 'failure' });
        expect(toJSON).not.toHaveBeenCalled();
        expect(f.thread.post).toHaveBeenCalledExactlyOnceWith('❌ Error: failure');
      });

      it('reads each Mastra classification field once before selecting its string value', async () => {
        const toJSON = vi.fn(() => ({ privateData: 'SENTINEL_CLASSIFICATION' }));
        const id = vi.fn().mockReturnValueOnce('CHANNEL_STORAGE_FAILED').mockReturnValue({ toJSON });
        const domain = vi.fn().mockReturnValueOnce('STORAGE').mockReturnValue({ toJSON });
        const category = vi.fn().mockReturnValueOnce('SYSTEM').mockReturnValue({ toJSON });
        const error = new MastraError({
          id: 'CHANNEL_STORAGE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: 'failure',
        });
        Object.defineProperties(error, { id: { get: id }, domain: { get: domain }, category: { get: category } });
        const f = await fixture(error);
        await f.run();
        expect(f.record().error).toEqual({
          message: 'failure',
          code: 'CHANNEL_STORAGE_FAILED',
          domain: 'STORAGE',
          category: 'SYSTEM',
        });
        expect(id).toHaveBeenCalledTimes(1);
        expect(domain).toHaveBeenCalledTimes(1);
        expect(category).toHaveBeenCalledTimes(1);
        expect(toJSON).not.toHaveBeenCalled();
        expect(format(...f.output.mock.calls[0]!)).not.toContain('SENTINEL');
        expect(f.thread.post).toHaveBeenCalledExactlyOnceWith('❌ Error: failure');
      });

      it.each([
        { details: { errorMessage: 'fallback message', token: 'SENTINEL_TOKEN' } },
        { message: '', details: { errorMessage: 'fallback message', token: 'SENTINEL_TOKEN' } },
        new MastraError({
          id: 'EMPTY_MESSAGE',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          text: '',
          details: { errorMessage: 'fallback message', token: 'SENTINEL_TOKEN' },
        }),
      ])('uses only details.errorMessage when no useful message is available (%#)', async error => {
        const f = await fixture(error, { formatError: () => 'feedback' });
        await f.run();
        expect(f.record().error.message).toBe('fallback message');
        expect(f.record().error).not.toHaveProperty('details');
        expect(format(...f.output.mock.calls[0]!)).not.toContain('SENTINEL');
        expect(f.thread.post).toHaveBeenCalledExactlyOnceWith('feedback');
      });

      it.each(['cause message', { details: { errorMessage: 'cause message', token: 'SENTINEL_TOKEN' } }])(
        'extracts only the immediate cause message (%#)',
        async cause => {
          const f = await fixture(new Error('failure', { cause }));
          await f.run();
          expect(f.record().error).toEqual({ message: 'failure', cause: { message: 'cause message' } });
        },
      );

      it.each(['', { details: { errorMessage: '' } }])('omits an empty immediate cause message (%#)', async cause => {
        const f = await fixture(new Error('failure', { cause }));
        await f.run();
        expect(f.record().error).toEqual({ message: 'failure' });
        expect(f.thread.post).toHaveBeenCalledExactlyOnceWith('❌ Error: failure');
      });

      it.each([null, undefined, '', { details: { errorMessage: '' } }, { details: { token: 'SENTINEL_TOKEN' } }])(
        'uses a static message for a throw without a useful message (%#)',
        async error => {
          const f = await fixture(error, { formatError: () => 'feedback' });
          await f.run();
          expect(f.record().error).toEqual({ message: 'Unknown error' });
          expect(f.thread.post).toHaveBeenCalledExactlyOnceWith('feedback');
        },
      );

      it('keeps feedback working if reading the selected cause fails', async () => {
        const error = new Error('failure');
        Object.defineProperty(error, 'cause', {
          get: () => {
            throw new Error('SENTINEL_GETTER');
          },
        });
        const f = await fixture(error);
        await f.run();
        expect(f.record().error).toEqual({ message: 'Error details unavailable' });
        expect(f.thread.post).toHaveBeenCalledExactlyOnceWith('❌ Error: failure');
      });

      it('retains ConsoleLogger filter and observability export envelopes', async () => {
        const filter = vi.fn<LogFilter>(() => true);
        const sink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const logger = new ConsoleLogger({ filter });
        logger.__attachObservability({
          resolveTraceFields: () => undefined,
          getLogSink: () => sink,
          options: { correlation: true, export: true },
        });
        const error = Object.assign(new Error('failure'), { request: { authorization: 'SENTINEL_TOKEN' } });
        const f = await fixture(error, { logger });
        await f.run();
        const record = f.record();
        expect(filter).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            component: 'CHANNEL',
            level: 'error',
            args: [{ args: [record] }],
          }),
        );
        expect(embeddedRecord(filter.mock.calls[0]![0].message)).toEqual(record);
        expect(sink.error).toHaveBeenCalledExactlyOnceWith(expect.any(String), { args: [record] });
        expect(JSON.parse(JSON.stringify(sink.error.mock.calls[0]![1]))).toEqual({ args: [record] });
        expect(embeddedRecord(sink.error.mock.calls[0]![0])).toEqual(record);
        expect(JSON.parse(JSON.stringify(filter.mock.calls[0]![0].args))).toEqual([{ args: [record] }]);
        expect(JSON.stringify(sink.error.mock.calls)).not.toContain('SENTINEL');
        expect(JSON.stringify(filter.mock.calls)).not.toContain('SENTINEL');
      });

      it('retains structured metadata in a custom IMastraLogger', async () => {
        const capture = vi.fn();
        const logger: IMastraLogger = {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: capture,
          trackException: vi.fn(),
          getTransports: () => new Map(),
          listLogs: async () => ({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false }),
          listLogsByRunId: async () => ({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false }),
        };
        const error = new Error('failure');
        const f = await fixture(error, { logger });
        await f.run();
        expect(capture).toHaveBeenCalledTimes(1);
        const [text, metadata] = capture.mock.calls[0]!;
        const record = embeddedRecord(text);
        expect(JSON.parse(JSON.stringify(metadata))).toEqual({ args: [record] });
        expect(record).toMatchObject({
          platform: 'slack',
          threadId: f.thread.id,
          messageId: f.incoming.id,
          authorId: 'U123',
        });
        expect(metadata.args[0].error).toEqual(record.error);
      });

      it('keeps deliberate refusal silent and produces no ordinary error diagnostic', async () => {
        const f = await fixture(new ChannelSessionRejectedError('refused'));
        await f.run();
        expect(f.output).not.toHaveBeenCalled();
        expect(f.thread.post).not.toHaveBeenCalled();
      });

      it.each(['formatter', 'post'])('preserves existing %s failure behavior', async mode => {
        const formatError = vi.fn(() => {
          if (mode === 'formatter') throw new Error('formatter failed');
          return 'feedback';
        });
        const f = await fixture(new Error('failure'), { formatError });
        if (mode === 'post') f.thread.post.mockRejectedValue(new Error('post failed'));
        await expect(f.run()).resolves.toBeUndefined();
        expect(f.record().error.message).toBe('failure');
        expect(f.thread.post).toHaveBeenCalledTimes(mode === 'post' ? 1 : 0);
      });

      it('continues to the next sender after an ordinary failed run', async () => {
        const f = await fixture(new Error('failure'));
        await f.run([{ ...f.incoming, id: 'earlier', author: { userId: 'OTHER' } }]);
        expect(f.storage).toHaveBeenCalledTimes(2);
        expect(f.thread.post).toHaveBeenCalledTimes(2);
        expect(f.output).toHaveBeenCalledTimes(2);
        expect(f.output.mock.calls.map(call => embeddedRecord(format(...call).split('\n')[0]!).authorId)).toEqual([
          'OTHER',
          'U123',
        ]);
      });
    });

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
        skipped: [],
      });

      spy.mockRestore();
    });

    it('gives a custom handler the messages batched by the SDK as ctx.skipped', async () => {
      const chatMod = await getChatModule();
      let registeredDMWrapper: ((...args: any[]) => unknown) | undefined;
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

      const earlier = { ...message, id: 'msg-earlier', text: 'first part' };
      const chatThread = makeChatThread({ adapter: channels.adapters.discord });
      await registeredDMWrapper!(chatThread, message, {}, { skipped: [earlier], totalSinceLastHandler: 2 });

      const ctx = onDirectMessage.mock.calls[0]![3] as { skipped: unknown[] };
      expect(ctx.skipped).toEqual([earlier]);

      spy.mockRestore();
    });

    it('merges batched messages into one agent turn, oldest first', async () => {
      const chatMod = await getChatModule();
      let registeredDMWrapper: ((...args: any[]) => unknown) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onDirectMessage').mockImplementation((handler: any) => {
        registeredDMWrapper = handler;
      });

      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
      });
      channels.__setAgent(mockAgent);
      await channels.initialize(makeMastra());

      const dispatches: any[] = [];
      vi.spyOn(channels as any, 'dispatchInboundMessage').mockImplementation(async (args: any) => {
        dispatches.push(args);
      });

      const first = { ...message, id: 'm1', text: 'first part', formatted: undefined, attachments: [] };
      const second = { ...message, id: 'm2', text: 'second part', formatted: undefined, attachments: [] };
      const chatThread = makeChatThread({ adapter: channels.adapters.discord });
      await registeredDMWrapper!(chatThread, second, {}, { skipped: [first], totalSinceLastHandler: 2 });

      expect(dispatches).toHaveLength(1);
      const serialized = JSON.stringify(dispatches[0].signalContents);
      expect(serialized).toContain('first part');
      expect(serialized).toContain('second part');
      expect(serialized.indexOf('first part')).toBeLessThan(serialized.indexOf('second part'));

      spy.mockRestore();
    });

    it('does not repeat batched messages as thread history on a first mention', async () => {
      const chatMod = await getChatModule();
      let registeredMentionWrapper: ((...args: any[]) => unknown) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onNewMention').mockImplementation((handler: any) => {
        registeredMentionWrapper = handler;
      });

      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
      });
      channels.__setAgent(mockAgent);
      await channels.initialize(makeMastra());

      const dispatches: any[] = [];
      vi.spyOn(channels as any, 'dispatchInboundMessage').mockImplementation(async (args: any) => {
        dispatches.push(args);
      });
      let historySignals: any[] = [];
      vi.spyOn(channels as any, 'persistThreadHistorySignals').mockImplementation(async (args: any) => {
        historySignals = await args.buildSignals();
        return true;
      });

      const first = { ...message, id: 'm1', text: 'first part', formatted: undefined, attachments: [] };
      const second = { ...message, id: 'm2', text: 'second part', formatted: undefined, attachments: [] };
      const older = { ...message, id: 'm0', text: 'older chatter', formatted: undefined, attachments: [] };
      const chatThread = makeChatThread({
        adapter: channels.adapters.discord,
        isDM: false,
        isSubscribed: vi.fn().mockResolvedValue(false),
        // newest-first, as the SDK yields them
        messages: (async function* () {
          yield second;
          yield first;
          yield older;
        })(),
      });
      await registeredMentionWrapper!(chatThread, second, { skipped: [first], totalSinceLastHandler: 2 });

      // The batched messages are the trigger, not history; only the older
      // message is persisted as a history row.
      expect(historySignals.map(s => s.contents)).toEqual(['older chatter']);
      const serialized = JSON.stringify(dispatches[0].signalContents);
      expect(serialized).not.toContain('older chatter');
      expect(serialized).not.toContain('[Thread context');
      expect(serialized.split('first part')).toHaveLength(2);

      spy.mockRestore();
    });

    it("dispatches another sender's batched messages as their own turn", async () => {
      const chatMod = await getChatModule();
      let registeredDMWrapper: ((...args: any[]) => unknown) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onDirectMessage').mockImplementation((handler: any) => {
        registeredDMWrapper = handler;
      });

      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
      });
      channels.__setAgent(mockAgent);
      await channels.initialize(makeMastra());

      const dispatches: any[] = [];
      vi.spyOn(channels as any, 'dispatchInboundMessage').mockImplementation(async (args: any) => {
        dispatches.push(args);
      });

      const fromOther = {
        ...message,
        id: 'm1',
        text: 'other user text',
        author: { userId: 'user-2', userName: 'mallory' },
        attachments: [],
      };
      const current = { ...message, id: 'm2', text: 'my text', formatted: undefined, attachments: [] };
      const chatThread = makeChatThread({ adapter: channels.adapters.discord });
      await registeredDMWrapper!(chatThread, current, {}, { skipped: [fromOther], totalSinceLastHandler: 2 });

      expect(dispatches).toHaveLength(2);
      const firstTurn = JSON.stringify(dispatches[0].signalContents);
      const secondTurn = JSON.stringify(dispatches[1].signalContents);
      expect(firstTurn).toContain('other user text');
      expect(firstTurn).not.toContain('my text');
      expect(secondTurn).toContain('my text');
      expect(secondTurn).not.toContain('other user text');
      expect(dispatches[0].attributes.messageId).toBe('m1');
      expect(dispatches[1].attributes.messageId).toBe('m2');

      spy.mockRestore();
    });

    it("isolates each sender's run and keeps going when one run is refused", async () => {
      const chatMod = await getChatModule();
      const { ChannelSessionRejectedError } = await import('../errors');
      let registeredDMWrapper: ((...args: any[]) => unknown) | undefined;
      const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onDirectMessage').mockImplementation((handler: any) => {
        registeredDMWrapper = handler;
      });

      const onDirectMessage = vi.fn((thread: any, msg: any, defaultHandler: any, ctx: any) => {
        ctx.requestContext.set('tenant', 'current-sender');
        return defaultHandler(thread, msg);
      });
      const channels = new AgentChannels({
        adapters: { discord: createMockAdapter('discord') },
        handlers: { onDirectMessage },
      });
      channels.__setAgent(mockAgent);
      await channels.initialize(makeMastra());

      const calls: { id: string; tenant: unknown }[] = [];
      vi.spyOn(channels as any, 'processChatMessage').mockImplementation(async (...args: any[]) => {
        calls.push({ id: args[1].id, tenant: args[3].get('tenant') });
        if (args[1].id === 'a') throw new ChannelSessionRejectedError('no');
      });

      const author = (userId?: string) => ({ userId, userName: userId ?? 'anon' });
      const skipped = [
        { ...message, id: 'a', author: author('user-a') },
        { ...message, id: 'anon1', author: author(undefined) },
        { ...message, id: 'anon2', author: author(undefined) },
      ];
      const current = { ...message, id: 'c', author: author('user-c') };
      await registeredDMWrapper!(
        makeChatThread({ adapter: channels.adapters.discord }),
        current,
        {},
        {
          skipped,
          totalSinceLastHandler: 4,
        },
      );

      expect(calls).toEqual([
        { id: 'a', tenant: undefined },
        { id: 'anon1', tenant: undefined },
        { id: 'anon2', tenant: undefined },
        { id: 'c', tenant: 'current-sender' },
      ]);

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

describe('thread history', () => {
  const BASE_TIME = Date.UTC(2026, 8, 29, 10, 0, 0);
  const alice = { userId: 'U1', userName: 'alice', fullName: 'Alice', isBot: false };
  const bob = { userId: 'U2', userName: 'bob', fullName: 'Bob', isBot: false };
  const bot = { userId: 'B1', userName: 'otherbot', fullName: 'Other Bot', isBot: true };

  function historyMessage(i: number, overrides: Record<string, unknown> = {}) {
    return {
      id: `h${i}`,
      text: `message ${i}`,
      formatted: undefined,
      attachments: [],
      author: i % 2 === 0 ? alice : bob,
      metadata: { dateSent: new Date(BASE_TIME + i * 1000), edited: false },
      ...overrides,
    } as any;
  }

  /** `history` is oldest first; the fake thread yields it newest first like the SDK. */
  function makeChatThread(
    history: any[],
    overrides: Record<string, unknown> = {},
    options: { forwardFetch?: ReturnType<typeof vi.fn> } = {},
  ) {
    const forwardFetch = options.forwardFetch ?? vi.fn();
    return {
      id: 'channel-1:thread-1',
      channelId: 'channel-1',
      isDM: false,
      isSubscribed: vi.fn().mockResolvedValue(false),
      subscribe: vi.fn().mockResolvedValue(undefined),
      mentionUser: vi.fn((userId: string) => `<@${userId}>`),
      messages: {
        async *[Symbol.asyncIterator]() {
          for (let i = history.length - 1; i >= 0; i--) yield history[i];
        },
      },
      allMessages: {
        async *[Symbol.asyncIterator]() {
          forwardFetch();
          for (const m of history) yield m;
        },
      },
      ...overrides,
    } as any;
  }

  function makeMastra() {
    const db = new InMemoryDB();
    const memoryStore = new InMemoryMemory({ db });
    return { getStorage: () => ({ getStore: () => memoryStore }), getServer: () => null } as any;
  }

  const trigger = {
    id: 'trigger',
    text: '@TestBot hi there',
    formatted: undefined,
    attachments: [],
    author: alice,
    metadata: { dateSent: new Date(BASE_TIME + 100_000), edited: false },
  } as any;

  async function setup(options: { agent?: any; threadContext?: Record<string, unknown>; spyHook?: boolean } = {}) {
    const chatMod = await getChatModule();
    let wrapper: ((...args: any[]) => unknown) | undefined;
    vi.spyOn(chatMod.Chat.prototype as any, 'onNewMention').mockImplementation((handler: any) => {
      wrapper = handler;
    });
    const agent = options.agent ?? createMockAgent();
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const channels = new AgentChannels({
      adapters: { slack: createMockAdapter('slack') },
      ...(options.threadContext ? { threadContext: options.threadContext } : {}),
    });
    channels.__setAgent(agent);
    channels.__setLogger(logger as any);
    await channels.initialize(makeMastra());

    const dispatches: any[] = [];
    vi.spyOn(channels as any, 'dispatchInboundMessage').mockImplementation(async (args: any) => {
      dispatches.push(args);
    });
    let signals: any[] = [];
    const hook = vi.spyOn(channels as any, 'persistThreadHistorySignals');
    if (options.spyHook !== false) {
      hook.mockImplementation(async (args: any) => {
        signals = await args.buildSignals();
        return true;
      });
    }
    return {
      channels,
      agent,
      logger,
      hook,
      dispatches,
      signals: () => signals,
      run: (chatThread: any, message = trigger) => {
        chatThread.adapter ??= channels.adapters.slack;
        return wrapper!(chatThread, message, { skipped: [], totalSinceLastHandler: 1 });
      },
    };
  }

  afterEach(() => vi.restoreAllMocks());

  it('persists root, gap marker and the recent window as attributed rows', async () => {
    const t = await setup({ threadContext: { maxMessages: 10 } });
    const history = Array.from({ length: 15 }, (_, i) => historyMessage(i, i === 7 ? { author: bot } : {}));
    await t.run(makeChatThread(history));

    const signals = t.signals();
    const mastraThreadId = t.dispatches[0].thread.id;
    expect(signals).toHaveLength(11);
    expect(signals.map(s => s.contents)).toEqual([
      'message 0',
      '[… 5 earlier Slack messages omitted]',
      ...Array.from({ length: 9 }, (_, i) => `message ${i + 6}`),
    ]);
    expect(signals.map(s => s.id)).toEqual([
      `thread-history:${mastraThreadId}:h0`,
      `thread-history:${mastraThreadId}:gap`,
      ...Array.from({ length: 9 }, (_, i) => `thread-history:${mastraThreadId}:h${i + 6}`),
    ]);
    for (const s of signals) {
      expect(s.type).toBe('user');
      expect(s.attributes.source).toBe('thread-history');
    }
    expect(signals[0].attributes).toEqual({
      messageId: 'h0',
      authorName: 'Alice',
      authorId: 'U1',
      authorMention: '<@U1>',
      source: 'thread-history',
    });
    expect(signals[0].createdAt).toEqual(new Date(BASE_TIME));
    expect(signals[1].attributes).toEqual({ source: 'thread-history', kind: 'gap', omitted: '5' });
    expect(signals[1].createdAt).toEqual(new Date(BASE_TIME + 1));
    // Platform badge without an author, so clients can tag the marker as channel context.
    expect(signals[1].providerOptions).toEqual({ mastra: { channels: { slack: {} } } });
    const botRow = signals.find(s => s.attributes.messageId === 'h7')!;
    expect(botRow.attributes).toMatchObject({ authorName: 'Other Bot', authorId: 'B1', isBot: 'true' });
    for (let i = 2; i < signals.length; i++) {
      expect(signals[i].createdAt).toEqual(history[i + 4].metadata.dateSent);
      expect(signals[i].providerOptions.mastra.channels.slack.author).toMatchObject({
        userId: history[i + 4].author.userId,
      });
    }

    expect(t.dispatches).toHaveLength(1);
    const serialized = JSON.stringify(t.dispatches[0].signalContents);
    expect(serialized).not.toContain('[Thread context');
    expect(serialized).not.toContain('message 0');
    expect(serialized).toContain('hi there');
  });

  it('emits no gap and no separate root when the root falls inside the window', async () => {
    const t = await setup({ threadContext: { maxMessages: 10 } });
    await t.run(makeChatThread(Array.from({ length: 4 }, (_, i) => historyMessage(i))));
    expect(t.signals().map(s => s.contents)).toEqual(['message 0', 'message 1', 'message 2', 'message 3']);
  });

  it('emits the root without a gap when it immediately precedes the window', async () => {
    const t = await setup({ threadContext: { maxMessages: 10 } });
    await t.run(makeChatThread(Array.from({ length: 10 }, (_, i) => historyMessage(i))));
    const contents = t.signals().map(s => s.contents);
    expect(contents).toHaveLength(10);
    expect(contents[0]).toBe('message 0');
    expect(contents).not.toContain(expect.stringContaining('omitted'));
  });

  it('emits only the root and the gap marker when maxMessages is 1', async () => {
    const t = await setup({ threadContext: { maxMessages: 1 } });
    await t.run(makeChatThread(Array.from({ length: 5 }, (_, i) => historyMessage(i))));
    expect(t.signals().map(s => s.contents)).toEqual(['message 0', '[… 4 earlier Slack messages omitted]']);
  });

  it('falls back to monotonic timestamps for messages without a valid dateSent', async () => {
    const t = await setup({ threadContext: { maxMessages: 10 } });
    const history = Array.from({ length: 6 }, (_, i) =>
      historyMessage(i, i === 2 ? { metadata: {} } : i === 4 ? { metadata: { dateSent: new Date('nope') } } : {}),
    );
    await t.run(makeChatThread(history));
    const stamps = t.signals().map(s => (s.createdAt as Date).getTime());
    expect(stamps).toHaveLength(6);
    for (let i = 1; i < stamps.length; i++) expect(stamps[i]).toBeGreaterThan(stamps[i - 1]!);
    expect(stamps.at(-1)!).toBeLessThanOrEqual(Date.now());
  });

  describe('omitted-count cap', () => {
    it('renders 500+ and fetches the root from the front of the thread past the cap', async () => {
      const t = await setup({ threadContext: { maxMessages: 10 } });
      const forwardFetch = vi.fn();
      await t.run(
        makeChatThread(
          Array.from({ length: 600 }, (_, i) => historyMessage(i)),
          {},
          { forwardFetch },
        ),
      );
      const signals = t.signals();
      expect(forwardFetch).toHaveBeenCalledTimes(1);
      expect(signals[0].contents).toBe('message 0');
      expect(signals[1].contents).toBe('[… 500+ earlier Slack messages omitted]');
      expect(signals[1].attributes.omitted).toBe('500+');
      expect(signals).toHaveLength(11);
    });

    it('treats exactly cap + window prior messages as a cap hit', async () => {
      const t = await setup({ threadContext: { maxMessages: 10 } });
      const forwardFetch = vi.fn();
      // 9 recent + 500 walked = the walk stops before seeing the root.
      await t.run(
        makeChatThread(
          Array.from({ length: 510 }, (_, i) => historyMessage(i)),
          {},
          { forwardFetch },
        ),
      );
      expect(forwardFetch).toHaveBeenCalledTimes(1);
      expect(t.signals()[1].contents).toBe('[… 500+ earlier Slack messages omitted]');
    });

    it('keeps the exact count when the walk reaches the root at the cap boundary', async () => {
      const t = await setup({ threadContext: { maxMessages: 10 } });
      const forwardFetch = vi.fn();
      // 9 recent + 500 walked, the 500th walked being the root itself.
      await t.run(
        makeChatThread(
          Array.from({ length: 509 }, (_, i) => historyMessage(i)),
          {},
          { forwardFetch },
        ),
      );
      expect(forwardFetch).toHaveBeenCalledTimes(1);
      expect(t.signals()[0].contents).toBe('message 0');
      expect(t.signals()[1].contents).toBe('[… 499 earlier Slack messages omitted]');
    });

    it('needs no forward fetch when the walk exhausts before the cap', async () => {
      const t = await setup({ threadContext: { maxMessages: 10 } });
      const forwardFetch = vi.fn();
      await t.run(
        makeChatThread(
          Array.from({ length: 508 }, (_, i) => historyMessage(i)),
          {},
          { forwardFetch },
        ),
      );
      expect(forwardFetch).not.toHaveBeenCalled();
      expect(t.signals()[1].contents).toBe('[… 498 earlier Slack messages omitted]');
    });
  });

  it('drops the gap marker but keeps the recent rows when the root fetch fails', async () => {
    const t = await setup({ threadContext: { maxMessages: 10 } });
    const chatThread = makeChatThread(
      Array.from({ length: 600 }, (_, i) => historyMessage(i)),
      {
        allMessages: {
          async *[Symbol.asyncIterator]() {
            throw new Error('forward boom');
          },
        },
      },
    );
    await t.run(chatThread);
    const contents = t.signals().map(s => s.contents);
    expect(contents).toHaveLength(9);
    expect(contents[0]).toBe('message 591');
    expect(t.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch thread root message'));
  });

  it('persists nothing but still dispatches the trigger when the history walk fails', async () => {
    const t = await setup({ threadContext: { maxMessages: 10 } });
    const chatThread = makeChatThread([], {
      messages: {
        async *[Symbol.asyncIterator]() {
          throw new Error('backward boom');
        },
      },
    });
    await t.run(chatThread);
    expect(t.hook).not.toHaveBeenCalled();
    expect(t.dispatches).toHaveLength(1);
    expect(t.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch thread history'));
  });

  it('routes history attachments like live attachments', async () => {
    const t = await setup({ threadContext: { maxMessages: 10 } });
    const png = {
      type: 'image',
      mimeType: 'image/png',
      name: 'shot.png',
      url: 'https://files.example/shot.png',
      fetchData: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    };
    const zip = {
      type: 'file',
      mimeType: 'application/zip',
      name: 'bundle.zip',
      url: 'https://files.example/bundle.zip',
    };
    const gone = {
      type: 'image',
      mimeType: 'image/jpeg',
      name: 'gone.jpg',
      url: 'https://files.example/gone.jpg',
      fetchData: vi.fn().mockRejectedValue(new Error('404')),
    };
    const history = [
      historyMessage(0, { attachments: [png] }),
      historyMessage(1, { attachments: [zip] }),
      historyMessage(2, { text: '', attachments: [gone] }),
    ];
    await t.run(makeChatThread(history));
    const [withPng, withZip, withGone] = t.signals();

    expect(withPng.contents).toEqual([
      { type: 'text', text: 'message 0' },
      { type: 'text', text: '[Attached image/png file: shot.png]' },
      {
        type: 'file',
        data: expect.stringMatching(/^data:image\/png;base64,/),
        mediaType: 'image/png',
        filename: 'shot.png',
      },
    ]);
    expect(withZip.contents).toEqual([
      { type: 'text', text: 'message 1' },
      { type: 'text', text: '[Attached file: bundle.zip (application/zip) — https://files.example/bundle.zip]' },
    ]);
    expect(withGone.contents).toEqual(expect.stringContaining('[Attachment unavailable: gone.jpg'));
  });

  it('skips the history walk for subscribed threads, DMs and maxMessages: 0', async () => {
    const subscribed = await setup();
    await subscribed.run(makeChatThread([historyMessage(0)], { isSubscribed: vi.fn().mockResolvedValue(true) }));
    expect(subscribed.hook).not.toHaveBeenCalled();
    vi.restoreAllMocks();

    const dm = await setup();
    const dmThread = makeChatThread([historyMessage(0)], { isDM: true });
    await dm.run(dmThread);
    expect(dm.hook).not.toHaveBeenCalled();
    expect(dmThread.isSubscribed).not.toHaveBeenCalled();
    vi.restoreAllMocks();

    const disabled = await setup({ threadContext: { maxMessages: 0 } });
    const disabledThread = makeChatThread([historyMessage(0)]);
    await disabled.run(disabledThread);
    expect(disabled.hook).not.toHaveBeenCalled();
    expect(disabledThread.isSubscribed).not.toHaveBeenCalled();
    for (const t of [subscribed, dm, disabled]) expect(t.dispatches).toHaveLength(1);
  });

  describe('base persist hook', () => {
    function persistingAgent() {
      const agent = createMockAgent();
      const memory = { saveMessages: vi.fn().mockResolvedValue(undefined) };
      agent.getMemory = vi.fn().mockResolvedValue(memory);
      agent.sendSignal = vi.fn();
      return Object.assign(agent, { memory });
    }

    it('writes every row to memory in one batch without waking the agent', async () => {
      const agent = persistingAgent();
      const t = await setup({ agent, threadContext: { maxMessages: 10 }, spyHook: false });
      await t.run(makeChatThread(Array.from({ length: 15 }, (_, i) => historyMessage(i))));

      await expect(t.hook.mock.results[0]!.value).resolves.toBe(true);
      expect(agent.sendSignal).not.toHaveBeenCalled();
      expect(agent.memory.saveMessages).toHaveBeenCalledTimes(1);
      const memory = t.dispatches[0].memory;
      const { messages } = agent.memory.saveMessages.mock.calls[0][0];
      expect(messages).toHaveLength(11);
      expect(messages.map((m: any) => m.id)).toEqual([
        `thread-history:${memory.thread}:h0`,
        `thread-history:${memory.thread}:gap`,
        ...Array.from({ length: 9 }, (_, i) => `thread-history:${memory.thread}:h${i + 6}`),
      ]);
      for (const m of messages) {
        expect(m).toMatchObject({ role: 'signal', type: 'user', threadId: memory.thread, resourceId: memory.resource });
      }
      expect(messages[0].createdAt).toEqual(new Date(BASE_TIME));
      expect(messages[0].content.metadata.signal.attributes).toMatchObject({
        messageId: 'h0',
        source: 'thread-history',
      });
      expect(messages[1].content.metadata.signal.attributes.kind).toBe('gap');
      // The trigger itself is dispatched separately, never through the batch write.
      expect(t.dispatches).toHaveLength(1);
      expect(JSON.stringify(t.dispatches[0].signalContents)).not.toContain('[Thread context');
    });

    it('falls back to the legacy text block when the batch write fails', async () => {
      const agent = persistingAgent();
      agent.memory.saveMessages.mockRejectedValue(new Error('write boom'));
      const t = await setup({ agent, threadContext: { maxMessages: 10 }, spyHook: false });
      await t.run(makeChatThread(Array.from({ length: 15 }, (_, i) => historyMessage(i))));
      // History is only collected on the first mention, so a lost write must
      // not lose the context: the legacy block carries it on the trigger.
      await expect(t.hook.mock.results[0]!.value).resolves.toBe(false);
      expect(t.logger.warn).toHaveBeenCalledWith(
        'Failed to persist 11 thread history messages: Error: write boom',
        expect.anything(),
      );
      expect(t.dispatches).toHaveLength(1);
      const text = t.dispatches[0].signalContents as string;
      expect(text).toContain('[Thread context — messages in this thread before you joined]');
      expect(text).toContain('[… 5 earlier Slack messages omitted]');
      expect(text).toContain('(msg:h0): message 0');
    });

    it('logs and dispatches the trigger without a legacy block when building the rows fails', async () => {
      const agent = persistingAgent();
      const t = await setup({ agent, threadContext: { maxMessages: 10 }, spyHook: false });
      vi.spyOn(t.channels as any, 'buildThreadHistorySignals').mockRejectedValue(new Error('build boom'));
      await t.run(makeChatThread(Array.from({ length: 3 }, (_, i) => historyMessage(i))));
      await expect(t.hook.mock.results[0]!.value).resolves.toBe(true);
      expect(agent.memory.saveMessages).not.toHaveBeenCalled();
      expect(t.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to build thread history messages'),
        expect.anything(),
      );
      expect(t.dispatches).toHaveLength(1);
      expect(JSON.stringify(t.dispatches[0].signalContents)).not.toContain('[Thread context');
    });

    it('renders the legacy text block for an agent without memory', async () => {
      const agent = createMockAgent();
      agent.sendSignal = vi.fn();
      const t = await setup({ agent, threadContext: { maxMessages: 10 }, spyHook: false });
      const history = Array.from({ length: 15 }, (_, i) => historyMessage(i, i === 7 ? { author: bot } : {}));
      await t.run(makeChatThread(history));

      await expect(t.hook.mock.results[0]!.value).resolves.toBe(false);
      expect(agent.sendSignal).not.toHaveBeenCalled();
      expect(t.dispatches).toHaveLength(1);
      const text = t.dispatches[0].signalContents as string;
      expect(text.split('\n\n')[0]!.split('\n')).toEqual([
        '[Thread context — messages in this thread before you joined]',
        '[Alice (<@U1>)] (msg:h0): message 0',
        '[… 5 earlier Slack messages omitted]',
        '[Alice (<@U1>)] (msg:h6): message 6',
        '[Other Bot (<@B1>) (bot)] (msg:h7): message 7',
        ...Array.from({ length: 7 }, (_, k) => {
          const i = k + 8;
          return `[${i % 2 === 0 ? 'Alice (<@U1>)' : 'Bob (<@U2>)'}] (msg:h${i}): message ${i}`;
        }),
      ]);
      expect(text).toContain('hi there');
    });
  });
});

describe('thread history end to end', () => {
  const BASE_TIME = Date.UTC(2026, 8, 29, 11, 0, 0);
  const alice = { userId: 'U1', userName: 'alice', fullName: 'Alice', isBot: false, isMe: false };
  const bob = { userId: 'U2', userName: 'bob', fullName: 'Bob', isBot: false, isMe: false };
  const bot = { userId: 'B1', userName: 'otherbot', fullName: 'Other Bot', isBot: true, isMe: false };
  const THREAD_ID = 'C1:1700000000.000100';

  function fixtureMessage(i: number, overrides: Record<string, unknown> = {}) {
    return {
      id: `h${i}`,
      threadId: THREAD_ID,
      text: `message ${i}`,
      formatted: undefined,
      raw: {},
      attachments: [],
      author: i % 2 === 0 ? alice : bob,
      metadata: { dateSent: new Date(BASE_TIME + i * 1000), edited: false },
      ...overrides,
    } as any;
  }

  /** Adapter whose fetchMessages pages over `prior` honoring direction/cursor/limit. */
  function createFixtureAdapter(prior: any[]) {
    const adapter = createMockAdapter('slack');
    adapter.isDM = () => false;
    adapter.fetchMessages = vi.fn(async (_threadId: string, options: any = {}) => {
      const pageSize = options.limit ?? 5;
      if (options.direction === 'forward') {
        const start = options.cursor ? Number(options.cursor) : 0;
        const messages = prior.slice(start, start + pageSize);
        const end = start + messages.length;
        return { messages, nextCursor: end < prior.length ? String(end) : undefined };
      }
      // backward: pages of chronological messages, newest page first
      const end = options.cursor ? Number(options.cursor) : prior.length;
      const start = Math.max(0, end - pageSize);
      return { messages: prior.slice(start, end), nextCursor: start > 0 ? String(start) : undefined };
    });
    return adapter;
  }

  async function createHarness(options: { prior: any[]; state?: any } = { prior: [] }) {
    const { MockLanguageModelV2, convertArrayToReadableStream } = await import('@internal/ai-sdk-v5/test');
    const { Mastra } = await import('../../mastra');
    const { InMemoryStore } = await import('../../storage/mock');
    const { MockMemory } = await import('../../memory/mock');

    const prompts: any[] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        prompts.push(prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 't-1' },
            { type: 'text-delta', id: 't-1', delta: 'Hello' },
            { type: 'text-end', id: 't-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });
    const storage = new InMemoryStore();
    const adapter = createFixtureAdapter(options.prior);
    const channels = new AgentChannels({
      adapters: { slack: adapter },
      threadContext: { maxMessages: 10 },
      ...(options.state ? { state: options.state } : {}),
    });
    const agent = new Agent({
      id: 'e2e-agent',
      name: 'e2e-agent',
      instructions: 'test',
      model,
      // Recall enough history for the root row to reach the prompt: memory's
      // `lastMessages` must cover root + gap + the recent window.
      memory: new MockMemory({ storage, options: { lastMessages: 50 } }),
      channels,
    });
    const mastra = new Mastra({ storage, agents: { agent } });
    await channels.initialize(mastra);

    const mention = (id: string) =>
      fixtureMessage(0, {
        id,
        text: '@TestBot what was the first message?',
        author: alice,
        metadata: { dateSent: new Date(BASE_TIME + 100_000), edited: false },
      });
    const storedRows = async () => {
      const memoryStore = await storage.getStore('memory');
      const threads = await memoryStore!.listThreads({ page: 0, perPage: 10 });
      const thread = threads.threads[0]!;
      const { messages } = await memoryStore!.listMessages({ threadId: thread.id, page: 0, perPage: 100 });
      return { thread, messages: [...messages].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)) };
    };
    return {
      channels,
      adapter,
      prompts,
      mention,
      storedRows,
      deliver: (m: any) => (channels.sdk as any).processMessage(adapter, THREAD_ID, m),
    };
  }

  it('persists prior thread messages as attributed rows and prompts with them before the trigger', async () => {
    const png = {
      type: 'image',
      mimeType: 'image/png',
      name: 'shot.png',
      url: 'https://files.example/shot.png',
      fetchData: vi.fn().mockResolvedValue(new Uint8Array([137, 80, 78, 71])),
    };
    const prior = Array.from({ length: 15 }, (_, i) =>
      fixtureMessage(i, i === 7 ? { author: bot } : i === 9 ? { attachments: [png] } : {}),
    );
    const h = await createHarness({ prior });
    await h.deliver(h.mention('trigger-1'));

    const { thread, messages } = await h.storedRows();
    const userRows = messages.filter(m => m.type === 'user');
    // No row carries the legacy text block; history arrives as its own rows:
    // root + gap + 9 recent + trigger.
    expect(JSON.stringify(userRows.map(m => m.content))).not.toContain('[Thread context');
    expect(userRows).toHaveLength(12);
    const attrs = (m: any) => m.content.metadata?.signal?.attributes ?? {};
    expect(userRows.slice(0, 11).map(m => m.id)).toEqual([
      `thread-history:${thread.id}:h0`,
      `thread-history:${thread.id}:gap`,
      ...Array.from({ length: 9 }, (_, i) => `thread-history:${thread.id}:h${i + 6}`),
    ]);
    for (const row of userRows.slice(0, 11)) expect(attrs(row).source).toBe('thread-history');
    expect(attrs(userRows[0])).toMatchObject({ messageId: 'h0', authorName: 'Alice', authorId: 'U1' });
    expect(new Date(userRows[0]!.createdAt)).toEqual(new Date(BASE_TIME));
    expect(attrs(userRows[1])).toMatchObject({ kind: 'gap', omitted: '5' });
    expect(attrs(userRows.find(m => attrs(m).messageId === 'h7'))).toMatchObject({ isBot: 'true' });
    const trigger = userRows[11]!;
    expect(attrs(trigger).source).toBeUndefined();
    expect(attrs(trigger).messageId).toBe('trigger-1');
    expect(JSON.stringify(trigger.content)).not.toContain('[Thread context');

    // Adapter paging: backward walk for the window and count; no forward fetch needed (root reached).
    const directions = h.adapter.fetchMessages.mock.calls.map((c: any[]) => c[1]?.direction);
    expect(directions).toContain('backward');
    expect(directions).not.toContain('forward');

    // The model saw the history turns, in order, before the trigger.
    expect(h.prompts).toHaveLength(1);
    const userTurns = h.prompts[0].filter((m: any) => m.role === 'user');
    const turnText = (m: any) =>
      typeof m.content === 'string' ? m.content : m.content.map((p: any) => p.text ?? '').join('');
    const texts = userTurns.map(turnText);
    expect(texts[0]).toContain('source="thread-history"');
    expect(texts[0]).toContain('message 0');
    expect(texts[1]).toContain('[… 5 earlier Slack messages omitted]');
    expect(texts[texts.length - 1]).toContain('what was the first message?');
    expect(texts[texts.length - 1]).not.toContain('[Thread context');
    expect(texts.join('\n').indexOf('message 0')).toBeLessThan(texts.join('\n').indexOf('what was the first message?'));
    const fileParts = userTurns.flatMap((m: any) =>
      typeof m.content === 'string' ? [] : m.content.filter((p: any) => p.type === 'file'),
    );
    expect(fileParts).toHaveLength(1);
    expect(fileParts[0].mediaType).toBe('image/png');
  });

  it('does not duplicate history rows when two deliveries race before the subscription lands', async () => {
    const prior = Array.from({ length: 15 }, (_, i) => fixtureMessage(i));
    // Subscription state that never reports subscribed, so both deliveries take the first-mention path.
    const kv = new Map<string, unknown>();
    const state = {
      isSubscribed: vi.fn().mockResolvedValue(false),
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(async (key: string) => kv.get(key) ?? null),
      set: vi.fn(async (key: string, value: unknown) => void kv.set(key, value)),
      setIfNotExists: vi.fn(async (key: string, value: unknown) => {
        if (kv.has(key)) return false;
        kv.set(key, value);
        return true;
      }),
      delete: vi.fn(async (key: string) => void kv.delete(key)),
      acquireLock: vi.fn().mockResolvedValue({ release: async () => {} }),
      releaseLock: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const h = await createHarness({ prior, state });
    await Promise.all([h.deliver(h.mention('trigger-a')), h.deliver(h.mention('trigger-b'))]);

    const { messages } = await h.storedRows();
    const historyRows = messages.filter(m => m.id.startsWith('thread-history:'));
    expect(historyRows).toHaveLength(11);
    expect(state.isSubscribed).toHaveBeenCalled();
  });
});
