import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/core/error', () => ({
  ErrorCategory: { USER: 'USER', THIRD_PARTY: 'THIRD_PARTY' },
  ErrorDomain: { MASTRA_VECTOR: 'MASTRA_VECTOR' },
  MastraError: class MastraError extends Error {
    constructor(
      public metadata: any,
      error?: Error,
    ) {
      super(error?.message ?? 'MastraError');
    }
  },
}));

vi.mock('@mastra/core/utils', () => ({
  parseSqlIdentifier: (name: string) => name,
}));

vi.mock('@mastra/core/vector', () => ({
  MastraVector: class MastraVector {
    id: string;
    disableInit: boolean;
    logger = { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn(), trackException: vi.fn() };
    constructor({ id, disableInit }: { id: string; disableInit?: boolean }) {
      this.id = id;
      this.disableInit = disableInit ?? false;
    }
  },
  validateTopK: () => {},
  validateUpsertInput: () => {},
}));

vi.mock('@mastra/core/vector/filter', () => ({
  BaseFilterTranslator: class {
    static DEFAULT_OPERATORS = {};
    translate(filter: any) {
      return filter;
    }
    isEmpty(filter: any) {
      return !filter || (typeof filter === 'object' && Object.keys(filter).length === 0);
    }
    validateFilter() {}
    isPrimitive() {
      return false;
    }
  },
}));

import type { PgVectorConfig } from '../shared/config';
import { PgVector } from '.';

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

vi.mock('pg', () => {
  class MockPool {
    public options: any;
    public connect = vi.fn(async () => mockClient);
    public end = vi.fn(async () => {});
    public on = vi.fn().mockReturnThis();

    constructor(options: any) {
      this.options = options;
    }
  }

  return { Pool: MockPool };
});

const isCountQuery = (sql: string) => /COUNT\(\*\)/i.test(sql);

const clearIndexCaches = (vectorStore: PgVector) => {
  (vectorStore as any).describeIndexCache.clear();
  (vectorStore as any).indexMetadataCache.clear();
};

describe('PgVector row counts', () => {
  const indexName = 'memory_messages';
  const baseConfig: PgVectorConfig & { id: string } = {
    connectionString: 'postgresql://postgres:postgres@localhost:5432/mastra',
    id: 'pg-vector-count-scan-test',
  };

  let statements: string[];
  let rowCount: number;
  let listIndexesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    statements = [];
    rowCount = 42;

    mockClient.query.mockImplementation(async (text: any) => {
      const sql = typeof text === 'string' ? text : text?.text || '';
      statements.push(sql);

      if (sql.includes('information_schema.columns') && sql.includes('udt_name')) {
        return { rows: [{ udt_name: 'vector' }] };
      }
      if (sql.includes('pg_attribute') && sql.includes('atttypmod')) {
        return { rows: [{ dimension: 3 }] };
      }
      if (isCountQuery(sql)) {
        return { rows: [{ count: String(rowCount) }] };
      }
      return { rows: [] };
    });
    mockClient.release.mockReset();

    listIndexesSpy = vi.spyOn(PgVector.prototype, 'listIndexes').mockResolvedValue([indexName]);
  });

  afterEach(() => {
    listIndexesSpy.mockRestore();
    mockClient.query.mockReset();
  });

  it('does not count rows while warming the index cache on construction', async () => {
    const vectorStore = new PgVector(baseConfig);
    await (vectorStore as any).cacheWarmupPromise;

    // The warmup did read the catalog...
    expect(statements.some(sql => sql.includes('information_schema.columns'))).toBe(true);
    // ...but never scanned the table for a count it does not use.
    expect(statements.filter(isCountQuery)).toEqual([]);
    // And it still populated the caches it exists for.
    expect((vectorStore as any).createdIndexes.has(indexName)).toBe(true);
    expect((vectorStore as any).indexVectorTypes.get(indexName)).toBe('vector');
  });

  it('does not count rows when querying', async () => {
    const vectorStore = new PgVector(baseConfig);
    await (vectorStore as any).cacheWarmupPromise;
    clearIndexCaches(vectorStore);
    statements = [];

    await vectorStore.query({ indexName, queryVector: [1, 2, 3] });

    // The query had to look the index up for itself, and it read the catalog to do it.
    expect(statements.some(sql => sql.includes('information_schema.columns'))).toBe(true);
    expect(statements.filter(isCountQuery)).toEqual([]);
  });

  it('returns an exact, uncached row count from describeIndex', async () => {
    const vectorStore = new PgVector(baseConfig);
    await (vectorStore as any).cacheWarmupPromise;

    await expect(vectorStore.describeIndex({ indexName })).resolves.toEqual({
      dimension: 3,
      count: 42,
      metric: 'cosine',
      type: 'flat',
      vectorType: 'vector',
      config: {},
    });

    // describeIndex reports the row count as it is now, not as it was on the first call.
    rowCount = 43;
    await expect(vectorStore.describeIndex({ indexName })).resolves.toMatchObject({ count: 43 });
  });

  it('returns an exact row count from getIndexInfo', async () => {
    const vectorStore = new PgVector(baseConfig);
    await (vectorStore as any).cacheWarmupPromise;
    statements = [];

    await expect(vectorStore.getIndexInfo({ indexName })).resolves.toEqual({
      dimension: 3,
      count: 42,
      metric: 'cosine',
      type: 'flat',
      vectorType: 'vector',
      config: {},
    });
    expect(statements.filter(isCountQuery)).toHaveLength(1);
  });

  it('makes a single round trip when getIndexInfo is called concurrently on a cold cache', async () => {
    const describeIndexSpy = vi.spyOn(PgVector.prototype, 'describeIndex');
    try {
      const vectorStore = new PgVector(baseConfig);
      await (vectorStore as any).cacheWarmupPromise;
      clearIndexCaches(vectorStore);
      statements = [];
      describeIndexSpy.mockClear();

      const results = await Promise.all(Array.from({ length: 10 }, () => vectorStore.getIndexInfo({ indexName })));

      expect(describeIndexSpy).toHaveBeenCalledTimes(1);
      expect(statements.filter(isCountQuery)).toHaveLength(1);
      for (const result of results) {
        expect(result.count).toBe(42);
      }
    } finally {
      describeIndexSpy.mockRestore();
    }
  });

  it('does not cache a failed index lookup', async () => {
    const vectorStore = new PgVector(baseConfig);
    await (vectorStore as any).cacheWarmupPromise;
    clearIndexCaches(vectorStore);

    mockClient.query.mockRejectedValueOnce(new Error('connection terminated'));
    await expect(vectorStore.getIndexInfo({ indexName })).rejects.toThrow();
    expect((vectorStore as any).describeIndexCache.size).toBe(0);
    expect((vectorStore as any).indexMetadataCache.size).toBe(0);

    await expect(vectorStore.getIndexInfo({ indexName })).resolves.toMatchObject({ count: 42 });
  });
});
