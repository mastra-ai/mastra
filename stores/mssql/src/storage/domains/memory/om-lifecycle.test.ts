import { randomUUID } from 'node:crypto';
import { createObservationalMemoryConcurrencyTests } from '@internal/storage-test-utils';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MSSQLStore } from '../../index';

/**
 * Observational memory lifecycle on a real SQL Server. Each suite gets its own disposable
 * database, and every MSSQLStore opens its own pool, so two stores stand in for two processes.
 */
const SERVER = {
  server: process.env.MSSQL_HOST || 'localhost',
  port: Number(process.env.MSSQL_PORT) || 1433,
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'Your_password123',
  options: { encrypt: true, trustServerCertificate: true },
};

const OM_TABLE = '[dbo].[mastra_observational_memory]';

async function createDatabase(prefix: string) {
  const database = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = await new sql.ConnectionPool({ ...SERVER, database: 'master' }).connect();
  await admin.request().query(`CREATE DATABASE [${database}]`);
  await admin.close();
  const pool = await new sql.ConnectionPool({ ...SERVER, database }).connect();
  return {
    database,
    pool,
    drop: async () => {
      await pool.close().catch(() => {});
      const dropper = await new sql.ConnectionPool({ ...SERVER, database: 'master' }).connect();
      await dropper
        .request()
        .query(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${database}]`);
      await dropper.close();
    },
  };
}

async function openStore(database: string, id: string) {
  const store = new MSSQLStore({
    id,
    server: SERVER.server,
    port: SERVER.port,
    user: SERVER.user,
    password: SERVER.password,
    database,
  });
  await store.init();
  return { store, memory: (await store.getStore('memory'))! };
}

const T0 = Date.parse('2026-01-10T12:00:00.000Z');
const at = (ms: number) => new Date(T0 + ms);
const chunkAt = (name: string, endMs: number) => ({
  cycleId: `cycle-${name}-${randomUUID()}`,
  observations: `- ${name}`,
  tokenCount: 10,
  messageIds: [`msg-${name}-${randomUUID()}`],
  messageTokens: 500,
  lastObservedAt: at(endMs),
});

// Needs a live SQL Server. Without ENABLE_TESTS the file must still register a (skipped) suite,
// or Vitest fails it with "No test suite found".
describe.runIf(process.env.ENABLE_TESTS === 'true')('MSSQL observational memory', () => {
  createObservationalMemoryConcurrencyTests({
    label: 'MSSQL (two pools)',
    createStores: async () => {
      const db = await createDatabase('om_life');
      const a = await openStore(db.database, 'om-life-a');
      const b = await openStore(db.database, 'om-life-b');
      return {
        a: a.memory,
        b: b.memory,
        cleanup: async () => {
          await Promise.all([a.store.close(), b.store.close()].map(p => p.catch(() => {})));
          await db.drop();
        },
      };
    },
  });

  describe('MSSQL observational memory lifecycle (community PR #24374 regressions)', () => {
    let db: Awaited<ReturnType<typeof createDatabase>>;
    const stores: MSSQLStore[] = [];
    let memory: MemoryStorage;
    let other: MemoryStorage;

    beforeAll(async () => {
      db = await createDatabase('om_regress');
      const a = await openStore(db.database, 'om-regress-a');
      const b = await openStore(db.database, 'om-regress-b');
      stores.push(a.store, b.store);
      memory = a.memory;
      other = b.memory;
    }, 120_000);

    afterAll(async () => {
      await Promise.all(stores.map(store => store.close().catch(() => {})));
      await db?.drop();
    }, 120_000);

    const rowsFor = async (threadId: string) => {
      const result = await db.pool
        .request()
        .input('lookupKey', `thread:${threadId}`)
        .query(
          `SELECT id, supersededBy, generationCount, pendingMessageTokens, bufferedObservationChunks
           FROM ${OM_TABLE} WHERE lookupKey = @lookupKey`,
        );
      return result.recordset as Array<{
        id: string;
        supersededBy: string | null;
        generationCount: number;
        pendingMessageTokens: number;
        bufferedObservationChunks: string | null;
      }>;
    };

    const newKey = () => ({
      threadId: `om-thread-${randomUUID()}`,
      resourceId: `om-resource-${randomUUID()}`,
      scope: 'thread' as const,
      config: {},
    });

    it('advertises observational memory support', () => {
      expect(memory.supportsObservationalMemory).toBe(true);
    });

    // #24374 inserted a fresh UUID on every call, so a second initialize created a second head.
    it('initializing the same thread again returns the existing record instead of inserting another', async () => {
      const key = newKey();
      const first = await memory.initializeObservationalMemory(key);
      const second = await memory.initializeObservationalMemory(key);
      const fromOtherProcess = await other.initializeObservationalMemory(key);

      expect(second.id).toBe(first.id);
      expect(fromOtherProcess.id).toBe(first.id);
      const rows = await rowsFor(key.threadId);
      expect(rows.map(r => r.id)).toEqual([first.id]);
    });

    it('two processes initializing the same thread at once leave exactly one record', async () => {
      for (let i = 0; i < 20; i++) {
        const key = newKey();
        const [a, b] = await Promise.all([
          memory.initializeObservationalMemory(key),
          other.initializeObservationalMemory(key),
        ]);
        expect(a.id).toBe(b.id);
        const rows = await rowsFor(key.threadId);
        expect(rows).toHaveLength(1);
      }
    }, 120_000);

    // #24374 inherited the base fallback, which updated by id and always reported success.
    it('committing observations to a record that a reflection already retired reports retired and writes nothing', async () => {
      const key = newKey();
      const initial = await memory.initializeObservationalMemory(key);
      const successor = await other.createReflectionGeneration({
        currentRecord: initial,
        reflection: '- reflected',
        tokenCount: 5,
      });

      const result = await memory.commitActiveObservations({
        id: initial.id,
        observations: '- late observation from a stale writer',
        tokenCount: 7,
        lastObservedAt: at(1000),
      });
      expect(result).toEqual({ applied: false, reason: 'retired' });
      await expect(
        memory.updateActiveObservations({
          id: initial.id,
          observations: '- late observation from a stale writer',
          tokenCount: 7,
          lastObservedAt: at(1000),
        }),
      ).rejects.toThrow();

      const head = (await memory.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(head.id).toBe(successor.id);
      expect(head.activeObservations).toBe('- reflected');
      const retired = (await memory.getObservationalMemoryHistory(key.threadId, key.resourceId, 10)).find(
        r => r.id === initial.id,
      )!;
      expect(retired.activeObservations).toBe('');
    });

    it('committing over text that changed since the caller read it reports a conflict', async () => {
      const key = newKey();
      const record = await memory.initializeObservationalMemory(key);
      await other.commitActiveObservations({
        id: record.id,
        observations: '- written by the other process',
        tokenCount: 3,
        lastObservedAt: at(500),
      });

      const result = await memory.commitActiveObservations({
        id: record.id,
        observations: '- based on the empty text',
        tokenCount: 3,
        lastObservedAt: at(600),
        expectedActiveObservations: '',
      });
      expect(result).toEqual({ applied: false, reason: 'conflict' });
      const head = (await memory.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(head.activeObservations).toBe('- written by the other process');
    });

    // #24374 inserted a successor from caller state: it reset pending tokens, dropped buffered
    // chunks and never retired the previous head.
    it('a reflection moves pending tokens and buffered chunks to the new generation and retires the old one', async () => {
      const key = newKey();
      const record = await memory.initializeObservationalMemory(key);
      await memory.commitActiveObservations({
        id: record.id,
        observations: '- observed',
        tokenCount: 4,
        lastObservedAt: at(100),
      });
      await memory.setPendingMessageTokens(record.id, 1234);
      const chunk = chunkAt('pending', 900);
      const appended = await other.appendBufferedObservations({ id: record.id, chunk });
      expect(appended).toEqual({ persisted: true, recordId: record.id });

      // The caller's snapshot predates the pending tokens and the chunk.
      const next = await memory.createReflectionGeneration({
        currentRecord: { ...record, activeObservations: '- observed', observationTokenCount: 4 },
        reflection: '- reflected',
        tokenCount: 2,
      });

      expect(next.id).not.toBe(record.id);
      expect(next.generationCount).toBe(1);
      expect(next.pendingMessageTokens).toBe(1234);
      expect(next.bufferedObservationChunks?.map(c => c.cycleId)).toEqual([chunk.cycleId]);

      const rows = await rowsFor(key.threadId);
      const live = rows.filter(r => r.supersededBy === null);
      expect(live.map(r => r.id)).toEqual([next.id]);
      const retired = rows.find(r => r.id === record.id)!;
      expect(retired.supersededBy).toBe(next.id);
      expect(retired.bufferedObservationChunks).toBeNull();
    });

    it('a reflection from a snapshot that is no longer the head creates no competing head', async () => {
      const key = newKey();
      const record = await memory.initializeObservationalMemory(key);
      const winner = await other.createReflectionGeneration({
        currentRecord: record,
        reflection: '- first reflection',
        tokenCount: 1,
      });
      const loser = await memory.createReflectionGeneration({
        currentRecord: record,
        reflection: '- stale reflection',
        tokenCount: 1,
      });

      expect(loser.id).toBe(winner.id);
      const live = (await rowsFor(key.threadId)).filter(r => r.supersededBy === null);
      expect(live.map(r => r.id)).toEqual([winner.id]);
    });

    it('a buffered chunk appended to a retired record lands on the head exactly once', async () => {
      const key = newKey();
      const record = await memory.initializeObservationalMemory(key);
      const head = await other.createReflectionGeneration({
        currentRecord: record,
        reflection: '- reflected',
        tokenCount: 1,
      });
      const chunk = chunkAt('late', 2000);
      const first = await memory.appendBufferedObservations({ id: record.id, chunk });
      const retry = await memory.appendBufferedObservations({ id: record.id, chunk });

      expect(first).toEqual({ persisted: true, recordId: head.id });
      expect(retry).toEqual({ persisted: false, recordId: head.id });
      const stored = (await memory.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(stored.bufferedObservationChunks?.map(c => c.cycleId)).toEqual([chunk.cycleId]);
    });

    it('stores observation text longer than an indexed column allows', async () => {
      const key = newKey();
      const record = await memory.initializeObservationalMemory(key);
      const long = `- ${'x'.repeat(20_000)}`;
      await memory.updateActiveObservations({
        id: record.id,
        observations: long,
        tokenCount: 1,
        lastObservedAt: at(1),
      });
      const head = (await memory.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(head.activeObservations).toBe(long);
    });

    // Thread clones copy the source thread's record with insertObservationalMemoryRecord.
    it('a copied record keeps its flags, cursor and buffered chunks', async () => {
      const key = newKey();
      const chunk = { id: `ombuf-${randomUUID()}`, ...chunkAt('copied', 300), createdAt: at(301) };
      const record: ObservationalMemoryRecord = {
        id: randomUUID(),
        scope: 'thread',
        threadId: key.threadId,
        resourceId: key.resourceId,
        createdAt: at(10),
        updatedAt: at(20),
        lastObservedAt: at(250),
        originType: 'reflection',
        generationCount: 2,
        activeObservations: '- copied observations',
        bufferedObservationChunks: [chunk],
        totalTokensObserved: 90,
        observationTokenCount: 30,
        pendingMessageTokens: 12,
        isReflecting: false,
        isObserving: true,
        isBufferingObservation: true,
        isBufferingReflection: false,
        lastBufferedAtTokens: 40,
        lastBufferedAtTime: at(260),
        config: { scope: 'thread' },
        observedMessageIds: ['m1', 'm2'],
        observedTimezone: 'Europe/Warsaw',
        supersededBy: null,
      };
      await memory.insertObservationalMemoryRecord(record);

      const head = (await other.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(head).toMatchObject({
        id: record.id,
        generationCount: 2,
        activeObservations: '- copied observations',
        pendingMessageTokens: 12,
        isObserving: true,
        isBufferingObservation: true,
        isReflecting: false,
        lastBufferedAtTokens: 40,
        observedMessageIds: ['m1', 'm2'],
        observedTimezone: 'Europe/Warsaw',
        config: { scope: 'thread' },
        supersededBy: null,
      });
      expect(head.lastObservedAt?.toISOString()).toBe(at(250).toISOString());
      expect(head.lastBufferedAtTime?.toISOString()).toBe(at(260).toISOString());
      expect(head.bufferedObservationChunks?.map(c => c.cycleId)).toEqual([chunk.cycleId]);
    });

    it('concurrent config overrides from two processes both land', async () => {
      const key = newKey();
      const record = await memory.initializeObservationalMemory({ ...key, config: { observationThreshold: 1 } });
      await Promise.all([
        memory.updateObservationalMemoryConfig({ id: record.id, config: { _overrides: { a: 1 } } }),
        other.updateObservationalMemoryConfig({ id: record.id, config: { _overrides: { b: 2 } } }),
      ]);
      const head = (await memory.getObservationalMemory(key.threadId, key.resourceId))!;
      expect(head.config).toEqual({ observationThreshold: 1, _overrides: { a: 1, b: 2 } });
    });

    it('a store with a custom schema keeps its records in that schema', async () => {
      const schemaName = `om_schema_${Math.floor(Math.random() * 1e6)}`;
      // Created up front: concurrent domain inits racing to CREATE SCHEMA is a separate, pre-existing issue.
      await db.pool.request().query(`CREATE SCHEMA [${schemaName}]`);
      const store = new MSSQLStore({
        id: 'om-regress-schema',
        server: SERVER.server,
        port: SERVER.port,
        user: SERVER.user,
        password: SERVER.password,
        database: db.database,
        schemaName,
      });
      await store.init();
      stores.push(store);
      const scoped = (await store.getStore('memory'))!;
      const key = newKey();
      const record = await scoped.initializeObservationalMemory(key);
      await scoped.createReflectionGeneration({ currentRecord: record, reflection: '- reflected', tokenCount: 1 });

      const rows = await db.pool
        .request()
        .input('lookupKey', `thread:${key.threadId}`)
        .query(
          `SELECT id, supersededBy FROM [${schemaName}].[mastra_observational_memory] WHERE lookupKey = @lookupKey`,
        );
      expect(rows.recordset).toHaveLength(2);
      expect(rows.recordset.filter(r => r.supersededBy === null)).toHaveLength(1);
      expect(await rowsFor(key.threadId)).toEqual([]);
    });

    const openSchemaStore = async (schemaName: string, extra: { skipDefaultIndexes?: boolean } = {}) => {
      await db.pool.request().query(`CREATE SCHEMA [${schemaName}]`);
      const store = new MSSQLStore({
        id: `om-regress-${schemaName}`,
        server: SERVER.server,
        port: SERVER.port,
        user: SERVER.user,
        password: SERVER.password,
        database: db.database,
        schemaName,
        ...extra,
      });
      stores.push(store);
      return store;
    };
    const omIndexes = async (schemaName: string) =>
      (
        await db.pool
          .request()
          .input('schemaName', schemaName)
          .query(
            `SELECT i.name FROM sys.indexes i
             JOIN sys.tables t ON t.object_id = i.object_id
             JOIN sys.schemas s ON s.schema_id = t.schema_id
             WHERE s.name = @schemaName AND t.name = 'mastra_observational_memory' AND i.type_desc = 'NONCLUSTERED'`,
          )
      ).recordset.map(r => r.name as string);

    it('initializes with a long schema name and still creates the OM lookup index', async () => {
      // 40 characters: with the schema name prefixed, the index name would pass the 63-character limit.
      const schemaName = `om_long_schema_name_${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}_abcdefghijklm`;
      const store = await openSchemaStore(schemaName);
      await store.init();
      expect(await omIndexes(schemaName)).toEqual(['mastra_om_lookupkey_generation_idx']);
    });

    it('creates no OM lookup index when skipDefaultIndexes is set', async () => {
      const schemaName = `om_skip_${Math.floor(Math.random() * 1e6)}`;
      const store = await openSchemaStore(schemaName, { skipDefaultIndexes: true });
      await store.init();
      expect(await omIndexes(schemaName)).toEqual([]);
      const scoped = (await store.getStore('memory'))!;
      const record = await scoped.initializeObservationalMemory(newKey());
      expect(record.id).toBeTruthy();
    });

    it('activation waits for a row lock held by another writer and then sees its write', async () => {
      const key = newKey();
      const record = await memory.initializeObservationalMemory(key);
      const one = chunkAt('one', 101);
      await memory.appendBufferedObservations({ id: record.id, chunk: one });

      const holder = db.pool.transaction();
      await holder.begin();
      try {
        const locked = await holder
          .request()
          .input('id', record.id)
          .query(`SELECT bufferedObservationChunks FROM ${OM_TABLE} WITH (UPDLOCK, ROWLOCK, HOLDLOCK) WHERE id = @id`);
        let settled = false;
        const swap = memory
          .swapBufferedToActive({
            id: record.id,
            activationRatio: 1,
            messageTokensThreshold: 1000,
            currentPendingTokens: 1000,
          })
          .finally(() => {
            settled = true;
          });
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(settled).toBe(false);
        // The lock holder appends a chunk; activation must see it once the lock is released.
        const two = { id: 'ombuf-two', ...chunkAt('two', 201), createdAt: new Date().toISOString() };
        const chunks = [...JSON.parse(locked.recordset[0].bufferedObservationChunks), two];
        await holder
          .request()
          .input('chunks', JSON.stringify(chunks))
          .input('id', record.id)
          .query(`UPDATE ${OM_TABLE} SET bufferedObservationChunks = @chunks WHERE id = @id`);
        await holder.commit();
        const result = await swap;
        expect(result.activatedCycleIds).toEqual([one.cycleId, two.cycleId]);
      } catch (error) {
        await holder.rollback().catch(() => {});
        throw error;
      }
    });

    it('a second store starting against an existing table keeps every record readable', async () => {
      const key = newKey();
      const record = await memory.initializeObservationalMemory(key);
      const reopened = await openStore(db.database, 'om-regress-restart');
      stores.push(reopened.store);
      const head: ObservationalMemoryRecord | null = await reopened.memory.getObservationalMemory(
        key.threadId,
        key.resourceId,
      );
      expect(head?.id).toBe(record.id);
    });
  });
});
