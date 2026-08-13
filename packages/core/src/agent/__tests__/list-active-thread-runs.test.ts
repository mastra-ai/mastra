import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { MastraModelOutput } from '../../stream/base/output';
import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

const fakeAgent = { id: 'list-active-runs-test-agent' } as unknown as Agent<any, any, any, any>;

function createFakeRun(runId: string) {
  let status: 'running' | 'success' = 'running';
  let streamController!: ReadableStreamDefaultController<unknown>;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => {
    finish = resolve;
  });

  const output = {
    runId,
    get status() {
      return status;
    },
    fullStream: new ReadableStream<unknown>({
      start(controller) {
        streamController = controller;
      },
    }),
    _waitUntilFinished: () => finished,
  } as unknown as MastraModelOutput<unknown>;

  return {
    output,
    settle() {
      status = 'success';
      streamController.close();
      finish();
    },
  };
}

describe('listActiveThreadRuns', () => {
  const pubsub = new EventEmitterPubSub();

  afterEach(async () => {
    await pubsub.close();
  });

  it('reports each in-flight run with its resource and thread, and drops settled runs', async () => {
    const runtime = new AgentThreadStreamRuntime();
    expect(runtime.listActiveThreadRuns(pubsub)).toEqual([]);

    const runA = createFakeRun('run-a');
    await runtime.registerRun(
      fakeAgent,
      runA.output,
      { memory: { thread: 'thread-a', resource: 'resource-a' } },
      pubsub,
    );
    const runB = createFakeRun('run-b');
    await runtime.registerRun(
      fakeAgent,
      runB.output,
      { memory: { thread: 'thread-b', resource: 'resource-b' } },
      pubsub,
    );

    expect(runtime.listActiveThreadRuns(pubsub)).toEqual(
      expect.arrayContaining([
        { runId: 'run-a', resourceId: 'resource-a', threadId: 'thread-a' },
        { runId: 'run-b', resourceId: 'resource-b', threadId: 'thread-b' },
      ]),
    );

    runB.settle();
    await vi.waitFor(() =>
      expect(runtime.listActiveThreadRuns(pubsub)).toEqual([
        { runId: 'run-a', resourceId: 'resource-a', threadId: 'thread-a' },
      ]),
    );
  });
});
