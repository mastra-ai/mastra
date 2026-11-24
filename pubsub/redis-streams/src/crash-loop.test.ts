import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { killProcess, makeStorageDir, PACKAGE_DIR, REDIS_URL, spawnFixture } from '../test-fixtures/harness';

const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/crash-loop.entry.ts');

// A background task that crashes its worker must not be re-run by every server
// that starts afterwards. Each crash spends a retry, so with `maxRetries: 1` the
// task runs twice and then fails. (#30977)
describe('background task that crashes its worker', () => {
  let storage: Awaited<ReturnType<typeof makeStorageDir>>;

  beforeAll(async () => {
    storage = await makeStorageDir('mastra-crash-loop-');
  });

  afterAll(async () => {
    await storage?.cleanup();
  });

  it('stops running once its retries are used', async () => {
    const attemptsFile = join(storage.dir, 'attempts.log');
    const attempts = () =>
      existsSync(attemptsFile) ? readFileSync(attemptsFile, 'utf8').trim().split('\n').length : 0;
    const keyPrefix = `crash-loop-${randomUUID()}`;

    // Start servers one after another, as a supervisor restarting a crashed process would.
    for (let i = 0; i < 4; i++) {
      const server = spawnFixture({
        entry: ENTRY,
        label: `server-${i}`,
        env: {
          REDIS_URL,
          KEY_PREFIX: keyPrefix,
          STORAGE_URL: storage.storageUrl,
          ATTEMPTS_FILE: attemptsFile,
          ENQUEUE: i === 0 ? '1' : '',
        },
      });
      const exited = new Promise(r => server.proc.once('exit', r));
      // Give each server time to recover the task after the previous lease lapses.
      await Promise.race([exited, new Promise(r => setTimeout(r, 8_000))]);
      await killProcess(server);
    }

    const store = new LibSQLStore({ id: 'crash-loop-check', url: storage.storageUrl });
    const { tasks } = await (await store.getStore('backgroundTasks'))!.listTasks({});

    expect(attempts()).toBe(2);
    expect(tasks).toMatchObject([
      { status: 'failed', retryCount: 1, error: { message: 'Worker process terminated before task completed' } },
    ]);
  }, 90_000);
});
