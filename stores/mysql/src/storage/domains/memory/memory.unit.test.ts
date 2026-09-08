import { OBSERVATIONAL_MEMORY_TABLE_SCHEMA, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { Pool } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';

import { StoreOperationsMySQL } from '../operations';
import { MemoryMySQL } from './index';

const OM_TABLE = 'mastra_observational_memory';

/**
 * Builds a catalog fixture describing a fully converged schema for every
 * table the memory domain's init touches, so the only variable under test is
 * whether the raw CREATE INDEX idx_om_lookup_key consults the snapshot.
 */
function convergedCatalog({ withOmIndex }: { withOmIndex: boolean }) {
  const omSchema = OBSERVATIONAL_MEMORY_TABLE_SCHEMA?.[OM_TABLE] ?? {};
  const tables: Record<string, string[]> = {
    mastra_threads: Object.keys(TABLE_SCHEMAS.mastra_threads ?? {}),
    mastra_messages: Object.keys(TABLE_SCHEMAS.mastra_messages ?? {}),
    mastra_resources: Object.keys(TABLE_SCHEMAS.mastra_resources ?? {}),
    [OM_TABLE]: Object.keys(omSchema),
  };
  return {
    tables: Object.keys(tables).map(t => ({ TABLE_NAME: t })),
    columns: Object.entries(tables).flatMap(([t, cols]) => cols.map(c => ({ TABLE_NAME: t, COLUMN_NAME: c }))),
    statistics: withOmIndex ? [{ TABLE_NAME: OM_TABLE, INDEX_NAME: 'idx_om_lookup_key' }] : [],
  };
}

function createMockPool(fixture: ReturnType<typeof convergedCatalog>) {
  const statements: string[] = [];
  const run = async (sql: string) => {
    statements.push(sql);
    if (/information_schema\.tables/i.test(sql) && /SELECT table_name/i.test(sql)) return [fixture.tables, []];
    if (/information_schema\.tables/i.test(sql)) return [[{ count: 1 }], []];
    if (/information_schema\.statistics/i.test(sql)) return [fixture.statistics, []];
    if (/information_schema\.columns/i.test(sql)) return [fixture.columns, []];
    return [[], []];
  };
  const pool = {
    execute: run,
    query: run,
    getConnection: async () => ({ execute: run, query: run, release: () => {} }),
  } as unknown as Pool;
  return { pool, statements };
}

async function initMemoryWithSnapshot(fixture: ReturnType<typeof convergedCatalog>) {
  const { pool, statements } = createMockPool(fixture);
  const operations = new StoreOperationsMySQL({ pool, database: 'mastra' });
  const memory = new MemoryMySQL({ pool, operations, skipDefaultIndexes: true });
  await operations.loadInitSchemaSnapshot();
  statements.length = 0; // count only statements issued by init itself
  await memory.init();
  return { operations, memory, statements };
}

describe('memory domain init consults the schema snapshot', () => {
  it('issues no statements at all when the snapshot shows a converged schema', async () => {
    const { statements } = await initMemoryWithSnapshot(convergedCatalog({ withOmIndex: true }));
    expect(statements).toEqual([]);
  });

  it('creates idx_om_lookup_key once and maintains the snapshot', async () => {
    const { memory, statements } = await initMemoryWithSnapshot(convergedCatalog({ withOmIndex: false }));
    expect(statements).toEqual([expect.stringMatching(/^CREATE INDEX idx_om_lookup_key/)]);
    statements.length = 0;
    await memory.init(); // second init in the same snapshot window
    expect(statements).toEqual([]);
  });
});
