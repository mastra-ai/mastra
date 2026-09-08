import type { Pool } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';
import { StoreOperationsMySQL } from './index';

// MySQL returns information_schema result fields with uppercase keys through mysql2
// (proven by execution on mysql:9.7: Object.keys(rows[0]) -> ['COLUMN_NAME']).
// The probe read must be casing agnostic because identifier casing can vary with
// server settings, so both key shapes are covered here.
function createPoolStub(columnRows: Record<string, unknown>[]) {
  const executed: string[] = [];
  const pool = {
    execute: async (sql: string) => {
      executed.push(sql);
      if (sql.includes('information_schema.tables')) {
        return [[{ count: 1 }], []];
      }
      if (sql.includes('information_schema.columns')) {
        return [columnRows, []];
      }
      return [[], []];
    },
    query: async () => [[{ db: 'mastra' }], []],
  } as unknown as Pool;
  return { pool, executed };
}

const schema = {
  resourceId: { type: 'text', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
} as const;

describe('alterTable existing-column probe casing', () => {
  it('issues no ALTER when existing columns come back with uppercase keys (MySQL real behavior)', async () => {
    const { pool, executed } = createPoolStub([{ COLUMN_NAME: 'resourceId' }, { COLUMN_NAME: 'createdAt' }]);
    const ops = new StoreOperationsMySQL({ pool, database: 'mastra' });

    await ops.alterTable({
      tableName: 'mastra_workflow_snapshot' as any,
      schema: schema as any,
      ifNotExists: ['resourceId', 'createdAt'],
    });

    const alters = executed.filter(sql => sql.startsWith('ALTER TABLE'));
    expect(alters).toEqual([]);
  });

  it('issues no ALTER when existing columns come back with lowercase keys (casing agnostic)', async () => {
    const { pool, executed } = createPoolStub([{ column_name: 'resourceId' }, { column_name: 'createdAt' }]);
    const ops = new StoreOperationsMySQL({ pool, database: 'mastra' });

    await ops.alterTable({
      tableName: 'mastra_workflow_snapshot' as any,
      schema: schema as any,
      ifNotExists: ['resourceId', 'createdAt'],
    });

    expect(executed.filter(sql => sql.startsWith('ALTER TABLE'))).toEqual([]);
  });

  it('still adds a column that is genuinely missing', async () => {
    const { pool, executed } = createPoolStub([{ COLUMN_NAME: 'createdAt' }]);
    const ops = new StoreOperationsMySQL({ pool, database: 'mastra' });

    await ops.alterTable({
      tableName: 'mastra_workflow_snapshot' as any,
      schema: schema as any,
      ifNotExists: ['resourceId', 'createdAt'],
    });

    const alters = executed.filter(sql => sql.startsWith('ALTER TABLE'));
    expect(alters).toHaveLength(1);
    expect(alters[0]).toContain('`resourceId`');
  });
});
