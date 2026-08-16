import type { Pool } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';

import { StoreOperationsMySQL } from '../domains/operations';
import { loadSchemaSnapshot } from './schema-snapshot';

type Row = Record<string, unknown>;

interface CatalogFixture {
  tables?: Row[];
  columns?: Row[];
  statistics?: Row[];
}

/**
 * Records every statement sent through the pool and answers the three catalog
 * reads from the fixture. Everything else returns empty result sets.
 */
function createMockPool(fixture: CatalogFixture = {}) {
  const statements: string[] = [];
  const answer = (sql: string): Row[] => {
    if (/information_schema\.tables/i.test(sql) && /SELECT table_name/i.test(sql)) return fixture.tables ?? [];
    if (/information_schema\.tables/i.test(sql)) return [{ count: fixture.tables?.length ? 1 : 0 }];
    if (/information_schema\.statistics/i.test(sql)) return fixture.statistics ?? [];
    if (/information_schema\.columns/i.test(sql)) return fixture.columns ?? [];
    if (/SELECT DATABASE\(\)/i.test(sql)) return [{ db: 'mastra' }];
    return [];
  };
  const run = async (sql: string) => {
    statements.push(sql);
    return [answer(sql), []] as unknown;
  };
  const pool = {
    execute: run,
    query: run,
    getConnection: async () => ({
      execute: run,
      query: run,
      release: () => {},
    }),
  } as unknown as Pool;
  return { pool, statements };
}

const catalog: CatalogFixture = {
  tables: [{ TABLE_NAME: 'mastra_threads' }],
  columns: [
    { TABLE_NAME: 'mastra_threads', COLUMN_NAME: 'id' },
    { TABLE_NAME: 'mastra_threads', COLUMN_NAME: 'resourceId' },
  ],
  statistics: [{ TABLE_NAME: 'mastra_threads', INDEX_NAME: 'idx_om_lookup_key' }],
};

describe('loadSchemaSnapshot', () => {
  it('builds tables, columns, and indexes from three reads', async () => {
    const { pool, statements } = createMockPool(catalog);
    const snapshot = await loadSchemaSnapshot(pool, 'mastra');
    expect(statements).toHaveLength(3);
    expect(snapshot?.tables.has('mastra_threads')).toBe(true);
    expect(snapshot?.columns.get('mastra_threads')).toEqual(new Set(['id', 'resourceid']));
    expect(snapshot?.indexes.has('mastra_threads.idx_om_lookup_key')).toBe(true);
  });

  it('is casing agnostic about catalog result keys', async () => {
    const { pool } = createMockPool({
      tables: [{ table_name: 'mastra_threads' }],
      columns: [{ table_name: 'mastra_threads', column_name: 'id' }],
      statistics: [{ table_name: 'mastra_threads', index_name: 'idx_om_lookup_key' }],
    });
    const snapshot = await loadSchemaSnapshot(pool, 'mastra');
    expect(snapshot?.tables.has('mastra_threads')).toBe(true);
    expect(snapshot?.columns.get('mastra_threads')).toEqual(new Set(['id']));
    expect(snapshot?.indexes.has('mastra_threads.idx_om_lookup_key')).toBe(true);
  });
});

describe('operations consult and maintain the init snapshot', () => {
  const schema = { id: { type: 'text', primaryKey: true } } as any;

  async function opsWithSnapshot(fixture: CatalogFixture) {
    const { pool, statements } = createMockPool(fixture);
    const ops = new StoreOperationsMySQL({ pool, database: 'mastra' });
    await ops.loadInitSchemaSnapshot();
    statements.length = 0; // only count statements after the snapshot load
    return { ops, statements };
  }

  it('createTable consults the snapshot and skips converged tables', async () => {
    const { ops, statements } = await opsWithSnapshot(catalog);
    await ops.createTable({ tableName: 'mastra_threads' as any, schema });
    expect(statements).toEqual([]);
  });

  it('createTable maintains the snapshot so a later alterTable issues no probes', async () => {
    const { ops, statements } = await opsWithSnapshot({});
    await ops.createTable({ tableName: 'mastra_threads' as any, schema });
    expect(statements.filter(sql => /^CREATE TABLE/i.test(sql))).toHaveLength(1);
    statements.length = 0;
    await ops.alterTable({ tableName: 'mastra_threads' as any, schema, ifNotExists: ['id'] });
    expect(statements).toEqual([]);
  });

  it('alterTable uses snapshot columns instead of probing', async () => {
    const { ops, statements } = await opsWithSnapshot(catalog);
    const fullSchema = { ...schema, newCol: { type: 'text' } } as any;
    await ops.alterTable({
      tableName: 'mastra_threads' as any,
      schema: fullSchema,
      ifNotExists: ['id', 'resourceId', 'newCol'],
    });
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/^ALTER TABLE .* ADD COLUMN .*newCol/);
  });

  it('createIndex skips indexes the snapshot knows, keyed per table', async () => {
    const { ops, statements } = await opsWithSnapshot(catalog);
    await ops.createIndex({ name: 'idx_om_lookup_key', table: 'mastra_threads' as any, columns: ['id'] });
    expect(statements).toEqual([]);
    // MySQL index names are unique per table, not per schema: the same name on
    // a different table must not be suppressed by the snapshot.
    await ops.createIndex({ name: 'idx_om_lookup_key', table: 'mastra_messages' as any, columns: ['id'] });
    expect(statements.some(sql => /^CREATE INDEX/i.test(sql))).toBe(true);
  });

  it('falls back to probing when no snapshot is installed', async () => {
    const { pool, statements } = createMockPool(catalog);
    const ops = new StoreOperationsMySQL({ pool, database: 'mastra' });
    await ops.alterTable({ tableName: 'mastra_threads' as any, schema, ifNotExists: ['id'] });
    expect(statements.some(sql => /information_schema\.tables/i.test(sql))).toBe(true);
    expect(statements.some(sql => /information_schema\.columns/i.test(sql))).toBe(true);
  });

  it('an undefined schema name disables the snapshot and probes remain', async () => {
    const { pool, statements } = createMockPool({ ...catalog });
    // No database configured and SELECT DATABASE() resolves to null.
    const noDbRun = async (sql: string) => {
      statements.push(sql);
      if (/SELECT DATABASE\(\)/i.test(sql)) return [[{ db: null }], []];
      if (/information_schema\.tables/i.test(sql)) return [[{ count: 1 }], []];
      if (/information_schema\.columns/i.test(sql)) return [[{ COLUMN_NAME: 'id' }], []];
      return [[], []];
    };
    (pool as any).execute = noDbRun;
    (pool as any).query = noDbRun;
    const ops = new StoreOperationsMySQL({ pool });
    await ops.loadInitSchemaSnapshot();
    expect(ops.getInitSchemaSnapshot()).toBeNull();
    statements.length = 0;
    await ops.alterTable({ tableName: 'mastra_threads' as any, schema, ifNotExists: ['id'] });
    expect(statements.some(sql => /information_schema\.columns/i.test(sql))).toBe(true);
  });
});
