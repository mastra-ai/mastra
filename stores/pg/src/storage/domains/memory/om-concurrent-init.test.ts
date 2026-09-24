import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { connectionString } from '../../test-utils';
import { MemoryPG } from './index';

const pool = new Pool({ connectionString });
const schemaName = `om_${randomUUID().slice(0, 8)}`;
const createStore = () => new MemoryPG({ pool, schemaName });

beforeAll(async () => {
  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  await createStore().init();
});

afterAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await pool.end();
});

describe('observational memory generation ownership', () => {
  it('starts with legacy duplicate histories without modifying them', async () => {
    const store = createStore();
    const input = { threadId: randomUUID(), resourceId: 'resource-1', scope: 'thread' as const, config: {} };
    const original = await store.initializeObservationalMemory(input);
    await pool.query(
      `INSERT INTO "${schemaName}"."mastra_observational_memory" SELECT (jsonb_populate_record(NULL::"${schemaName}"."mastra_observational_memory", to_jsonb(row) || jsonb_build_object('id', $1::text))).* FROM "${schemaName}"."mastra_observational_memory" row WHERE id = $2`,
      [randomUUID(), original.id],
    );
    const before = await pool.query(
      `SELECT id FROM "${schemaName}"."mastra_observational_memory" WHERE "lookupKey" = $1 ORDER BY id`,
      [`thread:${input.threadId}`],
    );
    await createStore().init();
    const after = await pool.query(
      `SELECT id FROM "${schemaName}"."mastra_observational_memory" WHERE "lookupKey" = $1 ORDER BY id`,
      [`thread:${input.threadId}`],
    );
    expect(after.rows).toEqual(before.rows);
    expect(after.rows).toHaveLength(2);
  });

  it('warns once when reading a legacy duplicate history and identifies the affected generation', async () => {
    const store = createStore();
    const warn = vi.fn();
    store.__setLogger({ warn } as Parameters<typeof store.__setLogger>[0]);
    const threadId = randomUUID();
    const currentRecord = await store.initializeObservationalMemory({
      threadId,
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });
    const next = await store.createReflectionGeneration({ currentRecord, reflection: 'summary', tokenCount: 1 });
    await pool.query(
      `INSERT INTO "${schemaName}"."mastra_observational_memory" SELECT (jsonb_populate_record(NULL::"${schemaName}"."mastra_observational_memory", to_jsonb(row) || jsonb_build_object('id', $1::text))).* FROM "${schemaName}"."mastra_observational_memory" row WHERE id = $2`,
      [randomUUID(), next.id],
    );

    expect((await store.getObservationalMemory(threadId, 'resource-1'))?.generationCount).toBe(1);
    await store.getObservationalMemoryHistory(threadId, 'resource-1');
    await store.getObservationalMemory(threadId, 'resource-1');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`generation 1 for lookupKey "thread:${threadId}"`));
  });

  it('returns the same stored generation to concurrent initializers from separate stores', async () => {
    const threadId = randomUUID();
    const stores = Array.from({ length: 12 }, createStore);
    const records = await Promise.all(
      stores.map(store =>
        store.initializeObservationalMemory({ threadId, resourceId: 'resource-1', scope: 'thread', config: {} }),
      ),
    );
    expect(new Set(records.map(record => record.id)).size).toBe(1);
    const rows = await pool.query(
      `SELECT id FROM "${schemaName}"."mastra_observational_memory" WHERE "lookupKey" = $1`,
      [`thread:${threadId}`],
    );
    expect(rows.rows).toHaveLength(1);
    expect(records[0]?.id).toBe(rows.rows[0]?.id);
  });

  it('does not silently accept a second reflection for the same generation', async () => {
    const store = createStore();
    const currentRecord = await store.initializeObservationalMemory({
      threadId: randomUUID(),
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });
    const input = { currentRecord, reflection: 'summary', tokenCount: 1 };
    await store.createReflectionGeneration(input);
    await expect(store.createReflectionGeneration(input)).rejects.toThrow();
  });

  it('rejects concurrent reflections for the same generation without a unique index', async () => {
    const store = createStore();
    const currentRecord = await store.initializeObservationalMemory({
      threadId: randomUUID(),
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        createStore().createReflectionGeneration({ currentRecord, reflection: 'summary', tokenCount: 1 }),
      ),
    );
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rows = await pool.query(
      `SELECT id FROM "${schemaName}"."mastra_observational_memory" WHERE "lookupKey" = $1 AND "generationCount" = 1`,
      [`thread:${currentRecord.threadId}`],
    );
    expect(rows.rows).toHaveLength(1);
  });
});
