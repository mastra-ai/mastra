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

import { namespaceSchemaReadyResult } from './namespace-test-utils';
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

describe('PgVector HNSW iterative scan', () => {
  const indexName = 'hnsw_index';
  let statements: string[];
  let extensionVersion: string | null;
  let listIndexesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    statements = [];
    mockClient.query.mockImplementation(async (text: any) => {
      const sql = typeof text === 'string' ? text : text?.text || '';
      statements.push(sql);

      if (sql.includes('FROM pg_extension')) {
        return { rows: extensionVersion ? [{ schema_name: 'public', version: extensionVersion }] : [] };
      }
      if (sql.includes('AS composite_index')) {
        return namespaceSchemaReadyResult();
      }
      return { rows: [] };
    });
    listIndexesSpy = vi.spyOn(PgVector.prototype, 'listIndexes').mockResolvedValue([indexName]);
  });

  afterEach(() => {
    listIndexesSpy.mockRestore();
    mockClient.query.mockReset();
  });

  const runHnswQuery = async () => {
    const vectorStore = new PgVector({
      id: 'pg-vector-iterative-scan-test',
      connectionString: 'postgresql://postgres:postgres@localhost:5432/mastra',
    });
    await (vectorStore as any).cacheWarmupPromise;
    vi.spyOn(vectorStore as any, 'getIndexMetadata').mockResolvedValue({
      dimension: 3,
      metric: 'cosine',
      type: 'hnsw',
      vectorType: 'vector',
      config: { m: 16, efConstruction: 64 },
    });
    statements = [];
    await vectorStore.query({ indexName, queryVector: [1, 0, 0], topK: 2 });
    return statements;
  };

  it.each(['0.7.4', '0.5.1'])('does not set hnsw.iterative_scan on pgvector %s', async version => {
    extensionVersion = version;
    const sql = await runHnswQuery();
    expect(sql).toContain('SET LOCAL hnsw.ef_search = 32');
    expect(sql.some(s => s.includes('hnsw.iterative_scan'))).toBe(false);
  });

  it('does not set hnsw.iterative_scan when the pgvector version is unknown', async () => {
    extensionVersion = null;
    const sql = await runHnswQuery();
    expect(sql.some(s => s.includes('hnsw.iterative_scan'))).toBe(false);
  });

  it.each(['0.8.0', '0.8.4', '1.0.0'])('sets hnsw.iterative_scan on pgvector %s', async version => {
    extensionVersion = version;
    const sql = await runHnswQuery();
    expect(sql).toContain('SET LOCAL hnsw.ef_search = 32');
    expect(sql).toContain('SET LOCAL hnsw.iterative_scan = strict_order');
  });
});
