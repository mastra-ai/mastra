import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';

import { Agent } from '../../agent';
import { AgentController } from '../../agent-controller/agent-controller';
import { createMockWorkspace } from '../../agent-controller/test-utils';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import type { AgentControllerChannels } from '../agent-controller-channels';
import { ChannelSessionRejectedError } from '../errors';

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
    // Must agree with createChatThread's channelId derivation: the SDK builds
    // threads for action events via this hook, and the mapped-thread lookup
    // filters on channel_externalChannelId.
    channelIdFromThreadId: vi.fn((id: string) => id.split(':')[0]),
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

/**
 * Two-phase model for approval flows: the first stream emits a tool call
 * (which parks controller runs at the approval gate), every later stream
 * emits `finalText`.
 */
function createApprovalFlowModel({ toolName = 'deployTool', finalText = 'Deployed successfully.' } = {}) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call += 1;
      const chunks: any[] =
        call === 1
          ? [
              { type: 'stream-start' as const, warnings: [] },
              { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call' as const,
                toolCallId: 'call-1',
                toolName,
                input: '{"action":"prod"}',
                providerExecuted: false,
              },
              {
                type: 'finish' as const,
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'stream-start' as const, warnings: [] },
              {
                type: 'response-metadata' as const,
                id: `id-${call}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start' as const, id: 'text-1' },
              { type: 'text-delta' as const, id: 'text-1', delta: finalText },
              { type: 'text-end' as const, id: 'text-1' },
              {
                type: 'finish' as const,
                finishReason: 'stop' as const,
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(chunks),
      };
    },
  });
}

function createDeployTool() {
  const executeSpy = vi.fn(async (input: { action: string }) => ({ deployed: input.action }));
  const tool = createTool({
    id: 'deployTool',
    description: 'Deploys the given target',
    inputSchema: z.object({ action: z.string() }),
    execute: executeSpy as any,
  });
  return { tool, executeSpy };
}

async function createSetup({
  responseText = 'Hello from the controller!',
  model,
  tools,
  toolDisplay,
  stateSchema,
  agentMemory,
  onSessionStart,
  resolveSession,
  onStaleToolApproval,
}: {
  responseText?: string;
  model?: MockLanguageModelV2;
  tools?: Record<string, any>;
  toolDisplay?: 'text';
  stateSchema?: z.ZodTypeAny;
  /** Memory for the mode agent — required for signal persistence assertions. */
  agentMemory?: MockMemory;
  onSessionStart?: (ctx: any) => void | Promise<void>;
  resolveSession?: (ctx: any) => any;
  onStaleToolApproval?: (ctx: any) => void | Promise<void>;
} = {}) {
  const adapter = createMockAdapter('discord');
  const agent = new Agent({
    id: 'mode-agent',
    name: 'mode-agent',
    model: model ?? createTextStreamModel(responseText),
    instructions: 'You are a test agent.',
    ...(tools ? { tools } : {}),
    ...(agentMemory ? { memory: agentMemory } : {}),
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'ctrl-1',
    storage: new InMemoryStore(),
    resourceId: 'ctrl-resource',
    modes: [{ id: 'build', agent, defaultModelId: 'anthropic/claude-opus-4-7' }],
    defaultModeId: 'build',
    channels: {
      adapters: { discord: toolDisplay ? { adapter, toolDisplay } : adapter },
      ...(onSessionStart ? { onSessionStart } : {}),
      ...(resolveSession ? { resolveSession } : {}),
      ...(onStaleToolApproval ? { onStaleToolApproval } : {}),
    },
    ...(stateSchema ? { stateSchema } : {}),
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

/**
 * Simulate a platform button click through the real Chat SDK action pipeline
 * (`processAction` → `handleActionEvent` → the base class's onAction handler
 * → the controller dispatch seams).
 */
async function simulateAction(channels: AgentControllerChannels, adapter: any, threadId: string, actionId: string) {
  await (channels.sdk as any).processAction({
    actionId,
    adapter,
    messageId: 'posted-1',
    threadId,
    user: { userId: 'user-1', userName: 'caleb', fullName: 'Caleb Barnes' },
    raw: {},
  });
}

/** Text posted anywhere: the inbound mock thread or SDK-built action threads. */
function allPostedText(adapter: any, chatThread: any): string {
  return JSON.stringify([...chatThread.post.mock.calls, ...adapter.postMessage.mock.calls]);
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

    await (channels as any).processChatMessage(
      chatThread,
      createMessage('m-1', 'hello controller'),
      mastra,
      new RequestContext(),
    );

    // One durable session keyed `channel:{platform}:{externalThreadId}`
    const session = await controller.getSessionByResource('channel:chan-1:t-1');
    expect(session).toBeDefined();

    // The mapped Mastra thread carries channel metadata and the derived owner
    const threads = await getChannelThreads(mastra, 'chan-1:t-1');
    expect(threads).toHaveLength(1);
    expect(threads[0]!.resourceId).toBe('channel:chan-1:t-1');
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

    await (channels as any).processChatMessage(chatThread, createMessage('m-1', 'first'), mastra, new RequestContext());
    const session = await controller.getSessionByResource('channel:chan-1:t-1');
    expect(session).toBeDefined();
    await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'first reply' });
    const boundThreadId = session!.thread.getId();

    await (channels as any).processChatMessage(
      chatThread,
      createMessage('m-2', 'second'),
      mastra,
      new RequestContext(),
    );
    await waitFor(() => chatThread.post.mock.calls.length >= 2, { what: 'second reply' });

    // Same session instance, same bound thread, still exactly one mapped thread
    const sessionAgain = await controller.getSessionByResource('channel:chan-1:t-1');
    expect(sessionAgain).toBe(session);
    expect(sessionAgain!.thread.getId()).toBe(boundThreadId);
    const threads = await getChannelThreads(mastra, 'chan-1:t-1');
    expect(threads).toHaveLength(1);
  }, 30_000);

  /**
   * A host can name a session (`resolveResourceId`) but never receives the
   * `Session` object — it is created in here. This hook is the only seam where
   * a channel-created session can be configured before it answers anything.
   */
  describe('session start hook', () => {
    it('fires once per session, with the session already bound to its mapped thread', async () => {
      const starts: Array<{ resourceId: string; boundThreadId: string }> = [];
      const { adapter, mastra, channels } = await createSetup({
        onSessionStart: ({ session, thread }) =>
          void starts.push({ resourceId: thread.resourceId, boundThreadId: session.thread.getId() }),
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-1');

      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-1', 'first'),
        mastra,
        new RequestContext(),
      );
      await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'first reply' });

      const threads = await getChannelThreads(mastra, 'chan-1:t-1');
      expect(starts).toEqual([{ resourceId: 'channel:chan-1:t-1', boundThreadId: threads[0]!.id }]);

      // A second message reuses the session, so it must not be reconfigured —
      // that would overwrite anything set on the thread since.
      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-2', 'second'),
        mastra,
        new RequestContext(),
      );
      await waitFor(() => chatThread.post.mock.calls.length >= 2, { what: 'second reply' });
      expect(starts).toHaveLength(1);
    }, 30_000);

    it('makes concurrent first messages wait for the hook instead of dispatching unconfigured', async () => {
      // Hold the hook open: any message that dispatches while it is pending
      // would run on an unconfigured session, which is exactly the race a
      // skip-style once-guard allows.
      let releaseHook!: () => void;
      const hookGate = new Promise<void>(resolve => (releaseHook = resolve));
      let hookCalls = 0;
      const { adapter, mastra, channels } = await createSetup({
        onSessionStart: async () => {
          hookCalls += 1;
          await hookGate;
        },
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-1');

      const dispatches = Promise.all([
        (channels as any).processChatMessage(chatThread, createMessage('m-1', 'first'), mastra, new RequestContext()),
        (channels as any).processChatMessage(chatThread, createMessage('m-2', 'second'), mastra, new RequestContext()),
      ]);

      // Give a leaked dispatch every chance to happen before asserting.
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(chatThread.post).not.toHaveBeenCalled();

      releaseHook();
      await dispatches;
      // Concurrent messages on one session may supersede each other, so only
      // require that replies exist at all - the claim under test is that none
      // happened before the hook finished, asserted above.
      await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'a reply after the hook' });
      expect(hookCalls).toBe(1);
    }, 30_000);

    it('still answers the message when the hook throws', async () => {
      const { adapter, mastra, channels } = await createSetup({
        onSessionStart: () => {
          throw new Error('configuration backend down');
        },
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-1');

      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-1', 'hello'),
        mastra,
        new RequestContext(),
      );

      await waitFor(() => postedText(chatThread).includes('Hello from the controller!'), {
        what: 'reply posted despite the failing hook',
      });
    }, 30_000);
  });

  /**
   * `onSessionStart` cannot authorize: it runs after the session exists and its
   * errors are swallowed. `resolveSession` runs before any session is created
   * and its errors propagate, which is what makes a fail-closed shared install
   * possible.
   */
  describe('session resolver', () => {
    it('creates the session in place of the default, with the inbound requestContext', async () => {
      const calls: Array<{ resourceId: string; tenant: unknown }> = [];
      const { adapter, controller, mastra, channels } = await createSetup({
        resolveSession: async ({ controller, thread, requestContext }: any) => {
          calls.push({ resourceId: thread.resourceId, tenant: requestContext?.get('tenantId') });
          return controller.createSession({
            resourceId: thread.resourceId,
            id: `tenant-acme:${thread.resourceId}`,
            ownerId: controller.id,
            requestContext,
          });
        },
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-resolve');
      const requestContext = new RequestContext();
      requestContext.set('tenantId', 'acme');

      await (channels as any).processChatMessage(chatThread, createMessage('m-1', 'hello'), mastra, requestContext);
      await waitFor(() => postedText(chatThread).includes('Hello from the controller!'), {
        what: 'reply from the resolved session',
      });

      // The resolver saw the routing inputs, and the session it built (its own
      // id, not the default one) is the session that answered on the mapped
      // thread.
      expect(calls).toEqual([{ resourceId: 'channel:chan-1:t-resolve', tenant: 'acme' }]);
      const resolved = (await controller.getSessionByResource('channel:chan-1:t-resolve'))!;
      expect(resolved.identity.getId()).toBe('tenant-acme:channel:chan-1:t-resolve');
      const threads = await getChannelThreads(mastra, 'chan-1:t-resolve');
      expect(resolved.thread.getId()).toBe(threads[0]!.id);
    }, 30_000);

    it('explains the mismatch when the resolved session cannot own the mapped thread', async () => {
      const { adapter, mastra, channels } = await createSetup({
        resolveSession: ({ controller, thread, requestContext }: any) =>
          controller.createSession({
            resourceId: `tenant-acme:${thread.resourceId}`,
            id: `tenant-acme:${thread.resourceId}`,
            ownerId: controller.id,
            requestContext,
          }),
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-mismatch');

      // Without the guard this surfaces as an opaque "Thread not found" thrown
      // from inside the session's ownership check.
      await expect(
        (channels as any).processChatMessage(chatThread, createMessage('m-1', 'hello'), mastra, new RequestContext()),
      ).rejects.toThrow(/resolveSession returned a session for resourceId=.*resolveResourceId/s);
    }, 30_000);

    it('fails closed: a rejecting resolver produces no session, no model call, and no output', async () => {
      const model = createTextStreamModel('should never be reached');
      const doStream = vi.spyOn(model, 'doStream' as any);
      const { adapter, controller, mastra, channels } = await createSetup({
        model,
        resolveSession: () => {
          throw new Error('not authorized for this install');
        },
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-denied');

      // `handleChatMessage`, not `processChatMessage`: the error boundary that
      // decides whether anything reaches the channel lives in the caller, so
      // testing one frame lower cannot show what the sender sees.
      await (channels as any).handleChatMessage(
        chatThread,
        createMessage('m-1', 'hello'),
        mastra,
        new RequestContext(),
      );

      expect(await controller.getSessionByResource('channel:chan-1:t-denied')).toBeUndefined();
      expect(doStream).not.toHaveBeenCalled();
      // Silence includes the error card: posting it would echo the host's
      // authorization message into a shared channel.
      expect(chatThread.post).not.toHaveBeenCalled();
    }, 30_000);

    it('surfaces the refusal to the host as a tagged error rather than swallowing it', async () => {
      const { adapter, mastra, channels } = await createSetup({
        resolveSession: async () => {
          throw new Error('not authorized for this install');
        },
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-denied-cause');

      const rejection = await (channels as any)
        .processChatMessage(chatThread, createMessage('m-1', 'hello'), mastra, new RequestContext())
        .catch((err: unknown) => err);

      expect(rejection).toBeInstanceOf(ChannelSessionRejectedError);
      expect((rejection as Error).message).toBe('not authorized for this install');
      expect((rejection as Error).cause).toBeInstanceOf(Error);
    }, 30_000);

    it('still reports genuine failures to the channel, so a broken host is not silently silent', async () => {
      const { adapter, mastra, channels } = await createSetup({
        resolveSession: ({ controller, thread, requestContext }: any) =>
          controller.createSession({
            resourceId: thread.resourceId,
            id: thread.resourceId,
            ownerId: controller.id,
            requestContext,
          }),
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-broken');
      // A failure from anywhere other than the resolver keeps the old
      // behavior: the sender is told, instead of waiting on a bot that quietly
      // gave up.
      vi.spyOn(channels as any, 'dispatchInboundMessage').mockRejectedValue(new Error('engine exploded'));

      await (channels as any).handleChatMessage(
        chatThread,
        createMessage('m-1', 'hello'),
        mastra,
        new RequestContext(),
      );

      expect(chatThread.post).toHaveBeenCalledWith('❌ Error: engine exploded');
    }, 30_000);

    it('runs on approval continuations with the action requestContext, so routing can be revalidated', async () => {
      const seen: Array<unknown> = [];
      const { adapter, mastra, channels } = await createSetup({
        resolveSession: ({ controller, thread, requestContext }: any) => {
          seen.push(requestContext?.get('actor'));
          return controller.createSession({
            resourceId: thread.resourceId,
            id: thread.resourceId,
            ownerId: controller.id,
            requestContext,
          });
        },
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-recheck');

      const messageContext = new RequestContext();
      messageContext.set('actor', 'author');
      await (channels as any).processChatMessage(chatThread, createMessage('m-1', 'hello'), mastra, messageContext);
      await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'reply' });

      const threads = await getChannelThreads(mastra, 'chan-1:t-recheck');
      const actionContext = new RequestContext();
      actionContext.set('actor', 'approver');
      await (channels as any).dispatchApproval({
        runId: 'run-gone',
        toolCallId: 'no-such-tool-call',
        requestContext: actionContext,
        memory: { thread: threads[0]!.id, resource: threads[0]!.resourceId },
      });

      // Previously the approval path resolved the session with no context at
      // all, so a host could only ever check the message that opened the
      // session.
      expect(seen).toEqual(['author', 'approver']);
    }, 30_000);
  });

  /**
   * An armed gate is in-memory, so every approval recovered after a restart is
   * stale. Core still refuses to run the tool; the hook is the only signal a
   * durable host gets that a user clicked on an attempt it must now settle.
   */
  describe('stale tool approval hook', () => {
    it('reports the stale action instead of dropping it, without executing the tool', async () => {
      const stale: any[] = [];
      const { adapter, controller, mastra, channels } = await createSetup({
        onStaleToolApproval: (ctx: any) => void stale.push(ctx),
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-stale-hook');

      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-1', 'hello'),
        mastra,
        new RequestContext(),
      );
      await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'reply' });
      const session = (await controller.getSessionByResource('channel:chan-1:t-stale-hook'))!;
      const respondSpy = vi.spyOn(session, 'respondToToolApproval');
      const threads = await getChannelThreads(mastra, 'chan-1:t-stale-hook');
      const memory = { thread: threads[0]!.id, resource: threads[0]!.resourceId };

      await (channels as any).dispatchApproval({
        runId: 'run-gone',
        toolCallId: 'tool-call-gone',
        requestContext: new RequestContext(),
        memory,
      });
      await (channels as any).dispatchDecline({
        runId: 'run-gone',
        toolCallId: 'tool-call-gone',
        requestContext: new RequestContext(),
        memory,
      });

      expect(stale.map(ctx => ctx.decision)).toEqual(['approve', 'decline']);
      // The action's own runId, which is what a durable host settles against.
      // The session's current run is reported separately and is not it.
      expect(stale[0]).toMatchObject({ toolCallId: 'tool-call-gone', runId: 'run-gone', memory });
      expect(stale[0].currentRunId).not.toBe('run-gone');
      expect(stale[0].session).toBe(session);
      // Core still never resumes the engine for a stale action.
      expect(respondSpy).not.toHaveBeenCalled();
    }, 30_000);

    it('does not fire when the gate matches the action', async () => {
      const stale: any[] = [];
      const { adapter, controller, mastra, channels } = await createSetup({
        model: createApprovalFlowModel(),
        tools: { deployTool: createDeployTool().tool },
        onStaleToolApproval: (ctx: any) => void stale.push(ctx),
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-live-hook');

      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-1', 'deploy'),
        mastra,
        new RequestContext(),
      );
      const session = (await controller.getSessionByResource('channel:chan-1:t-live-hook'))!;
      await waitFor(() => session.approval.isArmed(), { what: 'approval gate armed' });
      const toolCallId = session.approval.getToolCallId()!;

      await simulateAction(channels, adapter, 'chan-1:t-live-hook', `tool_approve:${toolCallId}`);
      await waitFor(() => !session.approval.isArmed(), { what: 'gate resolved' });
      expect(stale).toEqual([]);
    }, 30_000);
  });

  it('produces distinct sessions for distinct chat threads', async () => {
    const { adapter, controller, mastra, channels } = await createSetup();
    const threadA = createChatThread(adapter, 'chan-1:t-a');
    const threadB = createChatThread(adapter, 'chan-1:t-b');

    await (channels as any).processChatMessage(threadA, createMessage('m-a', 'hello a'), mastra, new RequestContext());
    await (channels as any).processChatMessage(threadB, createMessage('m-b', 'hello b'), mastra, new RequestContext());

    const sessionA = await controller.getSessionByResource('channel:chan-1:t-a');
    const sessionB = await controller.getSessionByResource('channel:chan-1:t-b');
    expect(sessionA).toBeDefined();
    expect(sessionB).toBeDefined();
    expect(sessionA).not.toBe(sessionB);
    expect(sessionA!.thread.getId()).not.toBe(sessionB!.thread.getId());
  }, 30_000);

  it('keeps channel thread metadata intact after a full message roundtrip', async () => {
    const { adapter, mastra, channels } = await createSetup();
    const chatThread = createChatThread(adapter, 'chan-1:t-meta');

    await (channels as any).processChatMessage(chatThread, createMessage('m-1', 'hello'), mastra, new RequestContext());
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

  it('stamps channel providerOptions onto the persisted user message (content.providerMetadata)', async () => {
    const agentMemory = new MockMemory();
    const { adapter, controller, mastra, channels } = await createSetup({ agentMemory });
    const chatThread = createChatThread(adapter, 'chan-1:t-po');

    await (channels as any).processChatMessage(
      chatThread,
      createMessage('m-po', 'hello metadata'),
      mastra,
      new RequestContext(),
    );
    await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'reply' });

    const session = await controller.getSessionByResource('channel:chan-1:t-po');
    const threadId = session!.thread.getId()!;
    // Signals persist through the mode agent's memory (not the controller
    // storage), and land asynchronously — poll until the user signal row shows.
    const memoryStore = await (agentMemory as any).storage.getStore('memory');
    let userMessage: any;
    await waitFor(
      () => {
        void memoryStore!.listMessages({ threadId, perPage: 50 }).then(({ messages }: any) => {
          userMessage = messages.find((m: any) => m.role === 'user' || (m.role === 'signal' && m.type === 'user'));
        });
        return userMessage !== undefined;
      },
      { what: 'persisted user message' },
    );
    // Same stamping contract as the base agent path: platform facts live under
    // `content.providerMetadata.mastra.channels.<platform>` so UI/query callers
    // can read author/channel info off the stored message.
    expect(userMessage.content.providerMetadata).toMatchObject({
      mastra: {
        channels: {
          discord: {
            messageId: 'm-po',
            author: { userId: 'user-1', userName: 'caleb', fullName: 'Caleb Barnes' },
          },
        },
      },
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
    await (channels as any).processChatMessage(
      chatThread,
      createMessage('m-1', 'hello again'),
      mastra,
      new RequestContext(),
    );

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

  describe('instance-based channel resolution', () => {
    it('attaches the controller channels onto the backing agent instance (not the request context)', async () => {
      const { agent, controller, channels } = await createSetup();

      // The controller propagates its AgentControllerChannels onto the backing
      // agent via Agent.setChannels — the instance carries the channels, with
      // no per-run channels key on the request context involved.
      expect(agent.getChannels()).toBe(channels);
      expect(agent.getChannels()).toBe(controller.getChannels());
    }, 30_000);

    it('resolves the ChatChannelOutputProcessor from the backing agent instance', async () => {
      const { agent } = await createSetup();

      // Because the channels live on the instance, the agent's own channels
      // yield the render output processor with no request context in play.
      const processors = agent.getChannels()!.getOutputProcessors([]);
      expect(processors.map(p => (p as any).id)).toContain('chat-channel-render');
    }, 30_000);
  });

  describe('approvals through sessions', () => {
    it('parks at the approval gate, posts a card, and the approve action drives the engine continuation', async () => {
      const { tool, executeSpy } = createDeployTool();
      const { adapter, controller, mastra, channels } = await createSetup({
        model: createApprovalFlowModel(),
        tools: { deployTool: tool },
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-appr');

      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-1', 'please deploy'),
        mastra,
        new RequestContext(),
      );

      const session = (await controller.getSessionByResource('channel:chan-1:t-appr'))!;
      await waitFor(() => session.approval.isArmed(), { what: 'approval gate armed' });
      // Approval card was posted to the platform while the run stays parked
      await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'approval card posted' });
      expect(executeSpy).not.toHaveBeenCalled();

      const toolCallId = session.approval.getToolCallId()!;
      await simulateAction(channels, adapter, 'chan-1:t-appr', `tool_approve:${toolCallId}`);

      // The engine (parked at the gate) drives the resume: tool executes,
      // the continuation renders back to the platform.
      await waitFor(() => executeSpy.mock.calls.length >= 1, { what: 'tool executed after approval' });
      await waitFor(() => allPostedText(adapter, chatThread).includes('Deployed successfully.'), {
        what: 'post-approval continuation rendered',
      });
      expect(session.approval.isArmed()).toBe(false);
      // Card edited to its approved state
      expect(adapter.editMessage).toHaveBeenCalled();
    }, 30_000);

    it('resolves the gate as a decline without executing the tool', async () => {
      const { tool, executeSpy } = createDeployTool();
      const { adapter, controller, mastra, channels } = await createSetup({
        model: createApprovalFlowModel({ finalText: 'Understood, not deploying.' }),
        tools: { deployTool: tool },
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-deny');

      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-1', 'please deploy'),
        mastra,
        new RequestContext(),
      );

      const session = (await controller.getSessionByResource('channel:chan-1:t-deny'))!;
      await waitFor(() => session.approval.isArmed(), { what: 'approval gate armed' });

      const toolCallId = session.approval.getToolCallId()!;
      await simulateAction(channels, adapter, 'chan-1:t-deny', `tool_deny:${toolCallId}`);

      await waitFor(() => !session.approval.isArmed(), { what: 'gate resolved as decline' });
      // The declined run continues (agent acknowledges) without running the tool
      await waitFor(() => allPostedText(adapter, chatThread).includes('Understood, not deploying.'), {
        what: 'post-decline continuation rendered',
      });
      expect(executeSpy).not.toHaveBeenCalled();
    }, 30_000);

    it('treats an approval with no matching parked gate as stale without throwing', async () => {
      const { adapter, controller, mastra, channels } = await createSetup();
      const chatThread = createChatThread(adapter, 'chan-1:t-stale');

      // Full roundtrip completes — nothing is armed afterwards
      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-1', 'hello'),
        mastra,
        new RequestContext(),
      );
      await waitFor(() => chatThread.post.mock.calls.length >= 1, { what: 'reply' });
      const session = (await controller.getSessionByResource('channel:chan-1:t-stale'))!;
      expect(session.approval.isArmed()).toBe(false);

      const threads = await getChannelThreads(mastra, 'chan-1:t-stale');
      const respondSpy = vi.spyOn(session, 'respondToToolApproval');

      // Stale approve and decline actions resolve silently: no throw, gate untouched
      await expect(
        (channels as any).dispatchApproval({
          runId: 'run-gone',
          toolCallId: 'no-such-tool-call',
          requestContext: new RequestContext(),
          memory: { thread: threads[0]!.id, resource: threads[0]!.resourceId },
        }),
      ).resolves.toBeUndefined();
      await expect(
        (channels as any).dispatchDecline({
          runId: 'run-gone',
          toolCallId: 'no-such-tool-call',
          requestContext: new RequestContext(),
          memory: { thread: threads[0]!.id, resource: threads[0]!.resourceId },
        }),
      ).resolves.toBeUndefined();
      expect(respondSpy).not.toHaveBeenCalled();
    }, 30_000);

    it('auto-declines a pending approval when a new message arrives (session semantics)', async () => {
      const { tool, executeSpy } = createDeployTool();
      const { adapter, controller, mastra, channels } = await createSetup({
        model: createApprovalFlowModel({ finalText: 'Okay, moving on.' }),
        tools: { deployTool: tool },
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-interrupt');

      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-1', 'please deploy'),
        mastra,
        new RequestContext(),
      );

      const session = (await controller.getSessionByResource('channel:chan-1:t-interrupt'))!;
      await waitFor(() => session.approval.isArmed(), { what: 'approval gate armed' });

      // New inbound message while the approval is pending
      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-2', 'actually, never mind'),
        mastra,
        new RequestContext(),
      );

      await waitFor(() => !session.approval.isArmed(), { what: 'pending approval auto-declined' });
      await waitFor(() => allPostedText(adapter, chatThread).includes('Okay, moving on.'), {
        what: 'response after interrupt',
      });
      expect(executeSpy).not.toHaveBeenCalled();
    }, 30_000);

    it('auto-executes tools on buttonless adapters without touching session state', async () => {
      const { tool, executeSpy } = createDeployTool();
      const { adapter, controller, mastra, channels } = await createSetup({
        model: createApprovalFlowModel({ finalText: 'Deployed without asking.' }),
        tools: { deployTool: tool },
        toolDisplay: 'text',
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-yolo');

      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-1', 'please deploy'),
        mastra,
        new RequestContext(),
      );

      // The run never parks: the tool executes and the final text renders
      await waitFor(() => executeSpy.mock.calls.length >= 1, { what: 'tool auto-executed' });
      await waitFor(() => allPostedText(adapter, chatThread).includes('Deployed without asking.'), {
        what: 'final text rendered',
      });

      const session = (await controller.getSessionByResource('channel:chan-1:t-yolo'))!;
      // The auto-approve marker lives on the channels instance, not in
      // user-owned session state (which is schema-validated).
      expect((session.state.get() as Record<string, unknown>).yolo).toBeUndefined();
      expect(channels.__isAutoApproveResource('channel:chan-1:t-yolo')).toBe(true);
      expect(session.approval.isArmed()).toBe(false);
    }, 30_000);

    it('auto-executes tools on buttonless adapters when the controller has a strict stateSchema', async () => {
      // Regression: the flag must not route through schema-validated session
      // state — a strict schema would reject an injected key (failing every
      // inbound message) and a non-strict one would silently strip it
      // (parking the run forever at an approval nobody can answer).
      const { tool, executeSpy } = createDeployTool();
      const { adapter, mastra, channels } = await createSetup({
        model: createApprovalFlowModel({ finalText: 'Deployed with schema.' }),
        tools: { deployTool: tool },
        toolDisplay: 'text',
        stateSchema: z.strictObject({ counter: z.number().default(0) }),
      });
      const chatThread = createChatThread(adapter, 'chan-1:t-schema');

      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-1', 'please deploy'),
        mastra,
        new RequestContext(),
      );

      await waitFor(() => executeSpy.mock.calls.length >= 1, { what: 'tool auto-executed (strict schema)' });
      await waitFor(() => allPostedText(adapter, chatThread).includes('Deployed with schema.'), {
        what: 'final text rendered (strict schema)',
      });
    }, 30_000);
  });

  describe('resolving Mastra from the bound controller', () => {
    it('builds an outbound render context for a channel-backed thread', async () => {
      // `AgentControllerChannels.__setAgent` is a deliberate no-op, so the base
      // class's agent-based Mastra lookup resolves to undefined here. The
      // controller-based override is what keeps the outbound path working:
      // without it this returns null and the output processor silently stops
      // rendering into the channel.
      const { adapter, mastra, channels } = await createSetup({});
      const chatThread = createChatThread(adapter, 'discord:t-render');

      await (channels as any).processChatMessage(
        chatThread,
        createMessage('m-1', 'hello'),
        mastra,
        new RequestContext(),
      );

      const memoryStore = await mastra.getStorage()!.getStore('memory');
      const { threads } = await memoryStore!.listThreads({
        filter: { metadata: { channel_externalThreadId: 'discord:t-render' } },
        perPage: 1,
      });
      const mapped = threads[0];
      expect(mapped, 'inbound dispatch mapped the chat thread to a Mastra thread').toBeDefined();

      const renderContext = await channels.buildRenderContextForThread(mapped!.id);
      expect(renderContext).not.toBeNull();
    }, 30_000);
  });
});
