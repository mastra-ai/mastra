import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestAgent, createTestController } from '../../agent-controller/test-utils';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { MastraModelOutput } from '../../stream/base/output';
import type { Agent } from '../agent';
import { agentThreadStreamRuntime, AgentThreadStreamRuntime } from '../thread-stream-runtime';

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

describe('AgentController.listActiveThreadRuns', () => {
  it('covers modes whose agent carries its own pubsub', async () => {
    const buildPubSub = new EventEmitterPubSub();
    const planPubSub = new EventEmitterPubSub();
    const buildAgent = createTestAgent({ id: 'build-agent', name: 'build-agent' });
    const planAgent = createTestAgent({ id: 'plan-agent', name: 'plan-agent' });
    buildAgent.__setPubSub(buildPubSub);
    planAgent.__setPubSub(planPubSub);

    const controller = createTestController({
      modes: [
        { id: 'build', name: 'Build', default: true, agent: buildAgent },
        { id: 'plan', name: 'Plan', agent: planAgent },
      ],
    });
    await controller.init();

    const buildRun = createFakeRun('run-build');
    const planRun = createFakeRun('run-plan');
    try {
      await agentThreadStreamRuntime.registerRun(
        buildAgent,
        buildRun.output,
        { memory: { thread: 'thread-build', resource: 'resource-build' } },
        buildPubSub,
      );
      await agentThreadStreamRuntime.registerRun(
        planAgent,
        planRun.output,
        { memory: { thread: 'thread-plan', resource: 'resource-plan' } },
        planPubSub,
      );

      const runs = controller.listActiveThreadRuns();
      expect(runs).toHaveLength(2);
      expect(runs).toEqual(
        expect.arrayContaining([
          { runId: 'run-build', resourceId: 'resource-build', threadId: 'thread-build' },
          { runId: 'run-plan', resourceId: 'resource-plan', threadId: 'thread-plan' },
        ]),
      );
    } finally {
      buildRun.settle();
      planRun.settle();
      await buildPubSub.close();
      await planPubSub.close();
    }
  });
});
