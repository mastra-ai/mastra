import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { AgentController } from '../../agent-controller/agent-controller';
import { createMockWorkspace } from '../../agent-controller/test-utils';
import { InMemoryStore } from '../../storage/mock';
import type { AgentControllerChannels } from '../agent-controller-channels';

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
    channelIdFromThreadId: vi.fn((id: string) => id.split(':').slice(0, 2).join(':')),
    renderFormatted: vi.fn((text: string) => text),
    fetchThread: vi.fn().mockResolvedValue(null),
    startTyping: vi.fn().mockResolvedValue(undefined),
    parseMessage: vi.fn((raw: unknown) => raw),
    userName: 'TestBot',
  } as any;
}

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

async function createSetup({ responseText = 'Hello from the controller!' } = {}) {
  const adapter = createMockAdapter('discord');
  const agent = new Agent({
    id: 'mode-agent',
    name: 'mode-agent',
    model: createTextStreamModel(responseText),
    instructions: 'You are a test agent.',
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'ctrl-1',
    storage: new InMemoryStore(),
    resourceId: 'ctrl-resource',
    modes: [{ id: 'build', agent, defaultModelId: 'anthropic/claude-opus-4-7' }],
    defaultModeId: 'build',
    channels: { adapters: { discord: adapter } },
  });
  await controller.init();
  const mastra = controller.getMastra()!;
  await mastra.startWorkers();
  const channels = controller.getChannels()! as AgentControllerChannels;
  await channels.initialize(mastra);
  return { adapter, agent, controller, mastra, channels };
}

function createChatThread(adapter: any, threadId: string, { isDM = true }: { isDM?: boolean } = {}) {
  return {
    id: threadId,
    channelId: threadId.split(':')[0],
    isDM,
    adapter,
    isSubscribed: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn().mockResolvedValue(undefined),
    mentionUser: vi.fn((userId: string) => `<@${userId}>`),
    messages: (async function* () {})(),
    post: vi.fn().mockResolvedValue({ id: 'posted-1', text: '' }),
    startTyping: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMessage(id: string, text: string) {
  return {
    id,
    text,
    author: { userId: 'user-1', userName: 'caleb', fullName: 'Caleb Barnes' },
    attachments: [],
  } as any;
}

async function waitFor(cond: () => boolean, { timeoutMs = 15_000, what = 'condition' } = {}) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

function postedText(chatThread: any): string {
  return JSON.stringify(chatThread.post.mock.calls);
}

async function getChannelThreads(mastra: any, externalThreadId: string) {
  const memoryStore = await mastra.getStorage()!.getStore('memory');
  const { threads } = await memoryStore!.listThreads({
    filter: { metadata: { channel_externalThreadId: externalThreadId } },
    perPage: 10,
  });
  return threads;
}

describe('AgentControllerChannels', () => {
  it('routes an inbound message into a controller session and renders the reply through the output processor', async () => {
    const { adapter, controller, mastra, channels } = await createSetup();
    const chatThread = createChatThread(adapter, 'chan-1:t-1');

    await (channels as any).processChatMessage(chatThread, createMessage('m-1', 'hello controller'), mastra);

    // One durable session keyed `channel:{platform}:{externalThreadId}`
    const session = await controller.getSessionByResource('channel:discord:chan-1:t-1');
    expect(session).toBeDefined();

    // The mapped Mastra thread carries channel metadata and the derived owner
    const threads = await getChannelThreads(mastra, 'chan-1:t-1');
    expect(threads).toHaveLength(1);
    expect(threads[0]!.resourceId).toBe('channel:discord:chan-1:t-1');
    expect(threads[0]!.metadata).toMatchObject({
      channel_platform: 'discord',
      channel_externalThreadId: 'chan-1:t-1',
      channel_externalChannelId: 'chan-1',
    });

    // The session is bound to the mapped thread
    expect(session!.thread.getId()).toBe(threads[0]!.id);

    // Load-bearing assertion: the run's output reaches the platform through
    // ChatChannelOutputProcessor — the requestContext keys set by the channels
    // layer survived buildRequestContext into the run.
    await waitFor(() => postedText(chatThread).includes('Hello from the controller!'), {
      what: 'agent reply posted to chat thread',
    });
  }, 30_000);

  it('reuses the same session and Mastra thread for a second message in the same chat thread', async () => {
    const { adapter, controller, mastra, channels } = await createSetup();
    const chatThread = createChatThread(adapter, 'chan-1:t-1');

    await (channels as any).processChatMessage(chatThread, createMessage('m-1', 'first'), mastra);
    const session = await controller.getSessionByResource('channel:discord:chan-1:t-1');
    expect(session).toBeDefined();
    await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'first reply' });
    const boundThreadId = session!.thread.getId();

    await (channels as any).processChatMessage(chatThread, createMessage('m-2', 'second'), mastra);
    await waitFor(() => chatThread.post.mock.calls.length >= 2, { what: 'second reply' });

    // Same session instance, same bound thread, still exactly one mapped thread
    const sessionAgain = await controller.getSessionByResource('channel:discord:chan-1:t-1');
    expect(sessionAgain).toBe(session);
    expect(sessionAgain!.thread.getId()).toBe(boundThreadId);
    const threads = await getChannelThreads(mastra, 'chan-1:t-1');
    expect(threads).toHaveLength(1);
  }, 30_000);

  it('produces distinct sessions for distinct chat threads', async () => {
    const { adapter, controller, mastra, channels } = await createSetup();
    const threadA = createChatThread(adapter, 'chan-1:t-a');
    const threadB = createChatThread(adapter, 'chan-1:t-b');

    await (channels as any).processChatMessage(threadA, createMessage('m-a', 'hello a'), mastra);
    await (channels as any).processChatMessage(threadB, createMessage('m-b', 'hello b'), mastra);

    const sessionA = await controller.getSessionByResource('channel:discord:chan-1:t-a');
    const sessionB = await controller.getSessionByResource('channel:discord:chan-1:t-b');
    expect(sessionA).toBeDefined();
    expect(sessionB).toBeDefined();
    expect(sessionA).not.toBe(sessionB);
    expect(sessionA!.thread.getId()).not.toBe(sessionB!.thread.getId());
  }, 30_000);

  it('keeps channel thread metadata intact after a full message roundtrip', async () => {
    const { adapter, mastra, channels } = await createSetup();
    const chatThread = createChatThread(adapter, 'chan-1:t-meta');

    await (channels as any).processChatMessage(chatThread, createMessage('m-1', 'hello'), mastra);
    await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'reply' });

    // Re-read after the session's own thread saves during the run
    const threads = await getChannelThreads(mastra, 'chan-1:t-meta');
    expect(threads).toHaveLength(1);
    expect(threads[0]!.metadata).toMatchObject({
      channel_platform: 'discord',
      channel_externalThreadId: 'chan-1:t-meta',
      channel_externalChannelId: 'chan-1',
    });
  }, 30_000);

  it('binds a pre-existing channel thread whose resourceId differs from the derived default', async () => {
    const { adapter, controller, mastra, channels } = await createSetup();

    // Thread created before this feature (or with a custom resolveResourceId)
    const memoryStore = await mastra.getStorage()!.getStore('memory');
    await memoryStore!.saveThread({
      thread: {
        id: 'pre-existing-thread',
        title: 'discord conversation',
        resourceId: 'custom-owner',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          channel_platform: 'discord',
          channel_externalThreadId: 'chan-1:t-pre',
          channel_externalChannelId: 'chan-1',
        },
      },
    });

    const chatThread = createChatThread(adapter, 'chan-1:t-pre');
    await (channels as any).processChatMessage(chatThread, createMessage('m-1', 'hello again'), mastra);

    // Session keyed off the thread's own resourceId — no ownership throw
    const session = await controller.getSessionByResource('custom-owner');
    expect(session).toBeDefined();
    expect(session!.thread.getId()).toBe('pre-existing-thread');
    await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'reply on pre-existing thread' });
  }, 30_000);

  it('exposes webhook routes under /api/agent-controllers/{id}', async () => {
    const { channels } = await createSetup();
    const routes = channels.getWebhookRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0]!.path).toBe('/api/agent-controllers/ctrl-1/channels/discord/webhook');
    expect(routes[0]!.method).toBe('POST');
  }, 30_000);
});
