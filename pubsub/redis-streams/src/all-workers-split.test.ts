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
const ORCH_ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/app.worker.entry.ts');
const SCHEDULER_ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/app.worker.entry.ts');
const BACKGROUND_ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/app.worker.entry.ts');

/**
 * Headline test: server + orchestration + scheduler + background-task
 * worker each in its own process, all sharing Redis + libsql storage.
 * A schedule fires → orchestrator runs the workflow → step enqueues a
 * background task for `echo-tool` → bg worker resolves it from Mastra's
 * static tool registry, executes it, and writes `completed` → step
 * returns the status. Proves the split deployment works as a system.
 */
describe('all workers split across processes', () => {
  let storage: { dir: string; storageUrl: string; cleanup: () => Promise<void> };
  let serverUrl: string;
  let server: ManagedProcess | undefined;
  let orchestrator: ManagedProcess | undefined;
  let scheduler: ManagedProcess | undefined;
  let background: ManagedProcess | undefined;

  beforeAll(async () => {
    await flushRedis();
    storage = await makeStorageDir('mastra-all-split-');
    const port = await getFreePort();
    serverUrl = `http://localhost:${port}`;

    server = spawnFixture({
      entry: SERVER_ENTRY,
      label: 'server',
      env: { MASTRA_WORKERS: 'false', REDIS_URL, STORAGE_URL: storage.storageUrl, PORT: String(port) },
    });
    await waitForLine(server, 'server-ready');
    await waitForServerHttp(serverUrl);

    orchestrator = spawnFixture({
      entry: ORCH_ENTRY,
      label: 'orchestrator',
      env: {
        MASTRA_WORKERS: 'orchestration',
        REDIS_URL,
        STORAGE_URL: storage.storageUrl,
        MASTRA_STEP_EXECUTION_URL: `${serverUrl}/api`,
      },
    });
    await waitForLine(orchestrator, 'worker-ready');

    scheduler = spawnFixture({
      entry: SCHEDULER_ENTRY,
      label: 'scheduler',
      env: { MASTRA_WORKERS: 'scheduler', REDIS_URL, STORAGE_URL: storage.storageUrl },
    });
    await waitForLine(scheduler, 'scheduler-ready');

    background = spawnFixture({
      entry: BACKGROUND_ENTRY,
      label: 'background',
      env: { MASTRA_WORKERS: 'backgroundTasks', REDIS_URL, STORAGE_URL: storage.storageUrl },
    });
    await waitForLine(background, 'background-ready');
  }, 90_000);

  afterAll(async () => {
    await killProcess(background);
    await killProcess(scheduler);
    await killProcess(orchestrator);
    await killProcess(server);
    await storage?.cleanup();
  });

  it('a scheduled workflow runs, dispatches a background task, and observes it completing on the bg worker', async () => {
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

    const scheduleId = `xp-fanout-${Date.now()}`;
    const now = Date.now();
    await (schedulesStore as any).createSchedule({
      id: scheduleId,
      target: {
        type: 'workflow',
        workflowId: 'cross-process-fanout',
        inputData: { name: 'split' },
      },
      cron: '* * * * * *',
      status: 'active',
      nextFireAt: now + 200,
      createdAt: now,
      updatedAt: now,
    });

    // The terminal-state marker is logged on the SERVER (because the
    // orchestrator's HttpRemoteStrategy POSTs the step to the server's
    // /steps/execute endpoint, where it actually executes). Wait for
    // the *completed* terminal state — the bg worker resolved
    // `echo-tool` from the static registry and ran it.
    await waitFor(async () => countMarker(server, 'status=completed') > 0, 30_000);

    expect(countMarker(server, 'fanout-kickoff')).toBeGreaterThan(0);
    expect(countMarker(server, 'fanout-bg-enqueued')).toBeGreaterThan(0);
    expect(countMarker(server, 'status=completed')).toBeGreaterThan(0);
    // Server must have served step-execute calls (proves orchestrator
    // process called server process).
    expect(countMarker(server, 'step-execute-hit')).toBeGreaterThan(0);

    // Pause the schedule so it doesn't keep firing every second.
    await (schedulesStore as any).updateSchedule(scheduleId, { status: 'paused' });
    await controlMastra.shutdown();
  }, 60_000);
});
