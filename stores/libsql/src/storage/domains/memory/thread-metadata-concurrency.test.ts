import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import type { RunFence } from '@mastra/core/storage';
import { isRunFenceConflictError } from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gateIfLocalFile } from '../../../shared/file-transaction-gate';
import { resetConnectionsAfterBusy } from '../../../shared/reset-after-busy-client';
import { MemoryLibSQL } from './index';

const ROUNDS = 25;
const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'resource-1';

/**
 * Thread metadata writes are a read-modify-write: read the thread, merge the new keys, write the
 * whole object back. Two stores with their own connections to one database file stand in for two
 * processes. Without an atomic read, both read the same snapshot and the later write drops the
 * earlier writer's keys.
 *
 * Each client is wrapped the way `LibSQLStore` wraps a store-owned local `file:` client: the file
 * gate makes another client in this process wait out an open write transaction instead of spinning
 * in SQLite's busy handler, which would block the thread the transaction holder needs to resume,
 * and the reset reopens connections a refused write would otherwise leave holding the write lock.
 * Clients in other processes are unaffected and still contend through `busy_timeout`.
 */
describe('MemoryLibSQL thread metadata concurrency', () => {
  let tmpDir: string;
  let clients: Client[];
  let a: MemoryLibSQL;
  let b: MemoryLibSQL;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'libsql-thread-metadata-'));
    const url = `file:${join(tmpDir, 'db.sqlite')}`;
    clients = [0, 1].map(() =>
      gateIfLocalFile(resetConnectionsAfterBusy(createClient({ url, timeout: 5_000 }), { maxWaitMs: 5_000 }), url, {
        maxWaitMs: 5_000,
      }),
    );
    [a, b] = clients.map(client => new MemoryLibSQL({ client, maxRetries: 5, initialBackoffMs: 10 }));
    await a.init();
    await b.init();
  });

  afterAll(() => {
    for (const client of clients) client.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await a.deleteThread({ threadId: THREAD_ID });
    await a.saveThread({
      thread: {
        id: THREAD_ID,
        resourceId: RESOURCE_ID,
        title: 'Test thread',
        metadata: { seed: true },
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
  });

  function expectedKeys(): Record<string, unknown> {
    const expected: Record<string, unknown> = { seed: true };
    for (let i = 0; i < ROUNDS; i++) {
      expected[`a${i}`] = i;
      expected[`b${i}`] = i;
    }
    return expected;
  }

  async function storedMetadata(store: MemoryLibSQL = a): Promise<Record<string, unknown>> {
    const thread = await store.getThreadById({ threadId: THREAD_ID });
    return thread!.metadata as Record<string, unknown>;
  }

  it('updateThread keeps every key when two processes write concurrently', async () => {
    for (let i = 0; i < ROUNDS; i++) {
      await Promise.all([
        a.updateThread({ id: THREAD_ID, metadata: { [`a${i}`]: i } }),
        b.updateThread({ id: THREAD_ID, metadata: { [`b${i}`]: i } }),
      ]);
    }

    expect(await storedMetadata()).toEqual(expectedKeys());
  });

  it('updateThreadMetadata keeps every key when two processes write whole objects concurrently', async () => {
    for (let i = 0; i < ROUNDS; i++) {
      await Promise.all([
        a.updateThreadMetadata({
          id: THREAD_ID,
          resourceId: RESOURCE_ID,
          update: thread => ({ ...thread.metadata, [`a${i}`]: i }),
        }),
        b.updateThreadMetadata({
          id: THREAD_ID,
          resourceId: RESOURCE_ID,
          update: thread => ({ ...thread.metadata, [`b${i}`]: i }),
        }),
      ]);
    }

    expect(await storedMetadata()).toEqual(expectedKeys());
  });

  it('updateThread updates the title alone and leaves metadata untouched', async () => {
    const updated = await a.updateThread({ id: THREAD_ID, title: 'renamed' });

    expect(updated.title).toBe('renamed');
    expect(await storedMetadata()).toEqual({ seed: true });
  });

  it('updateThread rejects a missing thread', async () => {
    await expect(a.updateThread({ id: 'missing', title: 'renamed' })).rejects.toThrow(/not found/);
  });

  it('keys patched to undefined are removed from metadata', async () => {
    await a.updateThread({ id: THREAD_ID, metadata: { extra: 1 } });
    await a.updateThread({ id: THREAD_ID, metadata: { extra: undefined } });

    expect(await storedMetadata()).toEqual({ seed: true });
  });

  it('updateThreadMetadata respects resourceId, missing threads, and no-op updates', async () => {
    const mismatched = await a.updateThreadMetadata({
      id: THREAD_ID,
      resourceId: 'other-resource',
      update: () => ({ ignored: true }),
    });
    expect(mismatched).toBeNull();

    const missing = await a.updateThreadMetadata({ id: 'missing', update: () => ({ ignored: true }) });
    expect(missing).toBeNull();

    const before = await a.getThreadById({ threadId: THREAD_ID });
    const noop = await a.updateThreadMetadata({ id: THREAD_ID, update: () => undefined });
    expect(noop).not.toBeNull();
    expect(noop!.updatedAt).toEqual(before!.updatedAt);
    expect(await storedMetadata()).toEqual({ seed: true });
  });

  it('updateThreadMetadata rejects a stale fence', async () => {
    const runId = 'run-1';
    const fenceA: RunFence = { runId, generation: 1, ownerId: 'a' };
    const fenceB: RunFence = { runId, generation: 2, ownerId: 'b' };

    await a.raiseRunFence(fenceA);
    await b.raiseRunFence(fenceB);

    const error = await a.updateThreadMetadata({ id: THREAD_ID, update: () => ({ stale: true }), fence: fenceA }).then(
      () => undefined,
      (e: unknown) => e,
    );

    expect(isRunFenceConflictError(error)).toBe(true);
    expect(await storedMetadata()).toEqual({ seed: true });
  });
});
