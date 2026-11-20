import { randomUUID } from 'node:crypto';
import type { EventCallback, PubSub } from '@mastra/core/events';
import { EventEmitterPubSub } from '@mastra/core/events';
import type { IMastraLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows/evented';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { makeOutageProxy, REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

/**
 * Callers of evented `run.start()` / `run.startAsync()` wait for their run's
 * `workflows-finish` event. These cover what a user sees when many runs are in
 * flight at once, and when the broker drops out while a run is being started.
 */

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function waitFor(check: () => boolean, timeoutMs: number, what: string) {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(20);
  }
}

/** Counts every invocation of a `workflows-finish` callback, keeping unsubscribe working. */
function countFinishDeliveries(pubsub: PubSub) {
  const stats = { deliveries: 0 };
  const wrapped = new Map<EventCallback, EventCallback>();
  const subscribe = pubsub.subscribe.bind(pubsub);
  const unsubscribe = pubsub.unsubscribe.bind(pubsub);
  pubsub.subscribe = async (topic, cb, opts) => {
    if (topic !== 'workflows-finish') return subscribe(topic, cb, opts);
    const w: EventCallback = (...args) => {
      stats.deliveries++;
      return cb(...args);
    };
    wrapped.set(cb, w);
    return subscribe(topic, w, opts);
  };
  pubsub.unsubscribe = async (topic, cb) => {
    const w = topic === 'workflows-finish' ? wrapped.get(cb) : undefined;
    if (!w) return unsubscribe(topic, cb);
    wrapped.delete(cb);
    return unsubscribe(topic, w);
  };
  return stats;
}

/** One step; runs with a negative `i` wait at `gate` until the test releases them. */
function makeWorkflow(id: string, gate: Promise<void>, counters: { started: number[]; finished: number }) {
  return createWorkflow({
    id,
    inputSchema: z.object({ i: z.number() }),
    outputSchema: z.object({ i: z.number() }),
    options: {
      onFinish: () => {
        counters.finished++;
      },
    },
  })
    .then(
      createStep({
        id: 'work',
        inputSchema: z.object({ i: z.number() }),
        outputSchema: z.object({ i: z.number() }),
        execute: async ({ inputData }) => {
          counters.started.push(inputData.i);
          if (inputData.i < 0) await gate;
          return inputData;
        },
      }),
    )
    .commit();
}

const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!().catch(() => {});
});

// Before the fix every waiting caller held its own `workflows-finish`
// subscription and filtered by runId, so each finish event was delivered to
// every waiting caller: N held runs finishing cost ~N²/2 (redis-streams) or N²
// (EventEmitter) callback invocations and drained slower the more runs were
// in flight. Now one subscription routes each finish to its own caller.
describe('many evented runs in flight at once', () => {
  const backends = {
    redis: (prefix: string) => new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: prefix, blockMs: 50 }),
    'event-emitter': () => new EventEmitterPubSub(),
  } as const;

  for (const backend of Object.keys(backends) as Array<keyof typeof backends>) {
    for (const method of ['start', 'startAsync'] as const) {
      for (const n of [10, 50, 150]) {
        it(
          `each finish reaches only its own caller (${backend}, ${method}, ${n} runs)`,
          { timeout: 120_000 },
          async () => {
            const id = `finish-fanout-${randomUUID()}`;
            let release!: () => void;
            const gate = new Promise<void>(r => (release = r));
            const counters = { started: [] as number[], finished: 0 };
            const workflow = makeWorkflow(id, gate, counters);
            const pubsub = backends[backend](id);
            const stats = countFinishDeliveries(pubsub);
            const mastra = new Mastra({ workflows: { workflow }, storage: new InMemoryStore(), pubsub, logger: false });
            cleanups.push(async () => {
              release();
              await mastra.stopWorkers();
              await pubsub.close?.();
            });
            await mastra.startWorkers();

            const wf = mastra.getWorkflow('workflow');
            const results: Array<Promise<{ status: string; result?: unknown }>> = [];
            const runIds: string[] = [];
            for (let i = 1; i <= n; i++) {
              const run = await wf.createRun();
              runIds.push(run.runId);
              if (method === 'start') results.push(run.start({ inputData: { i: -i } }));
              else await run.startAsync({ inputData: { i: -i } });
            }
            await waitFor(() => counters.started.length === n, 60_000, 'all steps running');
            const before = stats.deliveries;
            release();
            await waitFor(() => counters.finished === n, 60_000, 'every onFinish');

            // Every start() caller got its own run's result, not a neighbour's.
            const settled = await Promise.all(results);
            settled.forEach((r, idx) => expect(r).toMatchObject({ status: 'success', result: { i: -(idx + 1) } }));
            for (const runId of runIds) expect((await wf.getWorkflowRunById(runId))?.status).toBe('success');

            expect(stats.deliveries - before).toBeLessThanOrEqual(n);
          },
        );
      }
    }
  }
});

function captureErrors() {
  const errors: unknown[][] = [];
  const logger = {
    error: (...a: unknown[]) => errors.push(a),
    warn() {},
    info() {},
    debug() {},
    trackException() {},
    child() {
      return this;
    },
  } as unknown as IMastraLogger;
  return { errors, logger };
}

// Before the fix, when the broker went away while a run was being started the
// caller got an error but the run stayed `running` in storage forever, even
// after the broker came back: it had been written as `running` and the start
// event never reached a worker.
describe('broker outage while a run is being started', () => {
  async function setup({ publishRetryBudgetMs }: { publishRetryBudgetMs?: number } = {}) {
    const upstream = new URL(REDIS_URL);
    const proxy = makeOutageProxy({ host: upstream.hostname, port: Number(upstream.port) || 6379 });
    const port = await proxy.listening;
    const id = `finish-outage-${randomUUID()}`;
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const counters = { started: [] as number[], finished: 0 };
    const workflow = makeWorkflow(id, gate, counters);
    const pubsub = new RedisStreamsPubSub({
      url: `redis://127.0.0.1:${port}`,
      keyPrefix: id,
      blockMs: 50,
      ...(publishRetryBudgetMs !== undefined && { publishRetryBudgetMs }),
    });
    const { logger } = captureErrors();
    const mastra = new Mastra({ workflows: { workflow }, storage: new InMemoryStore(), pubsub, logger });
    cleanups.push(async () => {
      release();
      proxy.unpause();
      await proxy.start().catch(() => {});
      await mastra.stopWorkers().catch(() => {});
      await pubsub.close().catch(() => {});
      await proxy.close();
    });
    await mastra.startWorkers();
    return { proxy, counters, release, wf: mastra.getWorkflow('workflow') };
  }

  function track(call: Promise<unknown>) {
    const outcome = { state: 'pending' as 'pending' | 'resolved' | 'rejected', value: undefined as unknown };
    void call.then(
      v => Object.assign(outcome, { state: 'resolved', value: v }),
      e => Object.assign(outcome, { state: 'rejected', value: e }),
    );
    return outcome;
  }

  for (const method of ['start', 'startAsync'] as const) {
    it(`a run started while the broker is stopped fails instead of staying running (${method})`, async () => {
      const { proxy, counters, wf } = await setup();
      const run = await wf.createRun();
      await proxy.stop();

      const outcome = track(run[method]({ inputData: { i: 1 } }));
      await waitFor(() => outcome.state !== 'pending', 15_000, 'caller to settle');
      expect(outcome.state).toBe('rejected');

      // The broker comes back; nothing ever ran, and the run stays failed.
      await sleep(2_000);
      await proxy.start();
      await sleep(3_000);
      const snapshot = await wf.getWorkflowRunById(run.runId);
      expect(snapshot?.status).toBe('failed');
      expect(counters.started).not.toContain(1);
    });

    it(`a run whose start event can't be published before the retry budget runs out fails (${method})`, async () => {
      const { proxy, counters, release, wf } = await setup({ publishRetryBudgetMs: 2_000 });
      // Another caller is already waiting, so the finish subscription is live
      // and only the publish has to ride out the outage.
      const warm = await wf.createRun();
      const warmCall = warm.start({ inputData: { i: -1 } });
      await waitFor(() => counters.started.includes(-1), 10_000, 'warm run');

      const run = await wf.createRun();
      await proxy.stop();
      const outcome = track(run[method]({ inputData: { i: 1 } }));
      await waitFor(() => outcome.state !== 'pending', 15_000, 'caller to settle');
      expect(outcome.state).toBe('rejected');
      // Nothing reached a worker while the broker is down, so the run is failed rather than `running`.
      expect((await wf.getWorkflowRunById(run.runId))?.status).toBe('failed');

      await proxy.start();
      release();
      await expect(warmCall).resolves.toMatchObject({ status: 'success' });
      // What happens to `run` after the broker returns isn't asserted: redis-streams can still
      // deliver a publish that ran out of budget once it reconnects, so the run may later execute.
      // That's a redis-streams issue, separate from this fix.
    });

    it(`a run started while the broker is paused completes once it resumes (${method})`, async () => {
      const { proxy, counters, wf } = await setup();
      const run = await wf.createRun();
      proxy.pause();
      const outcome = track(run[method]({ inputData: { i: 1 } }));
      await sleep(4_000);
      proxy.unpause();

      await waitFor(() => counters.finished === 1, 20_000, 'run to finish');
      await waitFor(() => outcome.state !== 'pending', 5_000, 'caller to settle');
      expect(outcome.state).toBe('resolved');
      expect((await wf.getWorkflowRunById(run.runId))?.status).toBe('success');
    });
  }
});
