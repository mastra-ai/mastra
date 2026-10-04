import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createChildProcessMemoryStorage,
  createObservationalMemoryConcurrencyTests,
} from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MemoryLibSQL } from './index';

const OM_TABLE = 'mastra_observational_memory';

/** A temp file database: two clients on it contend on SQLite's real (cross-connection) write lock. */
function tempDbUrl() {
  const dir = mkdtempSync(join(tmpdir(), 'om-lifecycle-'));
  return { url: `file:${join(dir, 'om.db')}`, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// The `libsql` driver is synchronous: a connection waiting on SQLite's lock blocks its whole
// event loop, so two connections in one process cannot contend. Store B runs in a child process.
createObservationalMemoryConcurrencyTests({
  label: 'LibSQL (file, two processes)',
  createStores: async () => {
    const db = tempDbUrl();
    const a = new MemoryLibSQL({ url: db.url });
    await a.init();
    const b = await createChildProcessMemoryStorage({
      modulePath: fileURLToPath(new URL('./index.ts', import.meta.url)),
      exportName: 'MemoryLibSQL',
      options: { url: db.url },
    });
    return {
      a,
      b: b.storage,
      cleanup: async () => {
        await b.close();
        db.cleanup();
      },
    };
  },
});

describe('LibSQL observational memory supersededBy upgrade', () => {
  let db: ReturnType<typeof tempDbUrl>;
  let url: string;

  beforeAll(() => {
    db = tempDbUrl();
    url = db.url;
  });
  afterAll(() => db.cleanup());

  const at = (ms: number) => new Date(Date.parse('2026-01-10T12:00:00.000Z') + ms);
  const row = (key: { threadId: string; resourceId: string }, id: string, generationCount: number, createdAt: Date) =>
    ({
      id,
      scope: 'thread',
      threadId: key.threadId,
      resourceId: key.resourceId,
      createdAt,
      updatedAt: createdAt,
      lastObservedAt: undefined,
      originType: generationCount === 0 ? 'initial' : 'reflection',
      generationCount,
      activeObservations: `- ${id}`,
      totalTokensObserved: 0,
      observationTokenCount: 0,
      pendingMessageTokens: 0,
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      config: {},
      supersededBy: null,
    }) as ObservationalMemoryRecord;

  const liveIds = async (store: MemoryLibSQL, key: { threadId: string; resourceId: string }) =>
    (await store.getObservationalMemoryHistory(key.threadId, key.resourceId, 100))
      .filter(r => !r.supersededBy)
      .map(r => r.id);

  it('adds the column to a pre-M3 table and leaves only the canonical head live (idempotently)', async () => {
    const legacy = new MemoryLibSQL({ url });
    await legacy.init();
    const chain = { threadId: 'chain-thread', resourceId: 'chain-resource' };
    const dup = { threadId: 'dup-thread', resourceId: 'dup-resource' };
    for (const record of [
      row(chain, 'chain-0', 0, at(0)),
      row(chain, 'chain-1', 1, at(1000)),
      row(chain, 'chain-2', 2, at(2000)),
      row(dup, 'dup-0', 0, at(0)),
      row(dup, 'dup-1-late', 1, at(2000)),
      row(dup, 'dup-1-early', 1, at(1000)),
    ]) {
      await legacy.insertObservationalMemoryRecord(record);
    }
    // Pre-M3 shape: the table has no supersededBy column (SQLite keeps the rows when dropping it).
    const raw = createClient({ url });
    await raw.execute(`ALTER TABLE "${OM_TABLE}" DROP COLUMN "supersededBy"`);
    const columns = async () => (await raw.execute(`PRAGMA table_info("${OM_TABLE}")`)).rows.map(r => r.name);
    expect(await columns()).not.toContain('supersededBy');

    const upgraded = new MemoryLibSQL({ url });
    await upgraded.init();
    expect(await columns()).toContain('supersededBy');

    const expectBackfilled = async () => {
      expect(await liveIds(upgraded, chain)).toEqual(['chain-2']);
      expect(await liveIds(upgraded, dup)).toEqual(['dup-1-early']);
      const all = [
        ...(await upgraded.getObservationalMemoryHistory(chain.threadId, chain.resourceId, 100)),
        ...(await upgraded.getObservationalMemoryHistory(dup.threadId, dup.resourceId, 100)),
      ];
      expect(Object.fromEntries(all.map(r => [r.id, r.supersededBy]))).toEqual({
        'chain-0': 'chain-2',
        'chain-1': 'chain-2',
        'chain-2': null,
        'dup-0': 'dup-1-early',
        'dup-1-late': 'dup-1-early',
        'dup-1-early': null,
      });
      expect((await upgraded.getObservationalMemory(dup.threadId, dup.resourceId))!.id).toBe('dup-1-early');
    };
    await expectBackfilled();

    await new MemoryLibSQL({ url }).init();
    await expectBackfilled();
    raw.close();
  });

  it('a backfill racing a rollover always leaves exactly one live record', async () => {
    const roller = new MemoryLibSQL({ url });
    await roller.init();
    for (let i = 0; i < 25; i++) {
      const key = { threadId: `race-thread-${i}`, resourceId: `race-resource-${i}` };
      // Two live rows, as left by a pre-M3 process: generation 0 was never marked superseded.
      await roller.insertObservationalMemoryRecord(row(key, `race-${i}-0`, 0, at(0)));
      await roller.insertObservationalMemoryRecord(row(key, `race-${i}-1`, 1, at(1000)));
      const snapshot = (await roller.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(snapshot.id).toBe(`race-${i}-1`);

      const backfiller = new MemoryLibSQL({ url });
      await Promise.all([
        backfiller.init(),
        roller.createReflectionGeneration({ currentRecord: snapshot, reflection: '- reflected', tokenCount: 1 }),
      ]);

      const head = (await roller.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(head.generationCount).toBe(2);
      expect(await liveIds(roller, key)).toEqual([head.id]);
    }
  }, 120_000);
});
