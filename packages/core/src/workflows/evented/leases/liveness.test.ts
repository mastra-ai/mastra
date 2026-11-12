/**
 * The run liveness key a process keeps fresh while it handles events of an
 * evented run (#28712): which events keep it fresh, that nested runs keep
 * their ancestors fresh, how often it is written, that a slow store does not
 * get overlapping renewals, and that shutdown expires it once the drain is
 * done. Leases use a short TTL here, read when core loads.
 */
vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '600';
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { PubSub } from '../../../events/pubsub';
import type { Event } from '../../../events/types';
import type { IMastraLogger } from '../../../logger';
import { InMemoryStore } from '../../../storage/mock';
import { WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS, WORKFLOW_RUN_LEASE_TTL_MS } from '../../run-ownership';
import {
  Num,
  interceptWorkflowEvents,
  isStepRunAt,
  recordLeases,
  restartOutcome,
  runIsLive,
  sleep,
  startReplica,
  stopReplicas,
  track,
  work,
} from '../test-utils/lease-replicas';
import type { Built, Report } from '../test-utils/lease-replicas';
import { enterRunLiveness, runLivenessKey } from '.';

afterEach(stopReplicas);

/** A pubsub another instance could still deliver from: closing this instance leaves it open. */
function sharedPubsub(inner: PubSub): PubSub {
  return new Proxy(inner, {
    get(target, prop) {
      if (prop === 'close') {
        return undefined;
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

describe('evented run liveness (#28712)', () => {
  it.each([
    [
      'a step end',
      (report: Report) =>
        createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
          .then(work('first', report))
          .then(work('second', report))
          .commit(),
      // Published by the first step's end handler.
      (event: Event) => isStepRunAt(event, [1]),
    ],
    [
      'a parallel dispatcher',
      (report: Report) =>
        createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() })
          .parallel([work('a', report), work('b', report)])
          .commit(),
      // Published by the dispatcher of the parallel entry.
      (event: Event) => isStepRunAt(event, [0, 0]),
    ],
    [
      'a nested run start',
      (report: Report) =>
        createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() })
          .then(
            createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num }).then(work('inner', report)).commit(),
          )
          .commit(),
      // Published by the nested run's start handler.
      (event: Event) => isStepRunAt(event, [0]) && (event.data as { workflowId?: string }).workflowId === 'child',
    ],
  ] as const)(
    'keeps a run live while its replica handles %s between steps',
    async (_, build, inGap) => {
      const storage = new InMemoryStore();
      const handling = Promise.withResolvers<string>();
      const deliver = Promise.withResolvers<void>();
      // The handler stalls on its publish, so it is the only work of the run in flight.
      const pubsub = interceptWorkflowEvents(new EventEmitterPubSub(), event => {
        if (!inGap(event)) {
          return undefined;
        }

        handling.resolve(event.runId);
        return { hold: deliver.promise };
      });
      const a = await startReplica(storage, build(async () => {}) as unknown as Built, { pubsub });
      const run = await a.workflow.createRun();
      const result = run.start({ inputData: { n: 1 } });
      await handling.promise;

      await sleep(WORKFLOW_RUN_LEASE_TTL_MS * 2);
      expect(await runIsLive(storage, run.runId)).toBe(true);

      deliver.resolve();
      expect((await result).status).toBe('success');
    },
    20_000,
  );

  it.each(['then', 'foreach'] as const)(
    'keeps a parent run live while a step of a nested workflow it started with .%s() runs',
    async kind => {
      const storage = new InMemoryStore();
      const store = (await storage.getStore('workflows'))!;
      const tracked = track({ blocks: ['inner:1'] });
      const build = (replica: string) => {
        const report = tracked.reporter(replica);
        const child = createWorkflow({ id: 'child', inputSchema: Num, outputSchema: Num })
          .then(
            createStep({
              id: 'inner',
              inputSchema: Num,
              outputSchema: Num,
              execute: async ({ inputData }) => {
                await report(`inner:${inputData.n}`);
                return inputData;
              },
            }),
          )
          .commit();
        const parent =
          kind === 'then'
            ? createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: z.any() }).then(child).commit()
            : createWorkflow({ id: 'leased', inputSchema: z.array(Num), outputSchema: z.any() })
                .foreach(child, { concurrency: 2 })
                .commit();
        return { parent: parent as unknown as Built, child: child as unknown as Built };
      };
      const onA = build('A');
      const onB = build('B');
      const a = await startReplica(storage, onA.parent, { nested: { child: onA.child } });
      const b = await startReplica(storage, onB.parent, { nested: { child: onB.child } });
      const run = await a.workflow.createRun();
      const result = run.start({ inputData: (kind === 'then' ? { n: 1 } : [{ n: 1 }, { n: 2 }]) as any });
      await tracked.allBlocked;
      if (kind === 'foreach') {
        // The second item's nested run finished; only the first item's nested run still runs.
        await vi.waitFor(async () => {
          const snapshot = await store.loadWorkflowSnapshot({ workflowName: 'leased', runId: run.runId });
          expect((snapshot?.context.child as { output?: unknown[] } | undefined)?.output?.[1]).toBeTruthy();
        });
      }

      // The parent's step only dispatched the nested run and handles nothing while it works.
      await sleep(WORKFLOW_RUN_LEASE_TTL_MS + 100);
      expect(await runIsLive(storage, run.runId)).toBe(true);
      expect((await restartOutcome(b, run.runId)).id).toBe('WORKFLOW_RESTART_RUN_OWNED');

      tracked.release();
      expect((await result).status).toBe('success');
      expect(tracked.executions.sort()).toEqual(kind === 'then' ? ['A:inner:1'] : ['A:inner:1', 'A:inner:2']);
    },
    20_000,
  );

  it('writes the liveness of a run about once per renew interval however many of its steps run at once', async () => {
    const storage = new InMemoryStore();
    const leases = await recordLeases(storage);
    const workflow = createWorkflow({ id: 'leased', inputSchema: z.array(Num), outputSchema: z.any() })
      .foreach(
        work('item', async () => {}),
        { concurrency: 10 },
      )
      .commit();
    const a = await startReplica(storage, workflow as unknown as Built);
    const startedAt = Date.now();
    const result = await (
      await a.workflow.createRun()
    ).start({
      inputData: Array.from({ length: 10 }, (_, n) => ({ n })) as any,
    });
    expect(result.status).toBe('success');

    const writes = leases.claims.filter(c => c.key.endsWith('::live')).length;
    // The liveness timer ticks at the renew interval, or at a third of the TTL when that is shorter.
    const tick = Math.min(WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS, Math.floor(WORKFLOW_RUN_LEASE_TTL_MS / 3));
    expect(writes).toBeGreaterThanOrEqual(1);
    expect(writes).toBeLessThanOrEqual(1 + Math.ceil((Date.now() - startedAt) / tick));
  }, 20_000);

  it('writes no more run liveness while an earlier liveness write is still pending', async () => {
    vi.useFakeTimers();
    try {
      const store = (await new InMemoryStore().getStore('workflows'))!;
      const scope = { __shuttingDown: false };
      const claim = store.claimRunOwnership.bind(store);
      const stalled = Promise.withResolvers<void>();
      const livenessWrites: Record<string, number> = {};
      // The store stalls on the second liveness write of run `slow`.
      vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
        if (args.runId.endsWith('::live')) {
          livenessWrites[args.runId] = (livenessWrites[args.runId] ?? 0) + 1;
          if (args.runId === runLivenessKey('slow') && livenessWrites[args.runId] === 2) {
            await stalled.promise;
          }
        }
        return claim(args);
      });
      const leaves = [
        await enterRunLiveness({ scope, store, runId: 'slow' }),
        await enterRunLiveness({ scope, store, runId: 'fast' }),
      ];

      await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_TTL_MS * 4);

      // The tick waiting on `slow` holds the next one back, so `fast` is not written again meanwhile.
      expect(livenessWrites[runLivenessKey('slow')]).toBe(2);
      expect(livenessWrites[runLivenessKey('fast')]).toBe(2);

      stalled.resolve();
      for (const leave of leaves) {
        leave();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('renews the oldest liveness key first and warns once when a renewal pass outlasts its interval', async () => {
    vi.useFakeTimers();
    try {
      const store = (await new InMemoryStore().getStore('workflows'))!;
      const scope = { __shuttingDown: false };
      const logger = { warn: vi.fn() } as unknown as IMastraLogger;
      const claim = store.claimRunOwnership.bind(store);
      const written: string[] = [];
      let slow = false;
      vi.spyOn(store, 'claimRunOwnership').mockImplementation(async args => {
        written.push(args.runId);
        if (slow) {
          await new Promise(resolve => setTimeout(resolve, WORKFLOW_RUN_LEASE_RENEW_INTERVAL_MS * 2));
        }

        return claim(args);
      });
      const leaveOld = await enterRunLiveness({ scope, store, runId: 'old', logger });
      await vi.advanceTimersByTimeAsync(10);
      const leaveNew = await enterRunLiveness({ scope, store, runId: 'new', logger });
      // `old` comes back after `new`, while its key is still the one written first.
      leaveOld();
      const leaveOldAgain = await enterRunLiveness({ scope, store, runId: 'old', logger });
      written.length = 0;
      slow = true;

      await vi.advanceTimersByTimeAsync(WORKFLOW_RUN_LEASE_TTL_MS * 2);

      expect(written.slice(0, 2)).toEqual([runLivenessKey('old'), runLivenessKey('new')]);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(vi.mocked(logger.warn).mock.calls[0]![0]).toContain('took longer than its interval');

      leaveNew();
      leaveOldAgain();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a run live while its replica drains during shutdown', async () => {
    const storage = new InMemoryStore();
    const tracked = track({ blocks: ['a'] });
    const a = await startReplica(
      storage,
      createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
        .then(work('a', tracked.reporter('A')))
        .commit() as unknown as Built,
    );
    const run = await a.workflow.createRun();
    const result = run.start({ inputData: { n: 1 } });
    await tracked.allBlocked;

    const shutdown = a.mastra.shutdown({ drainTimeout: 20_000 });
    await sleep(WORKFLOW_RUN_LEASE_TTL_MS * 2);
    expect(await runIsLive(storage, run.runId)).toBe(true);

    tracked.release();
    expect((await result).status).toBe('success');
    await shutdown;
  }, 20_000);

  it.each([
    ['its own in-process pubsub', () => new EventEmitterPubSub() as PubSub],
    ['a pubsub another instance still delivers from', () => sharedPubsub(new EventEmitterPubSub())],
  ] as const)(
    'expires the liveness of its runs when an instance with %s shuts down',
    async (_, pubsub) => {
      const storage = new InMemoryStore();
      const store = (await storage.getStore('workflows'))!;
      const tracked = track({ blocks: ['a'] }, { hangForever: true });
      const build = () =>
        createWorkflow({ id: 'leased', inputSchema: Num, outputSchema: Num })
          .then(work('a', tracked.reporter('A')))
          .commit() as unknown as Built;
      const a = await startReplica(storage, build(), { pubsub: pubsub() });
      const ours = await a.workflow.createRun();
      void ours.start({ inputData: { n: 1 } });
      await tracked.allBlocked;
      const rewritten = await a.workflow.createRun();
      void rewritten.start({ inputData: { n: 2 } });
      await vi.waitFor(() => expect(tracked.executions).toHaveLength(2));
      // Another process vouches for the second run after this one's last write, just before the expiry.
      const renew = store.renewRunOwnership.bind(store);
      vi.spyOn(store, 'renewRunOwnership').mockImplementation(async args => {
        if (args.runId === runLivenessKey(rewritten.runId)) {
          await store.claimRunOwnership({
            runId: args.runId,
            ownerId: 'other-process',
            leaseMs: WORKFLOW_RUN_LEASE_TTL_MS,
            force: true,
          });
        }

        return renew(args);
      });

      const shutdownStartedAt = Date.now();
      await a.mastra.shutdown({ drainTimeout: 0 });

      // Expiry is set one millisecond out.
      const expired = await vi.waitFor(async () => {
        const record = await store.getRunOwnership({ runId: runLivenessKey(ours.runId) });
        expect(record).toMatchObject({ live: false });
        return record;
      });
      // Expired at shutdown rather than released: the record keeps the time this instance stopped.
      expect(expired!.leaseExpiresAt!.getTime()).toBeGreaterThanOrEqual(shutdownStartedAt);
      expect(expired!.leaseExpiresAt!.getTime()).toBeLessThanOrEqual(Date.now());
      expect(await store.getRunOwnership({ runId: runLivenessKey(rewritten.runId) })).toMatchObject({
        live: true,
        ownerId: 'other-process',
      });
    },
    20_000,
  );
});
