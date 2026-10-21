import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createClient } from 'redis';
import { describe, expect, it } from 'vitest';
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

const ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/evented-recovery.worker.ts');

// Known #25631 blocker: a fresh evented restart event bypasses the original
// charge-card event's step lease, even with a real Redis Streams broker.
describe('evented boot recovery across Redis Streams workers', () => {
  it.fails('does not charge twice when a second process sweeps a live run', async () => {
    const prefix = `recovery-${randomUUID()}`;
    const storage = await makeStorageDir('evented-recovery-');
    const client = createClient({ url: REDIS_URL });
    let a: ManagedProcess | undefined;
    let b: ManagedProcess | undefined;
    await client.connect();
    try {
      const env = { REDIS_URL, STORAGE_URL: storage.storageUrl, RECOVERY_PREFIX: prefix };
      a = spawnFixture({ entry: ENTRY, label: 'charge-worker-A', env: { ...env, WORKER_ROLE: 'A' } });
      await waitForLine(a, 'worker-ready');
      await waitFor(async () => (await client.lRange(`${prefix}:charges`, 0, -1)).includes('A'), 20_000);
      b = spawnFixture({ entry: ENTRY, label: 'recovery-worker-B', env: { ...env, WORKER_ROLE: 'B' } });
      await waitForLine(b, 'sweep-done');
      await waitFor(async () => (await client.lRange(`${prefix}:charges`, 0, -1)).includes('B'), 2_000).catch(() => {});
      expect(await client.lRange(`${prefix}:charges`, 0, -1)).toEqual(['A']);
    } finally {
      await client.set(`${prefix}:release`, '1');
      await killProcess(b);
      await killProcess(a);
      await client.quit();
      await storage.cleanup();
    }
  }, 60_000);
});
