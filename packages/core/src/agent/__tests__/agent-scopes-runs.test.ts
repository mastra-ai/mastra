import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_SCOPES_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function textModel(text = 'ok') {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage,
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage },
      ]),
    }),
  });
}

/** First call asks for `toolName`, later calls answer with text. */
function toolCallingModel(toolName: string, input: Record<string, unknown> = {}) {
  let calls = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      calls++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        usage,
        finishReason: calls === 1 ? 'tool-calls' : 'stop',
        content:
          calls === 1
            ? [{ type: 'tool-call', toolCallId: `call-${calls}`, toolName, input: JSON.stringify(input) }]
            : [{ type: 'text', text: 'done' }],
      } as any;
    },
    doStream: async () => {
      calls++;
      const parts =
        calls === 1
          ? [
              { type: 'tool-call', toolCallId: `call-${calls}`, toolName, input: JSON.stringify(input) },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'done' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
      };
    },
  });
}

/** Records the `mastra__scopes` each processor call sees. */
function scopeRecorder() {
  const seen: unknown[] = [];
  const processor: Processor = {
    id: 'scope-recorder',
    processInput: async ({ messages, requestContext }) => {
      seen.push(requestContext?.get(MASTRA_SCOPES_KEY));
      return messages;
    },
  };
  return { seen, processor };
}

function setup(config: Partial<ConstructorParameters<typeof Agent>[0]> = {}) {
  const memory = new MockMemory({ storage: new InMemoryStore() });
  const recorder = scopeRecorder();
  const agent = new Agent({
    id: 'scoped-agent',
    name: 'Scoped Agent',
    instructions: 'Test',
    model: textModel(),
    memory,
    inputProcessors: [recorder.processor],
    ...config,
  } as ConstructorParameters<typeof Agent>[0]);
  return { agent, memory, seen: recorder.seen };
}

async function threadMessages(memory: MockMemory, threadId: string, resourceId: string) {
  const thread = await memory.getThreadById({ threadId });
  const { messages } = await memory.recall({ threadId, resourceId });
  return { thread, messages };
}

async function conflictOf(promise: Promise<unknown> | (() => unknown)) {
  try {
    await (typeof promise === 'function' ? promise() : promise);
  } catch (error: any) {
    return { id: error.id, status: error.details?.status };
  }
  throw new Error('expected a scopes conflict');
}

describe('agent scopes on runs', () => {
  it('stream with only identity scopes saves and recalls on that thread and resource', async () => {
    const { agent, memory } = setup();
    const first = await agent.stream('first turn', { scopes: ['resource:u1', 'thread:t1'] });
    await first.consumeStream();
    const second = await agent.stream('second turn', { scopes: ['resource:u1', 'thread:t1'] });
    await second.consumeStream();

    const { thread, messages } = await threadMessages(memory, 't1', 'u1');
    expect(thread?.resourceId).toBe('u1');
    const texts = messages.map(m => JSON.stringify(m.content));
    expect(texts.some(t => t.includes('first turn'))).toBe(true);
    expect(texts.some(t => t.includes('second turn'))).toBe(true);
  });

  it('generate with scopes matches memory options and passes only non-identity scopes downstream', async () => {
    const { agent, memory, seen } = setup();
    const requestContext = new RequestContext();
    await agent.generate('hello', { scopes: ['org:acme', 'resource:u1', 'thread:t1'], requestContext });

    const { messages } = await threadMessages(memory, 't1', 'u1');
    expect(messages.length).toBeGreaterThan(0);
    expect(seen).toEqual([['org:acme']]);
    // The caller's context is never rewritten.
    expect(requestContext.has(MASTRA_SCOPES_KEY)).toBe(false);
  });

  it('reserved mastra__scopes alone drives memory and survives reuse of the same context', async () => {
    const { agent, memory, seen } = setup();
    const requestContext = new RequestContext([[MASTRA_SCOPES_KEY, ['org:acme', 'resource:u1', 'thread:t1']]]);
    await agent.generate('one', { requestContext });
    await agent.generate('two', { requestContext });

    const { messages } = await threadMessages(memory, 't1', 'u1');
    const texts = messages.map(m => JSON.stringify(m.content));
    expect(texts.some(t => t.includes('one'))).toBe(true);
    expect(texts.some(t => t.includes('two'))).toBe(true);
    expect(seen).toEqual([['org:acme'], ['org:acme']]);
    expect(requestContext.get(MASTRA_SCOPES_KEY)).toEqual(['org:acme', 'resource:u1', 'thread:t1']);
  });

  it('unions the Agent resolver, defaultOptions and per-call scopes', async () => {
    const { agent, memory, seen } = setup({
      scopes: ({ requestContext }: { requestContext: RequestContext }) => [`org:${requestContext.get('tenant')}`],
      defaultOptions: { scopes: ['team:core'] },
    });
    const requestContext = new RequestContext([['tenant', 'acme']]);
    await agent.generate('hello', { requestContext, scopes: ['resource:u1', 'thread:t1'] });

    expect(seen).toEqual([['org:acme', 'team:core']]);
    expect((await threadMessages(memory, 't1', 'u1')).messages.length).toBeGreaterThan(0);
    await expect(agent.getScopes({ requestContext })).resolves.toEqual(['org:acme']);
  });

  it('resolves resource and thread independently', async () => {
    const { agent, memory } = setup();
    await agent.generate('hello', { scopes: ['resource:u1'], memory: { thread: 't-from-memory' } });
    const thread = await memory.getThreadById({ threadId: 't-from-memory' });
    expect(thread?.resourceId).toBe('u1');
  });

  it('throws a 400 conflict on stream and generate when scopes and memory disagree', async () => {
    const { agent } = setup();
    const options = { scopes: ['thread:a'], memory: { thread: 'b', resource: 'u1' } };
    await expect(conflictOf(agent.generate('x', options))).resolves.toEqual({
      id: 'AGENT_SCOPES_CONFLICT',
      status: 400,
    });
    await expect(conflictOf(agent.stream('x', options))).resolves.toEqual({
      id: 'AGENT_SCOPES_CONFLICT',
      status: 400,
    });
  });

  it('throws when the reserved ID key disagrees with scopes, and when the resolver and call disagree', async () => {
    const { agent } = setup({ scopes: ['resource:from-config'] });
    await expect(conflictOf(agent.generate('x', { scopes: ['resource:from-call'] }))).resolves.toMatchObject({
      id: 'AGENT_SCOPES_CONFLICT',
    });

    const plain = setup().agent;
    const requestContext = new RequestContext([[MASTRA_THREAD_ID_KEY, 'middleware-thread']]);
    await expect(conflictOf(plain.generate('x', { requestContext, scopes: ['thread:other'] }))).resolves.toMatchObject({
      id: 'AGENT_SCOPES_CONFLICT',
    });
  });

  it('does not throw when every source agrees', async () => {
    const { agent, memory } = setup();
    const requestContext = new RequestContext([
      [MASTRA_RESOURCE_ID_KEY, 'u1'],
      [MASTRA_THREAD_ID_KEY, 't1'],
    ]);
    await agent.generate('x', {
      requestContext,
      scopes: ['resource:u1', 'thread:t1'],
      memory: { resource: 'u1', thread: 't1' },
    });
    expect((await threadMessages(memory, 't1', 'u1')).messages.length).toBeGreaterThan(0);
  });

  it('keeps reserved ID key precedence over memory options when no scopes are present', async () => {
    const { agent, memory, seen } = setup();
    const requestContext = new RequestContext([
      [MASTRA_RESOURCE_ID_KEY, 'middleware-user'],
      [MASTRA_THREAD_ID_KEY, 'middleware-thread'],
    ]);
    await agent.generate('x', { requestContext, memory: { resource: 'body-user', thread: 'body-thread' } });
    expect(await memory.getThreadById({ threadId: 'body-thread' })).toBeNull();
    expect((await memory.getThreadById({ threadId: 'middleware-thread' }))?.resourceId).toBe('middleware-user');
    expect(seen).toEqual([undefined]);
  });

  it('lets a tool reuse the run context to call another agent on a different thread', async () => {
    const otherMemory = new MockMemory({ storage: new InMemoryStore() });
    const other = new Agent({
      id: 'other',
      name: 'Other',
      instructions: 'Test',
      model: textModel(),
      memory: otherMemory,
    });
    const callOther = createTool({
      id: 'callOther',
      description: 'calls another agent',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        // Observational Memory's internal agents clone the context and rewrite the thread key.
        const cloned = new RequestContext(Array.from(context.requestContext!.entries()));
        cloned.set(MASTRA_THREAD_ID_KEY, 'other-thread');
        await other.generate('nested', { requestContext: cloned, memory: { thread: 'other-thread', resource: 'u1' } });
        await other.generate('nested-same-context', {
          requestContext: context.requestContext,
          memory: { thread: 'second-thread', resource: 'u1' },
        });
        return { ok: true };
      },
    });
    const { agent } = setup({ model: toolCallingModel('callOther'), tools: { callOther } });
    const stream = await agent.stream('go', { scopes: ['org:acme', 'resource:u1', 'thread:t1'] });
    await stream.consumeStream();

    expect(await otherMemory.getThreadById({ threadId: 'other-thread' })).not.toBeNull();
    expect(await otherMemory.getThreadById({ threadId: 'second-thread' })).not.toBeNull();
  });

  it('gives delegated sub-agents only the non-identity scopes', async () => {
    const child = scopeRecorder();
    const subAgent = new Agent({
      id: 'child',
      name: 'Child',
      description: 'child agent',
      instructions: 'Test',
      model: textModel('child answer'),
      inputProcessors: [child.processor],
    });
    const { agent } = setup({
      model: toolCallingModel('agent-child', { prompt: 'help' }),
      agents: { child: subAgent },
    });
    const stream = await agent.stream('go', { scopes: ['org:acme', 'resource:u1', 'thread:t1'] });
    await stream.consumeStream();
    expect(child.seen).toEqual([['org:acme']]);
  });

  it('streamUntilIdle resolves the thread from scopes', async () => {
    const { agent, memory } = setup();
    const stream = await agent.streamUntilIdle('idle turn', { scopes: ['resource:u1', 'thread:t1'] });
    await stream.consumeStream();
    expect((await threadMessages(memory, 't1', 'u1')).messages.length).toBeGreaterThan(0);
  });

  it('restores the suspended run scopes on approval resume and accepts a subset from middleware', async () => {
    const recorder = scopeRecorder();
    const approve = createTool({
      id: 'approve',
      description: 'needs approval',
      inputSchema: z.object({}),
      requireApproval: true,
      execute: async (_input, context) => ({ scopes: context.requestContext?.get(MASTRA_SCOPES_KEY) }),
    });
    const toolSeen: unknown[] = [];
    const memory = new MockMemory({ storage: new InMemoryStore() });
    const agent = new Agent({
      id: 'approval-agent',
      name: 'Approval Agent',
      instructions: 'Test',
      model: toolCallingModel('approve'),
      memory,
      tools: { approve },
      inputProcessors: [recorder.processor],
    });
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });
    const stream = await agent.stream('go', { scopes: ['org:a', 'resource:u1', 'thread:t1', 'team:core'] });
    let toolCallId: string | undefined;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
    }
    expect(toolCallId).toBeDefined();

    const middleware = new RequestContext([[MASTRA_SCOPES_KEY, ['org:a']]]);
    const resumed = await agent.approveToolCall({
      runId: stream.runId,
      toolCallId: toolCallId!,
      requestContext: middleware,
    });
    for await (const chunk of resumed.fullStream) {
      if (chunk.type === 'tool-result') toolSeen.push((chunk.payload.result as any).scopes);
    }
    expect(toolSeen).toEqual([['org:a', 'team:core']]);
    expect((await threadMessages(memory, 't1', 'u1')).messages.length).toBeGreaterThan(0);
  });

  it('rejects a resume that adds a scope the suspended run did not hold', async () => {
    const approve = createTool({
      id: 'approve',
      description: 'needs approval',
      inputSchema: z.object({}),
      requireApproval: true,
      execute: async () => ({ ok: true }),
    });
    const { agent } = setup({ model: toolCallingModel('approve'), tools: { approve } });
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });
    const stream = await agent.stream('go', { scopes: ['org:a', 'resource:u1', 'thread:t1'] });
    let toolCallId: string | undefined;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
    }
    const requestContext = new RequestContext([[MASTRA_SCOPES_KEY, ['org:b']]]);
    await expect(
      conflictOf(agent.approveToolCall({ runId: stream.runId, toolCallId: toolCallId!, requestContext })),
    ).resolves.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });
  });

  it('rejects a resume that adds scopes to a run that started without any', async () => {
    const approve = createTool({
      id: 'approve',
      description: 'needs approval',
      inputSchema: z.object({}),
      requireApproval: true,
      execute: async () => ({ ok: true }),
    });
    const { agent } = setup({ model: toolCallingModel('approve'), tools: { approve } });
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });
    const stream = await agent.stream('go', { memory: { resource: 'u1', thread: 't1' } });
    let toolCallId: string | undefined;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
    }
    await expect(
      conflictOf(
        agent.approveToolCall({
          runId: stream.runId,
          toolCallId: toolCallId!,
          requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['org:x']]]),
        }),
      ),
    ).resolves.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });

    // Naming the run's own resource and thread is not a new scope.
    const resumed = await agent.approveToolCall({
      runId: stream.runId,
      toolCallId: toolCallId!,
      requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['resource:u1', 'thread:t1']]]),
    });
    await resumed.consumeStream();
  });

  it('restores the suspended run scopes on generate approval resume', async () => {
    const approve = createTool({
      id: 'approve',
      description: 'needs approval',
      inputSchema: z.object({}),
      requireApproval: true,
      execute: async (_input, context) => ({ scopes: context.requestContext?.get(MASTRA_SCOPES_KEY) }),
    });
    const { agent } = setup({ model: toolCallingModel('approve'), tools: { approve } });
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });
    const first = await agent.generate('go', { scopes: ['org:a', 'resource:u1', 'thread:t1', 'team:core'] });
    const toolCallId = (first.suspendPayload as any)?.toolCallId;
    expect(toolCallId).toBeDefined();
    await expect(
      conflictOf(
        agent.approveToolCallGenerate({
          runId: first.runId!,
          toolCallId,
          requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['org:b']]]),
        }),
      ),
    ).resolves.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });
    const resumed = await agent.approveToolCallGenerate({
      runId: first.runId!,
      toolCallId,
      requestContext: new RequestContext([[MASTRA_SCOPES_KEY, ['org:a']]]),
    });
    const result = resumed.toolResults.find(r => r.payload.toolName === 'approve')?.payload.result as any;
    expect(result?.scopes).toEqual(['org:a', 'team:core']);
  });
});

describe('agent scopes on thread entry points', () => {
  it('sendSignal wakes an idle thread with the scopes and memory identity', async () => {
    const { agent, memory, seen } = setup({ pubsub: new EventEmitterPubSub() });
    const result = agent.sendSignal(
      { type: 'user-message', contents: 'wake up' },
      {
        resourceId: 'u1',
        threadId: 't1',
        scopes: ['org:acme', 'resource:u1', 'thread:t1'],
        ifIdle: { streamOptions: {} },
      },
    );
    const accepted = await result.accepted;
    if (accepted.action !== 'wake') throw new Error(`expected wake, got ${accepted.action}`);
    await accepted.output.consumeStream();
    expect(seen).toEqual([['org:acme']]);
    expect((await threadMessages(memory, 't1', 'u1')).messages.length).toBeGreaterThan(0);
  });

  it('sendMessage and queueMessage start runs with the scopes', async () => {
    const { agent, memory, seen } = setup({ pubsub: new EventEmitterPubSub() });
    const sent = await agent.sendMessage('sent', {
      resourceId: 'u1',
      threadId: 't1',
      scopes: ['org:acme'],
      ifIdle: { streamOptions: {} },
    }).accepted;
    if (sent.action !== 'wake') throw new Error(`expected wake, got ${sent.action}`);
    await sent.output.consumeStream();

    const subscription = await agent.subscribeToThread({ resourceId: 'u2', threadId: 't2' });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    await agent.queueMessage('queued', { resourceId: 'u2', threadId: 't2', scopes: ['org:beta', 'thread:t2'] })
      .accepted;
    const queuedRun = await iterator.next();
    await (queuedRun.value as any).consumeStream?.();
    for (let i = 0; i < 50 && seen.length < 2; i++) await new Promise(resolve => setTimeout(resolve, 10));
    subscription.unsubscribe();

    expect(seen).toEqual([['org:acme'], ['org:beta']]);
    expect((await threadMessages(memory, 't1', 'u1')).messages.length).toBeGreaterThan(0);
    for (let i = 0; i < 50; i++) {
      if ((await threadMessages(memory, 't2', 'u2')).messages.length) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect((await threadMessages(memory, 't2', 'u2')).messages.length).toBeGreaterThan(0);
  });

  it('throws when identity scopes disagree with the target ids', async () => {
    const { agent } = setup();
    await expect(
      conflictOf(() =>
        agent.sendSignal(
          { type: 'user-message', contents: 'x' },
          { resourceId: 'u1', threadId: 't1', scopes: ['thread:t2'] },
        ),
      ),
    ).resolves.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });
    await expect(
      conflictOf(() => agent.sendMessage('x', { resourceId: 'u1', threadId: 't1', scopes: ['resource:u2'] })),
    ).resolves.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });
    await expect(
      conflictOf(() => agent.queueMessage('x', { resourceId: 'u1', threadId: 't1', scopes: ['thread:t2'] })),
    ).resolves.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });
    await expect(
      conflictOf(() =>
        agent.sendSignal(
          { type: 'user-message', contents: 'x' },
          { resourceId: 'u1', threadId: 't1', ifIdle: { streamOptions: { scopes: ['thread:t9'] } } },
        ),
      ),
    ).resolves.toMatchObject({ id: 'AGENT_SCOPES_CONFLICT' });
  });
});
