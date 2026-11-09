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

describe('LibSQL observational memory writes alongside other writes in the same process', () => {
  it('never hold a write transaction open across awaits (no SQLITE_BUSY for concurrent message saves)', async () => {
    const db = tempDbUrl();
    const store = new MemoryLibSQL({ url: db.url });
    try {
      await store.init();
      const threadId = 'busy-thread';
      const resourceId = 'busy-resource';
      await store.saveThread({
        thread: { id: threadId, resourceId, title: 't', createdAt: new Date(), updatedAt: new Date() },
      });
      await store.initializeObservationalMemory({ threadId, resourceId, scope: 'thread', config: {} });

      const errors: unknown[] = [];
      const capture = (promise: Promise<unknown>) => promise.catch(error => errors.push(error));
      await Promise.all([
        (async () => {
          for (let i = 0; i < 20; i++) {
            const head = (await store.getObservationalMemory(threadId, resourceId))!;
            await capture(
              store.appendBufferedObservations({
                id: head.id,
                chunk: {
                  cycleId: `c${i}`,
                  observations: `- ${i}`,
                  tokenCount: 1,
                  messageIds: [`m${i}`],
                  messageTokens: 1,
                  lastObservedAt: new Date(),
                },
                lastBufferedAtTime: new Date(),
              }),
            );
            await capture(store.setPendingMessageTokens(head.id, i));
          }
        })(),
        (async () => {
          for (let i = 0; i < 20; i++) {
            await capture(
              store.saveMessages({
                messages: [
                  {
                    id: `msg-${i}`,
                    threadId,
                    resourceId,
                    role: 'user',
                    type: 'text',
                    createdAt: new Date(),
                    content: { format: 2, parts: [{ type: 'text', text: 'x' }] },
                  },
                ],
              }),
            );
          }
        })(),
      ]);

      expect(errors).toEqual([]);
      const head = (await store.getObservationalMemory(threadId, resourceId))!;
      expect(head.bufferedObservationChunks?.map(c => c.cycleId)).toEqual(
        Array.from({ length: 20 }, (_, i) => `c${i}`),
      );
    } finally {
      db.cleanup();
    }
  }, 60_000);
});

describe('LibSQL observational memory guarded writes', () => {
  it.each([true, false])(
    'retry after a concurrent change and sync first only on an embedded replica (embeddedReplica: %s)',
    async embeddedReplica => {
      const db = tempDbUrl();
      const raw = createClient({ url: db.url });
      let injected = false;
      let syncs = 0;
      const client = {
        execute: async (statement: Parameters<typeof raw.execute>[0]) => {
          const result = await raw.execute(statement);
          const sql = typeof statement === 'string' ? statement : statement.sql;
          // Another instance changes the row between this read and the guarded write.
          if (!injected && sql.startsWith(`SELECT * FROM "${OM_TABLE}" WHERE id = ?`)) {
            injected = true;
            await raw.execute({
              sql: `UPDATE "${OM_TABLE}" SET "updatedAt" = '2000-01-01T00:00:00.000Z' WHERE id = ?`,
              args: [String(result.rows[0]!.id)],
            });
          }
          return result;
        },
        batch: raw.batch.bind(raw),
        transaction: raw.transaction.bind(raw),
        close: () => raw.close(),
        sync: async () => {
          syncs++;
        },
        get closed() {
          return raw.closed;
        },
        get protocol() {
          return raw.protocol;
        },
      };
      try {
        const store = new MemoryLibSQL({ client: client as never, embeddedReplica });
        await store.init();
        const record = await store.initializeObservationalMemory({
          threadId: 'sync-thread',
          resourceId: 'sync-resource',
          scope: 'thread',
          config: {},
        });
        injected = false;
        await store.commitActiveObservations({
          id: record.id,
          observations: '- fact',
          tokenCount: 1,
          lastObservedAt: new Date('2026-01-01T00:00:00.000Z'),
          expectedActiveObservations: '',
        });

        expect(injected).toBe(true);
        expect(syncs).toBe(embeddedReplica ? 1 : 0);
        const head = (await store.getObservationalMemory('sync-thread', 'sync-resource'))!;
        expect(head.activeObservations).toBe('- fact');
      } finally {
        raw.close();
        db.cleanup();
      }
    },
  );
});

describe('LibSQL observational memory on an embedded replica that has not synced yet', () => {
  /** Reads see nothing until `sync()`, like a replica missing another instance's writes; writes reach the primary. */
  function staleReplicaClient(raw: ReturnType<typeof createClient>) {
    const state = { stale: true, syncs: 0 };
    const client = {
      execute: async (statement: Parameters<typeof raw.execute>[0]) => {
        const sql = typeof statement === 'string' ? statement : statement.sql;
        const result = await raw.execute(statement);
        if (state.stale && sql.trimStart().startsWith('SELECT') && sql.includes(`"${OM_TABLE}"`)) {
          return { ...result, rows: [] };
        }
        return result;
      },
      batch: raw.batch.bind(raw),
      transaction: raw.transaction.bind(raw),
      close: () => raw.close(),
      sync: async () => {
        state.syncs++;
        state.stale = false;
      },
      get closed() {
        return raw.closed;
      },
      get protocol() {
        return raw.protocol;
      },
    };
    return { client, state };
  }

  async function withWinner(
    run: (args: {
      replica: MemoryLibSQL;
      state: { stale: boolean; syncs: number };
      winner: ObservationalMemoryRecord;
    }) => Promise<void>,
  ) {
    const db = tempDbUrl();
    const raw = createClient({ url: db.url });
    try {
      // Another instance initializes the record on the primary.
      const primary = new MemoryLibSQL({ client: raw as never });
      await primary.init();
      const winner = await primary.initializeObservationalMemory({
        threadId: 'replica-thread',
        resourceId: 'replica-resource',
        scope: 'thread',
        config: {},
      });
      const { client, state } = staleReplicaClient(raw);
      const replica = new MemoryLibSQL({ client: client as never, embeddedReplica: true });
      await run({ replica, state, winner });
    } finally {
      raw.close();
      db.cleanup();
    }
  }

  it('returns the stored record after losing an initialize race, not one that was never stored', async () => {
    await withWinner(async ({ replica, state, winner }) => {
      const record = await replica.initializeObservationalMemory({
        threadId: 'replica-thread',
        resourceId: 'replica-resource',
        scope: 'thread',
        config: {},
      });

      expect(record.id).toBe(winner.id);
      expect(state.syncs).toBe(1);
    });
  });

  it('syncs and reads again before treating a record as missing', async () => {
    await withWinner(async ({ replica, state, winner }) => {
      await replica.setPendingMessageTokens(winner.id, 42);

      expect(state.syncs).toBe(1);
      expect((await replica.getObservationalMemory('replica-thread', 'replica-resource'))!.pendingMessageTokens).toBe(
        42,
      );
    });
  });

  it('syncs before skipping a reflection whose source record looks missing', async () => {
    await withWinner(async ({ replica, state, winner }) => {
      const next = await replica.createReflectionGeneration({
        currentRecord: winner,
        reflection: '- reflected',
        tokenCount: 1,
      });

      expect(state.syncs).toBe(1);
      expect(next.id).not.toBe(winner.id);
      expect((await replica.getObservationalMemory('replica-thread', 'replica-resource'))!.id).toBe(next.id);
    });
  });
});
