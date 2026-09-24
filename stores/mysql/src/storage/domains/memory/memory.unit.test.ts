import { OBSERVATIONAL_MEMORY_TABLE_SCHEMA, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';

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

describe('listThreads pagination', () => {
  it.each([NaN, Infinity, -Infinity, 1.5, -0.5, -1])('rejects %s before querying an empty database', async value => {
    const { pool, statements } = createMockPool(convergedCatalog({ withOmIndex: true }));
    const operations = new StoreOperationsMySQL({ pool, database: 'mastra' });
    const memory = new MemoryMySQL({ pool, operations, skipDefaultIndexes: true });

    await expect(memory.listThreads({ perPage: value })).rejects.toThrow('perPage must be >= 0');
    for (const perPage of [10, 0, undefined, false] as const) {
      await expect(memory.listThreads({ page: value, perPage })).rejects.toThrow('page must be >= 0');
    }
    expect(statements).toEqual([]);
  });

  it.each([10, 0, undefined, false] as const)('queries with valid perPage %s', async perPage => {
    const { pool, statements } = createMockPool(convergedCatalog({ withOmIndex: true }));
    const operations = new StoreOperationsMySQL({ pool, database: 'mastra' });
    const memory = new MemoryMySQL({ pool, operations, skipDefaultIndexes: true });

    expect(await memory.listThreads({ page: 2, perPage })).toEqual({
      threads: [],
      total: 0,
      page: 2,
      perPage: perPage ?? 100,
      hasMore: false,
    });
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/COUNT/i);
  });
});

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

describe('Observational Memory metadata persistence', () => {
  it('round-trips cursor metadata through a reflection generation', async () => {
    let row: Record<string, unknown> | undefined;
    const execute = vi.fn(async (sql: string, params: unknown[] = []) => {
      if (/^INSERT INTO `mastra_observational_memory`/.test(sql)) {
        const columns = sql
          .match(/\(([^)]+)\) VALUES/)![1]!
          .split(',')
          .map(column => column.trim().replaceAll('`', ''));
        row = Object.fromEntries(columns.map((column, index) => [column, params[index]]));
        return [{ affectedRows: 1 }, []];
      }
      if (/^SELECT \* FROM `mastra_observational_memory`/.test(sql)) return [row ? [row] : [], []];
      return [[], []];
    });
    const pool = { execute, query: execute } as unknown as Pool;
    const operations = new StoreOperationsMySQL({ pool, database: 'mastra' });
    const memory = new MemoryMySQL({ pool, operations, skipDefaultIndexes: true });
    const cursor = {
      lastObservedAt: '2026-01-01T00:00:00.000Z',
      messageIds: ['message-a', 'message-b'],
    };
    const currentRecord: ObservationalMemoryRecord = {
      id: 'generation-0',
      scope: 'thread',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      lastObservedAt: new Date('2026-01-01T00:00:00.000Z'),
      originType: 'initial',
      generationCount: 0,
      activeObservations: 'Initial observation',
      totalTokensObserved: 10,
      observationTokenCount: 10,
      pendingMessageTokens: 0,
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      config: {},
      metadata: { __mastra_observation_cursor: cursor },
    };

    await memory.createReflectionGeneration({ currentRecord, reflection: 'Reflected observation', tokenCount: 5 });
    const restored = await memory.getObservationalMemory('thread-1', 'resource-1');

    expect(restored?.metadata).toEqual({ __mastra_observation_cursor: cursor });
  });
});
