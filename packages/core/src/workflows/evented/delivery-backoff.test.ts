import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import { UnixSocketPubSub } from '../../events/unix-socket-pubsub';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { RedeliveryDriver } from './test-utils/redelivery-driver';
import { WorkflowEventProcessor } from './workflow-event-processor';
import { createStep, createWorkflow } from '.';

// A store error used to fail every delivery of an event within milliseconds, so a single
// connection reset failed the run. These cases use the real retry schedule (about 0.5-1 s,
// then 2-4 s), so outages are sized against it: one that spans two deliveries must be
// survived, and one that outlasts all three must fail the run.
beforeAll(() => {
  vi.stubEnv('MASTRA_TEST_FAST_WAITS', '0');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const transports: Array<[string, () => Promise<{ pubsub: PubSub; close: () => Promise<void> }>]> = [
  ['EventEmitterPubSub', async () => ({ pubsub: new EventEmitterPubSub(), close: async () => {} })],
  [
    'UnixSocketPubSub',
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'mastra-delivery-backoff-'));
      const pubsub = new UnixSocketPubSub(join(dir, 'events.sock'));
      return {
        pubsub,
        close: async () => {
          await pubsub.close();
          await rm(dir, { recursive: true, force: true });
        },
      };
    },
  ],
];

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => (resolve = r));
  return { promise, resolve };
}

/**
 * Two-step workflow on a real in-memory store whose snapshot reads fail for chosen runs, the
 * way a dropped Postgres connection fails them. `failures` records when each failed read
 * happened; a failed read ends its delivery, so it is one entry per failed delivery.
 */
async function setup(pubsub: PubSub, id: string) {
  const secondRuns: string[] = [];
  const afterFirst = new Map<string, () => void>();
  const workflow = createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.object({}) })
    .then(
      createStep({
        id: 'first',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async ({ runId }) => {
          afterFirst.get(runId)?.();
          return {};
        },
      }),
    )
    .then(
      createStep({
        id: 'second',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async ({ runId }) => {
          secondRuns.push(runId);
          return {};
        },
      }),
    )
    .commit();
  const storage = new MockStore();
  const mastra = new Mastra({ workflows: { [id]: workflow }, storage, pubsub, logger: false });
  const workflows = (await storage.getStore('workflows'))!;
  const load = workflows.loadWorkflowSnapshot.bind(workflows);
  const down = new Map<string, () => boolean>();
  const failures = new Map<string, number[]>();
  const failed = new Map<string, Array<() => void>>();
  workflows.loadWorkflowSnapshot = async args => {
    if (down.get(args.runId)?.()) {
      const at = failures.get(args.runId) ?? [];
      at.push(Date.now());
      failures.set(args.runId, at);
      failed
        .get(args.runId)
        ?.splice(0)
        .forEach(cb => cb());
      throw new Error('Connection terminated unexpectedly');
    }
    return load(args);
  };
  return {
    mastra,
    workflow,
    secondRuns,
    failuresOf: (runId: string) => failures.get(runId) ?? [],
    /** Runs `cb` when step "first" of the run executes. */
    afterFirst: (runId: string, cb: () => void) => afterFirst.set(runId, cb),
    /** Fails the run's snapshot reads while `isDown()` holds. */
    outage: (runId: string, isDown: () => boolean) => down.set(runId, isDown),
    /** Resolves on the run's next failed read. */
    nextFailure: (runId: string) => {
      const d = deferred();
      failed.set(runId, [...(failed.get(runId) ?? []), d.resolve]);
      return d.promise;
    },
  };
}

describe.each(transports)('evented delivery retries over %s', (_name, makeTransport) => {
  it('a run survives a 2 s database outage while other runs keep finishing', async () => {
    const transport = await makeTransport();
    const { mastra, workflow, outage, failuresOf, nextFailure, afterFirst } = await setup(
      transport.pubsub,
      'outage-two',
    );
    await mastra.startWorkers();
    try {
      const runA = await workflow.createRun();
      let outageStart = 0;
      // Down from step "first" for 2.2 s: the step.end delivery fails, its first retry
      // (0.5-1 s later) fails too, and the second retry (2.5 s or more after the first
      // failure) succeeds. A single fixed sleep, or a sleep on the first retry only, retries
      // inside the outage and fails the run.
      afterFirst(runA.runId, () => (outageStart = Date.now()));
      outage(runA.runId, () => outageStart > 0 && Date.now() < outageStart + 2_200);
      const firstFailure = nextFailure(runA.runId);
      const resultA = runA.start({ inputData: {} });
      await firstFailure;

      // A healthy run started while run A waits (0.5 s or more) must not queue behind it.
      const runBStartedAt = Date.now();
      const runB = await workflow.createRun();
      const resultB = await runB.start({ inputData: {} });
      const runBDoneAt = Date.now();

      const result = await Promise.race([
        resultA,
        new Promise<{ status: 'HANG' }>(resolve => setTimeout(() => resolve({ status: 'HANG' }), 15_000)),
      ]);
      const failures = failuresOf(runA.runId);
      expect(resultB.status).toBe('success');
      expect(result.status).toBe('success');
      expect(failures).toHaveLength(2);
      expect(runBDoneAt - runBStartedAt).toBeLessThan(400);
      expect(runBDoneAt).toBeLessThan(failures[1]!);
      expect(failures[1]! - failures[0]!).toBeGreaterThanOrEqual(400);
    } finally {
      await mastra.stopWorkers();
      await transport.close();
    }
  });

  it('stopping the workers hands a waiting event back without waiting out the retry delay', async () => {
    const transport = await makeTransport();
    const { mastra, workflow, outage, nextFailure, afterFirst } = await setup(transport.pubsub, 'outage-stop');
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      let armed = false;
      afterFirst(run.runId, () => (armed = true));
      outage(run.runId, () => armed);
      const secondFailure = (async () => {
        await nextFailure(run.runId);
        await nextFailure(run.runId);
      })();
      void run.start({ inputData: {} }).catch(() => {});
      await secondFailure;
      // The delivery now waits 2-4 s before its last retry.
      await new Promise(resolve => setTimeout(resolve, 20));
      const stopStarted = Date.now();
      await mastra.stopWorkers({ drainTimeout: 5_000 });
      expect(Date.now() - stopStarted).toBeLessThan(1_000);
    } finally {
      await mastra.stopWorkers();
      await transport.close();
    }
  });
});

describe('evented delivery retries', () => {
  it('a run whose database stays down past every retry ends failed instead of hanging', async () => {
    const pubsub = new EventEmitterPubSub();
    const { mastra, workflow, outage, failuresOf, afterFirst } = await setup(pubsub, 'outage-long');
    // The outage lasts until the engine gives up on the event, so its workflow.fail can be
    // recorded once the store is back.
    let failPublished = false;
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic, event, options) => {
      if (topic === 'workflows' && event.type === 'workflow.fail') failPublished = true;
      return publish(topic, event, options);
    };
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      let armed = false;
      afterFirst(run.runId, () => (armed = true));
      outage(run.runId, () => armed && !failPublished);
      const result = run.start({ inputData: {} });
      const settled = await Promise.race([
        result,
        new Promise<{ status: 'HANG' }>(resolve => setTimeout(() => resolve({ status: 'HANG' }), 15_000)),
      ]);
      const settledAt = Date.now();
      const failures = failuresOf(run.runId);
      expect(settled.status).toBe('failed');
      expect(failures).toHaveLength(3);
      // Both retry delays were spent before giving up.
      expect(failures[2]! - failures[0]!).toBeGreaterThanOrEqual(2_400);
      // No wait after the last attempt: the run fails as soon as the budget is spent.
      expect(settledAt - failures[2]!).toBeLessThan(1_500);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('drops a duplicate step.run that arrives while the failed delivery waits to retry', async () => {
    const driver = new RedeliveryDriver();
    const { mastra, workflow, outage, nextFailure, secondRuns } = await setup(driver.pubsub, 'outage-dup');
    driver.assertEvented(workflow);
    const run = await workflow.createRun();
    let outageStart = 0;
    // Down for 300 ms from the publish of step "second"'s step.run, so that delivery fails and
    // its retry (0.5 s or more later) succeeds.
    const publish = driver.pubsub.publish.bind(driver.pubsub);
    driver.pubsub.publish = async (topic, event, options) => {
      const path = (event.data as { executionPath?: number[] } | undefined)?.executionPath;
      if (topic === 'workflows' && event.type === 'workflow.step.run' && event.runId === run.runId && path?.[0] === 1) {
        outageStart ||= Date.now();
      }
      return publish(topic, event, options);
    };
    outage(run.runId, () => outageStart > 0 && Date.now() < outageStart + 300);
    await mastra.startWorkers();
    try {
      const failure = nextFailure(run.runId);
      const result = run.start({ inputData: {} });
      await failure;
      await new Promise(resolve => setTimeout(resolve, 50));
      // The failed delivery still holds its step fence while it waits, so a broker
      // duplicate is acknowledged as a duplicate instead of running the step.
      const { handled } = await driver.redeliver({ runId: run.runId, spec: 'outage-dup@1' });
      expect(handled.map(h => h.result)).toEqual([{ ok: true }]);
      expect((await result).status).toBe('success');
      expect(secondRuns).toEqual([run.runId]);
    } finally {
      await mastra.stopWorkers();
      driver.dispose();
    }
  });

  it('shutdown ends a pending retry delay within its drain deadline', async () => {
    const pubsub = new EventEmitterPubSub();
    const { mastra, workflow, outage, nextFailure, afterFirst } = await setup(pubsub, 'outage-shutdown');
    let inFlight = 0;
    const handle = WorkflowEventProcessor.prototype.handle;
    const spy = vi
      .spyOn(WorkflowEventProcessor.prototype, 'handle')
      .mockImplementation(async function (this: WorkflowEventProcessor, event) {
        inFlight++;
        try {
          return await handle.call(this, event);
        } finally {
          inFlight--;
        }
      });
    try {
      await mastra.startWorkers();
      const run = await workflow.createRun();
      let armed = false;
      afterFirst(run.runId, () => (armed = true));
      outage(run.runId, () => armed);
      const secondFailure = (async () => {
        await nextFailure(run.runId);
        await nextFailure(run.runId);
      })();
      void run.start({ inputData: {} }).catch(() => {});
      await secondFailure;
      // The delivery waits 2-4 s; shutdown spends its 1 s on the still-running run first.
      const started = Date.now();
      await mastra.shutdown({ drainTimeout: 1_000 });
      await new Promise(resolve => setImmediate(resolve));
      expect(Date.now() - started).toBeLessThan(1_800);
      expect(inFlight).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});
