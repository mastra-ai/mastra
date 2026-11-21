/**
 * Regression for https://github.com/mastra-ai/mastra/issues/30774.
 *
 * A run that suspends and is never resumed must not stay in `workflow.runs` once
 * its suspension is persisted, unless something still watches it — on both engines.
 */

import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createWorkflow as createDefaultWorkflow } from '../create';
import { createStep as createDefaultStep } from '../workflow';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '.';

const engines = [
  { engine: 'default', createWorkflow: createDefaultWorkflow, createStep: createDefaultStep, evented: false },
  { engine: 'evented', createWorkflow: createEventedWorkflow, createStep: createEventedStep, evented: true },
] as const;

describe.each(engines)('$engine engine: suspended run eviction', ({ createWorkflow, createStep, evented }) => {
  let mastra: Mastra | undefined;
  let storage: MockStore | undefined;
  const others: Mastra[] = [];

  afterEach(async () => {
    if (evented) await Promise.all([mastra, ...others].map(host => host?.stopWorkers()));
    mastra = undefined;
    others.length = 0;
  });

  /** A resume waits in its resume-data validation until `validated()` resolves. */
  async function setup(validated: () => Promise<unknown> = async () => {}) {
    storage = new MockStore();
    mastra = await host(validated, storage);
    // Wrapped: a workflow has a builder `.then()`, so awaiting it directly never settles.
    return { workflow: mastra.getWorkflow('approval') };
  }

  /** Another process on the same storage as the one `setup` started. */
  async function otherProcess() {
    const other = await host(async () => {}, storage);
    others.push(other);
    return { workflow: other.getWorkflow('approval') };
  }

  async function host(validated: () => Promise<unknown>, storage: MockStore = new MockStore()) {
    const approve = createStep({
      id: 'approve',
      inputSchema: z.object({}),
      outputSchema: z.object({ by: z.string() }),
      resumeSchema: z.object({ by: z.string() }).refine(async () => {
        await validated();
        return true;
      }),
      execute: async ({ resumeData, suspend }: any) =>
        resumeData && resumeData.by !== 'again' ? { by: resumeData.by } : suspend({}),
    });
    const workflow = createWorkflow({
      id: 'approval',
      inputSchema: z.object({}),
      outputSchema: z.object({ by: z.string() }),
    })
      .then(approve)
      .commit();
    const created = new Mastra({
      logger: false,
      storage,
      ...(evented ? { pubsub: new EventEmitterPubSub() } : {}),
      workflows: { approval: workflow },
    });
    if (evented) await created.startWorkers();
    return created;
  }

  it('evicts a run once its suspension is persisted', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);

    const resumed = await (
      await workflow.createRun({ runId: run.runId })
    ).resume({
      step: 'approve',
      resumeData: { by: 'ana' },
    });
    expect(resumed.status).toBe('success');
  });

  it('evicts a run started in the background once its suspension is persisted', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    await run.startAsync({ inputData: {} });

    await expect.poll(async () => (await workflow.getWorkflowRunById(run.runId))?.status).toBe('suspended');
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('keeps a watched suspended run until its last watcher leaves', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    const unwatch = run.watch(() => {});
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(workflow.runs.has(run.runId)).toBe(true);

    unwatch();
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('keeps a run whose last watcher leaves while a resume of it is setting up', async () => {
    let validate!: () => void;
    const gate = new Promise<void>(resolve => (validate = resolve));
    const { workflow } = await setup(() => gate);
    const run = await workflow.createRun();
    const unwatch = run.watch(() => {});
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const resumed = run.resume({ step: 'approve', resumeData: { by: 'ana' } });
    unwatch();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(workflow.runs.get(run.runId)).toBe(run);

    validate();
    expect((await resumed).status).toBe('success');
  });

  it('evicts a run once a resume of a step that is not suspended is rejected', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    const unwatch = run.watch(() => {});
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    await expect(run.resume({ step: 'missing', resumeData: { by: 'ana' } })).rejects.toThrow();
    unwatch();
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('evicts a run once a resume with invalid resume data is rejected', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    const unwatch = run.watch(() => {});
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    await expect(run.resume({ step: 'approve', resumeData: { by: 1 } as any })).rejects.toThrow();
    unwatch();
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('keeps a run whose resume is setting up while another resume of it is rejected', async () => {
    let validate!: () => void;
    const gate = new Promise<void>(resolve => (validate = resolve));
    const { workflow } = await setup(() => gate);
    const run = await workflow.createRun();
    const unwatch = run.watch(() => {});
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const resumed = run.resume({ step: 'approve', resumeData: { by: 'ana' } });
    await expect(run.resume({ step: 'missing', resumeData: { by: 'bo' } })).rejects.toThrow();
    unwatch();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(workflow.runs.get(run.runId)).toBe(run);

    validate();
    expect((await resumed).status).toBe('success');
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('releases a run by the status its executions leave when their results arrive out of order', async () => {
    let validate!: () => void;
    let entered!: () => void;
    const olderValidating = new Promise<void>(resolve => (entered = resolve));
    let gate: Promise<void> | undefined;
    const { workflow } = await setup(async () => {
      entered();
      await gate;
    });
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    // The older resume waits in validation while a newer one suspends the run again.
    gate = new Promise<void>(resolve => (validate = resolve));
    const older = run.resume({ step: 'approve', resumeData: { by: 'ana' } });
    await olderValidating;
    gate = undefined;
    expect((await run.resume({ step: 'approve', resumeData: { by: 'again' } })).status).toBe('suspended');

    validate();
    expect((await older).status).toBe('success');
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('evicts a run started in the background when a resume rejected meanwhile', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    await run.startAsync({ inputData: {} });
    await expect(run.resume({ step: 'missing', resumeData: { by: 'ana' } })).rejects.toThrow();

    await expect.poll(async () => (await workflow.getWorkflowRunById(run.runId))?.status).toBe('suspended');
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('releases a finished run when an older execution reports its suspension after the finish', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    // Stands in for an evented background start whose result arrives after a newer resume finished.
    let report!: () => void;
    const reported = new Promise<void>(resolve => (report = resolve));
    const stale = run as unknown as {
      runExecution(
        execute: (epoch: number, holdUntil: (work: Promise<unknown>) => void) => Promise<void>,
      ): Promise<void>;
      releaseAfterExecution(status: 'suspended', epoch: number): Promise<void>;
    };
    await stale.runExecution(async (epoch, holdUntil) => {
      holdUntil(reported.then(() => stale.releaseAfterExecution('suspended', epoch)));
    });

    expect((await run.resume({ step: 'approve', resumeData: { by: 'ana' } })).status).toBe('success');
    report();
    await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
  });

  it('lets a reopened handle watch a resume driven through a handle held since before eviction', async () => {
    const { workflow } = await setup();
    const held = await workflow.createRun();
    expect((await held.start({ inputData: {} })).status).toBe('suspended');
    await expect.poll(() => workflow.runs.has(held.runId)).toBe(false);

    const reopened = await workflow.createRun({ runId: held.runId });
    expect(reopened).toBe(held);
    const events: unknown[] = [];
    const unwatch = reopened.watch(event => events.push(event));
    expect((await held.resume({ step: 'approve', resumeData: { by: 'ana' } })).status).toBe('success');
    await expect.poll(() => events.length).toBeGreaterThan(0);
    unwatch();
  });

  it('stops a step running through a reopened handle when a held handle cancels the run', async () => {
    let started!: () => void;
    const running = new Promise<void>(resolve => (started = resolve));
    const approve = createStep({
      id: 'approve',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      resumeSchema: z.object({}),
      execute: async ({ resumeData, suspend, abortSignal }: any) => {
        if (!resumeData) return suspend({});
        started();
        await new Promise(resolve => abortSignal.addEventListener('abort', resolve, { once: true }));
        return {};
      },
    });
    const built = createWorkflow({ id: 'approval', inputSchema: z.object({}), outputSchema: z.object({}) })
      .then(approve)
      .commit();
    mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      ...(evented ? { pubsub: new EventEmitterPubSub() } : {}),
      workflows: { approval: built },
    });
    if (evented) await mastra.startWorkers();
    const workflow = mastra.getWorkflow('approval');
    const held = await workflow.createRun();
    expect((await held.start({ inputData: {} })).status).toBe('suspended');
    await expect.poll(() => workflow.runs.has(held.runId)).toBe(false);

    const reopened = await workflow.createRun({ runId: held.runId });
    expect(reopened).toBe(held);
    const resumed = reopened.resume({ step: 'approve', resumeData: {} });
    await running;
    await held.cancel();
    expect((await resumed).status).toBe('canceled');
  }, 5_000);

  it('reopens a held run as that instance when it was evicted during an earlier reopen', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun();
    const unwatch = run.watch(() => {});
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    // The first reopen finds the watched run cached, then waits in its storage read.
    const store = (await mastra!.getStorage()!.getStore('workflows'))!;
    const gate = gateFirst(store);
    const first = workflow.createRun({ runId: run.runId });
    try {
      await gate.entered;
      // Meanwhile the run is evicted, and reopened again.
      unwatch();
      await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
      const second = workflow.createRun({ runId: run.runId });
      gate.release();
      expect(await first).toBe(run);
      expect(await second).toBe(run);
    } finally {
      gate.release();
    }
    expect(workflow.runs.get(run.runId)).toBe(run);
  });

  it('keeps a run another open of its id started while an earlier open read storage', async () => {
    const { workflow } = await setup();
    const runId = 'opened-twice';
    const store = (await mastra!.getStorage()!.getStore('workflows'))!;
    // The first open has read that no run is stored, and waits before it acts on that.
    const gate = gateFirst(store, { afterRead: true });
    const first = workflow.createRun({ runId });
    let suspended: Promise<unknown> | undefined;
    try {
      await gate.entered;
      suspended = workflow.createRun({ runId }).then(run => run.start({ inputData: {} }));
      // Gives an open that does not wait for the first one time to start and suspend the run; an
      // open that waits gets nowhere until the release.
      await Promise.race([suspended, new Promise(resolve => setTimeout(resolve, 200))]);
    } finally {
      gate.release();
    }
    await first;
    expect(((await suspended) as { status: string }).status).toBe('suspended');
    expect((await workflow.getWorkflowRunById(runId))?.status).toBe('suspended');
  });

  it('evicts a held handle whose resume is rejected because another process finished the run', async () => {
    const { workflow } = await setup();
    const held = await workflow.createRun();
    expect((await held.start({ inputData: {} })).status).toBe('suspended');
    await expect.poll(() => workflow.runs.has(held.runId)).toBe(false);

    const { workflow: other } = await otherProcess();
    const elsewhere = await other.createRun({ runId: held.runId });
    expect((await elsewhere.resume({ step: 'approve', resumeData: { by: 'ana' } })).status).toBe('success');

    await expect(held.resume({ step: 'approve', resumeData: { by: 'bo' } })).rejects.toThrow();
    await expect.poll(() => workflow.runs.has(held.runId)).toBe(false);
  });

  it('keeps the stored resourceId when a run is reopened without one', async () => {
    const { workflow } = await setup();
    const run = await workflow.createRun({ resourceId: 'user-1' });
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const { workflow: other } = await otherProcess();
    const reopened = await other.createRun({ runId: run.runId });
    expect(reopened.resourceId).toBe('user-1');
    expect((await reopened.resume({ step: 'approve', resumeData: { by: 'ana' } })).status).toBe('success');
    expect((await other.getWorkflowRunById(run.runId))?.resourceId).toBe('user-1');
  });

  it('does not reopen a held run resumed after its record was deleted', async () => {
    const { workflow } = await setup();
    const held = await workflow.createRun();
    expect((await held.start({ inputData: {} })).status).toBe('suspended');
    await expect.poll(() => workflow.runs.has(held.runId)).toBe(false);

    await workflow.deleteWorkflowRunById(held.runId);
    await held.resume({ step: 'approve', resumeData: { by: 'ana' } }).catch(() => {});
    const reopened = await workflow.createRun({ runId: held.runId });
    expect(reopened).not.toBe(held);
    expect(reopened.workflowRunStatus).toBe('pending');
  });

  it('does not reopen a held run whose record was deleted', async () => {
    const { workflow } = await setup();
    const held = await workflow.createRun();
    expect((await held.start({ inputData: {} })).status).toBe('suspended');
    await expect.poll(() => workflow.runs.has(held.runId)).toBe(false);

    await workflow.deleteWorkflowRunById(held.runId);
    const reopened = await workflow.createRun({ runId: held.runId });
    expect(reopened).not.toBe(held);
    expect(reopened.workflowRunStatus).toBe('pending');
  });

  it('does not keep a run whose record was deleted while an open of it read storage', async () => {
    const { workflow } = await setup();
    const held = await workflow.createRun();
    expect((await held.start({ inputData: {} })).status).toBe('suspended');
    await expect.poll(() => workflow.runs.has(held.runId)).toBe(false);
    const store = (await mastra!.getStorage()!.getStore('workflows'))!;
    // The open has read the suspended record, and waits before it acts on that.
    const gate = gateFirst(store, { afterRead: true });
    const opening = workflow.createRun({ runId: held.runId });
    let deleted: Promise<void> | undefined;
    try {
      await gate.entered;
      deleted = workflow.deleteWorkflowRunById(held.runId);
      await Promise.race([deleted, new Promise(resolve => setTimeout(resolve, 50))]);
    } finally {
      gate.release();
    }
    await opening;
    await deleted;
    expect(workflow.runs.has(held.runId)).toBe(false);
    const reopened = await workflow.createRun({ runId: held.runId });
    expect(reopened).not.toBe(held);
    expect(reopened.workflowRunStatus).toBe('pending');
  });

  it('frees an evicted run nobody holds, with its persistence override', async () => {
    const { workflow } = await setup();
    const engine = (workflow as any).executionEngine;
    let collected = false;
    const registry = new FinalizationRegistry(() => (collected = true));
    const persistAlways = () => true;
    const runId = await suspendUnheld(workflow, registry, persistAlways, evented);

    await expect
      .poll(
        async () => {
          collectGarbage();
          await new Promise(resolve => setTimeout(resolve, 10));
          return collected && engine.getRunPersistenceOverride(runId) === undefined;
        },
        { timeout: 10_000, interval: 50 },
      )
      .toBe(true);

    const reopened = await workflow.createRun({ runId });
    expect(reopened.resourceId).toBe('user-1');
    expect((await reopened.resume({ step: 'approve', resumeData: { by: 'ana' } })).status).toBe('success');
  });

  // Only the default engine keeps a per-run persistence override.
  it.runIf(!evented)(
    'drops the persistence override of a collected run that a reopen replaces before its finalizer runs',
    async () => {
      const { workflow } = await setup();
      const engine = (workflow as any).executionEngine;
      const registry = new FinalizationRegistry(() => {});
      const persistAlways = () => true;
      const runId = await suspendUnheld(workflow, registry, persistAlways, evented);
      // Collected, but its finalizer runs in a later task; the reopen starts before that.
      for (let i = 0; i < 100 && (workflow as any).liveRun(runId); i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
        collectGarbage();
      }
      expect((workflow as any).liveRun(runId)).toBeUndefined();
      expect(engine.getRunPersistenceOverride(runId)).toBe(persistAlways);

      const reopened = await workflow.createRun({ runId });
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(engine.getRunPersistenceOverride(runId)).toBeUndefined();
      expect((await reopened.resume({ step: 'approve', resumeData: { by: 'ana' } })).status).toBe('success');
    },
  );

  it.each(['start', 'resume'] as const)(
    'releases a run canceled during %s after its suspension is written but before the run settles',
    async execution => {
      const { workflow } = await setup();
      const run = await workflow.createRun();
      if (execution === 'resume') expect((await run.start({ inputData: {} })).status).toBe('suspended');
      const store = (await mastra!.getStorage()!.getStore('workflows'))!;
      let canceled: Promise<void> | undefined;
      let heldUntilCanceled = false;
      let restore = () => {};
      if (evented) {
        // The engine's suspended result waits until the cancel has finished, so it reaches the run late.
        const engine = (run as any).executionEngine;
        const execute = engine.execute;
        engine.execute = async (...args: unknown[]) => {
          const result = await execute.apply(engine, args);
          if (result.status === 'suspended' && !canceled) {
            await (canceled = run.cancel());
            heldUntilCanceled = true;
          }
          return result;
        };
        restore = () => {
          engine.execute = execute;
        };
      } else {
        // The cancel lands while the run releases its ownership lease, after the engine returned.
        const release = store.releaseRunOwnership.bind(store);
        store.releaseRunOwnership = async fence => {
          await (canceled ??= run.cancel());
          return release(fence);
        };
      }

      try {
        if (execution === 'start') await run.start({ inputData: {} });
        else await run.resume({ step: 'approve', resumeData: { by: 'again' } });
        expect(canceled).toBeDefined();
        await canceled;
        expect(heldUntilCanceled).toBe(evented);
        expect(run.workflowRunStatus).toBe('canceled');
        await expect.poll(() => workflow.runs.has(run.runId)).toBe(false);
        expect((await workflow.getWorkflowRunById(run.runId))?.status).toBe('canceled');
      } finally {
        restore();
      }
    },
  );
});

/** Suspends a run in a frame of its own, so nothing in the calling test keeps it. */
async function suspendUnheld(
  workflow: any,
  registry: FinalizationRegistry<undefined>,
  shouldPersistSnapshot: () => boolean,
  evented: boolean,
): Promise<string> {
  const run = await workflow.createRun({ resourceId: 'user-1', shouldPersistSnapshot });
  registry.register(run, undefined);
  const runId: string = run.runId;
  expect((await run.start({ inputData: {} })).status).toBe('suspended');
  // Not expect.poll: vitest keeps a poll's callback, and with it the run, until the test ends.
  for (let tries = 0; workflow.runs.has(runId); tries++) {
    if (tries > 100) throw new Error('the suspended run was not evicted');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  // Only the default engine keeps a per-run persistence override.
  if (!evented) expect(workflow.executionEngine.getRunPersistenceOverride(runId)).toBeDefined();
  return runId;
}

/** Holds the first storage read of a run's record until `release()`, before or after it reads. */
function gateFirst(store: any, { afterRead = false } = {}) {
  let release!: () => void;
  const released = new Promise<void>(resolve => (release = resolve));
  let enter!: () => void;
  const entered = new Promise<void>(resolve => (enter = resolve));
  let gated = false;
  for (const method of ['loadWorkflowRunHeader', 'getWorkflowRunById']) {
    const original = store[method].bind(store);
    store[method] = async (...args: unknown[]) => {
      if (gated) return original(...args);
      gated = true;
      const read = afterRead ? await original(...args) : undefined;
      enter();
      await released;
      return afterRead ? read : original(...args);
    };
  }
  return { entered, release };
}

function collectGarbage() {
  const gc =
    (globalThis as { gc?: () => void }).gc ?? (setFlagsFromString('--expose-gc'), runInNewContext('gc') as () => void);
  gc();
}
