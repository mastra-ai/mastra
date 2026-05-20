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

describe('PgVector custom schema sets search_path before index creation and queries', () => {
  const config: PgVectorConfig & { id: string } = {
    connectionString: 'postgresql://postgres:postgres@localhost:5432/mastra',
    schemaName: 'myapp',
    id: 'pg-vector-search-path-test',
  };

  let vectorStore: PgVector;
  let listIndexesSpy: ReturnType<typeof vi.spyOn>;
  const queryHistory: QueryCall[] = [];

  beforeEach(async () => {
    queryHistory.length = 0;

    mockClient.query.mockImplementation(async (text: any, values?: any[]) => {
      const sql = typeof text === 'string' ? text : text?.text || '';
      queryHistory.push({ text: sql, values });

      // Schema check
      if (sql.includes('information_schema.schemata')) {
        return { rows: [{ exists: true }] };
      }

      // Extension is installed in the custom schema (myapp), NOT public
      if (sql.includes('FROM pg_extension e')) {
        return { rows: [{ schema_name: 'myapp', version: '0.8.0' }] };
      }

      // For describeIndex - simulate a vector table exists
      if (sql.includes('information_schema.columns') && sql.includes('udt_name')) {
        return { rows: [{ udt_name: 'vector' }] };
      }

      // For dimension query
      if (sql.includes('pg_attribute') && sql.includes('atttypmod')) {
        return { rows: [{ dimension: 1536 }] };
      }

      // For count query
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ count: '100' }] };
      }

      // For index info query - no index exists yet (flat)
      if (sql.includes('pg_index') && sql.includes('pg_am')) {
        return { rows: [] };
      }

      // For query results
      if (sql.includes('vector_scores')) {
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

  it('should set search_path before index creation when extension is in custom schema', async () => {
    // When the vector extension is installed in a custom schema (myapp) and
    // the tables are also in myapp, operator classes like vector_cosine_ops
    // are not resolvable without proper search_path.
    // The search_path must be set before CREATE INDEX, not just before CREATE TABLE.

    await vectorStore.buildIndex({
      indexName: 'testIndex',
      metric: 'cosine',
      indexConfig: { type: 'hnsw' },
    });

    const createIndexIdx = queryHistory.findIndex(call => call.text.includes('CREATE INDEX'));
    expect(createIndexIdx).toBeGreaterThan(-1);

    // There must be a SET search_path call BEFORE the CREATE INDEX
    const searchPathBeforeIndex = queryHistory
      .slice(0, createIndexIdx)
      .some(call => call.text.includes('search_path') && call.text.includes('myapp'));

    expect(searchPathBeforeIndex).toBe(true);
  });

  it('should set search_path before vector similarity queries when extension is in custom schema', async () => {
    // When the vector extension is in a custom schema, the <=> operator
    // and other distance operators are unresolvable without search_path.

    // First create the index so query can find it
    await vectorStore.createIndex({
      indexName: 'queryTest',
      dimension: 1536,
      buildIndex: false,
    });

    queryHistory.length = 0; // Reset to track only query calls

    await vectorStore.query({
      indexName: 'queryTest',
      queryVector: new Array(1536).fill(0.1),
    });

    const vectorQueryIdx = queryHistory.findIndex(call => call.text.includes('vector_scores'));
    expect(vectorQueryIdx).toBeGreaterThan(-1);

    // There must be a SET search_path call BEFORE the vector similarity query
    const searchPathBeforeQuery = queryHistory
      .slice(0, vectorQueryIdx)
      .some(call => call.text.includes('search_path') && call.text.includes('myapp'));

    expect(searchPathBeforeQuery).toBe(true);
  });

  it('should NOT set search_path before CREATE TABLE in createIndex to avoid table placement regression', async () => {
    // When schemaName is unset, the table name is unqualified. Calling ensureSearchPath()
    // before CREATE TABLE would put the extension schema first in search_path, causing
    // PostgreSQL to create the table in the extension schema instead of the expected schema.
    // The vector type in CREATE TABLE is already fully qualified by getVectorTypeName().

    await vectorStore.createIndex({
      indexName: 'noSearchPathTest',
      dimension: 1536,
      buildIndex: false,
    });

    const createTableIdx = queryHistory.findIndex(call => call.text.includes('CREATE TABLE'));
    expect(createTableIdx).toBeGreaterThan(-1);

    // There must NOT be a SET search_path call immediately before CREATE TABLE
    // (search_path should only be set before index creation and queries, not table creation)
    const searchPathBeforeTable = queryHistory
      .slice(0, createTableIdx)
      .some(call => call.text.includes('SET search_path'));

    expect(searchPathBeforeTable).toBe(false);
  });

  it('should set search_path before upsert when extension is in custom schema', async () => {
    // On a fresh process, upsert() calls getVectorTypeName() which emits
    // ::vector or ::halfvec casts that fail without proper search_path.

    // First create the index
    await vectorStore.createIndex({
      indexName: 'upsertTest',
      dimension: 1536,
      buildIndex: false,
    });

    queryHistory.length = 0; // Reset to track only upsert calls

    await vectorStore.upsert({
      indexName: 'upsertTest',
      vectors: [new Array(1536).fill(0.1)],
      metadata: [{ key: 'value' }],
    });

    const insertIdx = queryHistory.findIndex(call => call.text.includes('INSERT INTO'));
    expect(insertIdx).toBeGreaterThan(-1);

    // There must be a SET search_path call BEFORE the INSERT
    const searchPathBeforeInsert = queryHistory
      .slice(0, insertIdx)
      .some(call => call.text.includes('search_path') && call.text.includes('myapp'));

    expect(searchPathBeforeInsert).toBe(true);
  });

  it('should set search_path before updateVector when extension is in custom schema', async () => {
    // updateVector() also uses getVectorTypeName() for ::vector/::halfvec casts.

    // First create the index
    await vectorStore.createIndex({
      indexName: 'updateTest',
      dimension: 1536,
      buildIndex: false,
    });

    queryHistory.length = 0; // Reset to track only update calls

    await vectorStore.updateVector({
      indexName: 'updateTest',
      id: 'test-id',
      update: {
        vector: new Array(1536).fill(0.2),
      },
    });

    const updateIdx = queryHistory.findIndex(call => call.text.includes('UPDATE'));
    expect(updateIdx).toBeGreaterThan(-1);

    // There must be a SET search_path call BEFORE the UPDATE
    const searchPathBeforeUpdate = queryHistory
      .slice(0, updateIdx)
      .some(call => call.text.includes('search_path') && call.text.includes('myapp'));

    expect(searchPathBeforeUpdate).toBe(true);
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
