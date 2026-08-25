import { randomUUID } from 'node:crypto';

import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildConstraintName } from '../../db/constraint-utils';
import { connectionString } from '../../test-utils';
import { MemoryPG } from './index';

const OM_TABLE = 'mastra_observational_memory';
const UNIQUE_INDEX = 'idx_om_lookup_key_generation_count_unique';

async function duplicateFirstOMRow(pool: Pool, schemaName: string, id: string): Promise<void> {
  const columns = await pool.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position`,
    [schemaName, OM_TABLE],
  );
  const quotedColumns = columns.rows.map(({ column_name }) => `"${column_name}"`).join(', ');
  const selectedColumns = columns.rows.map(({ column_name }) => (column_name === 'id' ? '$1' : `"${column_name}"`));
  await pool.query(
    `INSERT INTO "${schemaName}"."${OM_TABLE}" (${quotedColumns})
     SELECT ${selectedColumns.join(', ')} FROM "${schemaName}"."${OM_TABLE}" LIMIT 1`,
    [id],
  );
}

describe('MemoryPG observational-memory generation invariants', () => {
  let pool: Pool;
  let schemaName: string;
  let memory: MemoryPG;

  beforeAll(() => {
    pool = new Pool({ connectionString, max: 30 });
  });

  beforeEach(async () => {
    schemaName = `om_concurrency_${randomUUID().replaceAll('-', '')}`;
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    memory = new MemoryPG({ pool, schemaName, skipDefaultIndexes: true });
    await memory.init();
  });

  afterEach(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns one generation-zero record to concurrent initializers', async () => {
    const input = {
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread' as const,
      config: { observation: { model: 'test-model' } },
      observedTimezone: 'Europe/Bucharest',
    };

    const records = await Promise.all(Array.from({ length: 24 }, () => memory.initializeObservationalMemory(input)));

    expect(new Set(records.map(record => record.id)).size).toBe(1);
    expect(records.every(record => record.generationCount === 0)).toBe(true);

    const stored = await pool.query<{ id: string; count: string }>(
      `SELECT MIN(id) AS id, COUNT(*)::text AS count
         FROM "${schemaName}"."${OM_TABLE}"
        WHERE "lookupKey" = $1 AND "generationCount" = 0`,
      ['thread:thread-1'],
    );
    expect(stored.rows[0]?.count).toBe('1');
    expect(stored.rows[0]?.id).toBe(records[0]?.id);
  });

  it('uses one canonical index name during concurrent init with a long schema name', async () => {
    const indexName = buildConstraintName({ baseName: UNIQUE_INDEX, schemaName });
    await pool.query(`DROP INDEX "${schemaName}"."${indexName}"`);

    const stores = Array.from({ length: 4 }, () => new MemoryPG({ pool, schemaName, skipDefaultIndexes: true }));
    await expect(Promise.all(stores.map(store => store.init()))).resolves.toHaveLength(4);

    const indexes = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2`,
      [schemaName, indexName],
    );
    expect(Buffer.byteLength(indexName, 'utf8')).toBeLessThanOrEqual(63);
    expect(indexes.rows).toEqual([
      expect.objectContaining({
        indexname: indexName,
        indexdef: expect.stringContaining('UNIQUE INDEX'),
      }),
    ]);
  });

  it.each([
    {
      name: 'non-unique',
      statements: (indexName: string) => [
        `CREATE INDEX "${indexName}" ON "${schemaName}"."${OM_TABLE}" ("lookupKey", "generationCount")`,
      ],
    },
    {
      name: 'partial',
      statements: (indexName: string) => [
        `CREATE UNIQUE INDEX "${indexName}" ON "${schemaName}"."${OM_TABLE}" ("lookupKey", "generationCount") WHERE "generationCount" >= 0`,
      ],
    },
    {
      name: 'wrongly ordered',
      statements: (indexName: string) => [
        `CREATE UNIQUE INDEX "${indexName}" ON "${schemaName}"."${OM_TABLE}" ("generationCount", "lookupKey")`,
      ],
    },
    {
      name: 'attached to another table',
      statements: (indexName: string) => [
        `CREATE TABLE "${schemaName}"."om_index_collision" ("lookupKey" text NOT NULL, "generationCount" integer NOT NULL)`,
        `CREATE UNIQUE INDEX "${indexName}" ON "${schemaName}"."om_index_collision" ("lookupKey", "generationCount")`,
      ],
    },
  ])('fails closed when the generation index name is occupied by a $name index', async ({ statements }) => {
    const indexName = buildConstraintName({ baseName: UNIQUE_INDEX, schemaName });
    await pool.query(`DROP INDEX "${schemaName}"."${indexName}"`);
    for (const statement of statements(indexName)) await pool.query(statement);

    const upgradedMemory = new MemoryPG({ pool, schemaName, skipDefaultIndexes: true });
    await expect(upgradedMemory.init()).rejects.toMatchObject({
      id: expect.stringContaining('MIGRATION_REQUIRED'),
      message: expect.stringContaining('does not provide the required observational-memory generation invariant'),
    });
  });

  it('rejects colliding reflections instead of creating an ambiguous history', async () => {
    const initial = await memory.initializeObservationalMemory({
      threadId: null,
      resourceId: 'resource-1',
      scope: 'resource',
      config: {},
    });

    const createReflection = (reflection: string) =>
      memory.createReflectionGeneration({ currentRecord: initial, reflection, tokenCount: 10 });
    const results = await Promise.allSettled([createReflection('reflection-a'), createReflection('reflection-b')]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);

    const history = await memory.getObservationalMemoryHistory(null, 'resource-1');
    expect(history.map((record: ObservationalMemoryRecord) => record.generationCount)).toEqual([1, 0]);
  });

  it('reports an actionable migration error when externally managed schema omits the unique index', async () => {
    const indexName = buildConstraintName({ baseName: UNIQUE_INDEX, schemaName });
    await pool.query(`DROP INDEX "${schemaName}"."${indexName}"`);

    await expect(
      memory.initializeObservationalMemory({
        threadId: 'thread-missing-index',
        resourceId: 'resource-1',
        scope: 'thread',
        config: {},
      }),
    ).rejects.toMatchObject({
      id: expect.stringContaining('MIGRATION_REQUIRED'),
      message: expect.stringContaining('externally managed migration'),
    });
  });

  it('rejects an invalid index left by a failed concurrent build', async () => {
    await memory.initializeObservationalMemory({
      threadId: 'thread-invalid-index',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    const indexName = buildConstraintName({ baseName: UNIQUE_INDEX, schemaName });
    await pool.query(`DROP INDEX "${schemaName}"."${indexName}"`);
    await duplicateFirstOMRow(pool, schemaName, 'invalid-index-duplicate');
    await expect(
      pool.query(
        `CREATE UNIQUE INDEX CONCURRENTLY "${indexName}" ON "${schemaName}"."${OM_TABLE}" ("lookupKey", "generationCount")`,
      ),
    ).rejects.toThrow();

    const invalidIndex = await pool.query<{ indisvalid: boolean }>(
      `SELECT i.indisvalid
         FROM pg_catalog.pg_index i
         JOIN pg_catalog.pg_class index_class ON index_class.oid = i.indexrelid
         JOIN pg_catalog.pg_namespace namespace ON namespace.oid = index_class.relnamespace
        WHERE namespace.nspname = $1 AND index_class.relname = $2`,
      [schemaName, indexName],
    );
    expect(invalidIndex.rows).toEqual([{ indisvalid: false }]);

    const upgradedMemory = new MemoryPG({ pool, schemaName, skipDefaultIndexes: true });
    await expect(upgradedMemory.init()).rejects.toMatchObject({
      id: expect.stringContaining('MIGRATION_REQUIRED'),
      message: expect.stringContaining('the index is invalid'),
    });
  });

  it('fails closed when an existing database contains duplicate generations', async () => {
    await memory.initializeObservationalMemory({
      threadId: 'thread-duplicate',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    const indexName = buildConstraintName({ baseName: UNIQUE_INDEX, schemaName });
    await pool.query(`DROP INDEX "${schemaName}"."${indexName}"`);
    await duplicateFirstOMRow(pool, schemaName, 'duplicate-id');

    const upgradedMemory = new MemoryPG({ pool, schemaName, skipDefaultIndexes: true });
    await expect(upgradedMemory.init()).rejects.toMatchObject({
      id: expect.stringContaining('MIGRATION_REQUIRED'),
      message: expect.stringContaining('cannot select a winner'),
    });
  });
});
