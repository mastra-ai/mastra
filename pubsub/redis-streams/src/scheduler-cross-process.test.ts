import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
 * Verifies that a SchedulerWorker running in a process separate from
 * both the HTTP server and the orchestration worker can drive workflow
 * runs end-to-end via shared Redis + storage.
 *
 * Topology:
 *   process A: HTTP server (MASTRA_WORKERS=false, no workers at all)
 *   process B: standalone OrchestrationWorker (calls A for /steps/execute)
 *   process C: standalone SchedulerWorker (polls storage, publishes start events)
 *
 * The test inserts a schedule directly into shared storage with
 * nextFireAt in the immediate future, then asserts the workflow run
 * appears with status=success. The scheduler-step ran marker on B's
 * stdout proves the chain went C -> Redis -> B -> A.
 */
describe('cross-process scheduler', () => {
  let storage: { dir: string; storageUrl: string; cleanup: () => Promise<void> };
  let serverUrl: string;
  let server: ManagedProcess | undefined;
  let worker: ManagedProcess | undefined;
  let scheduler: ManagedProcess | undefined;

  beforeAll(async () => {
    await flushRedis();
    storage = await makeStorageDir('mastra-scheduler-xp-');
    const port = await getFreePort();
    serverUrl = `http://localhost:${port}`;

    server = spawnFixture({
      entry: SERVER_ENTRY,
      label: 'server',
      env: { MASTRA_WORKERS: 'false', REDIS_URL, STORAGE_URL: storage.storageUrl, PORT: String(port) },
    });
    await waitForLine(server, 'server-ready');
    await waitForServerHttp(serverUrl);

    worker = spawnFixture({
      entry: WORKER_ENTRY,
      label: 'orchestrator',
      env: {
        MASTRA_WORKERS: 'orchestration',
        REDIS_URL,
        STORAGE_URL: storage.storageUrl,
        MASTRA_STEP_EXECUTION_URL: `${serverUrl}/api`,
      },
    });
    await waitForLine(worker, 'worker-ready');

    scheduler = spawnFixture({
      entry: SCHEDULER_ENTRY,
      label: 'scheduler',
      env: { MASTRA_WORKERS: 'scheduler', REDIS_URL, STORAGE_URL: storage.storageUrl },
    });
    await waitForLine(scheduler, 'scheduler-ready');
  }, 60_000);

  afterAll(async () => {
    // allSettled so a single zombie process doesn't block the others.
    await Promise.allSettled([killProcess(scheduler), killProcess(worker), killProcess(server)]);
    await storage?.cleanup();
  });

  it('fires a schedule from a separate process and the orchestrator runs the workflow', async () => {
    // Use the same shared storage by reaching into it from the test
    // process. We bring up our own throwaway Mastra against the same
    // libsql file purely to insert a schedule row.
    const { Mastra } = await import('@mastra/core/mastra');
    const { LibSQLStore } = await import('@mastra/libsql');
    const { RedisStreamsPubSub } = await import('../src/index.js');
    const controlMastra = new Mastra({
      storage: new LibSQLStore({ id: 'mastra-storage', url: storage.storageUrl }),
      pubsub: new RedisStreamsPubSub({ url: REDIS_URL }),
      logger: false,
      workers: false,
    });

    const storageInstance = controlMastra.getStorage();
    if (!storageInstance) throw new Error('storage not available');
    const schedulesStore = await storageInstance.getStore('schedules');
    if (!schedulesStore) throw new Error('schedules store not available');

    const scheduleId = `xp-schedule-${Date.now()}`;
    // Per-test marker discriminator: assertions count occurrences of
    // `scheduled-step-ran name=${scheduleName}` on the shared server
    // stdout. Without a unique name a second test run on the same
    // server (or a retry) would inherit prior matches and pass without
    // the *current* schedule actually firing.
    const scheduleName = scheduleId;
    const scheduledMarker = `scheduled-step-ran name=${scheduleName}`;
    // Capture baselines *before* createSchedule so a fast scheduler
    // tick can't sneak a fire in between baseline and waitFor.
    const baselineScheduledRuns = countMarker(server, scheduledMarker);
    const baselineStepHits = countMarker(server, 'step-execute-hit');
    const now = Date.now();
    await (schedulesStore as any).createSchedule({
      id: scheduleId,
      target: {
        type: 'workflow',
        workflowId: 'cross-process-scheduled',
        inputData: { name: scheduleName },
      },
      // Every-second cron just so the scheduler has a valid pattern; we
      // pre-arm nextFireAt to fire immediately.
      cron: '* * * * * *',
      status: 'active',
      nextFireAt: now + 200,
      createdAt: now,
      updatedAt: now,
    });

    // The scheduled step itself runs on the server (the orchestrator's
    // HttpRemoteStrategy POSTs to /steps/execute on the server, so the
    // `scheduled-step-ran` marker is logged on server stdout). The
    // chain server -> redis -> worker -> server is still proven because
    // /steps/execute is only called by the standalone orchestrator.
    await waitFor(async () => countMarker(server, scheduledMarker) > baselineScheduledRuns, 20_000);

    expect(countMarker(server, scheduledMarker)).toBeGreaterThan(baselineScheduledRuns);
    expect(countMarker(server, 'step-execute-hit')).toBeGreaterThan(baselineStepHits);

    // Mark the schedule paused so we don't keep firing every second
    // through the rest of the suite.
    await (schedulesStore as any).updateSchedule(scheduleId, { status: 'paused' });
    await controlMastra.shutdown();
  }, 30_000);

  it('without a scheduler process, schedules do not fire', async () => {
    // Stop the scheduler process and verify a brand-new schedule does
    // not advance — proves the scheduler process is what drives fires,
    // not the server or orchestrator.
    await killProcess(scheduler);
    scheduler = undefined;

    const { Mastra } = await import('@mastra/core/mastra');
    const { LibSQLStore } = await import('@mastra/libsql');
    const { RedisStreamsPubSub } = await import('../src/index.js');
    const controlMastra = new Mastra({
      storage: new LibSQLStore({ id: 'mastra-storage', url: storage.storageUrl }),
      pubsub: new RedisStreamsPubSub({ url: REDIS_URL }),
      logger: false,
      workers: false,
    });

    const storageInstance = controlMastra.getStorage();
    if (!storageInstance) throw new Error('storage not available');
    const schedulesStore = await storageInstance.getStore('schedules');
    if (!schedulesStore) throw new Error('schedules store not available');
    const scheduleId = `xp-schedule-no-scheduler-${Date.now()}`;
    const now = Date.now();
    await (schedulesStore as any).createSchedule({
      id: scheduleId,
      target: { type: 'workflow', workflowId: 'cross-process-scheduled', inputData: { name: 'orphan' } },
      cron: '* * * * * *',
      status: 'active',
      nextFireAt: now + 200,
      createdAt: now,
      updatedAt: now,
    });

    const baselineRuns = countMarker(server, 'scheduled-step-ran name=orphan');
    // Wait long enough that a scheduler tick (default 10s) WOULD have
    // fired. Use 4s — without any scheduler process the schedule must
    // not advance no matter how long we wait.
    await new Promise(r => setTimeout(r, 4_000));
    expect(countMarker(server, 'scheduled-step-ran name=orphan')).toBe(baselineRuns);

    await (schedulesStore as any).updateSchedule(scheduleId, { status: 'paused' });
    await controlMastra.shutdown();
  }, 20_000);
});
