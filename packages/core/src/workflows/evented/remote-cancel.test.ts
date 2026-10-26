import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import { UnixSocketPubSub } from '../../events/unix-socket-pubsub';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { WorkflowEventProcessor } from './workflow-event-processor';
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
  vi.restoreAllMocks();
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

  it('surfaces a failed workflow.cancel publish and lets the caller retry the cancel', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const blocker = createBlocker();
    const ownerWorkflow = buildWorkflow('sequential', blocker);
    const otherWorkflow = buildWorkflow('sequential', createBlocker());
    const owner = new Mastra({ logger: false, storage, pubsub, workflows: { [WORKFLOW_ID]: ownerWorkflow } });
    new Mastra({ logger: false, storage, pubsub, workflows: { [WORKFLOW_ID]: otherWorkflow } });
    cleanups.push(() => owner.stopWorkers());
    await owner.startWorkers();

    const publish = pubsub.publish.bind(pubsub);
    let failNextCancel = true;
    vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event) => {
      if (failNextCancel && topic === 'workflows' && event.type === 'workflow.cancel') {
        failNextCancel = false;
        throw new Error('pubsub unavailable');
      }
      return publish(topic, event);
    });

    const run = await ownerWorkflow.createRun();
    const resultPromise = run.start({ inputData: { count: 0 } });
    await blocker.entered;

    const remoteRun = await otherWorkflow.createRun({ runId: run.runId });
    await expect(remoteRun.cancel()).rejects.toThrow('pubsub unavailable');
    // Storage already says canceled; the retry must still publish rather than treat the run as finished.
    await remoteRun.cancel();

    const result = await withTimeout(resultPromise);
    expect(result === 'timed out' ? result : result.status).toBe('canceled');
    expect(blocker.state.aborted).toBe(true);
  });

  it('leaves the run cancelable from any instance when the workflow.cancel publish fails', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const blocker = createBlocker();
    const ownerWorkflow = buildWorkflow('sequential', blocker);
    const failingWorkflow = buildWorkflow('sequential', createBlocker());
    const retryWorkflow = buildWorkflow('sequential', createBlocker());
    const owner = new Mastra({ logger: false, storage, pubsub, workflows: { [WORKFLOW_ID]: ownerWorkflow } });
    new Mastra({ logger: false, storage, pubsub, workflows: { [WORKFLOW_ID]: failingWorkflow } });
    new Mastra({ logger: false, storage, pubsub, workflows: { [WORKFLOW_ID]: retryWorkflow } });
    cleanups.push(() => owner.stopWorkers());
    await owner.startWorkers();

    const publish = pubsub.publish.bind(pubsub);
    let failNextCancel = true;
    vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event) => {
      if (failNextCancel && topic === 'workflows' && event.type === 'workflow.cancel') {
        failNextCancel = false;
        throw new Error('pubsub unavailable');
      }
      return publish(topic, event);
    });

    const run = await ownerWorkflow.createRun();
    const resultPromise = run.start({ inputData: { count: 0 } });
    await blocker.entered;

    const failedRun = await failingWorkflow.createRun({ runId: run.runId });
    await expect(failedRun.cancel()).rejects.toThrow('pubsub unavailable');
    const workflowsStore = await storage.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: WORKFLOW_ID, runId: run.runId });
    expect(snapshot?.status).not.toBe('canceled');

    // A fresh handle carries no memory of the failed attempt; storage must not report the run as finished.
    const retryRun = await retryWorkflow.createRun({ runId: run.runId });
    await retryRun.cancel();

    const result = await withTimeout(resultPromise);
    expect(result === 'timed out' ? result : result.status).toBe('canceled');
    expect(blocker.state.aborted).toBe(true);
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

/**
 * `workflow.cancel` is consumed by one processor of the consumer group. With workers on several
 * replicas, the step it must abort may be running on another one: the cancelling processor has to
 * reach that step through the broadcast control topic.
 */
describe('evented workflow cancel with workers on both replicas', () => {
  const RUNS = 4;
  type Label = 'owner' | 'other';

  /** Mutable so one replica pair can serve several runs; records which replica ran the step. */
  function createSharedBlocker() {
    const holder = { current: createBlocker(), ranOn: [] as Label[] };
    const block = (label: Label) => async (abortSignal: AbortSignal) => {
      if (holder.current.state.calls === 0) holder.ranOn.push(label);
      await holder.current.block(abortSignal);
    };
    return { holder, block };
  }

  function buildBothWorkflow(nested: boolean, block: (abortSignal: AbortSignal) => Promise<void>) {
    const countSchema = z.object({ count: z.number() });
    const blocking = createStep({
      id: 'blocking',
      inputSchema: countSchema,
      outputSchema: countSchema,
      execute: async ({ inputData, abortSignal }) => {
        await block(abortSignal);
        return { count: inputData.count + 1 };
      },
    });
    if (!nested) {
      return createWorkflow({ id: WORKFLOW_ID, inputSchema: countSchema, outputSchema: countSchema })
        .then(blocking)
        .commit();
    }
    const child = createWorkflow({ id: `${WORKFLOW_ID}-child`, inputSchema: countSchema, outputSchema: countSchema })
      .then(blocking)
      .commit();
    return createWorkflow({ id: WORKFLOW_ID, inputSchema: countSchema, outputSchema: countSchema })
      .then(child)
      .commit();
  }

  // The replica that runs a step is not necessarily the one that handles the run's workflow.end, so
  // the step path must drop the abort controller and parent links it records for runs it did not start.
  it('does not leave step-recorded run state on replicas that never finalize the run', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const workflows = [0, 1].map(() => buildBothWorkflow(true, async () => {}));
    const [owner, other] = workflows.map(
      workflow => new Mastra({ logger: false, storage, pubsub, workflows: { [WORKFLOW_ID]: workflow } }),
    );
    cleanups.push(
      () => owner!.stopWorkers(),
      () => other!.stopWorkers(),
    );

    // Pin the topology: 'other' only runs steps, the owner starts and finalizes every run.
    const processors = new Map<Mastra, any>();
    const handle = WorkflowEventProcessor.prototype.handle;
    vi.spyOn(WorkflowEventProcessor.prototype, 'handle').mockImplementation(function (this: any, event) {
      processors.set(this.mastra, this);
      const target = processors.get(event.type === 'workflow.step.run' ? other! : owner!) ?? this;
      return handle.call(target, event);
    });

    await owner!.startWorkers();
    await other!.startWorkers();
    for (let i = 0; i < 4; i++) {
      const result = await withTimeout((await workflows[0]!.createRun()).start({ inputData: { count: 0 } }));
      expect(result === 'timed out' ? result : result.status).toBe('success');
    }

    const stepOnly = processors.get(other!);
    expect(stepOnly).toBeDefined();
    await vi.waitFor(
      () => {
        expect([...stepOnly.stepRunRefs.keys()]).toEqual([]);
        expect([...stepOnly.abortControllers.keys()]).toEqual([]);
        expect([...stepOnly.parentChildRelationships.keys()]).toEqual([]);
      },
      { timeout: SETTLE_TIMEOUT_MS },
    );
  });

  function createGate() {
    let reach!: () => void;
    let release!: () => void;
    const reached = new Promise<void>(resolve => (reach = resolve));
    const released = new Promise<void>(resolve => (release = resolve));
    return {
      reached,
      release,
      pass: async () => {
        reach();
        await released;
      },
    };
  }
  type Gate = ReturnType<typeof createGate>;

  /**
   * Pinned topology over one EventEmitterPubSub: 'other' runs every step, the owner handles every
   * other event (so it consumes workflow.cancel and finalizes). `gateControlSubscribe` delays the
   * step replica's subscribe to workflow.control until `subscribeGate` is released;
   * `gateNextStepRun` delays the next step-run handling on 'other' after the dispatch guard's
   * state load until the returned gate is released.
   */
  async function setupPinnedCancel(opts: { gateControlSubscribe?: boolean } = {}) {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const holder: { current?: Blocker } = {};
    const block = async (abortSignal: AbortSignal) => {
      await holder.current?.block(abortSignal);
    };
    const workflows = [0, 1].map(() => buildBothWorkflow(false, block));
    const [owner, other] = workflows.map(
      workflow => new Mastra({ logger: false, storage, pubsub, workflows: { [WORKFLOW_ID]: workflow } }),
    );
    cleanups.push(
      () => owner!.stopWorkers(),
      () => other!.stopWorkers(),
    );

    const processors = new Map<Mastra, any>();
    const handle = WorkflowEventProcessor.prototype.handle;
    vi.spyOn(WorkflowEventProcessor.prototype, 'handle').mockImplementation(function (this: any, event) {
      processors.set(this.mastra, this);
      const target = processors.get(event.type === 'workflow.step.run' ? other! : owner!) ?? this;
      return handle.call(target, event);
    });

    const ends = new Map<string, number>();
    const publish = pubsub.publish.bind(pubsub);
    vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event, ...rest) => {
      if (topic === 'workflows' && event.type === 'workflow.end')
        ends.set(event.runId, (ends.get(event.runId) ?? 0) + 1);
      return (publish as any)(topic, event, ...rest);
    });

    const subscribeGate = opts.gateControlSubscribe ? createGate() : undefined;
    let pendingSubscribeGate = subscribeGate;
    const subscribe = pubsub.subscribe.bind(pubsub);
    vi.spyOn(pubsub, 'subscribe').mockImplementation(async (topic, cb, options) => {
      if (topic === 'workflow.control' && pendingSubscribeGate) {
        const gate = pendingSubscribeGate;
        pendingSubscribeGate = undefined;
        await gate.pass();
      }
      return subscribe(topic, cb, options);
    });

    let nextStepRun: Gate | undefined;
    const stepRun = WorkflowEventProcessor.prototype['processWorkflowStepRun'];
    vi.spyOn(WorkflowEventProcessor.prototype as any, 'processWorkflowStepRun').mockImplementation(async function (
      this: any,
      ...args: any[]
    ) {
      if (nextStepRun) {
        const gate = nextStepRun;
        nextStepRun = undefined;
        await gate.pass();
      }
      return stepRun.apply(this, args as any);
    });

    const released: string[] = [];
    const retain = WorkflowEventProcessor.prototype['retainRunsForStep'];
    vi.spyOn(WorkflowEventProcessor.prototype as any, 'retainRunsForStep').mockImplementation(function (
      this: any,
      runIds: string[],
    ) {
      const release = retain.call(this, runIds);
      return () => {
        release();
        released.push(...runIds);
      };
    });

    await owner!.startWorkers();
    await other!.startWorkers();
    return {
      workflow: workflows[0]!,
      holder,
      ends,
      released,
      subscribeGate,
      gateNextStepRun: () => (nextStepRun = createGate()),
      stepProcessor: () => processors.get(other!),
    };
  }
  type PinnedCancel = Awaited<ReturnType<typeof setupPinnedCancel>>;

  async function runPlain(setup: PinnedCancel) {
    const result = await withTimeout((await setup.workflow.createRun()).start({ inputData: { count: 0 } }));
    expect(result === 'timed out' ? result : result.status).toBe('success');
  }

  // Release the gated step and check its run's own cancel was found before the step body started,
  // so the step never ran, and the run settled canceled with one workflow.end.
  async function expectStepSkipped(setup: PinnedCancel, gate: Gate, runId: string, blocker: Blocker) {
    setup.holder.current = blocker;
    gate.release();
    await vi.waitFor(() => expect(setup.released).toContain(runId), { timeout: SETTLE_TIMEOUT_MS });
    expect([...setup.stepProcessor().stepRunRefs.keys()]).toEqual([]);
    expect(blocker.state.calls).toBe(0);
    expect(setup.ends.get(runId)).toBe(1);
    const stored = await setup.workflow.getWorkflowRunById(runId);
    expect(stored?.status).toBe('canceled');
  }

  // Start a run whose step is held at `gate`, cancel it there, then release the step.
  async function cancelWhileGated(setup: PinnedCancel, gate: Gate) {
    const run = await setup.workflow.createRun();
    const resultPromise = run.start({ inputData: { count: 0 } });
    await gate.reached;
    await run.cancel();
    const result = await withTimeout(resultPromise);
    expect(result === 'timed out' ? result : result.status).toBe('canceled');
    await expectStepSkipped(setup, gate, run.runId, createBlocker());
  }

  // The abort broadcast is published while the step's processor is still subscribing to
  // workflow.control (`startFrom: 'latest'`), so it never reaches it; the storage re-check must.
  it('skips a step whose processor was not yet subscribed to workflow.control when the run was canceled', async () => {
    const setup = await setupPinnedCancel({ gateControlSubscribe: true });
    await cancelWhileGated(setup, setup.subscribeGate!);
  });

  // The subscription is long established, but the abort lands after the dispatch guard loaded the
  // run's state and before the step retained the run, so the processor had no step of it to abort.
  it('skips a step whose cancel arrived after its dispatch check but before the step was retained', async () => {
    const setup = await setupPinnedCancel();
    await runPlain(setup);

    const recheck = vi.spyOn(setup.stepProcessor(), 'abortRunsCanceledInStorage');
    await runPlain(setup);
    // Steady state: no storage re-check for an uncancelled step.
    expect(recheck).not.toHaveBeenCalled();

    await cancelWhileGated(setup, setup.gateNextStepRun());
    expect(recheck).toHaveBeenCalledTimes(1);
  });

  // A step dispatched while the subscription is still pending is canceled before the subscription
  // is ready, so its broadcast is neither delivered nor recorded. Other steps run after the
  // subscription is ready; the held step must still re-check storage when it resumes.
  it('skips a step dispatched while workflow.control was still subscribing, even after other steps ran', async () => {
    const setup = await setupPinnedCancel({ gateControlSubscribe: true });
    // Run A opens the subscription and waits on it.
    const runA = (await setup.workflow.createRun()).start({ inputData: { count: 0 } });
    await setup.subscribeGate!.reached;

    // Run X's step passes the dispatch guard while the subscription is pending, then is held.
    const stepGate = setup.gateNextStepRun();
    const runX = await setup.workflow.createRun();
    const resultX = runX.start({ inputData: { count: 0 } });
    await stepGate.reached;
    await runX.cancel();
    const settledX = await withTimeout(resultX);
    expect(settledX === 'timed out' ? settledX : settledX.status).toBe('canceled');

    // The subscription becomes ready; A finishes and run C's step starts after it is ready.
    setup.subscribeGate!.release();
    const settledA = await withTimeout(runA);
    expect(settledA === 'timed out' ? settledA : settledA.status).toBe('success');
    await runPlain(setup);

    await expectStepSkipped(setup, stepGate, runX.runId, createBlocker());
  });

  describe.each(PUBSUBS)('$name', pubsubFactory => {
    // UnixSocketPubSub delivers the ungrouped push `workflows` subscription to every replica that
    // owns the workflow, so both process each event (pre-existing; also true on main). Exactly-once
    // end, the cross-replica routing proof and repeated runs only apply where one replica consumes each event.
    const groupedDelivery = pubsubFactory.name === 'EventEmitterPubSub';
    // Without grouping, a nested run is executed on both replicas: a duplicate child can finish and
    // clean up the run while the first call is still blocking, so nested cases need grouped delivery.
    const cases = [
      { canceller: 'owner' as const, nested: false },
      { canceller: 'other' as const, nested: false },
      { canceller: 'owner' as const, nested: true },
      { canceller: 'other' as const, nested: true },
    ].filter(({ nested }) => groupedDelivery || !nested);
    it.each(cases)(
      'aborts the step wherever it runs (cancel from $canceller, nested: $nested)',
      async ({ canceller, nested }) => {
        const storage = new MockStore();
        const { owner: ownerPubsub, other: otherPubsub, cleanup } = pubsubFactory.create();
        const { holder, block } = createSharedBlocker();
        const ownerWorkflow = buildBothWorkflow(nested, block('owner'));
        const otherWorkflow = buildBothWorkflow(nested, block('other'));
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
        cleanups.push(
          cleanup,
          () => owner.stopWorkers(),
          () => other.stopWorkers(),
        );

        // Control subscriptions opened, per topic: one per processor, however many runs and steps.
        const controlSubscriptions = new Map<string, number>();
        const ends = new Map<string, number>();
        for (const pubsub of new Set([ownerPubsub, otherPubsub])) {
          const subscribe = pubsub.subscribe.bind(pubsub);
          const publish = pubsub.publish.bind(pubsub);
          vi.spyOn(pubsub, 'subscribe').mockImplementation(async (topic, cb, options) => {
            await subscribe(topic, cb, options);
            if (topic.startsWith('workflow.control')) {
              controlSubscriptions.set(topic, (controlSubscriptions.get(topic) ?? 0) + 1);
            }
          });
          vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event, ...rest) => {
            if (topic === 'workflows' && event.type === 'workflow.end' && !event.data?.parentWorkflow) {
              ends.set(event.runId, (ends.get(event.runId) ?? 0) + 1);
            }
            return (publish as any)(topic, event, ...rest);
          });
        }

        // Which replica finalized each cancel, to prove the cross-replica case was exercised.
        const cancelledOn: Label[] = [];
        const processCancel = WorkflowEventProcessor.prototype['processWorkflowCancel'];
        vi.spyOn(WorkflowEventProcessor.prototype as any, 'processWorkflowCancel').mockImplementation(function (
          this: any,
          args: any,
        ) {
          if (!args.parentWorkflow) cancelledOn.push(this.mastra === owner ? 'owner' : 'other');
          return processCancel.call(this, args);
        });

        await owner.startWorkers();
        await other.startWorkers();

        const processors = new Set<any>();
        const retain = WorkflowEventProcessor.prototype['retainRunsForStep'];
        vi.spyOn(WorkflowEventProcessor.prototype as any, 'retainRunsForStep').mockImplementation(function (
          this: any,
          runIds: any,
        ) {
          processors.add(this);
          return retain.call(this, runIds);
        });

        // Several runs let the consumer group route cancels to both replicas. Without grouping, duplicate
        // processing can leave a late step call that would take the next run's blocker, so run once.
        for (let i = 0; i < (groupedDelivery ? RUNS : 1); i++) {
          holder.current = createBlocker();
          const run = await ownerWorkflow.createRun();
          const resultPromise = run.start({ inputData: { count: 0 } });
          await holder.current.entered;

          const cancelWorkflow = canceller === 'owner' ? ownerWorkflow : otherWorkflow;
          await (await cancelWorkflow.createRun({ runId: run.runId })).cancel();

          const result = await withTimeout(resultPromise);
          expect(result === 'timed out' ? result : result.status).toBe('canceled');
          await vi.waitFor(() => expect(holder.current.state.aborted).toBe(true), { timeout: SETTLE_TIMEOUT_MS });
          await vi.waitFor(
            () => {
              for (const processor of processors) expect([...processor.stepRunRefs.keys()]).toEqual([]);
            },
            { timeout: SETTLE_TIMEOUT_MS },
          );
          if (groupedDelivery) {
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(ends.get(run.runId)).toBe(1);
          }
        }

        expect([...controlSubscriptions.keys()]).toEqual(['workflow.control']);
        expect(controlSubscriptions.get('workflow.control')).toBeLessThanOrEqual(processors.size);
        if (groupedDelivery) expect(cancelledOn.some((label, i) => label !== holder.ranOn[i])).toBe(true);
      },
    );
  });
});
