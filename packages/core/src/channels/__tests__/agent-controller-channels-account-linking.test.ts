import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { AgentController } from '../../agent-controller/agent-controller';
import { createMockWorkspace } from '../../agent-controller/test-utils';
import { InMemoryStore } from '../../storage/mock';
import type { AgentControllerChannels } from '../agent-controller-channels';
import type { ChannelAccountLinkResolver } from '../types';

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

// Minimal Slack-shaped mock adapter — named 'slack' so the core team-id
// extraction (`resolveSlackTeamId`, gated on platform === 'slack') fires.
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

async function createSetup() {
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
    channels: { adapters: { slack: adapter } },
  });
  await controller.init();
  const mastra = controller.getMastra()!;
  await mastra.startWorkers();
  const channels = controller.getChannels()! as AgentControllerChannels;
  await channels.initialize(mastra);
  return { adapter, controller, mastra, channels };
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

// A Slack message whose raw envelope carries `team_id` (the only place the
// Slack team id survives onto a normalized chat Message).
function createSlackMessage(id: string, text: string, teamId: string) {
  return {
    id,
    text,
    author: { userId: 'U-sender', userName: 'caleb', fullName: 'Caleb Barnes' },
    attachments: [],
    raw: { team_id: teamId },
  } as any;
}

async function waitFor(cond: () => boolean, { timeoutMs = 15_000, what = 'condition' } = {}) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

describe('AgentControllerChannels account linking', () => {
  it('resolves the linked sender and stamps the tenant on the run before dispatching', async () => {
    const { adapter, controller, mastra, channels } = await createSetup();
    const chatThread = createSlackChatThread(adapter, 'C-1:t-1');

    const resolver: ChannelAccountLinkResolver = vi.fn(async () => ({ orgId: 'org-9', userId: 'tenant-user-9' }));
    channels.setAccountLinkResolver(resolver);

    // Wrap the created session's sendSignal to capture the requestContext the
    // dispatcher hands it, so we can assert the tenant was stamped as `user`.
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

    await (channels as any).processChatMessage(chatThread, createSlackMessage('m-1', 'hi', 'T-workspace'), mastra);

    await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'agent reply posted' });

    // The resolver was consulted with the platform sender identity from the
    // channel context (team id extracted from message.raw.team_id).
    expect(resolver).toHaveBeenCalledWith({ platform: 'slack', teamId: 'T-workspace', userId: 'U-sender' });

    // The tenant was stamped on the run's requestContext as `user` — the single
    // seam `resolveCredentialStore` reads to load the sender's model creds.
    expect(signalUser).toEqual({ id: 'tenant-user-9', organizationId: 'org-9' });

    // Session creation received the same stamped context: a dynamic workspace
    // factory resolves once at creation time, and it must see the tenant or a
    // repo-backed session workspace fails its owner check on the first message.
    expect(createSessionUser).toEqual({ id: 'tenant-user-9', organizationId: 'org-9' });

    // And the run proceeded: a session exists and the reply rendered.
    const session = await controller.getSessionByResource('channel:C-1:t-1');
    expect(session).toBeDefined();
  }, 30_000);

  it('does not dispatch an unlinked sender and invokes the unlinked-sender handler', async () => {
    const { adapter, controller, mastra, channels } = await createSetup();
    const chatThread = createSlackChatThread(adapter, 'C-2:t-2');

    const resolver: ChannelAccountLinkResolver = vi.fn(async () => null);
    channels.setAccountLinkResolver(resolver);
    const unlinked = vi.fn();
    channels.setUnlinkedSenderHandler(unlinked);

    const createSpy = vi.spyOn(controller, 'createSession');

    await (channels as any).processChatMessage(chatThread, createSlackMessage('m-1', 'hi', 'T-workspace'), mastra);

    // The unlinked handler fired with the sender identity...
    await waitFor(() => unlinked.mock.calls.length >= 1, { what: 'unlinked handler invoked' });
    expect(unlinked).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'slack', teamId: 'T-workspace', userId: 'U-sender', channelId: 'C-2' }),
    );

    // ...and no run happened: no session created, no reply posted.
    expect(createSpy).not.toHaveBeenCalled();
    expect(chatThread.post.mock.calls.length).toBe(0);
  }, 30_000);

  it('keeps pre-account-linking behavior when no resolver is set (dispatches with no tenant)', async () => {
    const { adapter, controller, mastra, channels } = await createSetup();
    const chatThread = createSlackChatThread(adapter, 'C-3:t-3');

    // No resolver set — the gate is inert.
    const createSpy = vi.spyOn(controller, 'createSession');

    await (channels as any).processChatMessage(chatThread, createSlackMessage('m-1', 'hi', 'T-workspace'), mastra);

    await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'agent reply posted' });
    expect(createSpy).toHaveBeenCalled();
  }, 30_000);
});
