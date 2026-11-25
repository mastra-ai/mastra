import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  killProcess,
  makeStorageDir,
  PACKAGE_DIR,
  REDIS_URL,
  spawnFixture,
  waitFor,
  waitForLine,
} from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';

const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/background-tool-split.entry.ts');

// An API process without workers starts an evented agent run; a dedicated
// worker runs it. The worker must dispatch the agent's background-eligible tool
// as a background task, as a single process does, not run it inline. (#31090)
describe('background tool in an evented agent run on a dedicated worker', () => {
  let storage: Awaited<ReturnType<typeof makeStorageDir>>;
  let worker: ManagedProcess | undefined;
  let sharedEnv: Record<string, string>;

  beforeAll(async () => {
    storage = await makeStorageDir('mastra-bg-split-');
    sharedEnv = { REDIS_URL, KEY_PREFIX: `bg-split-${randomUUID()}`, STORAGE_URL: storage.storageUrl };
    worker = spawnFixture({ entry: ENTRY, label: 'worker', env: { ...sharedEnv, ROLE: 'worker' } });
    await waitForLine(worker, 'worker-ready');
  });

  afterAll(async () => {
    await killProcess(worker);
    await storage?.cleanup();
  });

  // Starts a run from a fresh API process; returns its stream chunk types and how the worker ran the tool.
  async function run(env: Record<string, string> = {}) {
    const ranBefore = worker!.stdout.split('tool-ran:').length;
    const api = spawnFixture({ entry: ENTRY, label: 'api', env: { ...sharedEnv, ...env, ROLE: 'api' } });
    try {
      await waitForLine(api, 'tasks:');
      await waitFor(async () => worker!.stdout.split('tool-ran:').length > ranBefore);
      const toolRuns = [...worker!.stdout.matchAll(/tool-ran:(.*)/g)];
      return {
        chunkTypes: JSON.parse(api.stdout.match(/stream:(.*)/)![1]!),
        tasks: JSON.parse(api.stdout.match(/tasks:(.*)/)![1]!),
        toolRun: JSON.parse(toolRuns.at(-1)![1]!),
      };
    } finally {
      await killProcess(api);
    }
  }

  it('runs the tool as a background task', async () => {
    const { chunkTypes, toolRun, tasks } = await run();

    expect(chunkTypes).toContain('background-task-started');
    expect(tasks).toEqual([{ status: 'completed', result: { brewed: true } }]);
    expect(toolRun).toEqual({ role: 'worker', isBackgroundTask: true });
  });

  it('still runs the tool inline when the run disables background tasks', async () => {
    const { chunkTypes, toolRun, tasks } = await run({ DISABLE_BACKGROUND: '1' });

    expect(chunkTypes).not.toContain('background-task-started');
    expect(tasks).toEqual([]);
    expect(chunkTypes).toContain('tool-result');
    expect(toolRun).toEqual({ role: 'worker', isBackgroundTask: false });
  });
});
