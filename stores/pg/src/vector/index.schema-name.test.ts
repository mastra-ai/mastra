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
    logger = { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn(), trackException: vi.fn() };
  },
}));

vi.mock('@mastra/core/vector/filter', () => ({
  BaseFilterTranslator: class {
    translate(filter: any) {
      return filter;
    }
  },
}));

import type { PgVectorConfig } from '../shared/config';
import { PgVector } from '.';

type QueryCall = { text: string; values?: any[] };

const queryHistory: QueryCall[] = [];

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

vi.mock('pg', () => {
  class MockPool {
    public options: any;
    public connect = vi.fn(async () => mockClient);
    public end = vi.fn(async () => {});

    constructor(options: any) {
      this.options = options;
    }
  }

  return { Pool: MockPool };
});

describe('PgVector schema-aware vector type handling', () => {
  const config: PgVectorConfig & { id: string } = {
    connectionString: 'postgresql://postgres:postgres@localhost:5432/mastra',
    schemaName: 'custom_schema',
    id: 'pg-vector-schema-test',
  };

  let vectorStore: PgVector;
  let listIndexesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    queryHistory.length = 0;
    mockClient.query.mockImplementation(async (text: any, values?: any[]) => {
      const sql = typeof text === 'string' ? text : text?.text || '';
      queryHistory.push({ text: sql, values });

      if (sql.includes('information_schema.schemata')) {
        return { rows: [{ exists: true }] };
      }

      if (sql.includes('FROM pg_extension e')) {
        return { rows: [{ schema_name: 'custom_schema' }] };
      }

      return { rows: [] };
    });
    mockClient.release.mockReset();

    listIndexesSpy = vi.spyOn(PgVector.prototype, 'listIndexes').mockResolvedValue([]);

    vectorStore = new PgVector(config);
    await (vectorStore as any).cacheWarmupPromise;
  });

  afterEach(async () => {
    await vectorStore.disconnect();
    listIndexesSpy.mockRestore();
    mockClient.query.mockReset();
  });

  it('prefixes vector type with schema when createIndex runs inside custom schema', async () => {
    await vectorStore.createIndex({
      indexName: 'nlQuery',
      dimension: 1536,
      buildIndex: false,
    });

    const createTableCall = queryHistory.find(call => call.text.includes('CREATE TABLE'));
    expect(createTableCall?.text ?? '').toContain('embedding custom_schema.vector');
  });
});

describe('PgVector halfvec version detection after custom schema install', () => {
  const config: PgVectorConfig & { id: string } = {
    connectionString: 'postgresql://postgres:postgres@localhost:5432/mastra',
    schemaName: 'custom_schema',
    id: 'pg-vector-halfvec-version-test',
  };

  let vectorStore: PgVector;
  let listIndexesSpy: ReturnType<typeof vi.spyOn>;
  const queryHistory: QueryCall[] = [];

  beforeEach(async () => {
    queryHistory.length = 0;
    let extensionCreated = false;

    mockClient.query.mockImplementation(async (text: any) => {
      const sql = typeof text === 'string' ? text : text?.text || '';
      queryHistory.push({ text: sql });

      // Schema check
      if (sql.includes('information_schema.schemata')) {
        return { rows: [{ exists: true }] };
      }

      // First pg_extension check - extension doesn't exist yet
      if (sql.includes('FROM pg_extension e') && !extensionCreated) {
        return { rows: [] };
      }

      // CREATE EXTENSION in custom schema succeeds
      if (sql.includes('CREATE EXTENSION') && sql.includes('custom_schema')) {
        extensionCreated = true;
        return { rows: [] };
      }

      // After extension is created, return version info
      if (sql.includes('FROM pg_extension e') && extensionCreated) {
        return { rows: [{ schema_name: 'custom_schema', version: '0.8.0' }] };
      }

      return { rows: [] };
    });
    mockClient.release.mockReset();

    listIndexesSpy = vi.spyOn(PgVector.prototype, 'listIndexes').mockResolvedValue([]);

    vectorStore = new PgVector(config);
    await (vectorStore as any).cacheWarmupPromise;
  });

  afterEach(async () => {
    await vectorStore.disconnect();
    listIndexesSpy.mockRestore();
    mockClient.query.mockReset();
  });

  it('should detect pgvector version after installing extension in custom schema to enable halfvec', async () => {
    // This test verifies that after installing the vector extension in a custom schema,
    // the version is detected so that supportsHalfvec() returns true.
    // Bug: The custom schema install path doesn't call detectVectorExtensionSchema,
    // leaving vectorExtensionVersion as null, causing supportsHalfvec() to return false.

    await vectorStore.createIndex({
      indexName: 'halfvecTest',
      dimension: 3072,
      vectorType: 'halfvec',
      buildIndex: false,
    });

    // If the bug exists, this will throw "halfvec type requires pgvector >= 0.7.0"
    // because vectorExtensionVersion is null after custom schema install.
    // The test passes if createIndex succeeds (no error thrown).

    const createTableCall = queryHistory.find(call => call.text.includes('CREATE TABLE'));
    expect(createTableCall?.text ?? '').toContain('embedding custom_schema.halfvec');
  });
});

describe('PgVector buildIndex uses correct operator class for halfvec', () => {
  const config: PgVectorConfig & { id: string } = {
    connectionString: 'postgresql://postgres:postgres@localhost:5432/mastra',
    id: 'pg-vector-buildindex-test',
  };

  let vectorStore: PgVector;
  let listIndexesSpy: ReturnType<typeof vi.spyOn>;
  const queryHistory: QueryCall[] = [];

  beforeEach(async () => {
    queryHistory.length = 0;

    mockClient.query.mockImplementation(async (text: any, values?: any[]) => {
      const sql = typeof text === 'string' ? text : text?.text || '';
      queryHistory.push({ text: sql, values });

      // Extension detection - return public schema with version 0.8.0
      if (sql.includes('FROM pg_extension e')) {
        return { rows: [{ schema_name: 'public', version: '0.8.0' }] };
      }

      // For describeIndex - simulate a halfvec table exists
      if (sql.includes('information_schema.columns') && sql.includes('udt_name')) {
        return { rows: [{ udt_name: 'halfvec' }] };
      }

      // For dimension query
      if (sql.includes('pg_attribute') && sql.includes('atttypmod')) {
        return { rows: [{ dimension: 3072 }] };
      }

      // For count query
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ count: '100' }] };
      }

      // For index info query - no index exists yet (flat)
      if (sql.includes('pg_index') && sql.includes('pg_am')) {
        return { rows: [] };
      }

      return { rows: [] };
    });
    mockClient.release.mockReset();

    listIndexesSpy = vi.spyOn(PgVector.prototype, 'listIndexes').mockResolvedValue([]);

    vectorStore = new PgVector(config);
    await (vectorStore as any).cacheWarmupPromise;
  });

  afterEach(async () => {
    await vectorStore.disconnect();
    listIndexesSpy.mockRestore();
    mockClient.query.mockReset();
  });

  it('should use halfvec_cosine_ops when building index on existing halfvec table', async () => {
    // This test verifies that when buildIndex is called on an existing halfvec table,
    // the correct operator class (halfvec_cosine_ops) is used instead of vector_cosine_ops.
    // Bug: setupIndex defaults vectorType to 'vector' and doesn't use the detected
    // vectorType from the existing table, causing wrong operator class.

    await vectorStore.buildIndex({
      indexName: 'existingHalfvecTable',
      metric: 'cosine',
      indexConfig: { type: 'hnsw' },
    });

    const createIndexCall = queryHistory.find(call => call.text.includes('CREATE INDEX'));
    expect(createIndexCall).toBeDefined();
    // Should use halfvec_cosine_ops, not vector_cosine_ops
    expect(createIndexCall?.text ?? '').toContain('halfvec_cosine_ops');
    expect(createIndexCall?.text ?? '').not.toContain('vector_cosine_ops');
  });
});
