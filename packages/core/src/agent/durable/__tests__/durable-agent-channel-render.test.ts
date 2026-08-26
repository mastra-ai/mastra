/**
 * DurableAgent channel rendering
 *
 * `ChatChannelOutputProcessor` resolves its render target two ways: the render context an inbound
 * platform event stashes on `requestContext`, and — for a run no platform event started (a schedule
 * fire, a signal wake, Studio) — a rebuild from the run's thread, which reads the thread id off the
 * `MastraMemory` entry of that same `requestContext`.
 *
 * A durable run reaches its output processors with no request context at all, so neither route
 * resolves and the run answers into memory without posting anything to the platform.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

const PLATFORM = 'demo';
const THREAD_ID = 'channel-backed-thread';
const RESOURCE_ID = 'channel-user';
/** Chat SDK thread ids are `<adapter>:<platform id>`; `chat.thread()` routes on that prefix. */
const EXTERNAL_THREAD_ID = `${PLATFORM}:C0001:1700000000.000100`;

/** Creates a minimal channel adapter and exposes its post spy for assertions. */
function createMockAdapter() {
  const postMessage = vi.fn(async () => ({ id: 'msg-1', text: '' }));
  const adapter = {
    name: PLATFORM,
    postMessage,
    editMessage: async () => ({ id: 'msg-1', text: '' }),
    deleteMessage: async () => {},
    addReaction: async () => {},
    removeReaction: async () => {},
    handleWebhook: async () => new Response('ok'),
    initialize: async () => {},
    fetchMessages: async () => [],
    encodeThreadId: (...parts: string[]) => parts.join(':'),
    decodeThreadId: (id: string) => id.split(':'),
    channelIdFromThreadId: (id: string) => id.split(':').slice(0, 2).join(':'),
    renderFormatted: (t: string) => t,
    fetchThread: async () => null,
    startTyping: async () => {},
    parseMessage: (raw: unknown) => raw,
    userName: 'Bot',
  } as any;
  return { adapter, postMessage };
}

/** Creates a deterministic streaming model that emits a single text response. */
function replyingModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 't-1' },
        { type: 'text-delta', id: 't-1', delta: 'Hello from the run' },
        { type: 'text-end', id: 't-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

/** A thread as the channel edge leaves it: the platform and external id are what the rebuild reads. */
async function seedChannelThread(storage: InMemoryStore) {
  const memoryStore = await storage.getStore('memory');
  await memoryStore!.saveThread({
    thread: {
      id: THREAD_ID,
      resourceId: RESOURCE_ID,
      title: 'a channel conversation',
      metadata: {
        channel_platform: PLATFORM,
        channel_externalThreadId: EXTERNAL_THREAD_ID,
        channel_externalChannelId: 'C0001',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/** Waits for asynchronous channel initialization before exercising the agent. */
async function untilChatReady(agent: Agent) {
  const channels = agent.getChannels() as unknown as { chat?: unknown } | null;
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && !channels?.chat) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

/** Builds a plain and durable agent pair backed by a seeded channel thread. */
async function channelBackedAgent(id: string, outputProcessors?: any[]) {
  const { adapter, postMessage } = createMockAdapter();
  const storage = new InMemoryStore();
  const agent = new Agent({
    id,
    name: id,
    instructions: 'Answer briefly.',
    model: replyingModel() as any,
    memory: new MockMemory(),
    outputProcessors,
    channels: { adapters: { [PLATFORM]: { adapter, streaming: false } } },
  });
  const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
  new Mastra({ agents: { [id]: durableAgent }, storage, logger: false });

  await untilChatReady(agent);
  await seedChannelThread(storage);
  return { agent, durableAgent, postMessage };
}

/**
 * A run that suspends on a tool, so it can be resumed by a different process. The model answers once the
 * tool result is in the conversation, which is what a rebuilt instance replays after the restart.
 */
function suspendingSetup(id: string, executions: { count: number }) {
  const suspendingTool = createTool({
    id: 'waitForAPerson',
    description: 'Waits for something only a person can give.',
    inputSchema: z.object({ query: z.string() }),
    suspendSchema: z.object({ message: z.string() }),
    resumeSchema: z.object({ answer: z.string() }),
    execute: async (input: { query: string }, context: any) => {
      if (!context?.agent?.resumeData) {
        return await context?.agent?.suspend({ message: `Need an answer for: ${input.query}` });
      }
      executions.count++;
      return { result: 'tool-result-payload', answer: context.agent.resumeData.answer };
    },
  });

  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasToolResult = JSON.stringify(prompt).includes('tool-result-payload');
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>(
          hasToolResult
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'r-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 't-1' },
                { type: 'text-delta', id: 't-1', delta: 'Answered after the restart' },
                { type: 'text-end', id: 't-1' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'r-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'waitForAPerson',
                  input: '{"query":"the thing"}',
                  providerExecuted: false,
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ],
        ),
      };
    },
  });

  return { suspendingTool, model, id };
}

/** Consumes a result stream so output processors and channel rendering complete. */
async function drain(result: { fullStream: AsyncIterable<unknown> }) {
  for await (const _chunk of result.fullStream) {
    void _chunk;
  }
}

describe('a run on a channel-backed thread posts its answer to the channel', () => {
  it('posts from a plain agent run', async () => {
    const { agent, postMessage } = await channelBackedAgent('channel-render-plain');

    await drain(await agent.stream('hi', { memory: { thread: THREAD_ID, resource: RESOURCE_ID } }));

    expect(postMessage).toHaveBeenCalled();
  });

  it('posts from a durable agent run', async () => {
    const { durableAgent, postMessage } = await channelBackedAgent('channel-render-durable');

    await drain(await durableAgent.stream('hi', { memory: { thread: THREAD_ID, resource: RESOURCE_ID } }));

    expect(postMessage).toHaveBeenCalled();
  });

  it("passes the caller's request context to durable output processors", async () => {
    const seenTenantIds: unknown[] = [];
    const outputProcessor = {
      id: 'capture-request-context',
      processOutputStream: async ({ part, requestContext }: any) => {
        seenTenantIds.push(requestContext?.get('tenantId'));
        return part;
      },
    };
    const { durableAgent } = await channelBackedAgent('channel-render-request-context', [outputProcessor]);
    const requestContext = new RequestContext([['tenantId', 'tenant-1']]);

    await drain(
      await durableAgent.stream('hi', {
        memory: { thread: THREAD_ID, resource: RESOURCE_ID },
        requestContext,
      }),
    );

    expect(seenTenantIds).toContain('tenant-1');
  });

  /**
   * `observe()` replays a run's chunks to a second reader through the same output processors. Its stream
   * is deliberately built without the run's request context: with one, the channel renderer resolves the
   * same platform thread and posts the whole reply again, so opening a web view of a live run would send
   * a duplicate message to the channel.
   */
  it('does not post again when a second reader observes the run', async () => {
    const { durableAgent, postMessage } = await channelBackedAgent('channel-render-observed');

    const result = await durableAgent.stream('hi', { memory: { thread: THREAD_ID, resource: RESOURCE_ID } });
    const runId = (result as unknown as { runId: string }).runId;
    await drain(result);
    const postsFromTheRun = postMessage.mock.calls.length;
    expect(postsFromTheRun).toBeGreaterThan(0);

    const observed = await durableAgent.observe(runId);
    await drain(observed.output);

    expect(postMessage.mock.calls.length).toBe(postsFromTheRun);
  });

  it('keeps durable memory context when a warm resume supplies caller context', async () => {
    const storage = new InMemoryStore();
    const executions = { count: 0 };
    const memory = { thread: THREAD_ID, resource: RESOURCE_ID };
    const seenContexts: Array<{ tenantId: unknown; threadId: unknown; resourceId: unknown }> = [];
    const { suspendingTool, model } = suspendingSetup('channel-render-warm-resume', executions);
    const { adapter } = createMockAdapter();
    const processMemory = new MockMemory();
    const outputProcessor = {
      id: 'capture-warm-resume-context',
      processOutputStream: async ({ part, requestContext }: any) => {
        const memoryContext = requestContext?.get('MastraMemory');
        seenContexts.push({
          tenantId: requestContext?.get('tenantId'),
          threadId: memoryContext?.thread?.id,
          resourceId: memoryContext?.resourceId,
        });
        return part;
      },
    };
    const agent = new Agent({
      id: 'channel-render-warm-resume',
      name: 'channel-render-warm-resume',
      instructions: 'Use your tool, then answer.',
      model: model as any,
      memory: processMemory,
      tools: { waitForAPerson: suspendingTool },
      outputProcessors: [outputProcessor],
      channels: { adapters: { [PLATFORM]: { adapter, streaming: false } } },
    });
    const durableAgent = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
    new Mastra({ agents: { warmResumeAgent: durableAgent }, storage, logger: false });
    await untilChatReady(agent);
    await seedChannelThread(storage);

    const started = await durableAgent.stream('do the thing', {
      memory,
      maxSteps: 5,
      requestContext: new RequestContext([['tenantId', 'initial-tenant']]),
    });
    for await (const chunk of started.fullStream) {
      if ((chunk as { type: string }).type === 'tool-call-suspended') break;
    }
    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const persisted = await workflows.getWorkflowRunById({
        runId: started.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(snapshot?.status).toBe('suspended');
    });
    const suspension = await vi.waitFor(async () => {
      const { messages } = await processMemory.recall({ threadId: memory.thread, resourceId: memory.resource });
      const withSuspension = [...messages]
        .reverse()
        .find((message: any) => message.role === 'assistant' && message.content?.metadata?.suspendedTools);
      const suspensions = withSuspension?.content?.metadata?.suspendedTools as Record<string, any> | undefined;
      expect(suspensions).toBeDefined();
      return Object.values(suspensions!)[0] as Record<string, any>;
    });

    seenContexts.length = 0;
    const callerContext = new RequestContext([
      ['tenantId', 'resume-tenant'],
      ['MastraMemory', { thread: { id: 'parent-thread' }, resourceId: 'parent-resource' }],
    ]);
    const resumed = await durableAgent.resumeStream(
      { answer: 'the missing detail' },
      {
        runId: suspension.runId,
        toolCallId: suspension.toolCallId,
        memory,
        requestContext: callerContext,
      },
    );
    await drain(resumed);

    expect(executions.count).toBe(1);
    expect(seenContexts).toContainEqual({
      tenantId: 'resume-tenant',
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
    });
    expect(seenContexts).not.toContainEqual({
      tenantId: 'resume-tenant',
      threadId: 'parent-thread',
      resourceId: 'parent-resource',
    });
  }, 30000);

  /**
   * The restart case. A run suspended on a tool is resumed by a process that never saw it: fresh agent,
   * fresh channel adapter, fresh pubsub, empty run registry, same storage. Everything the render needs has
   * to come off persisted state, because the in-process request context died with the old process.
   */
  it('posts from a run resumed on a fresh process over the same storage', async () => {
    const storage = new InMemoryStore();
    const memoryStorage = new InMemoryStore();
    const executions = { count: 0 };
    const memory = { thread: THREAD_ID, resource: RESOURCE_ID };
    const requestContext = new RequestContext([['tenantId', 'tenant-1']]);

    const build = (channelAdapter: unknown, seenTenantIds: unknown[]) => {
      const { suspendingTool, model } = suspendingSetup('channel-render-restart', executions);
      const processMemory = new MockMemory({ storage: memoryStorage });
      const outputProcessor = {
        id: 'capture-request-context',
        processOutputStream: async ({ part, requestContext: processorContext }: any) => {
          seenTenantIds.push(processorContext?.get('tenantId'));
          return part;
        },
      };
      const agent = new Agent({
        id: 'channel-render-restart',
        name: 'channel-render-restart',
        instructions: 'Use your tool, then answer.',
        model: model as any,
        memory: processMemory,
        tools: { waitForAPerson: suspendingTool },
        outputProcessors: [outputProcessor],
        channels: { adapters: { [PLATFORM]: { adapter: channelAdapter as any, streaming: false } } },
      });
      return { agent, memory: processMemory };
    };

    // ---- Process 1: run until the tool suspends. ----
    let pubsub = new EventEmitterPubSub();
    const first = createMockAdapter();
    const firstTenantIds: unknown[] = [];
    const firstProcess = build(first.adapter, firstTenantIds);
    const firstAgent = firstProcess.agent;
    const firstDurable = createDurableAgent({ agent: firstAgent, pubsub });
    new Mastra({ agents: { restartAgent: firstDurable }, storage, logger: false });
    await untilChatReady(firstAgent);
    await seedChannelThread(storage);

    const started = await firstDurable.stream('do the thing', { memory, maxSteps: 5, requestContext });
    const runId = (started as unknown as { runId: string }).runId;
    for await (const chunk of started.fullStream) {
      if ((chunk as { type: string }).type === 'tool-call-suspended') break;
    }
    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const persisted = await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
      const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(snapshot?.status).toBe('suspended');
    });

    const suspension = await vi.waitFor(async () => {
      const { messages } = await firstProcess.memory.recall({ threadId: memory.thread, resourceId: memory.resource });
      const withSuspension = [...messages]
        .reverse()
        .find((m: any) => m.role === 'assistant' && (m.content as any)?.metadata?.suspendedTools);
      const suspensions = (withSuspension as any)?.content?.metadata?.suspendedTools as Record<string, any>;
      expect(suspensions).toBeDefined();
      return Object.values(suspensions)[0] as Record<string, any>;
    });

    // ---- The restart: nothing of process 1 survives but its storage. ----
    globalRunRegistry.clear();
    await pubsub.close();
    pubsub = new EventEmitterPubSub();

    const second = createMockAdapter();
    const secondTenantIds: unknown[] = [];
    const secondProcess = build(second.adapter, secondTenantIds);
    const secondAgent = secondProcess.agent;
    const secondDurable = createDurableAgent({ agent: secondAgent, pubsub });
    new Mastra({ agents: { restartAgent: secondDurable }, storage, logger: false });
    await untilChatReady(secondAgent);

    const resumed = await secondDurable.resumeStream(
      { answer: 'the missing detail' },
      { runId: suspension.runId, toolCallId: suspension.toolCallId, memory },
    );
    await drain(resumed);

    expect(executions.count).toBe(1);
    expect(secondProcess.memory).not.toBe(firstProcess.memory);
    expect(secondTenantIds).toContain('tenant-1');
    expect(second.postMessage, 'the resumed run posted to the channel').toHaveBeenCalled();
  }, 30000);
});
