/**
 * Regression tests for #26841: a new `stream({ untilIdle: true })` on a thread
 * aborts the earlier run's idle wrapper (acquireStreamSlot), but the new
 * wrapper only tracked task IDs from `background-task-started/running/resumed`
 * chunks it saw itself. A task started by the aborted run was never tracked,
 * so the new wrapper closed after its first turn and the task's completion
 * woke nobody — the agent never reported the result.
 *
 * The idle loop must adopt still-running/pending tasks for its scope when it
 * starts, and must not re-adopt a task whose terminal event it already saw.
 */
import { describe, expect, it, vi } from 'vitest';
import { runIdleLoop } from './stream-until-idle-helpers';

const textChunks = (text: string) => [
  { type: 'text-delta', payload: { text } },
  { type: 'finish', payload: {} },
];

function streamOf(chunks: unknown[]): ReadableStream<any> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function makeAgent() {
  return {
    id: 'idle-agent',
    getDefaultOptions: () => ({}),
    getMemory: async () => ({}) as any,
  };
}

function makeBgStream() {
  let controller!: ReadableStreamDefaultController<any>;
  const stream = new ReadableStream<any>({
    start(c) {
      controller = c;
    },
  });
  return { stream, push: (chunk: unknown) => controller.enqueue(chunk) };
}

const completedChunk = (taskId: string) => ({
  type: 'background-task-completed',
  payload: { taskId, toolCallId: `call-${taskId}`, toolName: 'long-job' },
});

const runIdleLoopWithDeps = (deps: {
  listTasks: (filter: any) => Promise<{ tasks: Array<{ id: string }>; total: number }>;
  bgStream: ReadableStream<any>;
  firstTurn?: () => Promise<{ fullStream: ReadableStream<any>; runId?: string }>;
  streamForContinuation: (opts: Record<string, any>) => Promise<{ fullStream: ReadableStream<any>; runId?: string }>;
}) =>
  runIdleLoop(
    makeAgent(),
    { memory: { thread: 'thread-1', resource: 'user-1' } },
    {
      activeStreams: new Map(),
      bgManager: {
        config: {},
        listTasks: deps.listTasks,
        stream: () => deps.bgStream,
      } as any,
    },
    deps.firstTurn ?? (async () => ({ fullStream: streamOf(textChunks('first answer')), runId: 'run-1' })),
    deps.streamForContinuation,
    (_first, ctx) => ctx,
  );

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

describe('runIdleLoop adopts tasks started by a prior wrapper (#26841)', () => {
  it('stays open for a pre-existing running task and runs a continuation when it completes', async () => {
    const bg = makeBgStream();
    const continuation = vi.fn(async () => ({
      fullStream: streamOf(textChunks('continuation answer')),
      runId: 'run-2',
    }));

    // The task is already running in storage; its 'running' event predates
    // this wrapper's subscription, so only the startup lookup can find it.
    // Push its completion as soon as the lookup happens — on main the lookup
    // never happens and the wrapper closes after the first turn.
    const listTasks = vi.fn(async (filter: any) => {
      expect(filter).toMatchObject({ agentId: 'idle-agent', threadId: 'thread-1', resourceId: 'user-1' });
      queueMicrotask(() => bg.push(completedChunk('task-orphan')));
      return { tasks: [{ id: 'task-orphan' }], total: 1 };
    });

    const ctx = await runIdleLoopWithDeps({ listTasks, bgStream: bg.stream, streamForContinuation: continuation });
    const chunks = await drain(ctx.combinedStream);

    expect(listTasks).toHaveBeenCalledTimes(1);
    expect(continuation).toHaveBeenCalledTimes(1);
    const texts = chunks.filter(c => c.type === 'text-delta').map(c => c.payload.text);
    expect(texts).toContain('continuation answer');
  });

  it('keeps the wrapper open past the first idle evaluation for an adopted task', async () => {
    const bg = makeBgStream();
    const continuation = vi.fn(async () => ({
      fullStream: streamOf(textChunks('continuation answer')),
      runId: 'run-2',
    }));
    const listTasks = vi.fn(async () => ({ tasks: [{ id: 'task-orphan' }], total: 1 }));

    const ctx = await runIdleLoopWithDeps({ listTasks, bgStream: bg.stream, streamForContinuation: continuation });

    // Read until the first turn has fully finished, then flush the macrotask
    // queue so the first idle evaluation has run. Only the adopted task in
    // runningTaskIds keeps the wrapper open here — a completion queued during
    // the lookup would pass even if adoption discarded the lookup result.
    const reader = ctx.combinedStream.getReader();
    const chunks: any[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      if (value?.type === 'finish') break;
    }
    await new Promise(resolve => setImmediate(resolve));
    expect(continuation).not.toHaveBeenCalled();

    bg.push(completedChunk('task-orphan'));
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(continuation).toHaveBeenCalledTimes(1);
    const texts = chunks.filter(c => c.type === 'text-delta').map(c => c.payload.text);
    expect(texts).toContain('continuation answer');
  });

  it('does not re-adopt a task whose terminal event arrived during the lookup', async () => {
    const bg = makeBgStream();
    const continuation = vi.fn(async () => ({
      fullStream: streamOf(textChunks('continuation answer')),
      runId: 'run-2',
    }));

    // Deliver the completion BEFORE the (stale) lookup resolves: the task must
    // not be re-added to the running set, or the wrapper would wait forever
    // for a second completion that never comes.
    let resolveLookup!: (value: { tasks: Array<{ id: string }>; total: number }) => void;
    const lookupGate = new Promise<{ tasks: Array<{ id: string }>; total: number }>(resolve => {
      resolveLookup = resolve;
    });
    const listTasks = vi.fn(() => lookupGate);

    const loopPromise = runIdleLoopWithDeps({
      listTasks,
      bgStream: bg.stream,
      streamForContinuation: continuation,
    });

    // Wait until the lookup is in flight, then deliver the terminal event.
    await vi.waitFor(() => expect(listTasks).toHaveBeenCalledTimes(1));
    bg.push(completedChunk('task-orphan'));

    // Read the outer stream until the completed chunk is observed: the bg
    // handler enqueues it in the same synchronous pass that records the task
    // as settled, so from here the lookup snapshot is provably stale.
    const ctx = await loopPromise;
    const reader = ctx.combinedStream.getReader();
    const chunks: any[] = [];
    let sawCompleted = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      if (!sawCompleted && value?.type === 'background-task-completed') {
        sawCompleted = true;
        resolveLookup({ tasks: [{ id: 'task-orphan' }], total: 1 });
      }
    }
    expect(sawCompleted).toBe(true);

    // Exactly one continuation for the already-settled task, then the wrapper
    // closes instead of hanging on a phantom running task.
    expect(continuation).toHaveBeenCalledTimes(1);
    const texts = chunks.filter(c => c.type === 'text-delta').map(c => c.payload.text);
    expect(texts).toContain('continuation answer');
  });

  it('adopts nothing when the stream has no thread or resource scope (cross-resource disclosure)', async () => {
    const bg = makeBgStream();
    const continuation = vi.fn(async () => ({
      fullStream: streamOf(textChunks('continuation answer')),
      runId: 'run-2',
    }));

    // An agent-wide lookup ({ agentId } only) would return every resource's
    // running/pending tasks — adopting them lets another resource's task
    // completion drive a continuation on this stream, disclosing its result.
    const listTasks = vi.fn(async () => ({ tasks: [{ id: 'task-other-resource' }], total: 1 }));

    // Memory exists but the caller provided no thread or resource ids.
    const ctx = await runIdleLoop(
      makeAgent(),
      {},
      {
        activeStreams: new Map(),
        bgManager: { config: {}, listTasks, stream: () => bg.stream } as any,
      },
      async () => ({ fullStream: streamOf(textChunks('first answer')), runId: 'run-1' }),
      continuation,
      (_first: unknown, loopCtx: any) => loopCtx,
    );

    // Read until the first turn's text arrives; by then the (concurrent)
    // adoption pass has settled, since the first idle evaluation awaits it.
    const reader = ctx.combinedStream.getReader();
    const chunks: any[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      if (value?.type === 'text-delta') break;
    }

    // No authorized scope → no adoption lookup at all, and the wrapper closes
    // after the first turn instead of waiting on another resource's task.
    expect(listTasks).not.toHaveBeenCalled();
    expect(continuation).not.toHaveBeenCalled();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    expect(continuation).not.toHaveBeenCalled();
  });

  it('drops another resource’s live task events on an unscoped stream', async () => {
    const bg = makeBgStream();
    const continuation = vi.fn(async () => ({
      fullStream: streamOf(textChunks('continuation answer')),
      runId: 'run-2',
    }));

    // Keep the first turn open so the wrapper is provably live when the
    // foreign event arrives on the wildcard subscription.
    let releaseFirstTurn!: () => void;
    const firstStream = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({ type: 'text-delta', payload: { text: 'first answer' } });
        releaseFirstTurn = () => {
          controller.enqueue({ type: 'finish', payload: {} });
          controller.close();
        };
      },
    });

    const ctx = await runIdleLoop(
      makeAgent(),
      {},
      { activeStreams: new Map(), bgManager: { config: {}, listTasks: vi.fn(), stream: () => bg.stream } as any },
      async () => ({ fullStream: firstStream, runId: 'run-1' }),
      continuation,
      (_first: unknown, loopCtx: any) => loopCtx,
    );

    // Terminal payloads carry the task result — delivering this would
    // disclose another resource's result on this caller's stream.
    bg.push(completedChunk('task-other-resource'));
    // Let the subscription handler process the event before the turn ends.
    await new Promise(resolve => setImmediate(resolve));
    releaseFirstTurn();

    const chunks = await drain(ctx.combinedStream);
    expect(chunks.filter(c => c?.type === 'background-task-completed')).toEqual([]);
    expect(continuation).not.toHaveBeenCalled();
  });

  it('continues event-only when the adoption lookup hangs, and ignores a late result', async () => {
    vi.useFakeTimers();
    try {
      const bg = makeBgStream();
      const continuation = vi.fn(async () => ({
        fullStream: streamOf(textChunks('continuation answer')),
        runId: 'run-2',
      }));
      let resolveLookup!: (value: { tasks: Array<{ id: string }>; total: number }) => void;
      const listTasks = vi.fn(
        () =>
          new Promise<{ tasks: Array<{ id: string }>; total: number }>(resolve => {
            resolveLookup = resolve;
          }),
      );

      const ctx = await runIdleLoopWithDeps({ listTasks, bgStream: bg.stream, streamForContinuation: continuation });
      const drainPromise = drain(ctx.combinedStream);

      // The lookup never resolves within the bound: the wrapper must fall
      // back to event-only tracking and close instead of hanging.
      await vi.advanceTimersByTimeAsync(5_001);
      const chunks = await drainPromise;
      const texts = chunks.filter(c => c.type === 'text-delta').map(c => c.payload.text);
      expect(texts).toContain('first answer');

      // A late lookup result must be ignored — no phantom running task, no
      // continuation on an already-closed wrapper.
      resolveLookup({ tasks: [{ id: 'task-late' }], total: 1 });
      await vi.advanceTimersByTimeAsync(0);
      expect(continuation).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
