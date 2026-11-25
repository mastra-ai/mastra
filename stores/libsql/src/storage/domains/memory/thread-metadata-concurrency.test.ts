import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { RunFence } from '@mastra/core/storage';
import { isRunFenceConflictError } from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gateIfLocalFile } from '../../../shared/file-transaction-gate';
import { resetConnectionsAfterBusy } from '../../../shared/reset-after-busy-client';
import { MemoryLibSQL } from './index';

const ROUNDS = 25;
const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'resource-1';

function expectedKeys(): Record<string, unknown> {
  const expected: Record<string, unknown> = { seed: true };
  for (let i = 0; i < ROUNDS; i++) {
    expected[`a${i}`] = i;
    expected[`b${i}`] = i;
  }
  return expected;
}

async function storedMetadata(store: MemoryLibSQL): Promise<Record<string, unknown>> {
  const thread = await store.getThreadById({ threadId: THREAD_ID });
  return thread!.metadata as Record<string, unknown>;
}

async function seedThread(store: MemoryLibSQL): Promise<void> {
  await store.deleteThread({ threadId: THREAD_ID });
  await store.saveThread({
    thread: {
      id: THREAD_ID,
      resourceId: RESOURCE_ID,
      title: 'Test thread',
      metadata: { seed: true },
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    },
  });
}

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
    await seedThread(a);
  });

  it('updateThread keeps every key when two writers update the same thread concurrently', async () => {
    for (let i = 0; i < ROUNDS; i++) {
      await Promise.all([
        a.updateThread({ id: THREAD_ID, metadata: { [`a${i}`]: i } }),
        b.updateThread({ id: THREAD_ID, metadata: { [`b${i}`]: i } }),
      ]);
    }

    expect(await storedMetadata(a)).toEqual(expectedKeys());
  });

  it('updateThreadMetadata keeps every key when two writers write whole objects concurrently', async () => {
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

    expect(await storedMetadata(a)).toEqual(expectedKeys());
  });

  it('updateThread updates the title alone and leaves metadata untouched', async () => {
    const updated = await a.updateThread({ id: THREAD_ID, title: 'renamed' });

    expect(updated.title).toBe('renamed');
    expect(await storedMetadata(a)).toEqual({ seed: true });
  });

  it('updateThread rejects a missing thread', async () => {
    await expect(a.updateThread({ id: 'missing', title: 'renamed' })).rejects.toThrow(/not found/);
  });

  it('keys patched to undefined are removed from metadata', async () => {
    await a.updateThread({ id: THREAD_ID, metadata: { extra: 1 } });
    await a.updateThread({ id: THREAD_ID, metadata: { extra: undefined } });

    expect(await storedMetadata(a)).toEqual({ seed: true });
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
    expect(await storedMetadata(a)).toEqual({ seed: true });
  });

  it('updateThreadMetadata passes a MastraError from the callback through unchanged', async () => {
    const thrown = new MastraError({
      id: 'TEST_THREAD_METADATA_CALLBACK_ERROR',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: 'callback failed',
    });

    await expect(
      a.updateThreadMetadata({
        id: THREAD_ID,
        update: () => {
          throw thrown;
        },
      }),
    ).rejects.toBe(thrown);

    expect(await storedMetadata(a)).toEqual({ seed: true });
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
    expect(await storedMetadata(a)).toEqual({ seed: true });
  });
});

/**
 * The stores above are given clients that are already wrapped, which is the shape `LibSQLStore`
 * produces. Built from a `url` a domain instead makes its own client through `resolveClient`, and
 * that is where the same wrapping has to happen: nothing stops a second url-built store, a
 * `LibSQLStore`, or a workflow domain from opening the same local file, and the write transaction
 * each metadata write holds across its read would otherwise stall the other until its busy timeout
 * expires — the write lock never gets released, so the update fails rather than merging.
 */
describe('MemoryLibSQL url-built clients on one file', () => {
  let tmpDir: string;
  let a: MemoryLibSQL;
  let b: MemoryLibSQL;

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'libsql-thread-metadata-url-'));
    const url = `file:${join(tmpDir, 'db.sqlite')}`;
    a = new MemoryLibSQL({ url, maxRetries: 5, initialBackoffMs: 10 });
    b = new MemoryLibSQL({ url, maxRetries: 5, initialBackoffMs: 10 });
    await a.init();
    await b.init();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await seedThread(a);
  });

  it('updateThread keeps every key when both stores are built from a url', async () => {
    for (let i = 0; i < ROUNDS; i++) {
      await Promise.all([
        a.updateThread({ id: THREAD_ID, metadata: { [`a${i}`]: i } }),
        b.updateThread({ id: THREAD_ID, metadata: { [`b${i}`]: i } }),
      ]);
    }

    expect(await storedMetadata(a)).toEqual(expectedKeys());
  });

  it('updateThreadMetadata keeps every key when both stores are built from a url', async () => {
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

    expect(await storedMetadata(a)).toEqual(expectedKeys());
  });
});
