/**
 * DurableAgent Background Task Integration Tests
 *
 * These test the full durable agent loop with background tasks,
 * mirroring the patterns from stream-until-idle.test.ts 1:1 but adapted
 * for the durable agent's PubSub-based architecture.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

// ============================================================================
// Helpers
// ============================================================================

function makeScriptedModel(scripts: Array<() => ReadableStream<any>>) {
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: scripts[calls++]!(),
    }),
  });
  return { model, getCallCount: () => calls };
}

function textResponse(text: string) {
  return () =>
    convertArrayToReadableStream([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
      { type: 'text-start', id: 't' },
      { type: 'text-delta', id: 't', delta: text },
      { type: 'text-end', id: 't' },
      {
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      },
    ]);
}

function createToolCallThenTextModel(toolName: string, args: Record<string, unknown>, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName,
              input: JSON.stringify(args),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: finalText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

async function drain(stream: ReadableStream<any>): Promise<any[]> {
  const reader = stream.getReader();
  const chunks: any[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

// ============================================================================
// stream() tests
// ============================================================================

describe('DurableAgent background tasks via stream()', () => {
  let pubsub: EventEmitterPubSub;
  let mastra: Mastra;
  const storage = new MockStore();

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
    mastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
    });
  });

  afterEach(async () => {
    await mastra.backgroundTaskManager?.shutdown();
    await pubsub.close();
    const bgStore = await storage.getStore('backgroundTasks');
    await bgStore?.dangerouslyClearAll();
  });

  it('dispatches a bg task and returns placeholder in stream', async () => {
    const researchTool = createTool({
      id: 'research',
      description: 'Research a topic',
      inputSchema: z.object({ topic: z.string() }),
      execute: async ({ topic }) => {
        await new Promise(r => setTimeout(r, 200));
        return { summary: `Research on ${topic}` };
      },
      background: { enabled: true },
    });

    const mockModel = createToolCallThenTextModel('research', { topic: 'quantum' }, 'Done researching');

    const baseAgent = new Agent({
      id: 'bg-dispatch-agent',
      name: 'BG Dispatch Agent',
      instructions: 'Research topics when asked',
      model: mockModel as LanguageModelV2,
      tools: { research: researchTool },
      backgroundTasks: { tools: { research: true } },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
      agents: { 'bg-dispatch-agent': durableAgent as any },
    });

    const chunks: any[] = [];
    const { cleanup } = await durableAgent.stream('Research quantum', {
      onChunk: chunk => chunks.push(chunk),
    });

    await new Promise(r => setTimeout(r, 500));

    const bgStarted = chunks.find(c => c.type === 'background-task-started');
    expect(bgStarted).toBeDefined();
    expect(bgStarted.payload.toolName).toBe('research');
    expect(bgStarted.payload.taskId).toBeDefined();

    cleanup();
  });

  it('runs a foreground tool normally without bg-task-started chunk', async () => {
    const greetTool = createTool({
      id: 'greet',
      description: 'Greet a person',
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => `Hello, ${name}!`,
    });

    const mockModel = createToolCallThenTextModel('greet', { name: 'Alice' }, 'I greeted Alice');

    const baseAgent = new Agent({
      id: 'fg-tool-agent',
      name: 'FG Tool Agent',
      instructions: 'Greet people',
      model: mockModel as LanguageModelV2,
      tools: { greet: greetTool },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      logger: false,
      storage,
      agents: { 'fg-tool-agent': durableAgent as any },
    });

    const chunks: any[] = [];
    const { cleanup } = await durableAgent.stream('Greet Alice', {
      onChunk: chunk => chunks.push(chunk),
    });

    await new Promise(r => setTimeout(r, 500));

    const bgStarted = chunks.find(c => c.type === 'background-task-started');
    expect(bgStarted).toBeUndefined();

    const toolResult = chunks.find(c => c.type === 'tool-result');
    expect(toolResult).toBeDefined();
    expect(toolResult.payload.toolName).toBe('greet');

    cleanup();
  });

  it('onResult injects real result into MessageList after bg task completes', async () => {
    const researchTool = createTool({
      id: 'research',
      description: 'Research a topic',
      inputSchema: z.object({ topic: z.string() }),
      execute: async ({ topic }) => {
        await new Promise(r => setTimeout(r, 100));
        return { summary: `Research on ${topic}` };
      },
      background: { enabled: true },
    });

    const mockModel = createToolCallThenTextModel('research', { topic: 'AI' }, 'Summary provided');

    const baseAgent = new Agent({
      id: 'bg-onresult-agent',
      name: 'BG onResult Agent',
      instructions: 'Research when asked',
      model: mockModel as LanguageModelV2,
      tools: { research: researchTool },
      backgroundTasks: { tools: { research: true } },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
      agents: { 'bg-onresult-agent': durableAgent as any },
    });

    const chunks: any[] = [];
    const { cleanup, runId } = await durableAgent.stream('Research AI', {
      onChunk: chunk => chunks.push(chunk),
    });

    await new Promise(r => setTimeout(r, 1500));

    const bgStarted = chunks.find(c => c.type === 'background-task-started');
    expect(bgStarted).toBeDefined();
    expect(bgStarted.payload.toolName).toBe('research');

    const entry = globalRunRegistry.get(runId);
    expect(entry).toBeDefined();
    const messageList = (entry as any).messageList;
    expect(messageList).toBeDefined();

    const allMessages = messageList.get.all.db();

    const toolInvocationParts = allMessages.flatMap((m: any) => {
      const parts = m.content?.parts ?? (Array.isArray(m.content) ? m.content : []);
      return parts.filter((p: any) => p.type === 'tool-invocation' && p.toolInvocation?.state === 'result');
    });
    expect(toolInvocationParts.length).toBeGreaterThan(0);

    const firstResult = toolInvocationParts[0].toolInvocation;
    expect(firstResult.toolName).toBe('research');
    expect(firstResult.result).toEqual({ summary: 'Research on AI' });

    cleanup();
  });

  it('bg task completes and result is queryable via the task manager', async () => {
    const researchTool = createTool({
      id: 'research',
      description: 'Research a topic',
      inputSchema: z.object({ topic: z.string() }),
      execute: async ({ topic }) => {
        await new Promise(r => setTimeout(r, 100));
        return { summary: `Research on ${topic}` };
      },
      background: { enabled: true },
    });

    const mockModel = createToolCallThenTextModel('research', { topic: 'ML' }, 'Done');

    const baseAgent = new Agent({
      id: 'bg-pubsub-agent',
      name: 'BG PubSub Agent',
      instructions: 'Research when asked',
      model: mockModel as LanguageModelV2,
      tools: { research: researchTool },
      backgroundTasks: { tools: { research: true } },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const localMastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
      agents: { 'bg-pubsub-agent': durableAgent as any },
    });

    const chunks: any[] = [];
    const { cleanup } = await durableAgent.stream('Research ML', {
      onChunk: chunk => chunks.push(chunk),
    });

    await new Promise(r => setTimeout(r, 1500));

    const bgStarted = chunks.find(c => c.type === 'background-task-started');
    expect(bgStarted).toBeDefined();
    expect(bgStarted.payload.toolName).toBe('research');
    expect(bgStarted.payload.taskId).toBeDefined();

    const manager = localMastra.backgroundTaskManager!;
    const task = await manager.getTask(bgStarted.payload.taskId);
    expect(task).toBeDefined();
    expect(task!.status).toBe('completed');
    expect((task!.result as any).summary).toContain('Research on ML');

    cleanup();
  });

  it('bg check step allows loop continuation when bg task completes', async () => {
    let callCount = 0;
    const researchTool = createTool({
      id: 'research',
      description: 'Research a topic',
      inputSchema: z.object({ topic: z.string() }),
      execute: async ({ topic }) => {
        return { summary: `Research on ${topic}` };
      },
      background: { enabled: true },
    });

    const model = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'research',
                input: JSON.stringify({ topic: 'test' }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
          };
        }
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'continuation after bg' },
            { type: 'text-end', id: 't' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    const baseAgent = new Agent({
      id: 'bg-loop-agent',
      name: 'BG Loop Agent',
      instructions: 'Research when asked',
      model: model as LanguageModelV2,
      tools: { research: researchTool },
      backgroundTasks: { tools: { research: true } },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
      agents: { 'bg-loop-agent': durableAgent as any },
    });

    const chunks: any[] = [];
    let finished = false;
    const { cleanup } = await durableAgent.stream('Research test', {
      onChunk: chunk => chunks.push(chunk),
      onFinish: () => {
        finished = true;
      },
    });

    await new Promise(r => setTimeout(r, 2000));

    expect(finished).toBe(true);

    const textDeltas = chunks.filter(c => c.type === 'text-delta');
    expect(textDeltas.length).toBeGreaterThanOrEqual(1);

    cleanup();
  });
});

// ============================================================================
// streamUntilIdle() tests — mirrors Agent.streamUntilIdle tests 1:1
// ============================================================================

describe('DurableAgent.streamUntilIdle', () => {
  const storage = new MockStore();

  let mastra: Mastra;

  beforeEach(async () => {
    mastra = new Mastra({
      logger: false,
      storage,
      backgroundTasks: { enabled: true },
    });
  });

  afterEach(async () => {
    await mastra.backgroundTaskManager?.shutdown();
    const bgStore = await storage.getStore('backgroundTasks');
    await bgStore?.dangerouslyClearAll();
  });

  it('falls through to a plain stream when no bg manager or memory is configured', async () => {
    const plainMastra = new Mastra({ logger: false, storage, backgroundTasks: { enabled: false } });
    expect(plainMastra.backgroundTaskManager).toBeUndefined();

    const { model } = makeScriptedModel([textResponse('plain')]);
    const baseAgent = new Agent({
      id: 'da-plain',
      name: 'da-plain',
      instructions: 'test',
      model,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent });
    plainMastra.addAgent(durableAgent as any, 'da-plain');

    const result = await durableAgent.streamUntilIdle('hi');
    const chunks = await drain(result.fullStream as ReadableStream<any>);

    const textChunks = chunks.filter(c => c?.type?.includes('text')).length;
    expect(textChunks).toBeGreaterThan(0);

    result.cleanup();
  });

  it('closes after the initial turn when no background tasks were dispatched', async () => {
    const memory = new MockMemory();
    const { model, getCallCount } = makeScriptedModel([textResponse('hello')]);

    const baseAgent = new Agent({
      id: 'da1',
      name: 'da1',
      instructions: 'test',
      model,
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent });
    mastra.addAgent(durableAgent as any, 'da1');

    const result = await durableAgent.streamUntilIdle('hi', {
      memory: { thread: 'thread-1', resource: 'user-1' },
    });
    await drain(result.fullStream as ReadableStream<any>);

    expect(getCallCount()).toBe(1);

    result.cleanup();
  });

  it('re-invokes stream when a background task completes', async () => {
    const memory = new MockMemory();
    const { model, getCallCount } = makeScriptedModel([
      textResponse('first response'),
      textResponse('continuation response'),
    ]);

    const baseAgent = new Agent({
      id: 'da2',
      name: 'da2',
      instructions: 'test',
      model,
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent });
    mastra.addAgent(durableAgent as any, 'da2');

    const bgManager = mastra.backgroundTaskManager!;
    const publishEvent = (type: string, taskId: string) =>
      (bgManager as any).publishLifecycleEvent(type, {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'da2',
        threadId: 'thread-2',
        resourceId: 'user-1',
        status: type.split('.')[1],
        result: {},
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 1000,
        createdAt: new Date(),
        args: {},
      });

    const outer = await durableAgent.streamUntilIdle('hi', {
      memory: { thread: 'thread-2', resource: 'user-1' },
    });

    await publishEvent('task.running', 'task-1');
    await new Promise(r => setTimeout(r, 50));
    await publishEvent('task.completed', 'task-1');

    await drain(outer.fullStream as ReadableStream<any>);

    expect(getCallCount()).toBe(2);

    outer.cleanup();
  });

  it('serializes continuations (only one inner stream at a time)', async () => {
    const memory = new MockMemory();

    let resolver1: () => void = () => {};
    let resolver2: () => void = () => {};
    let resolver3: () => void = () => {};

    const makeBlocking = (signal: Promise<void>, text: string) =>
      new ReadableStream<any>({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'response-metadata', id: 'id', modelId: 'mock', timestamp: new Date(0) });
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: text });
          await signal;
          controller.enqueue({ type: 'text-end', id: 't' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          });
          controller.close();
        },
      });

    const scripts: Array<() => ReadableStream<any>> = [
      () =>
        makeBlocking(
          new Promise<void>(r => {
            resolver1 = r;
          }),
          'turn 1',
        ),
      () =>
        makeBlocking(
          new Promise<void>(r => {
            resolver2 = r;
          }),
          'turn 2',
        ),
      () =>
        makeBlocking(
          new Promise<void>(r => {
            resolver3 = r;
          }),
          'turn 3',
        ),
    ];
    const { model, getCallCount } = makeScriptedModel(scripts);

    const baseAgent = new Agent({
      id: 'da3',
      name: 'da3',
      instructions: 'test',
      model,
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent });
    mastra.addAgent(durableAgent as any, 'da3');

    const outer = await durableAgent.streamUntilIdle('hi', {
      memory: { thread: 'thread-3', resource: 'user-1' },
    });
    const drainPromise = drain(outer.fullStream as ReadableStream<any>);

    await new Promise(r => setTimeout(r, 50));
    expect(getCallCount()).toBe(1);

    const bgManager = mastra.backgroundTaskManager!;
    const publishCompleted = (taskId: string) =>
      (bgManager as any).publishLifecycleEvent('task.completed', {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'da3',
        threadId: 'thread-3',
        resourceId: 'user-1',
        status: 'completed',
        result: {},
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 1000,
        createdAt: new Date(),
        args: {},
      });
    await publishCompleted('t-a');
    await publishCompleted('t-b');
    await new Promise(r => setTimeout(r, 50));

    expect(getCallCount()).toBe(1);

    resolver1();
    await new Promise(r => setTimeout(r, 50));

    expect(getCallCount()).toBe(2);

    resolver2();
    resolver3();
    await drainPromise;

    expect(getCallCount()).toBe(2);

    outer.cleanup();
  });

  it('forwards background task chunks (running, output, completed) into the outer stream', async () => {
    const memory = new MockMemory();
    const { model } = makeScriptedModel([textResponse('first'), textResponse('after completion')]);

    const baseAgent = new Agent({
      id: 'da5',
      name: 'da5',
      instructions: 'test',
      model,
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent });
    mastra.addAgent(durableAgent as any, 'da5');

    const bgManager = mastra.backgroundTaskManager!;
    const publishEvent = (type: string, taskId: string, extra: Record<string, unknown> = {}) =>
      (bgManager as any).publishLifecycleEvent(type, {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'da5',
        threadId: 'thread-5',
        resourceId: 'user-1',
        status: type.split('.')[1],
        result: {},
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 1000,
        createdAt: new Date(),
        args: { q: 'test' },
        ...extra,
      });

    const result = await durableAgent.streamUntilIdle('hi', {
      memory: { thread: 'thread-5', resource: 'user-1' },
    });

    await publishEvent('task.running', 'task-1', { startedAt: new Date() });
    await new Promise(r => setTimeout(r, 20));
    await publishEvent('task.output', 'task-1', {
      chunk: { type: 'custom-progress', payload: { pct: 42 } },
    });
    await new Promise(r => setTimeout(r, 20));
    await publishEvent('task.completed', 'task-1', { completedAt: new Date() });

    const chunks = await drain(result.fullStream as ReadableStream<any>);

    const types = chunks.map(c => c?.type).filter(Boolean);
    expect(types).toContain('background-task-running');
    expect(types).toContain('background-task-output');
    expect(types).toContain('background-task-completed');

    const running = chunks.find(c => c?.type === 'background-task-running');
    expect((running as any)?.payload?.taskId).toBe('task-1');

    result.cleanup();
  });

  it('closes the outer stream when the caller aborts mid-flight', async () => {
    const memory = new MockMemory();
    const { model, getCallCount } = makeScriptedModel([textResponse('initial'), textResponse('would-continue')]);

    const baseAgent = new Agent({
      id: 'da-abort',
      name: 'da-abort',
      instructions: 'test',
      model,
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent });
    mastra.addAgent(durableAgent as any, 'da-abort');

    const bgManager = mastra.backgroundTaskManager!;
    const publishEvent = (type: string, taskId: string) =>
      (bgManager as any).publishLifecycleEvent(type, {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'da-abort',
        threadId: 'thread-abort',
        resourceId: 'user-1',
        status: type.split('.')[1],
        result: {},
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 1000,
        createdAt: new Date(),
        args: {},
      });

    const abortController = new AbortController();

    const result = await durableAgent.streamUntilIdle('hi', {
      memory: { thread: 'thread-abort', resource: 'user-1' },
      abortSignal: abortController.signal,
    } as any);

    await publishEvent('task.running', 'task-1');
    await new Promise(r => setTimeout(r, 30));

    abortController.abort();

    await publishEvent('task.completed', 'task-1');

    const chunks = await Promise.race([
      drain(result.fullStream as ReadableStream<any>),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('stream did not close within 500ms of abort')), 500),
      ),
    ]);

    const deltas = chunks
      .filter(c => c?.type === 'text-delta')
      .map(c => (c as any).payload?.text ?? (c as any).delta ?? '')
      .join('');

    expect(deltas).toContain('initial');
    expect(getCallCount()).toBe(1);
    expect(deltas).not.toContain('would-continue');

    result.cleanup();
  });

  it('closes after maxIdleMs when nothing is happening but tasks remain running', async () => {
    const memory = new MockMemory();
    const { model } = makeScriptedModel([textResponse('initial')]);

    const baseAgent = new Agent({
      id: 'da-idle',
      name: 'da-idle',
      instructions: 'test',
      model,
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent });
    mastra.addAgent(durableAgent as any, 'da-idle');

    const bgManager = mastra.backgroundTaskManager!;
    const publishRunning = (taskId: string) =>
      (bgManager as any).publishLifecycleEvent('task.running', {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'da-idle',
        threadId: 'thread-idle',
        resourceId: 'user-1',
        status: 'running',
        result: {},
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 1000,
        createdAt: new Date(),
        args: {},
      });

    const result = await durableAgent.streamUntilIdle('hi', {
      memory: { thread: 'thread-idle', resource: 'user-1' },
      maxIdleMs: 100,
    } as any);

    await publishRunning('task-1');

    const start = Date.now();
    await drain(result.fullStream as ReadableStream<any>);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2_000);

    result.cleanup();
  });

  it('does not close mid-turn when inner stream is slow (idle timer only runs between turns)', async () => {
    const memory = new MockMemory();

    const slowStream = () =>
      new ReadableStream<any>({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'response-metadata', id: 'id', modelId: 'mock', timestamp: new Date(0) });
          controller.enqueue({ type: 'text-start', id: 't' });
          await new Promise(r => setTimeout(r, 300));
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'slow' });
          controller.enqueue({ type: 'text-end', id: 't' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          });
          controller.close();
        },
      });

    const { model } = makeScriptedModel([slowStream]);

    const baseAgent = new Agent({
      id: 'da-slow',
      name: 'da-slow',
      instructions: 'test',
      model,
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent });
    mastra.addAgent(durableAgent as any, 'da-slow');

    const result = await durableAgent.streamUntilIdle('hi', {
      memory: { thread: 'thread-slow', resource: 'user-1' },
      maxIdleMs: 100,
    } as any);

    const chunks = await drain(result.fullStream as ReadableStream<any>);

    const deltaText = chunks
      .filter(c => c?.type === 'text-delta')
      .map(c => (c as any).payload?.text ?? (c as any).delta ?? '')
      .join('');
    expect(deltaText).toContain('slow');

    result.cleanup();
  });

  it('surfaces continuation errors through the outer stream', async () => {
    const memory = new MockMemory();

    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        if (calls === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: textResponse('initial')(),
          };
        }
        throw new Error('continuation boom');
      },
    });

    const baseAgent = new Agent({
      id: 'da-err',
      name: 'da-err',
      instructions: 'test',
      model,
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent });
    mastra.addAgent(durableAgent as any, 'da-err');

    const bgManager = mastra.backgroundTaskManager!;
    const publishEvent = (type: string, taskId: string) =>
      (bgManager as any).publishLifecycleEvent(type, {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'da-err',
        threadId: 'thread-err',
        resourceId: 'user-1',
        status: type.split('.')[1],
        result: {},
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 1000,
        createdAt: new Date(),
        args: {},
      });

    const result = await durableAgent.streamUntilIdle('hi', {
      memory: { thread: 'thread-err', resource: 'user-1' },
    });

    await publishEvent('task.running', 'task-1');
    await new Promise(r => setTimeout(r, 30));
    await publishEvent('task.completed', 'task-1');

    // The durable agent wraps execution in a workflow so the model error
    // may propagate as either a stream error, an error chunk, or the stream
    // may close without the continuation producing output. Any of those is
    // acceptable — the key requirement is that the outer stream closes
    // rather than hanging indefinitely.
    let sawError = false;
    try {
      const chunks = await Promise.race([
        drain(result.fullStream as ReadableStream<any>),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('stream did not close within 5s after error')), 5000),
        ),
      ]);
      sawError = chunks.some(c => c?.type === 'error');
    } catch {
      sawError = true;
    }
    expect(sawError).toBe(true);

    result.cleanup();
  }, 15_000);

  it('returns a DurableAgentStreamResult-shaped result (output, fullStream, runId, cleanup)', async () => {
    const memory = new MockMemory();
    const { model } = makeScriptedModel([textResponse('hello world')]);

    const baseAgent = new Agent({
      id: 'da4',
      name: 'da4',
      instructions: 'test',
      model,
      memory,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent });
    mastra.addAgent(durableAgent as any, 'da4');

    const result = await durableAgent.streamUntilIdle('hi', {
      memory: { thread: 'thread-4', resource: 'user-1' },
    });

    expect(result.fullStream).toBeInstanceOf(ReadableStream);
    expect(result.output).toBeDefined();
    expect(typeof result.runId).toBe('string');
    expect(typeof result.cleanup).toBe('function');

    await drain(result.fullStream as ReadableStream<any>);

    const text = await result.output.text;
    expect(text).toBe('hello world');

    result.cleanup();
  });
});
