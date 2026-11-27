import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  killProcess,
  makeStorageDir,
  PACKAGE_DIR,
  REDIS_URL,
  spawnFixture,
  waitForLine,
} from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';

const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/durable-background-split.entry.ts');

// A durable agent runs its loop on the API process. With `workers: false` that
// process can't run background tasks, and a dedicated worker can't run a task
// bound to the run's in-process executor, so the tool must run inline instead
// of leaving a task nobody claims. (#31089)
describe('background tool in a durable agent run on an API process without workers', () => {
  let storage: Awaited<ReturnType<typeof makeStorageDir>>;
  let worker: ManagedProcess | undefined;
  let api: ManagedProcess | undefined;

  beforeAll(async () => {
    storage = await makeStorageDir('mastra-durable-bg-split-');
    const env = { REDIS_URL, KEY_PREFIX: `durable-bg-split-${randomUUID()}`, STORAGE_URL: storage.storageUrl };
    worker = spawnFixture({ entry: ENTRY, label: 'worker', env: { ...env, ROLE: 'worker' } });
    await waitForLine(worker, 'worker-ready');
    api = spawnFixture({ entry: ENTRY, label: 'api', env: { ...env, ROLE: 'api' } });
    await waitForLine(api, 'result:');
  });

  afterAll(async () => {
    await killProcess(api);
    await killProcess(worker);
    await storage?.cleanup();
  });

  it('runs the tool inline and answers with its result', () => {
    const { chunkTypes, text, tasks } = JSON.parse(api!.stdout.match(/result:(.*)/)![1]!);

    expect(chunkTypes).not.toContain('background-task-started');
    expect(chunkTypes).toContain('tool-result');
    expect(text).toBe('brewed');
    expect(tasks).toEqual([]);
    expect(api!.stdout).toContain(`tool-ran:${JSON.stringify({ role: 'api', isBackgroundTask: false })}`);
    expect(worker!.stdout).not.toContain('tool-ran:');
  });
});
