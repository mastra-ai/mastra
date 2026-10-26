import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import { UnixSocketPubSub } from '../../events/unix-socket-pubsub';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

/**
 * A run is owned by the instance whose `run.start()` is awaiting it. Cancelling it from another
 * instance that shares storage and pubsub (another replica, or the server cancel route hitting a
 * different pod) must settle the owner's `start()` as `canceled` and abort the running step.
 */

const WORKFLOW_ID = 'remote-cancel-workflow';
const SETTLE_TIMEOUT_MS = 5_000;

type Shape = 'dountil' | 'foreach' | 'sequential' | 'sleep' | 'parallel';
const SHAPES: Shape[] = ['dountil', 'foreach', 'sequential', 'sleep', 'parallel'];

/** Tracks the first call of the blocking step: it waits until its abortSignal fires. */
function createBlocker() {
  let markEntered!: () => void;
  const entered = new Promise<void>(resolve => (markEntered = resolve));
  const state = { calls: 0, aborted: false };
  const block = async (abortSignal: AbortSignal) => {
    state.calls++;
    if (state.calls > 1) return;
    markEntered();
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, SETTLE_TIMEOUT_MS * 2);
      abortSignal.addEventListener(
        'abort',
        () => {
          state.aborted = true;
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  };
  return { entered, state, block };
}

type Blocker = ReturnType<typeof createBlocker>;

function buildWorkflow(shape: Shape, blocker: Blocker) {
  const countSchema = z.object({ count: z.number() });
  const blocking = createStep({
    id: 'blocking',
    inputSchema: countSchema,
    outputSchema: countSchema,
    execute: async ({ inputData, abortSignal }) => {
      await blocker.block(abortSignal);
      return { count: inputData.count + 1 };
    },
  });
  const passthrough = createStep({
    id: 'passthrough',
    inputSchema: countSchema,
    outputSchema: countSchema,
    execute: async ({ inputData }) => inputData,
  });

  switch (shape) {
    case 'dountil':
      return createWorkflow({ id: WORKFLOW_ID, inputSchema: countSchema, outputSchema: countSchema })
        .dountil(blocking, async ({ inputData }) => inputData.count >= 3)
        .commit();
    case 'foreach': {
      const item = createStep({
        id: 'item',
        inputSchema: z.number(),
        outputSchema: z.number(),
        execute: async ({ inputData, abortSignal }) => {
          await blocker.block(abortSignal);
          return inputData;
        },
      });
      return createWorkflow({ id: WORKFLOW_ID, inputSchema: countSchema, outputSchema: z.array(z.number()) })
        .map(async () => [1, 2, 3])
        .foreach(item)
        .commit();
    }
    case 'sequential':
      return createWorkflow({ id: WORKFLOW_ID, inputSchema: countSchema, outputSchema: countSchema })
        .then(blocking)
        .then(passthrough)
        .commit();
    case 'sleep':
      return createWorkflow({ id: WORKFLOW_ID, inputSchema: countSchema, outputSchema: countSchema })
        .then(blocking)
        .sleep(50)
        .then(passthrough)
        .commit();
    case 'parallel':
      return createWorkflow({ id: WORKFLOW_ID, inputSchema: countSchema, outputSchema: z.any() })
        .parallel([blocking, passthrough])
        .commit();
  }
}

function withTimeout<T>(promise: Promise<T>): Promise<T | 'timed out'> {
  return Promise.race([
    promise,
    new Promise<'timed out'>(resolve => setTimeout(() => resolve('timed out'), SETTLE_TIMEOUT_MS)),
  ]);
}

type PubSubFactory = {
  name: string;
  create: () => { owner: PubSub; other: PubSub; cleanup: () => Promise<void> | void };
};

const PUBSUBS: PubSubFactory[] = [
  {
    name: 'EventEmitterPubSub',
    create: () => {
      const shared = new EventEmitterPubSub();
      return { owner: shared, other: shared, cleanup: () => {} };
    },
  },
  {
    name: 'UnixSocketPubSub',
    create: () => {
      const dir = mkdtempSync(join(tmpdir(), 'mastra-remote-cancel-'));
      const socketPath = join(dir, 'pubsub.sock');
      const owner = new UnixSocketPubSub(socketPath);
      const other = new UnixSocketPubSub(socketPath);
      return {
        owner,
        other,
        cleanup: async () => {
          await other.close();
          await owner.close();
          rmSync(dir, { recursive: true, force: true });
        },
      };
    },
  },
];

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

describe('evented workflow cancel from another instance', () => {
  describe.each(PUBSUBS)('$name', pubsubFactory => {
    it.each(SHAPES)("settles the owner's start() as canceled and aborts the step (%s)", async shape => {
      const storage = new MockStore();
      const { owner: ownerPubsub, other: otherPubsub, cleanup } = pubsubFactory.create();
      const blocker = createBlocker();
      const ownerWorkflow = buildWorkflow(shape, blocker);
      // A separate workflow object per instance, as in two processes: Workflow caches runs by id.
      const otherWorkflow = buildWorkflow(shape, createBlocker());
      const owner = new Mastra({
        logger: false,
        storage,
        pubsub: ownerPubsub,
        workflows: { [WORKFLOW_ID]: ownerWorkflow },
      });
      const other = new Mastra({
        logger: false,
        storage,
        pubsub: otherPubsub,
        workflows: { [WORKFLOW_ID]: otherWorkflow },
      });
      cleanups.push(cleanup, () => owner.stopWorkers());
      await owner.startWorkers();

      const run = await ownerWorkflow.createRun();
      const resultPromise = run.start({ inputData: { count: 0 } });
      await blocker.entered;

      const remoteRun = await otherWorkflow.createRun({ runId: run.runId });
      await remoteRun.cancel();

      const result = await withTimeout(resultPromise);
      expect(result === 'timed out' ? result : result.status).toBe('canceled');
      expect(blocker.state.aborted).toBe(true);

      const stored = await otherWorkflow.getWorkflowRunById(run.runId);
      expect(stored?.status).toBe('canceled');
    });
  });

  it('publishes workflow.cancel once and settles watchers when a startAsync run is canceled', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const blocker = createBlocker();
    const workflow = buildWorkflow('dountil', blocker);
    const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { [WORKFLOW_ID]: workflow } });
    cleanups.push(() => mastra.stopWorkers());
    await mastra.startWorkers();

    const events: string[] = [];
    await pubsub.subscribe('workflows', event => void events.push(event.type));

    const run = await workflow.createRun();
    let markFinished!: (status: string) => void;
    const finished = new Promise<string>(resolve => (markFinished = resolve));
    const unwatch = run.watch(event => {
      if (event.type === 'workflow-finish') markFinished(event.payload.workflowStatus);
    });
    cleanups.push(() => unwatch());

    await run.startAsync({ inputData: { count: 0 } });
    await blocker.entered;
    await run.cancel();

    expect(await withTimeout(finished)).toBe('canceled');
    expect(blocker.state.aborted).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(events.filter(type => type === 'workflow.cancel')).toHaveLength(1);
    expect(events.filter(type => type === 'workflow.end')).toHaveLength(1);
  });

  it('publishes a single workflow.cancel and workflow.end when the owner cancels its own run', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const blocker = createBlocker();
    const workflow = buildWorkflow('dountil', blocker);
    const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { [WORKFLOW_ID]: workflow } });
    cleanups.push(() => mastra.stopWorkers());
    await mastra.startWorkers();

    const events: string[] = [];
    await pubsub.subscribe('workflows', event => void events.push(event.type));

    const run = await workflow.createRun();
    const resultPromise = run.start({ inputData: { count: 0 } });
    await blocker.entered;
    await run.cancel();

    const result = await withTimeout(resultPromise);
    expect(result === 'timed out' ? result : result.status).toBe('canceled');
    // Let any late duplicate events land before counting.
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(events.filter(type => type === 'workflow.cancel')).toHaveLength(1);
    expect(events.filter(type => type === 'workflow.end')).toHaveLength(1);
  });
});
