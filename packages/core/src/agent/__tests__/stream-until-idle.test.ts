import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory';
import { MockStore } from '../../storage';
import { Agent } from '../agent';

/**
 * Helper: build a mock model whose streaming response is controlled by the
 * caller. Each call to stream() pulls the next scripted response.
 */
function makeScriptedModel(scripts: Array<() => ReadableStream<any>>) {
  let calls = 0;
  const model = new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('doGenerate not used in these tests');
    },
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

describe('Agent.streamUntilIdle', () => {
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
    // Build a Mastra without background tasks enabled — no manager exists.
    const plainMastra = new Mastra({ logger: false, storage, backgroundTasks: { enabled: false } });
    expect(plainMastra.backgroundTaskManager).toBeUndefined();

    const { model } = makeScriptedModel([textResponse('plain')]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
    });
    plainMastra.addAgent(agent, 'a');

    const result = await agent.streamUntilIdle('hi');
    const chunks = await drain(result.fullStream as ReadableStream<any>);

    // We got chunks from a single turn (no continuation because no memory).
    const textChunks = chunks.filter(c => c?.type?.includes('text')).length;
    expect(textChunks).toBeGreaterThan(0);
  });

  it('closes after the initial turn when no background tasks were dispatched', async () => {
    const memory = new MockMemory();
    const { model, getCallCount } = makeScriptedModel([textResponse('hello')]);

    const agent = new Agent({
      id: 'a1',
      name: 'a1',
      instructions: 'test',
      model,
      memory,
    });
    mastra.addAgent(agent, 'a1');

    const result = await agent.streamUntilIdle('hi', {
      memory: { thread: 'thread-1', resource: 'user-1' },
    });
    await drain(result.fullStream as ReadableStream<any>);

    // Only the initial turn ran — one LLM call, no continuations.
    expect(getCallCount()).toBe(1);
  });

  it('re-invokes stream when a background task completes', async () => {
    const memory = new MockMemory();
    const { model, getCallCount } = makeScriptedModel([
      textResponse('first response'),
      textResponse('continuation response'),
    ]);

    const agent = new Agent({
      id: 'a2',
      name: 'a2',
      instructions: 'test',
      model,
      memory,
    });
    mastra.addAgent(agent, 'a2');

    // Emit task.running BEFORE calling streamUntilIdle so the outer state
    // machine sees a pending task and stays open after the initial turn.
    const bgManager = mastra.backgroundTaskManager!;
    const publishEvent = (type: string, taskId: string) =>
      (bgManager as any).publishLifecycleEvent(type, {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'a2',
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

    const outer = await agent.streamUntilIdle('hi', {
      memory: { thread: 'thread-2', resource: 'user-1' },
    });

    // Mark a task as running so the outer knows to wait for it.
    await publishEvent('task.running', 'task-1');
    // Now complete it. The state machine should re-invoke stream to process.
    await new Promise(r => setTimeout(r, 50));
    await publishEvent('task.completed', 'task-1');

    await drain(outer.fullStream as ReadableStream<any>);

    // Initial turn + one continuation = 2 LLM calls
    expect(getCallCount()).toBe(2);
  });

  it('serializes continuations (only one inner stream at a time)', async () => {
    const memory = new MockMemory();

    // Use resolvable promises so we can control when each inner turn finishes.
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

    const agent = new Agent({
      id: 'a3',
      name: 'a3',
      instructions: 'test',
      model,
      memory,
    });
    mastra.addAgent(agent, 'a3');

    const outer = await agent.streamUntilIdle('hi', {
      memory: { thread: 'thread-3', resource: 'user-1' },
    });
    const drainPromise = drain(outer.fullStream as ReadableStream<any>);

    // Initial turn is in flight; call count is 1.
    await new Promise(r => setTimeout(r, 50));
    expect(getCallCount()).toBe(1);

    // Fire two completions while the initial turn is still running.
    const bgManager = mastra.backgroundTaskManager!;
    const publishCompleted = (taskId: string) =>
      (bgManager as any).publishLifecycleEvent('task.completed', {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'a3',
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

    // Both completions queued but no second inner turn yet — still 1 call.
    expect(getCallCount()).toBe(1);

    // Let the initial turn finish.
    resolver1();
    await new Promise(r => setTimeout(r, 50));

    // After initial ends, processIfIdle should kick off ONE continuation
    // that drains all queued completions together. Call count is 2.
    expect(getCallCount()).toBe(2);

    // Let continuation 2 finish. No more pending → outer closes.
    resolver2();
    resolver3(); // no-op if script 3 isn't used
    await drainPromise;

    // Exactly 2 LLM calls total: initial + one continuation drain.
    expect(getCallCount()).toBe(2);
  });

  it('forwards background task chunks (running, output, completed) into the outer stream', async () => {
    const memory = new MockMemory();
    const { model } = makeScriptedModel([textResponse('first'), textResponse('after completion')]);

    const agent = new Agent({
      id: 'a5',
      name: 'a5',
      instructions: 'test',
      model,
      memory,
    });
    mastra.addAgent(agent, 'a5');

    const bgManager = mastra.backgroundTaskManager!;
    const publishEvent = (type: string, taskId: string, extra: Record<string, unknown> = {}) =>
      (bgManager as any).publishLifecycleEvent(type, {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'a5',
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

    const result = await agent.streamUntilIdle('hi', {
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
    // The bg chunks are forwarded into the outer stream alongside agent chunks.
    expect(types).toContain('background-task-running');
    expect(types).toContain('background-task-output');
    expect(types).toContain('background-task-completed');

    // And the bg-task-running chunk carries its taskId in the payload.
    const running = chunks.find(c => c?.type === 'background-task-running');
    expect((running as any)?.payload?.taskId).toBe('task-1');
  });

  it('closes the outer stream when the caller aborts mid-flight', async () => {
    const memory = new MockMemory();
    // Script a SECOND response: if abort failed to close the outer stream,
    // the post-abort task.completed below would trigger a continuation and
    // we'd observe its 'would-continue' text in the drained chunks.
    const { model, getCallCount } = makeScriptedModel([textResponse('initial'), textResponse('would-continue')]);

    const agent = new Agent({
      id: 'a-abort',
      name: 'a-abort',
      instructions: 'test',
      model,
      memory,
    });
    mastra.addAgent(agent, 'a-abort');

    const bgManager = mastra.backgroundTaskManager!;
    const publishEvent = (type: string, taskId: string) =>
      (bgManager as any).publishLifecycleEvent(type, {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'a-abort',
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

    const result = await agent.streamUntilIdle('hi', {
      memory: { thread: 'thread-abort', resource: 'user-1' },
      abortSignal: abortController.signal,
    });

    // Mark a task as running so the outer would stay open indefinitely
    // if abort didn't force-close it.
    await publishEvent('task.running', 'task-1');
    await new Promise(r => setTimeout(r, 30));

    abortController.abort();

    // Publish a completion AFTER abort. Without the force-close, this would
    // enter the continuation queue and kick off a second LLM call.
    await publishEvent('task.completed', 'task-1');

    // Stream must close within a short bound — race against a timeout so a
    // hang surfaces as a clear failure message, not a vitest timeout.
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

    // Initial turn's text made it through before abort.
    expect(deltas).toContain('initial');

    // No continuation ran: only the initial LLM call, and its text never appears.
    expect(getCallCount()).toBe(1);
    expect(deltas).not.toContain('would-continue');
  });

  it('closes after maxIdleMs when nothing is happening but tasks remain running', async () => {
    const memory = new MockMemory();
    const { model } = makeScriptedModel([textResponse('initial')]);

    const agent = new Agent({
      id: 'a-idle',
      name: 'a-idle',
      instructions: 'test',
      model,
      memory,
    });
    mastra.addAgent(agent, 'a-idle');

    const bgManager = mastra.backgroundTaskManager!;
    const publishRunning = (taskId: string) =>
      (bgManager as any).publishLifecycleEvent('task.running', {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'a-idle',
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

    const result = await agent.streamUntilIdle('hi', {
      memory: { thread: 'thread-idle', resource: 'user-1' },
      maxIdleMs: 100,
    });

    await publishRunning('task-1');

    // Drain must complete within maxIdleMs — the idle timer closes the stream
    // even though the running task never emits another event.
    const start = Date.now();
    await drain(result.fullStream as ReadableStream<any>);
    const elapsed = Date.now() - start;

    // Allow slack but confirm we're closing on the timer, not hanging open.
    expect(elapsed).toBeLessThan(2_000);
  });

  it('does not close mid-turn when inner stream is slow (idle timer only runs between turns)', async () => {
    const memory = new MockMemory();

    // Build a model whose first turn blocks for longer than maxIdleMs
    // before emitting its text deltas. If the idle timer were armed while
    // the inner stream was active, the outer would close prematurely and
    // we'd lose the "slow" chunk.
    const slowStream = () =>
      new ReadableStream<any>({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'response-metadata', id: 'id', modelId: 'mock', timestamp: new Date(0) });
          controller.enqueue({ type: 'text-start', id: 't' });
          // Long gap between deltas — exceeds maxIdleMs below.
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

    const agent = new Agent({
      id: 'a-slow',
      name: 'a-slow',
      instructions: 'test',
      model,
      memory,
    });
    mastra.addAgent(agent, 'a-slow');

    const result = await agent.streamUntilIdle('hi', {
      memory: { thread: 'thread-slow', resource: 'user-1' },
      maxIdleMs: 100, // shorter than the 300ms gap above
    });

    const chunks = await drain(result.fullStream as ReadableStream<any>);

    // The slow delta must have survived — we weren't killed by the idle
    // timer mid-turn. If the timer had fired during streaming, chunks
    // would be truncated before the text-delta.
    const deltaText = chunks
      .filter(c => c?.type === 'text-delta')
      .map(c => (c as any).payload?.text ?? (c as any).delta ?? '')
      .join('');
    expect(deltaText).toContain('slow');
  });

  it('surfaces continuation errors through the outer stream', async () => {
    const memory = new MockMemory();

    let calls = 0;
    const model = new MockLanguageModelV2({
      doGenerate: async () => {
        throw new Error('doGenerate not used');
      },
      doStream: async () => {
        calls++;
        if (calls === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: textResponse('initial')(),
          };
        }
        // Second call — throw to simulate a continuation failure.
        throw new Error('continuation boom');
      },
    });

    const agent = new Agent({
      id: 'a-err',
      name: 'a-err',
      instructions: 'test',
      model,
      memory,
    });
    mastra.addAgent(agent, 'a-err');

    const bgManager = mastra.backgroundTaskManager!;
    const publishEvent = (type: string, taskId: string) =>
      (bgManager as any).publishLifecycleEvent(type, {
        id: taskId,
        toolName: 'dummy',
        toolCallId: taskId,
        runId: 'run-1',
        agentId: 'a-err',
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

    const result = await agent.streamUntilIdle('hi', {
      memory: { thread: 'thread-err', resource: 'user-1' },
    });

    await publishEvent('task.running', 'task-1');
    await new Promise(r => setTimeout(r, 30));
    await publishEvent('task.completed', 'task-1');

    // Draining should either reject with the continuation error, or
    // forward it as an error chunk. Either behaviour is acceptable as long
    // as the outer stream closes rather than hanging.
    let sawError = false;
    try {
      const chunks = await drain(result.fullStream as ReadableStream<any>);
      sawError = chunks.some(c => c?.type === 'error');
    } catch {
      sawError = true;
    }
    expect(sawError).toBe(true);
  });

  it('returns a MastraModelOutput-shaped result (text, consumeStream, fullStream)', async () => {
    const memory = new MockMemory();
    const { model } = makeScriptedModel([textResponse('hello world')]);

    const agent = new Agent({
      id: 'a4',
      name: 'a4',
      instructions: 'test',
      model,
      memory,
    });
    mastra.addAgent(agent, 'a4');

    const result = await agent.streamUntilIdle('hi', {
      memory: { thread: 'thread-4', resource: 'user-1' },
    });

    // Shape matches stream(): fullStream is a ReadableStream.
    expect(result.fullStream).toBeInstanceOf(ReadableStream);

    // consumeStream drains the outer stream to completion.
    expect(typeof result.consumeStream).toBe('function');
    await result.consumeStream();

    // Delayed promises from the initial turn resolve through the proxy.
    const text = await result.text;
    expect(text).toBe('hello world');
  });
});
