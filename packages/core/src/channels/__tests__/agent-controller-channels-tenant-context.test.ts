import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { AgentController } from '../../agent-controller/agent-controller';
import { createMockWorkspace } from '../../agent-controller/test-utils';
import { InMemoryStore } from '../../storage/mock';
import type { AgentControllerChannels } from '../agent-controller-channels';
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
async function createSetup(onDirectMessage: ChannelHandler) {
  const chatMod = await getChatModule();
  let registeredDMWrapper: ((thread: any, message: any) => unknown) | undefined;
  const spy = vi.spyOn(chatMod.Chat.prototype as any, 'onDirectMessage').mockImplementation((handler: any) => {
    registeredDMWrapper = handler;
  });

  const adapter = createSlackMockAdapter();
  const agent = new Agent({
    id: 'mode-agent',
    name: 'mode-agent',
    model: createTextStreamModel('Hello from the controller!'),
    instructions: 'You are a test agent.',
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'ctrl-1',
    storage: new InMemoryStore(),
    resourceId: 'ctrl-resource',
    modes: [{ id: 'build', agent, defaultModelId: 'anthropic/claude-opus-4-7' }],
    defaultModeId: 'build',
    channels: { adapters: { slack: adapter }, handlers: { onDirectMessage } },
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
      await defaultHandler(thread, message);
    };

    const { adapter, controller, dispatch, restore } = await createSetup(onDirectMessage);
    const chatThread = createSlackChatThread(adapter, 'C-1:t-1');

    let signalUser: unknown;
    let createSessionUser: unknown;
    const createSession = controller.createSession.bind(controller);
    vi.spyOn(controller, 'createSession').mockImplementation(async (opts: any) => {
      createSessionUser = opts?.requestContext?.get('user');
      const session = await createSession(opts);
      const sendSignal = session.sendSignal.bind(session);
      vi.spyOn(session, 'sendSignal').mockImplementation((signalArgs: any) => {
        signalUser = signalArgs.requestContext?.get('user');
        return sendSignal(signalArgs);
      });
      return session;
    });

    await dispatch(chatThread, createSlackMessage('m-1', 'hi'));
    await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'agent reply posted' });

    // The tenant reached the run's requestContext as `user` — the single seam
    // `resolveCredentialStore` reads to load the sender's model credentials.
    expect(signalUser).toEqual({ id: 'tenant-user-9', organizationId: 'org-9' });

    // Session creation saw the same stamped context: a dynamic workspace factory
    // resolves once at creation time, and it must see the tenant or a
    // repo-backed session workspace fails its owner check on the first message.
    expect(createSessionUser).toEqual({ id: 'tenant-user-9', organizationId: 'org-9' });

    const session = await controller.getSessionByResource('channel:C-1:t-1');
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
