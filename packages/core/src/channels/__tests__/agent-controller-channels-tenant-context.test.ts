import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import type { AgentConfig } from '../../agent';
import { AgentController } from '../../agent-controller/agent-controller';
import { createMockWorkspace } from '../../agent-controller/test-utils';
import { MockMemory } from '../../memory/mock';
import type { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage/mock';
import type { AgentControllerChannels, ChannelSessionResolve } from '../agent-controller-channels';
import { getChatModule } from '../chat-lazy';
import type { ChannelHandler } from '../types';

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

function createSlackMockAdapter() {
  return {
    name: 'slack',
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

/**
 * Build a controller whose channels carry a custom `onDirectMessage`, and
 * capture the wrapper the Chat SDK is handed so the test can drive a message
 * through the real handler boundary — the seam a host writes the tenant on.
 */
async function createSetup(
  onDirectMessage: ChannelHandler,
  options: {
    memory?: (storage: InMemoryStore) => AgentConfig['memory'];
    initialState?: Record<string, unknown>;
    resolveSession?: ChannelSessionResolve;
  } = {},
) {
  const chatMod = await getChatModule();
  let registeredDMWrapper: ((thread: any, message: any) => unknown) | undefined;
  const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onDirectMessage').mockImplementation((handler: any) => {
    registeredDMWrapper = handler;
  });

  const adapter = createSlackMockAdapter();
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: 'mode-agent',
    name: 'mode-agent',
    model: createTextStreamModel('Hello from the controller!'),
    instructions: 'You are a test agent.',
    ...(options.memory ? { memory: options.memory(storage) } : {}),
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'ctrl-1',
    storage,
    resourceId: 'ctrl-resource',
    modes: [{ id: 'build', agent, defaultModelId: 'anthropic/claude-opus-4-7' }],
    defaultModeId: 'build',
    ...(options.initialState ? { initialState: options.initialState as any } : {}),
    channels: {
      adapters: { slack: adapter },
      handlers: { onDirectMessage },
      ...(options.resolveSession ? { resolveSession: options.resolveSession } : {}),
    },
  });
  await controller.init();
  const mastra = controller.getMastra()!;
  await mastra.startWorkers();
  const channels = controller.getChannels()! as AgentControllerChannels;
  await channels.initialize(mastra);

  return { adapter, controller, mastra, channels, dispatch: registeredDMWrapper!, restore: () => spy.mockRestore() };
}

function createSlackChatThread(adapter: any, threadId: string) {
  return {
    id: threadId,
    channelId: threadId.split(':')[0],
    isDM: true,
    adapter,
    isSubscribed: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn().mockResolvedValue(undefined),
    mentionUser: vi.fn((userId: string) => `<@${userId}>`),
    messages: (async function* () {})(),
    post: vi.fn().mockResolvedValue({ id: 'posted-1', text: '' }),
    startTyping: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createSlackMessage(id: string, text: string) {
  return {
    id,
    text,
    author: { userId: 'U-sender', userName: 'caleb', fullName: 'Caleb Barnes' },
    attachments: [],
    raw: { team_id: 'T-workspace' },
  } as any;
}

async function waitFor(cond: () => boolean, { timeoutMs = 15_000, what = 'condition' } = {}) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

describe('AgentControllerChannels tenant context', () => {
  it('carries a tenant stamped by the handler through to the dispatched run', async () => {
    // This is the seam that replaced core's injected account-link resolver: the
    // host resolves the sender itself and writes the tenant before deferring.
    const onDirectMessage: ChannelHandler = async (thread, message, defaultHandler, ctx) => {
      ctx.requestContext.set('user', { id: 'tenant-user-9', organizationId: 'org-9' });
      ctx.signalMetadata.attachments = [{ id: 'file-1', mediaType: 'application/pdf' }];
      await defaultHandler(thread, message);
    };

    const { adapter, controller, dispatch, restore } = await createSetup(onDirectMessage);
    const chatThread = createSlackChatThread(adapter, 'C-1:t-1');

    let signalUser: unknown;
    let signalMetadata: unknown;
    let createSessionUser: unknown;
    const createSession = controller.createSession.bind(controller);
    vi.spyOn(controller, 'createSession').mockImplementation(async (opts: any) => {
      createSessionUser = opts?.requestContext?.get('user');
      const session = await createSession(opts);
      const sendSignal = session.sendSignal.bind(session);
      vi.spyOn(session, 'sendSignal').mockImplementation((signalArgs: any, signalOptions: any) => {
        signalUser = signalOptions?.requestContext?.get('user');
        signalMetadata = signalArgs.metadata;
        return sendSignal(signalArgs, signalOptions);
      });
      return session;
    });

    await dispatch(chatThread, createSlackMessage('m-1', 'hi'));
    await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'agent reply posted' });

    // The tenant reached the run's requestContext as `user` — the single seam
    // `resolveCredentialStore` reads to load the sender's model credentials.
    expect(signalUser).toEqual({ id: 'tenant-user-9', organizationId: 'org-9' });
    expect(signalMetadata).toEqual({
      attachments: [{ id: 'file-1', mediaType: 'application/pdf' }],
    });

    // Session creation saw the same stamped context: a dynamic workspace factory
    // resolves once at creation time, and it must see the tenant or a
    // repo-backed session workspace fails its owner check on the first message.
    expect(createSessionUser).toEqual({ id: 'tenant-user-9', organizationId: 'org-9' });

    const session = await controller.getSession('channel:C-1:t-1');
    expect(session).toBeDefined();

    restore();
  }, 30_000);

  it('does not run when the handler declines to call defaultHandler', async () => {
    // The unlinked-sender path, now owned entirely by the host: gating means
    // simply not deferring to the default handler. Core has no say.
    const onDirectMessage: ChannelHandler = async () => {};

    const { adapter, controller, dispatch, restore } = await createSetup(onDirectMessage);
    const chatThread = createSlackChatThread(adapter, 'C-2:t-2');

    const createSpy = vi.spyOn(controller, 'createSession');

    await dispatch(chatThread, createSlackMessage('m-1', 'hi'));

    expect(createSpy).not.toHaveBeenCalled();
    expect(chatThread.post.mock.calls.length).toBe(0);

    restore();
  }, 30_000);
});

describe('AgentControllerChannels binds the mapped thread with the tenant context', () => {
  const tenant = { id: 'tenant-user-9', organizationId: 'org-9' };
  const stampTenant: ChannelHandler = async (thread, message, defaultHandler, ctx) => {
    ctx.requestContext.set('user', tenant);
    await defaultHandler(thread, message);
  };

  // Mirrors Mastra Code's tenant-wrapped memory: resolving memory without the
  // authenticated principal fails closed.
  function tenantMemory(seen: unknown[]) {
    return (storage: InMemoryStore) => {
      const memory = new MockMemory({ storage });
      return ({ requestContext }: { requestContext: RequestContext }) => {
        const user = requestContext.get('user');
        seen.push(user);
        if (!user) throw new Error('Tenant model credential policy could not be resolved.');
        return memory;
      };
    };
  }

  it('binds a new channel thread at session creation, with no orphan thread or context-free memory read', async () => {
    const seen: unknown[] = [];
    const { adapter, controller, mastra, dispatch, restore } = await createSetup(stampTenant, {
      memory: tenantMemory(seen),
      // A scoped session never auto-selects the channel-created thread, which
      // carries only channel metadata — the production shape.
      initialState: { projectPath: '/repo' },
    });
    const chatThread = createSlackChatThread(adapter, 'C-3:t-3');

    await dispatch(chatThread, createSlackMessage('m-1', 'hi'));
    await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'agent reply posted' });
    expect(JSON.stringify(chatThread.post.mock.calls)).toContain('Hello from the controller!');

    const resourceId = 'channel:C-3:t-3';
    const store = await mastra.getStorage()!.getStore('memory');
    const { threads } = await store!.listThreads({ filter: { resourceId }, perPage: 10 });
    expect(threads).toHaveLength(1);
    const session = (await controller.getSession(resourceId))!;
    expect(session.thread.getId()).toBe(threads[0]!.id);

    expect(seen.length).toBeGreaterThan(0);
    for (const user of seen) expect(user).toEqual(tenant);

    restore();
  }, 30_000);

  it('keeps the tenant when a resolveSession host returns a session bound elsewhere', async () => {
    const seen: unknown[] = [];
    const { adapter, controller, mastra, dispatch, restore } = await createSetup(stampTenant, {
      memory: tenantMemory(seen),
      // No exact thread: the session lands on its own scoped thread, and the
      // channel binding has to switch it onto the mapped one.
      resolveSession: ({ controller, thread, requestContext }) =>
        controller.createSession({
          id: thread.resourceId,
          resourceId: thread.resourceId,
          ownerId: controller.id,
          requestContext,
          tags: { factoryProjectId: 'fp-1' },
        }),
    });
    const chatThread = createSlackChatThread(adapter, 'C-4:t-4');

    await dispatch(chatThread, createSlackMessage('m-1', 'hi'));
    await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'agent reply posted' });
    expect(JSON.stringify(chatThread.post.mock.calls)).toContain('Hello from the controller!');

    const session = (await controller.getSession('channel:C-4:t-4'))!;
    const channelThread = await session.thread.getById({ threadId: session.thread.getId()! });
    expect((channelThread?.metadata as Record<string, unknown>)?.channel_externalThreadId).toBe('C-4:t-4');
    // The session's own scoped thread plus the channel thread it switched onto.
    const store = await mastra.getStorage()!.getStore('memory');
    const { threads } = await store!.listThreads({ filter: { resourceId: 'channel:C-4:t-4' }, perPage: 10 });
    expect(threads).toHaveLength(2);

    expect(seen.length).toBeGreaterThan(0);
    for (const user of seen) expect(user).toEqual(tenant);

    restore();
  }, 30_000);
});
