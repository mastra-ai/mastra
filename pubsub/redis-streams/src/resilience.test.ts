import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  countMarker,
  flushRedis,
  getFreePort,
  killProcess,
  makeStorageDir,
  PACKAGE_DIR,
  REDIS_URL,
  spawnFixture,
  waitFor,
  waitForLine,
  waitForServerHttp,
} from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';

const SERVER_ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/app.server.entry.ts');
const WORKER_ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/app.worker.entry.ts');
const SCHEDULER_ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/app.worker.entry.ts');

/**
 * Resilience and concurrency tests for the multi-process worker
 * topology. Each test spins up its own cluster against shared Redis
 * (different libsql file per test) so no state bleeds across.
 */
describe('worker resilience and concurrency', () => {
  let storage: { dir: string; storageUrl: string; cleanup: () => Promise<void> };
  const tracked: ManagedProcess[] = [];

  function track(proc: ManagedProcess): ManagedProcess {
    tracked.push(proc);
    return proc;
  }

  beforeAll(async () => {
    await flushRedis();
  }, 10_000);

  afterEach(async () => {
    while (tracked.length > 0) {
      const p = tracked.pop();
      await killProcess(p);
    }
    await storage?.cleanup();
  });

  afterAll(async () => {
    await flushRedis();
  });

  it('competing orchestration consumers split work and never duplicate step execution', async () => {
    await flushRedis();
    storage = await makeStorageDir('mastra-resilience-cc-');
    const port = await getFreePort();
    const serverUrl = `http://localhost:${port}`;

    const server = track(
      spawnFixture({
        entry: SERVER_ENTRY,
        label: 'server',
        env: { MASTRA_WORKERS: 'false', REDIS_URL, STORAGE_URL: storage.storageUrl, PORT: String(port) },
      }),
    );
    await waitForLine(server, 'server-ready');
    await waitForServerHttp(serverUrl);

    const workerA = track(
      spawnFixture({
        entry: WORKER_ENTRY,
        label: 'workerA',
        env: {
          MASTRA_WORKERS: 'orchestration',
          REDIS_URL,
          STORAGE_URL: storage.storageUrl,
          MASTRA_STEP_EXECUTION_URL: `${serverUrl}/api`,
        },
      }),
    );
    const workerB = track(
      spawnFixture({
        entry: WORKER_ENTRY,
        label: 'workerB',
        env: {
          MASTRA_WORKERS: 'orchestration',
          REDIS_URL,
          STORAGE_URL: storage.storageUrl,
          MASTRA_STEP_EXECUTION_URL: `${serverUrl}/api`,
        },
      }),
    );
    await Promise.all([waitForLine(workerA, 'worker-ready'), waitForLine(workerB, 'worker-ready')]);

    const N = 6;
    const before = countMarker(server, 'step-execute-hit');
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        fetch(`${serverUrl}/api/workflows/cross-process-pipeline/start-async`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ inputData: { name: `parallel-${i}` } }),
        }).then(r => r.json() as Promise<{ status: string }>),
      ),
    );

    // start-async may return either 'success' (workflow finished within
    // the request) or 'running' (still pending). Both are healthy — the
    // important property is that step-execute-hit markers cover all runs
    // and don't catastrophically duplicate.
    expect(results.every(r => r.status === 'success' || r.status === 'running')).toBe(true);

    // Wait until the server has seen at least 3*N step-execute-hits (one
    // per step per run). Polling is necessary because 'running' results
    // mean steps may still be in flight.
    await (async () => {
      const start = Date.now();
      while (Date.now() - start < 30_000) {
        if (countMarker(server, 'step-execute-hit') - before >= 3 * N) return;
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error(
        `Timed out waiting for ${3 * N} step-execute-hit markers. Saw ${countMarker(server, 'step-execute-hit') - before}.`,
      );
    })();

    // Give a small grace window for any duplicate redeliveries to surface,
    // then assert exact step count: with consumer-group competing-consumer
    // semantics each step should be executed exactly once across both
    // workers. Any drift here points at a real ack/nack regression.
    await new Promise(r => setTimeout(r, 1500));
    const delta = countMarker(server, 'step-execute-hit') - before;
    expect(delta).toBe(3 * N);
  }, 90_000);

  it('MASTRA_WORKERS=scheduler boots only the scheduler subsystem', async () => {
    await flushRedis();
    storage = await makeStorageDir('mastra-resilience-filter-');
    const port = await getFreePort();
    const serverUrl = `http://localhost:${port}`;

    const server = track(
      spawnFixture({
        entry: SERVER_ENTRY,
        label: 'server',
        env: { MASTRA_WORKERS: 'false', REDIS_URL, STORAGE_URL: storage.storageUrl, PORT: String(port) },
      }),
    );
    await waitForLine(server, 'server-ready');
    await waitForServerHttp(serverUrl);

    // Scheduler-only process: env filter selects only the SchedulerWorker
    // out of the auto-created defaults. If the env filter is wrong the
    // OrchestrationWorker would also boot and steal the workflow.start
    // events we publish below — the assertion at the bottom proves it
    // didn't.
    const schedulerOnly = track(
      spawnFixture({
        entry: SCHEDULER_ENTRY,
        label: 'scheduler-only',
        env: { MASTRA_WORKERS: 'scheduler', REDIS_URL, STORAGE_URL: storage.storageUrl },
      }),
    );
    await waitForLine(schedulerOnly, 'scheduler-ready');

    // Insert a schedule and verify the scheduler fires it (publishes
    // workflow.start), but no step ever executes because there's no
    // orchestration worker anywhere.
    const { Mastra } = await import('@mastra/core/mastra');
    const { LibSQLStore } = await import('@mastra/libsql');
    const { RedisStreamsPubSub } = await import('../src/index.js');
    const controlMastra = new Mastra({
      storage: new LibSQLStore({ id: 'mastra-storage', url: storage.storageUrl }),
      pubsub: new RedisStreamsPubSub({ url: REDIS_URL }),
      logger: false,
      workers: false,
    });
    try {
      const storageInstance = controlMastra.getStorage();
      const schedulesStore: any = await storageInstance!.getStore('schedules');

      const scheduleId = `filter-${Date.now()}`;
      const now = Date.now();
      await schedulesStore.createSchedule({
        id: scheduleId,
        target: { type: 'workflow', workflowId: 'cross-process-scheduled', inputData: { name: 'filter' } },
        cron: '* * * * * *',
        status: 'active',
        nextFireAt: now + 200,
        createdAt: now,
        updatedAt: now,
      });

      // Give the scheduler enough time to tick.
      await waitFor(async () => {
        const updated = await schedulesStore.getSchedule(scheduleId);
        return updated && updated.lastFireAt && updated.lastFireAt > now;
      }, 15_000);

      // The schedule fired (lastFireAt advanced) but the step never
      // executed (no orchestrator process exists).
      expect(countMarker(server, 'step-execute-hit')).toBe(0);
      expect(countMarker(server, 'scheduled-step-ran')).toBe(0);

      // Pause the schedule so the running scheduler stops triggering it.
      await schedulesStore.updateSchedule(scheduleId, { status: 'paused' });
    } finally {
      await controlMastra.shutdown();
    }
  }, 30_000);

  it('a workflow started before any orchestrator exists still completes once one joins', async () => {
    await flushRedis();
    storage = await makeStorageDir('mastra-resilience-noworker-');
    const port = await getFreePort();
    const serverUrl = `http://localhost:${port}`;

    const server = track(
      spawnFixture({
        entry: SERVER_ENTRY,
        label: 'server',
        env: { MASTRA_WORKERS: 'false', REDIS_URL, STORAGE_URL: storage.storageUrl, PORT: String(port) },
      }),
    );
    await waitForLine(server, 'server-ready');
    await waitForServerHttp(serverUrl);

    // Kick off the run BEFORE any orchestrator process exists. start-async
    // blocks until the run completes, so we issue it fire-and-forget and
    // assert the response after the worker comes up. This is the real
    // late-join case: events published into the workflows topic must be
    // recoverable by a worker that subscribes afterward.
    const startResultPromise = fetch(`${serverUrl}/api/workflows/cross-process-greet/start-async`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inputData: { name: 'late-join' } }),
    });

    // Confirm the server never executes a step itself (workers: false). Wait
    // long enough that the publish has definitely landed in Redis.
    await new Promise(r => setTimeout(r, 1500));
    expect(countMarker(server, 'step-execute-hit')).toBe(0);

    // Spawn an orchestrator now. With consumer groups anchored at '0', the
    // brand-new orchestrator group inherits the backlog and picks up the
    // pending workflow.start event.
    const orchestrator = track(
      spawnFixture({
        entry: WORKER_ENTRY,
        label: 'orchestrator-late',
        env: {
          MASTRA_WORKERS: 'orchestration',
          REDIS_URL,
          STORAGE_URL: storage.storageUrl,
          MASTRA_STEP_EXECUTION_URL: `${serverUrl}/api`,
        },
      }),
    );
    await waitForLine(orchestrator, 'worker-ready');

    // The original run must complete — not just a fresh run started later.
    const startRes = await startResultPromise;
    expect(startRes.ok).toBe(true);
    const body = (await startRes.json()) as { status: string; result?: { greeting?: string } };
    expect(body.status).toBe('success');
    expect(body.result?.greeting).toBe('hello, late-join');
    expect(countMarker(server, 'step-execute-hit')).toBeGreaterThan(0);
  }, 60_000);
});
