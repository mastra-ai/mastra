/**
 * Booting replicas restart every active evented run they find, including runs
 * another replica is still executing (#28712). An evented run holds no run
 * lease. The worker running a step holds a lease on that step occurrence and
 * keeps the run's liveness key fresh, and `restart()` refuses while the run is
 * live, so each step runs once however many replicas boot.
 *
 * These cases cover the step lease itself: duplicate deliveries waiting for
 * the holder, retries handing the lease on, and deliveries of a crashed or
 * shutting-down holder. Leases use a short TTL here, read when core loads.
 */
vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../../run-ownership';
import { abandonLease } from '../test-utils/abandon-lease';
import {
  Num,
  crash,
  delayReleases,
  interceptWorkflowEvents,
  isStepRunAt,
  recordLeases,
  replicas,
  runStatus,
  scanning,
  shapes,
  sleep,
  startReplica,
  stepRunningOnA,
  stopReplicas,
  track,
  work,
} from '../test-utils/lease-replicas';
import type { Built, Report } from '../test-utils/lease-replicas';
import { runLivenessKey, stepOccurrenceKey } from '.';

afterEach(stopReplicas);

describe('evented step leases (#28712)', () => {
  it.each(Object.keys(shapes) as (keyof typeof shapes)[])(
    '%s: a redelivered step another replica is running waits and is dropped once that replica finishes it',
    async name => {
      const shape = shapes[name];
      const storage = new InMemoryStore();
      await delayReleases(storage);
      const tracked = track(shape);
      const delivered: Event[] = [];
      const a = await startReplica(storage, shape.build(tracked.reporter('A')));
      const b = await startReplica(storage, shape.build(tracked.reporter('B')));
      await a.pubsub.subscribe('workflows', event => {
        if (event.type === 'workflow.step.run') delivered.push(structuredClone(event));
      });

      const result = (await a.workflow.createRun()).start({ inputData: shape.input as any });
      await tracked.allBlocked;

      // The broker redelivers the messages of the running occurrences to B.
      const leases = await recordLeases(storage);
      const redeliveries = shape.running.map(path => {
        const event = delivered.findLast(e => isStepRunAt(e, path))!;
        return b.mastra.handleWorkflowEvent({ ...event, deliveryAttempt: 2 });
      });
      await Promise.race([
        leases.until(() => leases.claims.filter(c => !c.acquired).length >= shape.running.length),
        tracked.otherReplicaRan.promise,
      ]);
      tracked.release();

      expect((await result).status).toBe('success');
      expect(await Promise.all(redeliveries)).toEqual(shape.running.map(() => ({ ok: true })));
      expect(tracked.executions.sort()).toEqual(shape.labels.map(label => `A:${label}`).sort());
    },
    20_000,
  );

  it('runs every retry of a failing step once while its first attempt is redelivered', async () => {
    const storage = new InMemoryStore();
    await delayReleases(storage);
    const executions: string[] = [];
    const firstAttempt = Promise.withResolvers<void>();
    const failFirstAttempt = Promise.withResolvers<void>();
    const otherReplicaRan = Promise.withResolvers<void>();
    const build = (replica: string) => {
      let attempts = 0;
      const flaky = createStep({
        id: 'flaky',
        inputSchema: Num,
        outputSchema: Num,
        execute: async ({ inputData }) => {
          executions.push(`${replica}:attempt-${++attempts}`);
          if (replica !== 'A') otherReplicaRan.resolve();
          else if (attempts === 1) {
            firstAttempt.resolve();
            await failFirstAttempt.promise;
            throw new Error('transient');
          }
          return inputData;
        },
      });
      return createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num, retryConfig: { attempts: 1 } })
        .then(flaky)
        .commit();
    };
    const a = await startReplica(storage, build('A'));
    const b = await startReplica(storage, build('B'));
    let firstDelivery: Event | undefined;
    await a.pubsub.subscribe('workflows', event => {
      if (isStepRunAt(event, [0])) firstDelivery ??= structuredClone(event);
    });

    const result = (await a.workflow.createRun()).start({ inputData: { n: 1 } });
    await firstAttempt.promise;
    const leases = await recordLeases(storage);
    const redelivery = b.mastra.handleWorkflowEvent({ ...firstDelivery!, deliveryAttempt: 2 });
    await Promise.race([leases.until(() => leases.claims.some(c => !c.acquired)), otherReplicaRan.promise]);
    // The retry takes the lease over from the failed attempt; B keeps waiting behind it.
    failFirstAttempt.resolve();

    expect((await result).status).toBe('success');
    expect(await redelivery).toEqual({ ok: true });
    expect(executions).toEqual(['A:attempt-1', 'A:attempt-2']);
  }, 20_000);

  it('runs a retry whose first receiver crashed after taking it over', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const executions: string[] = [];
    const retried = Promise.withResolvers<Event>();
    // The retry A publishes goes to another replica instead of A.
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event =>
      event.type === 'workflow.step.run' && (event.data as { retryCount?: number }).retryCount === 1
        ? { divert: retried.resolve }
        : undefined,
    );
    const build = (replica: string) =>
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num, retryConfig: { attempts: 1 } })
        .then(
          createStep({
            id: 'flaky',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              executions.push(replica);
              if (replica === 'A') throw new Error('transient');
              return inputData;
            },
          }),
        )
        .commit();
    const a = await startReplica(storage, build('A'), { pubsub });
    const b = await startReplica(storage, build('B'));
    const run = await a.workflow.createRun();
    void run.start({ inputData: { n: 1 } });
    const retry = await retried.promise;

    // The replica the retry went to first took the step lease over, then crashed before running it.
    const { key, generation } = (retry.data as { stepLeaseHandoff: { key: string; generation: number } })
      .stepLeaseHandoff;
    await store.claimRunOwnership({
      runId: key,
      ownerId: 'crashed-adopter',
      leaseMs: 1,
      force: true,
      expectedGeneration: generation,
    });
    await vi.waitFor(async () => expect(await store.getRunOwnership({ runId: key })).toMatchObject({ live: false }));

    expect(await b.mastra.handleWorkflowEvent({ ...retry, deliveryAttempt: 2 })).toEqual({ ok: true });
    expect(executions).toEqual(['A', 'B']);
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
  }, 20_000);

  it('runs a failed step again at once when publishing its retry failed', async () => {
    const storage = new InMemoryStore();
    const leases = await recordLeases(storage);
    let attempts = 0;
    let rejected = false;
    const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
      if (rejected || event.type !== 'workflow.step.run' || (event.data as { retryCount?: number }).retryCount !== 1) {
        return undefined;
      }
      rejected = true;
      return { reject: new Error('broker unavailable') };
    });
    const workflow = createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num, retryConfig: { attempts: 1 } })
      .then(
        createStep({
          id: 'flaky',
          inputSchema: Num,
          outputSchema: Num,
          execute: async () => {
            attempts++;
            throw new Error('transient');
          },
        }),
      )
      .commit();
    const a = await startReplica(storage, workflow as unknown as Built, { pubsub });
    const run = await a.workflow.createRun();
    expect((await run.start({ inputData: { n: 1 } })).status).toBe('failed');

    // The delivery whose retry could not be published is redelivered and runs the first attempt
    // again, then the retry runs. The redelivery finds the step lease released, so it does not
    // wait for the lease to expire first.
    expect(rejected).toBe(true);
    expect(attempts).toBe(3);
    expect(leases.claims.filter(c => c.key === stepOccurrenceKey(run.runId, [0]) && !c.acquired)).toEqual([]);
  }, 20_000);

  it('continues a run once from the replica that took over a step whose holder stalled past its lease', async () => {
    const { storage, tracked, a, b, run, delivery } = await stepRunningOnA();
    const stepEnds: string[] = [];
    for (const [name, replica] of [
      ['A', a],
      ['B', b],
    ] as const) {
      await replica.pubsub.subscribe('workflows', event => {
        if (event.type === 'workflow.step.end') {
          stepEnds.push(name);
        }
      });
    }

    // A stalls past its lease, and the broker redelivers its message to B, which runs the step.
    await abandonLease(storage, stepOccurrenceKey(run.runId, [0]));
    expect(await b.mastra.handleWorkflowEvent({ ...delivery, deliveryAttempt: 2 })).toEqual({ ok: true });
    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));

    // A's step finishes afterwards; shutting A down waits for its handler.
    tracked.release();
    await a.mastra.shutdown();

    expect(tracked.executions).toEqual(['A:a', 'B:a']);
    expect(stepEnds).toEqual(['B']);
    expect(await runStatus(storage, run.runId)).toBe('success');
  }, 20_000);

  // Replicas that shut down while a delivery waited for A handed it back, and the broker counted
  // every hand-back as a delivery attempt, so a delivery can arrive with its attempts used up.
  it.each([
    ['hands a waiting delivery back to the broker when its replica shuts down', 2, 'while waiting', true],
    ['does not fail a run when a delivery of its running step has used up its attempts', 10, undefined, false],
    // B is going away, so it hands the delivery back for a replica that stays rather than acknowledge it.
    [
      'hands an exhausted delivery of a running step back to the broker when its replica shuts down',
      10,
      'before',
      true,
    ],
  ] as const)(
    '%s',
    async (_, deliveryAttempt, shutdown, handedBack) => {
      const { storage, tracked, b, result, delivery } = await stepRunningOnA();
      const leases = await recordLeases(storage);

      let stopping = shutdown === 'before' ? b.mastra.shutdown({ drainTimeout: 0 }) : undefined;
      const handled = b.mastra.handleWorkflowEvent({ ...delivery, deliveryAttempt });
      if (shutdown === 'while waiting') {
        await leases.until(() => leases.claims.some(c => !c.acquired));
        stopping = b.mastra.shutdown({ drainTimeout: 0 });
      }

      expect(await Promise.race([handled, sleep(WORKFLOW_RUN_LEASE_TTL_MS * 3).then(() => 'still waiting')])).toEqual(
        handedBack ? { ok: false, retry: true } : { ok: true },
      );
      await stopping;
      tracked.release();
      expect((await result).status).toBe('success');
      expect(tracked.executions).toEqual(['A:a']);
    },
    20_000,
  );

  it.each([
    ['runs a redelivered step once the lease of its crashed worker expires', 2, false],
    // Replicas that shut down while this delivery waited for A handed it back, then A crashed.
    ['runs a step whose deliveries used up their attempts deferring to a replica that then crashed', 5, true],
  ] as const)(
    '%s',
    async (_, deliveryAttempt, lapsed) => {
      const { storage, tracked, a, b, run, delivery } = await stepRunningOnA({ hangForever: true });
      const store = (await storage.getStore('workflows'))!;
      const key = stepOccurrenceKey(run.runId, [0]);

      // A crashes mid-step: its lease stops being renewed and runs out one TTL later, or already ran out.
      await a.mastra.shutdown({ drainTimeout: 0 });
      if (lapsed) {
        await abandonLease(storage, key, runLivenessKey(run.runId));
      } else {
        await store.claimRunOwnership({
          runId: key,
          ownerId: 'crashed-worker',
          leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
          force: true,
        });
      }
      const expiresAt = (await store.getRunOwnership({ runId: key }))!.leaseExpiresAt!.getTime();

      // The broker redelivers A's unacknowledged message to B.
      expect(await b.mastra.handleWorkflowEvent({ ...delivery, deliveryAttempt })).toEqual({ ok: true });

      expect(tracked.executions).toEqual(['A:a', 'B:a']);
      expect(tracked.at['B:a']).toBeGreaterThanOrEqual(expiresAt);
      await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'));
    },
    20_000,
  );

  it('recovers a run once when the replica running its step crashes after an exhausted delivery was dropped', async () => {
    const { storage, tracked, a, b, run, delivery } = await stepRunningOnA({
      hangForever: true,
      b: { recovery: scanning },
    });
    expect(await b.mastra.handleWorkflowEvent({ ...delivery, deliveryAttempt: 10 })).toEqual({ ok: true });

    // The dropped delivery can no longer bring the step back; B's recovery loop restarts the run.
    await crash(a, storage, [stepOccurrenceKey(run.runId, [0]), runLivenessKey(run.runId)]);

    await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 15_000 });
    expect(tracked.executions).toEqual(['A:a', 'B:a']);
  }, 30_000);

  it.each([
    ['recovers a parent run', true],
    ['does not restart an opted-out parent run', false],
  ] as const)(
    '%s whose nested step dropped an exhausted delivery before its replica crashed',
    async (_, restartable) => {
      const storage = new InMemoryStore();
      const executions: string[] = [];
      const build = (replica: string) => {
        const child = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
          .then(
            createStep({
              id: 'inner',
              inputSchema: Num,
              outputSchema: Num,
              execute: async ({ inputData }) => {
                executions.push(replica);
                if (replica === 'A') await new Promise<never>(() => {});
                return inputData;
              },
            }),
          )
          .commit();
        const parent = createWorkflow({
          id: 'leased',
          inputSchema: Num,
          outputSchema: z.any(),
          options: restartable ? undefined : { autoRestartActiveRuns: false },
        })
          .then(child)
          .commit();
        return { parent: parent as unknown as Built, child: child as unknown as Built };
      };
      const onA = build('A');
      const onB = build('B');
      const a = await startReplica(storage, onA.parent, { nested: { child: onA.child } });
      const b = await startReplica(storage, onB.parent, { nested: { child: onB.child }, recovery: scanning });
      let delivery: Event | undefined;
      await a.pubsub.subscribe('workflows', event => {
        // A nested event carries its parent's step graph; the broker delivers it serialized.
        if (event.type === 'workflow.step.run' && (event.data as { workflowId?: string }).workflowId === 'child') {
          delivery = JSON.parse(JSON.stringify(event));
        }
      });
      const run = await a.workflow.createRun();
      void run.start({ inputData: { n: 1 } });
      await vi.waitFor(() => expect(executions).toEqual(['A']));
      expect(await b.mastra.handleWorkflowEvent({ ...delivery!, deliveryAttempt: 10 })).toEqual({ ok: true });

      await crash(a, storage, [
        stepOccurrenceKey(delivery!.runId, [0]),
        runLivenessKey(delivery!.runId),
        runLivenessKey(run.runId),
      ]);

      if (restartable) {
        await vi.waitFor(async () => expect(await runStatus(storage, run.runId)).toBe('success'), { timeout: 10_000 });
        expect(executions).toEqual(['A', 'B']);
      } else {
        // Past the point B's loop restarts the restartable parent.
        await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 3_000);
        expect(executions).toEqual(['A']);
        expect(await runStatus(storage, run.runId)).toBe('running');
      }
    },
    20_000,
  );

  it('takes no step lease and no liveness for a workflow that opted out of restarts', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('workflows'))!;
    const report: Report = async () => {};
    const optedOut = createWorkflow({
      id: 'opted-out',
      inputSchema: Num,
      outputSchema: Num,
      options: { autoRestartActiveRuns: false },
    })
      .then(work('a', report))
      .commit();
    const leased = shapes.step.build(report);
    const mastra = new Mastra({ logger: false, storage, workflows: { optedOut, leased } });
    replicas.push(mastra);
    await mastra.startWorkers();

    const optedOutRun = await optedOut.createRun();
    const leasedRun = await leased.createRun();
    expect((await optedOutRun.start({ inputData: { n: 1 } })).status).toBe('success');
    expect((await leasedRun.start({ inputData: { n: 1 } })).status).toBe('success');

    const lease = (key: string) => store.getRunOwnership({ runId: key });
    expect(await lease(stepOccurrenceKey(optedOutRun.runId, [0]))).toBeNull();
    expect(await lease(runLivenessKey(optedOutRun.runId))).toBeNull();
    expect(await lease(stepOccurrenceKey(leasedRun.runId, [0]))).toMatchObject({ live: false });
    expect(await lease(runLivenessKey(leasedRun.runId))).toMatchObject({ live: true });
  });
});
