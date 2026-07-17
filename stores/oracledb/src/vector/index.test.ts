import { describe, expect, it, vi } from 'vitest';

import { OracleVector } from '.';

// Unit tests avoid opening a real pool by validating failures that occur before connection use.
function createVector() {
  return new OracleVector({
    id: 'oracle-vector-unit',
    pool: {} as any,
  });
}

function createVectorWithConnection(connection: Record<string, unknown>, config: Record<string, unknown> = {}) {
  const poolManager = {
    withConnection: vi.fn(async callback => callback(connection)),
    close: vi.fn(async () => undefined),
  };
  const vector = new OracleVector({
    id: 'oracle-vector-unit-with-connection',
    poolManager,
    ...config,
  } as any);

  return { vector, poolManager };
}

function cacheIndex(vector: OracleVector, overrides: Record<string, unknown> = {}) {
  (vector as any).cacheIndexMetadata(overrides.indexName ?? 'hot_index', {
    indexName: 'hot_index',
    tableName: 'MASTRA_VEC_HOT',
    qualifiedTableName: '"MASTRA_VEC_HOT"',
    dimension: 3,
    metric: 'cosine',
    indexType: 'none',
    vectorFormat: 'vector',
    accuracy: 95,
    ...overrides,
  });
}

// Flushes microtasks until `condition` is true or `maxTicks` is exhausted. Used to observe an
// in-flight mocked DDL call without depending on real timers.
async function waitUntil(condition: () => boolean, maxTicks = 50): Promise<void> {
  for (let i = 0; i < maxTicks && !condition(); i += 1) {
    await Promise.resolve();
  }
}

// Format names are part of the public OracleVector API and should fail fast on misuse.
describe('OracleVector format validation', () => {
  it('defaults to exact search without a physical vector index', () => {
    const vector = createVector();

    expect((vector as any).defaultIndexConfig).toMatchObject({ type: 'none' });
  });

  it('rejects invalid vector upsert batch sizes at construction time', () => {
    expect(
      () =>
        new OracleVector({
          id: 'invalid-vector-batch',
          pool: {} as any,
          upsertBatchSize: 0,
        }),
    ).toThrow(/upsertBatchSize/i);
  });

  it('rejects bit indexes whose dimensions are not byte-aligned', async () => {
    const vector = createVector();

    await expect(
      vector.createIndex({
        indexName: 'bit_dimension_mismatch',
        dimension: 7,
        vectorFormat: 'bit',
        buildIndex: false,
      }),
    ).rejects.toThrow(/multiple of 8/i);
  });

  it('rejects non-bit metrics for bit indexes', async () => {
    const vector = createVector();

    await expect(
      vector.createIndex({
        indexName: 'bit_metric_mismatch',
        dimension: 8,
        vectorFormat: 'bit',
        metric: 'cosine',
        buildIndex: false,
      }),
    ).rejects.toThrow(/hamming|jaccard/i);
  });

  it('rejects hamming and jaccard metrics for non-bit indexes', async () => {
    const vector = createVector();

    await expect(
      vector.createIndex({
        indexName: 'vector_metric_mismatch',
        dimension: 8,
        vectorFormat: 'vector',
        metric: 'hamming',
        buildIndex: false,
      }),
    ).rejects.toThrow(/requires vectorFormat "bit"/i);
  });

  it('uses int8 as the public name for compact 8-bit vectors', async () => {
    const vector = createVector();

    await expect(
      vector.createIndex({
        indexName: 'invalid_format',
        dimension: 8,
        vectorFormat: 'binary' as any,
        buildIndex: false,
      }),
    ).rejects.toThrow(/vector.*bit.*int8/i);
  });

  it('rejects jaccard metric for HNSW/IVF index types before running any DDL', async () => {
    const vector = createVector();

    await expect(
      vector.createIndex({
        indexName: 'jaccard_hnsw_mismatch',
        dimension: 8,
        vectorFormat: 'bit',
        metric: 'jaccard',
        indexConfig: { type: 'hnsw' },
      }),
    ).rejects.toThrow(/jaccard.*exact search/i);

    await expect(
      vector.createIndex({
        indexName: 'jaccard_ivf_mismatch',
        dimension: 8,
        vectorFormat: 'bit',
        metric: 'jaccard',
        indexConfig: { type: 'ivf' },
      }),
    ).rejects.toThrow(/jaccard.*exact search/i);
  });

  it('allows jaccard metric for exact search (index type "none")', async () => {
    const execute = vi.fn(async () => ({ rows: [] }));
    const commit = vi.fn(async () => undefined);
    const vector = new OracleVector({
      id: 'oracle-vector-jaccard-exact',
      pool: {
        getConnection: vi.fn(async () => ({ execute, commit, close: vi.fn(async () => undefined) })),
      } as any,
    });

    await expect(
      vector.createIndex({
        indexName: 'jaccard_exact_ok',
        dimension: 8,
        vectorFormat: 'bit',
        metric: 'jaccard',
        indexConfig: { type: 'none' },
      }),
    ).resolves.toBeUndefined();
  });
});

describe('OracleVector vector memory support', () => {
  it('exposes a validated setup helper for Oracle Vector Pool sizing', async () => {
    const execute = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const vector = new OracleVector({
      id: 'oracle-vector-memory-helper',
      pool: {
        getConnection: vi.fn(async () => ({ execute, close })),
      } as any,
    });

    await vector.configureVectorMemory({ size: '512m' });

    expect(execute).toHaveBeenCalledWith('ALTER SYSTEM SET VECTOR_MEMORY_SIZE = 512M SCOPE=MEMORY');
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects unsafe vector memory size values before running ALTER SYSTEM', async () => {
    const vector = createVector();

    await expect(vector.configureVectorMemory({ size: '512M; DROP TABLE X' })).rejects.toThrow(/vector memory size/i);
  });

  it('explains ORA-51962 as a Vector Pool sizing problem when building HNSW', async () => {
    const vector = createVector();
    const ora51962 = Object.assign(
      new Error('ORA-51962: The vector memory area is out of space for the current container.'),
      { errorNum: 51962 },
    );
    const connection = {
      execute: vi.fn(async () => {
        throw ora51962;
      }),
    };

    await expect(
      (vector as any).createVectorIndex(connection, 'memory_messages', 'cosine', { type: 'hnsw' }),
    ).rejects.toThrow(/VECTOR_MEMORY_SIZE|Vector Pool|ORA-51962/i);
  });

  it('keeps createIndex retryable when an HNSW build exhausts the Vector Pool', async () => {
    type RegistryRow = {
      indexName: string;
      tableName: string;
      dimension: number;
      metric: string;
      indexType: string;
      vectorFormat: string;
      accuracy: number;
    };

    const ora51962 = Object.assign(
      new Error('ORA-51962: The vector memory area is out of space for the current container.'),
      { errorNum: 51962 },
    );
    const duplicateObject = Object.assign(new Error('ORA-00955: name is already used by an existing object'), {
      errorNum: 955,
    });
    let registryRow: RegistryRow | null = null;
    let tableExists = false;
    let metadataIndexExists = false;
    let metadataIndexAttempts = 0;
    let failVectorBuild = true;
    let vectorIndexAttempts = 0;

    const execute = vi.fn(async (sql: string, binds: Record<string, unknown> = {}) => {
      if (sql.includes('index_name AS "indexName"') && sql.includes('table_name AS "tableName"')) {
        return { rows: registryRow ? [registryRow] : [] };
      }
      if (sql.includes('FROM all_tables')) {
        return { rows: tableExists ? [{ exists: 1 }] : [] };
      }
      if (sql.includes('CREATE TABLE "MASTRA_VEC_RETRYABLE_INDEX"')) {
        tableExists = true;
        return { rows: [] };
      }
      if (sql.includes('MERGE INTO "MASTRA_VECTOR_INDEXES"')) {
        registryRow = {
          indexName: String(binds.index_name),
          tableName: String(binds.table_name),
          dimension: Number(binds.dimension),
          metric: String(binds.metric),
          indexType: String(binds.index_type),
          vectorFormat: String(binds.vector_format),
          accuracy: Number(binds.accuracy),
        };
        return { rows: [], rowsAffected: 1 };
      }
      if (sql.includes('CREATE INDEX')) {
        metadataIndexAttempts += 1;
        if (metadataIndexExists) throw duplicateObject;
        metadataIndexExists = true;
        return { rows: [] };
      }
      if (sql.includes('CREATE VECTOR INDEX')) {
        vectorIndexAttempts += 1;
        if (failVectorBuild) throw ora51962;
        return { rows: [] };
      }
      if (sql.includes('UPDATE "MASTRA_VECTOR_INDEXES"')) {
        if (!registryRow) throw new Error('registry row missing before index-config update');
        registryRow = {
          ...registryRow,
          metric: String(binds.metric),
          indexType: String(binds.index_type),
          accuracy: Number(binds.accuracy),
        };
        return { rows: [], rowsAffected: 1 };
      }
      return { rows: [], rowsAffected: 1 };
    });
    const connection = {
      execute,
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    };
    const { vector } = createVectorWithConnection(connection);
    const createOptions = {
      indexName: 'retryable_index',
      dimension: 3,
      metric: 'cosine' as const,
      metadataIndexes: ['tenant_id'],
      indexConfig: { type: 'hnsw' as const, accuracy: 91 },
    };

    await expect(vector.createIndex(createOptions)).rejects.toThrow(/VECTOR_MEMORY_SIZE|Vector Pool|ORA-51962/i);

    expect(registryRow).toMatchObject({
      indexName: 'retryable_index',
      tableName: 'MASTRA_VEC_RETRYABLE_INDEX',
      indexType: 'none',
      accuracy: 95,
    });
    const firstAttemptSql = execute.mock.calls.map(call => String(call[0]));
    const tableCreatePosition = firstAttemptSql.findIndex(sql =>
      sql.includes('CREATE TABLE "MASTRA_VEC_RETRYABLE_INDEX"'),
    );
    const registryWritePosition = firstAttemptSql.findIndex(sql => sql.includes('MERGE INTO "MASTRA_VECTOR_INDEXES"'));
    const metadataIndexPosition = firstAttemptSql.findIndex(sql => sql.includes('CREATE INDEX'));
    const vectorIndexPosition = firstAttemptSql.findIndex(sql => sql.includes('CREATE VECTOR INDEX'));
    expect(tableCreatePosition).toBeGreaterThan(-1);
    expect(registryWritePosition).toBeGreaterThan(tableCreatePosition);
    expect(metadataIndexPosition).toBeGreaterThan(registryWritePosition);
    expect(vectorIndexPosition).toBeGreaterThan(metadataIndexPosition);
    expect(firstAttemptSql.some(sql => sql.includes('UPDATE "MASTRA_VECTOR_INDEXES"'))).toBe(false);

    failVectorBuild = false;
    await expect(vector.createIndex(createOptions)).resolves.toBeUndefined();

    expect(vectorIndexAttempts).toBe(2);
    expect(metadataIndexAttempts).toBe(2);
    expect(registryRow).toMatchObject({ indexType: 'hnsw', accuracy: 91 });
    expect(execute.mock.calls.filter(call => String(call[0]).includes('CREATE TABLE "MASTRA_VEC_RETRYABLE_INDEX"'))).toHaveLength(
      1,
    );
    const updateCall = execute.mock.calls.find(call => String(call[0]).includes('UPDATE "MASTRA_VECTOR_INDEXES"'));
    expect(updateCall?.[1]).toMatchObject({
      indexName: 'retryable_index',
      metric: 'cosine',
      index_type: 'hnsw',
      accuracy: 91,
    });
    expect(connection.commit).toHaveBeenCalledTimes(2);
  });
});

describe('OracleVector hot path SQL shape', () => {
  it('records no physical vector index when createIndex defers approximate index build', async () => {
    const execute = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT') && (sql.includes('FROM "MASTRA_VECTOR_INDEXES"') || sql.includes('FROM all_tables'))) {
        return { rows: [] };
      }
      return { rows: [] };
    });
    const commit = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const vector = new OracleVector({
      id: 'oracle-vector-deferred-index-shape',
      pool: {
        getConnection: vi.fn(async () => ({ execute, commit, close })),
      } as any,
    });

    await vector.createIndex({
      indexName: 'deferred_index',
      dimension: 3,
      metric: 'cosine',
      indexConfig: { type: 'ivf', accuracy: 90, ivf: { neighborPartitions: 1 } },
      buildIndex: false,
    });

    const mergeCall = execute.mock.calls.find(call => String(call[0]).includes('MERGE INTO "MASTRA_VECTOR_INDEXES"'));
    expect(mergeCall?.[1]).toMatchObject({
      index_name: 'deferred_index',
      metric: 'cosine',
      index_type: 'none',
    });
    expect(execute.mock.calls.some(call => String(call[0]).includes('CREATE VECTOR INDEX'))).toBe(false);

    await expect(vector.getIndexStatus({ indexName: 'deferred_index' })).resolves.toBe('NONE');

    await vector.query({ indexName: 'deferred_index', queryVector: [1, 0, 0], topK: 1 });

    expect(execute.mock.calls.some(call => String(call[0]).includes('FETCH EXACT FIRST 1 ROWS ONLY'))).toBe(true);
  });

  it('uses cached index metadata for vector queries without live count or outer sort', async () => {
    const execute = vi.fn(async () => ({ rows: [{ id: 'vec-1', score: 1, metadata: {} }] }));
    const close = vi.fn(async () => undefined);
    const vector = new OracleVector({
      id: 'oracle-vector-query-shape',
      pool: {
        getConnection: vi.fn(async () => ({ execute, close })),
      } as any,
    });

    (vector as any).cacheIndexMetadata('hot_index', {
      indexName: 'hot_index',
      tableName: 'MASTRA_VEC_HOT',
      qualifiedTableName: 'MASTRA_VEC_HOT',
      dimension: 3,
      metric: 'cosine',
      indexType: 'none',
      vectorFormat: 'vector',
      accuracy: 95,
    });

    await vector.query({ indexName: 'hot_index', queryVector: [1, 0, 0], topK: 5 });

    expect(execute).toHaveBeenCalledOnce();
    const sql = String(execute.mock.calls[0]?.[0]);
    expect(sql).toContain('ORDER BY VECTOR_DISTANCE');
    expect(sql).toContain('FETCH EXACT FIRST 5 ROWS ONLY');
    expect(sql).not.toContain('WITH vector_scores');
    expect(sql).not.toContain('COUNT(*)');
    expect(close).toHaveBeenCalledOnce();
  });

  it('deletes many ids through executeMany array DML', async () => {
    const executeMany = vi.fn(async () => undefined);
    const commit = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const vector = new OracleVector({
      id: 'oracle-vector-delete-many-shape',
      pool: {
        getConnection: vi.fn(async () => ({ executeMany, commit, close })),
      } as any,
    });

    (vector as any).cacheIndexMetadata('hot_index', {
      indexName: 'hot_index',
      tableName: 'MASTRA_VEC_HOT',
      qualifiedTableName: 'MASTRA_VEC_HOT',
      dimension: 3,
      metric: 'cosine',
      indexType: 'none',
      vectorFormat: 'vector',
      accuracy: 95,
    });

    await vector.deleteVectors({ indexName: 'hot_index', ids: ['a', 'b', 'c'] });

    expect(executeMany).toHaveBeenCalledOnce();
    expect(String(executeMany.mock.calls[0]?.[0])).toContain('WHERE vector_id = :id');
    expect(executeMany.mock.calls[0]?.[1]).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(commit).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('reads vector index status from Oracle catalog views', async () => {
    const execute = vi.fn(async () => ({
      rows: [{ status: 'VALID', indexType: 'VECTOR', domainStatus: null }],
    }));
    const close = vi.fn(async () => undefined);
    const vector = new OracleVector({
      id: 'oracle-vector-status-shape',
      pool: {
        getConnection: vi.fn(async () => ({ execute, close })),
      } as any,
    });

    (vector as any).cacheIndexMetadata('hot_index', {
      indexName: 'hot_index',
      tableName: 'MASTRA_VEC_HOT',
      qualifiedTableName: 'MASTRA_VEC_HOT',
      dimension: 3,
      metric: 'cosine',
      indexType: 'hnsw',
      vectorFormat: 'vector',
      accuracy: 95,
    });

    await expect(vector.getIndexStatus({ indexName: 'hot_index' })).resolves.toBe('VALID type=VECTOR');

    const sql = String(execute.mock.calls[0]?.[0]);
    expect(sql).toContain('FROM all_indexes');
    expect(sql).not.toContain('DBMS_VECTOR.GET_INDEX_STATUS');
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not update registry metadata when buildIndex finds an existing physical index for a changed config', async () => {
    const duplicateIndexError = Object.assign(new Error('ORA-00955: name is already used by an existing object'), {
      errorNum: 955,
    });
    const execute = vi.fn(async (sql: string) => {
      if (sql.includes('CREATE VECTOR INDEX')) throw duplicateIndexError;
      return { rows: [] };
    });
    const close = vi.fn(async () => undefined);
    const vector = new OracleVector({
      id: 'oracle-vector-build-existing-index',
      pool: {
        getConnection: vi.fn(async () => ({ execute, close })),
      } as any,
    });

    (vector as any).cacheIndexMetadata('hot_index', {
      indexName: 'hot_index',
      tableName: 'MASTRA_VEC_HOT',
      qualifiedTableName: 'MASTRA_VEC_HOT',
      dimension: 3,
      metric: 'cosine',
      indexType: 'hnsw',
      vectorFormat: 'vector',
      accuracy: 95,
    });

    await expect(vector.buildIndex({ indexName: 'hot_index', metric: 'euclidean' })).rejects.toThrow(/rebuildIndex/i);

    expect(execute).toHaveBeenCalledOnce();
    expect(String(execute.mock.calls[0]?.[0])).toContain('CREATE VECTOR INDEX');
    expect(execute.mock.calls.some(call => String(call[0]).includes('UPDATE "MASTRA_VECTOR_INDEXES"'))).toBe(false);
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('OracleVector operation branches', () => {
  it('handles upsert, metadata-only query, min-score query, update, delete, and bit vector conversion', async () => {
    const connection = {
      execute: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT') && sql.includes('vector_id AS "id"')) {
          return {
            rows: [
              {
                id: 'bit-1',
                // Production projects a literal `0 AS "score"` for metadata-only queries (no queryVector);
                // mirror that here so a regression that starts computing a real score is caught.
                score: sql.includes('0 AS "score"') ? 0 : '0.75',
                metadata: Buffer.from(JSON.stringify({ tag: 'x' })),
                vector: Uint8Array.from([0b10101010]),
              },
            ],
          };
        }
        return { rows: [], rowsAffected: 1 };
      }),
      executeMany: vi.fn(async () => ({ rowsAffected: 1 })),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    };
    const { vector } = createVectorWithConnection(connection);
    cacheIndex(vector, {
      indexName: 'bit_index',
      dimension: 8,
      metric: 'hamming',
      vectorFormat: 'bit',
    });

    await expect(
      vector.upsert({
        indexName: 'bit_index',
        ids: ['bit-1'],
        vectors: [[1, 0, 1, 0, 1, 0, 1, 0]],
        metadata: [{ tag: 'x' }],
        deleteFilter: { tag: 'old' },
      }),
    ).resolves.toEqual(['bit-1']);

    const metadataOnlyResults = await vector.query({
      indexName: 'bit_index',
      filter: { tag: 'x' },
      topK: 1,
      includeVector: true,
    });
    const scoredResults = await vector.query({
      indexName: 'bit_index',
      queryVector: [1, 0, 1, 0, 1, 0, 1, 0],
      topK: 1,
      minScore: 0.5,
      queryMode: 'approx',
      targetAccuracy: 90,
      includeVector: true,
    });

    await vector.updateVector({
      indexName: 'bit_index',
      id: 'bit-1',
      update: { metadata: { tag: 'y' }, vector: [0, 1, 0, 1, 0, 1, 0, 1] },
    });
    await vector.updateVector({
      indexName: 'bit_index',
      filter: { tag: 'y' },
      update: { metadata: { active: true } },
    });
    await vector.deleteVector({ indexName: 'bit_index', id: 'bit-1' });
    await vector.deleteVectors({ indexName: 'bit_index', filter: { tag: 'y' } });

    const executeManyBinds = connection.executeMany.mock.calls[0]?.[1] as Array<{ embedding: Uint8Array }>;
    expect(Array.from(executeManyBinds[0]!.embedding)).toEqual([0b10101010]);
    expect(metadataOnlyResults[0]).toMatchObject({
      id: 'bit-1',
      score: 0,
      metadata: { tag: 'x' },
      vector: [1, 0, 1, 0, 1, 0, 1, 0],
    });
    expect(scoredResults[0]?.vector).toEqual([1, 0, 1, 0, 1, 0, 1, 0]);
    expect(connection.execute.mock.calls.some(call => String(call[0]).includes('WITH vector_scores'))).toBe(true);
    expect(connection.execute.mock.calls.some(call => String(call[0]).includes('FETCH APPROX FIRST 1 ROWS ONLY WITH TARGET ACCURACY 90'))).toBe(true);
    expect(connection.commit).toHaveBeenCalled();
  });

  it('rejects invalid vector operation inputs before touching Oracle', async () => {
    const { vector } = createVectorWithConnection({
      execute: vi.fn(async () => ({ rows: [] })),
      executeMany: vi.fn(async () => ({ rowsAffected: 0 })),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    });

    await expect(
      vector.upsert({
        indexName: 'hot_index',
        vectors: [[1, 2, 3]],
        sparseVectors: [{}] as any,
      }),
    ).rejects.toThrow(/sparseVectors/i);
    await expect(vector.query({ indexName: 'hot_index', topK: 1 } as any)).rejects.toThrow(/queryVector or filter/i);
    await expect(
      vector.query({ indexName: 'hot_index', queryVector: [1, Number.NaN, 3], topK: 1 }),
    ).rejects.toThrow(/non-finite/i);
    await expect(
      vector.updateVector({ indexName: 'hot_index', id: 'id-1', update: {} } as any),
    ).rejects.toThrow(/No updates provided/i);
    await expect(
      vector.updateVector({
        indexName: 'hot_index',
        id: 'id-1',
        filter: { tag: 'x' },
        update: { metadata: { tag: 'y' } },
      } as any),
    ).rejects.toThrow(/mutually exclusive/i);
    await expect(vector.deleteVectors({ indexName: 'hot_index', ids: [] })).rejects.toThrow(/empty ids array/i);
    await expect(
      vector.deleteVectors({ indexName: 'hot_index', ids: ['id-1'], filter: { tag: 'x' } } as any),
    ).rejects.toThrow(/mutually exclusive/i);
  });

  it('reads registry diagnostics, deletes registered indexes, and closes managed pool managers', async () => {
    const registryRow = {
      indexName: 'registry_index',
      tableName: 'MASTRA_VEC_REGISTRY',
      dimension: 3,
      metric: 'cosine',
      indexType: 'ivf',
      vectorFormat: 'vector',
      accuracy: 91,
    };
    const connection = {
      execute: vi.fn(async (sql: string) => {
        if (sql.includes('DBMS_VECTOR.INDEX_ACCURACY_QUERY')) return { rows: [{ accuracy: '0.93' }] };
        if (sql.includes('SELECT index_name AS "indexName" FROM')) {
          return { rows: [{ indexName: 'registry_index' }, { indexName: 'z_index' }] };
        }
        if (sql.includes('COUNT(*) AS "count"')) return { rows: [{ count: '7' }] };
        if (sql.includes('index_name AS "indexName"') && sql.includes('table_name AS "tableName"')) {
          return { rows: [registryRow] };
        }
        return { rows: [], rowsAffected: 1 };
      }),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    };
    const { vector, poolManager } = createVectorWithConnection(connection);

    await expect(vector.listIndexes()).resolves.toEqual(['registry_index', 'z_index']);
    await expect(vector.describeIndex({ indexName: 'registry_index' })).resolves.toMatchObject({
      indexName: 'registry_index',
      dimension: 3,
      count: 7,
    });
    await expect(
      vector.indexAccuracyQuery({ indexName: 'registry_index', queryVector: [1, 0, 0], topK: 3 }),
    ).resolves.toBe('0.93');
    await vector.deleteIndex({ indexName: 'registry_index' });
    await vector.disconnect();

    expect(connection.execute.mock.calls.some(call => String(call[0]).includes('DROP TABLE'))).toBe(true);
    expect(connection.execute.mock.calls.some(call => String(call[0]).includes('DELETE FROM "MASTRA_VECTOR_INDEXES"'))).toBe(
      true,
    );
    expect(connection.commit).toHaveBeenCalled();
    expect(poolManager.close).not.toHaveBeenCalled();
  });

  it('creates new vector indexes and rejects stale physical tables without registry metadata', async () => {
    const freshConnection = {
      execute: vi.fn(async (sql: string) => {
        if (sql.includes('FROM all_tables')) return { rows: [] };
        if (sql.includes('index_name AS "indexName"') && sql.includes('table_name AS "tableName"')) {
          return { rows: [] };
        }
        return { rows: [], rowsAffected: 1 };
      }),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    };
    const { vector: freshVector } = createVectorWithConnection(freshConnection, {
      tablePrefix: 'LOCAL_VEC',
      registryTableName: 'LOCAL_VECTOR_REGISTRY',
      schemaName: 'APP_SCHEMA',
    });

    await freshVector.createIndex({
      indexName: 'fresh.index',
      dimension: 3,
      metric: 'cosine',
      metadataIndexes: ['tenant.id'],
      indexConfig: { type: 'ivf', accuracy: 88, ivf: { neighborPartitions: 2 } },
    });

    const freshSql = freshConnection.execute.mock.calls.map(call => String(call[0])).join('\n');
    expect(freshSql).toContain('CREATE TABLE "APP_SCHEMA"."LOCAL_VECTOR_REGISTRY"');
    expect(freshSql).toContain('CREATE TABLE "APP_SCHEMA"."LOCAL_VEC_FRESH_INDEX"');
    expect(freshSql).toContain('CREATE VECTOR INDEX "APP_SCHEMA"."LOCAL_VEC_FRESH_INDEX_VECTOR_IDX"');
    expect(freshSql).toContain("JSON_VALUE(metadata, '$.tenant.id' RETURNING VARCHAR2(4000) NULL ON ERROR)");
    expect(freshSql).toContain('MERGE INTO "APP_SCHEMA"."LOCAL_VECTOR_REGISTRY"');

    const staleConnection = {
      execute: vi.fn(async (sql: string) => {
        if (sql.includes('FROM all_tables')) return { rows: [{ exists: 1 }] };
        if (sql.includes('index_name AS "indexName"') && sql.includes('table_name AS "tableName"')) {
          return { rows: [] };
        }
        return { rows: [], rowsAffected: 1 };
      }),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    };
    const { vector: staleVector } = createVectorWithConnection(staleConnection);

    await expect(staleVector.createIndex({ indexName: 'stale_index', dimension: 3 })).rejects.toThrow(
      /registry metadata/i,
    );
  });

  it('rejects createIndex when the physical table already belongs to a different index name after identifier normalization', async () => {
    // "FOO" and "foo" collapse onto the same physical table name once identifiers are normalized to
    // uppercase, so the registry already has a row for "foo" pointing at that table.
    const connection = {
      execute: vi.fn(async (sql: string) => {
        if (sql.includes('FROM all_tables')) return { rows: [{ exists: 1 }] };
        if (sql.includes('index_name AS "indexName"') && sql.includes('table_name AS "tableName"')) {
          // No exact/legacy registry row for the incoming logical name "FOO".
          return { rows: [] };
        }
        if (sql.includes('index_name AS "indexName"') && sql.includes('WHERE table_name = :tableName')) {
          // The physical table is already claimed by a different logical index name.
          return { rows: [{ indexName: 'foo' }] };
        }
        return { rows: [], rowsAffected: 1 };
      }),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    };
    const { vector } = createVectorWithConnection(connection);

    await expect(vector.createIndex({ indexName: 'FOO', dimension: 3 })).rejects.toThrow(
      /collides with existing index "foo"/i,
    );
  });

  it('recreates missing physical tables and covers build and rebuild transitions', async () => {
    const registryRow = {
      indexName: 'missing_table_index',
      tableName: 'MASTRA_VEC_MISSING_TABLE_INDEX',
      dimension: 3,
      metric: 'cosine',
      indexType: 'none',
      vectorFormat: 'vector',
      accuracy: 95,
    };
    const connection = {
      execute: vi.fn(async (sql: string) => {
        if (sql.includes('FROM all_tables')) return { rows: [] };
        if (sql.includes('index_name AS "indexName"') && sql.includes('table_name AS "tableName"')) {
          return { rows: [registryRow] };
        }
        return { rows: [], rowsAffected: 1 };
      }),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    };
    const { vector } = createVectorWithConnection(connection);

    await vector.createIndex({ indexName: 'missing_table_index', dimension: 3, metric: 'cosine', buildIndex: false });
    await vector.buildIndex({ indexName: 'missing_table_index', indexConfig: { type: 'none' } });
    await vector.buildIndex({ indexName: 'missing_table_index', indexConfig: { type: 'ivf', accuracy: 87 } });
    await vector.rebuildIndex({
      indexName: 'missing_table_index',
      metric: 'euclidean',
      indexConfig: { type: 'ivf', accuracy: 86 },
    });
    await vector.rebuildIndex({ indexName: 'missing_table_index', indexConfig: { type: 'none' } });

    const sql = connection.execute.mock.calls.map(call => String(call[0])).join('\n');
    expect(sql).toContain('CREATE TABLE "MASTRA_VEC_MISSING_TABLE_INDEX"');
    expect(sql).toContain('CREATE VECTOR INDEX "MASTRA_VEC_MISSING_TABLE_INDEX_VECTOR_IDX"');
    expect(sql).toContain('DROP INDEX "MASTRA_VEC_MISSING_TABLE_INDEX_VECTOR_IDX"');
    expect(sql).toContain('UPDATE "MASTRA_VECTOR_INDEXES"');
  });

  it('serializes concurrent buildIndex calls for the same index name instead of interleaving DDL', async () => {
    const registryRow = {
      indexName: 'lock_build_index',
      tableName: 'MASTRA_VEC_LOCK_BUILD_INDEX',
      dimension: 3,
      metric: 'cosine',
      indexType: 'none',
      vectorFormat: 'vector',
      accuracy: 95,
    };

    let activeBuilds = 0;
    let maxConcurrentBuilds = 0;
    // Each in-flight CREATE VECTOR INDEX call parks itself here until the test resolves it, so we can
    // observe whether a second buildIndex call reaches the DDL before the first one has finished.
    const pendingBuilds: Array<() => void> = [];

    const execute = vi.fn(async (sql: string) => {
      if (sql.includes('index_name AS "indexName"') && sql.includes('table_name AS "tableName"')) {
        return { rows: [registryRow] };
      }
      if (sql.includes('CREATE VECTOR INDEX')) {
        activeBuilds += 1;
        maxConcurrentBuilds = Math.max(maxConcurrentBuilds, activeBuilds);
        await new Promise<void>(resolve => pendingBuilds.push(() => resolve()));
        activeBuilds -= 1;
        return { rows: [] };
      }
      return { rows: [], rowsAffected: 1 };
    });
    const connection = { execute, commit: vi.fn(async () => undefined), rollback: vi.fn(async () => undefined) };
    const { vector } = createVectorWithConnection(connection);

    const first = vector.buildIndex({ indexName: 'lock_build_index', indexConfig: { type: 'hnsw' } });
    const second = vector.buildIndex({ indexName: 'lock_build_index', indexConfig: { type: 'ivf' } });

    await waitUntil(() => pendingBuilds.length >= 1);
    expect(pendingBuilds).toHaveLength(1); // the second call must stay blocked behind the per-index lock

    pendingBuilds[0]!();
    await first;

    await waitUntil(() => pendingBuilds.length >= 2);
    expect(pendingBuilds).toHaveLength(2);

    pendingBuilds[1]!();
    await second;

    expect(maxConcurrentBuilds).toBe(1);
  });

  it('serializes concurrent rebuildIndex calls for the same index name instead of interleaving DDL', async () => {
    let registryRow = {
      indexName: 'lock_rebuild_index',
      tableName: 'MASTRA_VEC_LOCK_REBUILD_INDEX',
      dimension: 3,
      metric: 'cosine',
      indexType: 'hnsw',
      vectorFormat: 'vector',
      accuracy: 95,
    };

    let activeBuilds = 0;
    let maxConcurrentBuilds = 0;
    const pendingBuilds: Array<() => void> = [];

    const execute = vi.fn(async (sql: string, binds: Record<string, unknown> = {}) => {
      if (sql.includes('index_name AS "indexName"') && sql.includes('table_name AS "tableName"')) {
        return { rows: [registryRow] };
      }
      if (sql.includes('DROP INDEX')) return { rows: [] };
      if (sql.includes('CREATE VECTOR INDEX')) {
        activeBuilds += 1;
        maxConcurrentBuilds = Math.max(maxConcurrentBuilds, activeBuilds);
        await new Promise<void>(resolve => pendingBuilds.push(() => resolve()));
        activeBuilds -= 1;
        return { rows: [] };
      }
      if (sql.includes('UPDATE "MASTRA_VECTOR_INDEXES"')) {
        registryRow = { ...registryRow, metric: String(binds.metric), indexType: String(binds.index_type) };
        return { rows: [], rowsAffected: 1 };
      }
      return { rows: [], rowsAffected: 1 };
    });
    const connection = { execute, commit: vi.fn(async () => undefined), rollback: vi.fn(async () => undefined) };
    const { vector } = createVectorWithConnection(connection);

    const first = vector.rebuildIndex({ indexName: 'lock_rebuild_index', indexConfig: { type: 'hnsw' } });
    const second = vector.rebuildIndex({ indexName: 'lock_rebuild_index', indexConfig: { type: 'ivf' } });

    await waitUntil(() => pendingBuilds.length >= 1);
    expect(pendingBuilds).toHaveLength(1); // the second rebuild must stay blocked behind the per-index lock

    pendingBuilds[0]!();
    await first;

    await waitUntil(() => pendingBuilds.length >= 2);
    expect(pendingBuilds).toHaveLength(2);

    pendingBuilds[1]!();
    await second;

    expect(maxConcurrentBuilds).toBe(1);
  });

  it('rejects rebuildIndex when the vector index still exists after DROP INDEX instead of updating the registry', async () => {
    const duplicateIndexError = Object.assign(new Error('ORA-00955: name is already used by an existing object'), {
      errorNum: 955,
    });
    const registryRow = {
      indexName: 'rebuild_race_index',
      tableName: 'MASTRA_VEC_REBUILD_RACE_INDEX',
      dimension: 3,
      metric: 'cosine',
      indexType: 'hnsw',
      vectorFormat: 'vector',
      accuracy: 95,
    };
    const execute = vi.fn(async (sql: string) => {
      if (sql.includes('index_name AS "indexName"') && sql.includes('table_name AS "tableName"')) {
        return { rows: [registryRow] };
      }
      if (sql.includes('DROP INDEX')) return { rows: [] };
      if (sql.includes('CREATE VECTOR INDEX')) throw duplicateIndexError;
      return { rows: [], rowsAffected: 1 };
    });
    const connection = { execute, commit: vi.fn(async () => undefined), rollback: vi.fn(async () => undefined) };
    const { vector } = createVectorWithConnection(connection);

    await expect(vector.rebuildIndex({ indexName: 'rebuild_race_index' })).rejects.toThrow(/already exists/i);

    expect(execute.mock.calls.some(call => String(call[0]).includes('UPDATE "MASTRA_VECTOR_INDEXES"'))).toBe(false);
  });

  it('normalizes query rows from string, null, object, array, and unsupported vector payloads', async () => {
    const connection = {
      execute: vi.fn(async () => ({
        rows: [
          { id: 'json-string', score: '0.9', metadata: '{"source":"string"}', vector: '[1,2,3]' },
          { id: 'json-null', score: 0.8, metadata: null, vector: [3, 2, 1] },
          { id: 'json-object', score: 0.7, metadata: { source: 'object' }, vector: { unsupported: true } },
        ],
      })),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    };
    const { vector } = createVectorWithConnection(connection);
    cacheIndex(vector);

    await expect(vector.query({ indexName: 'hot_index', filter: { tenant: 'a' }, includeVector: true })).resolves.toEqual([
      { id: 'json-string', score: 0.9, metadata: { source: 'string' }, vector: [1, 2, 3] },
      { id: 'json-null', score: 0.8, metadata: {}, vector: [3, 2, 1] },
      { id: 'json-object', score: 0.7, metadata: { source: 'object' }, vector: [] },
    ]);
  });

  it('wraps operation failures and validates vector-specific payload ranges', async () => {
    const executeFailure = Object.assign(new Error('database failed'), { errorNum: 1 });
    const failingConnection = {
      execute: vi.fn(async (sql: string) => {
        if (sql.includes('index_name AS "indexName"') && sql.includes('table_name AS "tableName"')) {
          return {
            rows: [
              {
                indexName: 'hot_index',
                tableName: 'MASTRA_VEC_HOT',
                dimension: 3,
                metric: 'cosine',
                indexType: 'ivf',
                vectorFormat: 'vector',
                accuracy: 95,
              },
            ],
          };
        }
        throw executeFailure;
      }),
      executeMany: vi.fn(async () => {
        throw executeFailure;
      }),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    };
    const { vector } = createVectorWithConnection(failingConnection);
    cacheIndex(vector);

    await expect(vector.query({ indexName: 'hot_index', sparseVector: { indices: [], values: [] } as any })).rejects.toThrow(
      /sparseVector/i,
    );
    await expect(vector.query({ indexName: 'hot_index', queryVector: [1, 0, 0], minScore: Number.NaN })).rejects.toThrow(
      /minScore/i,
    );
    await expect(vector.query({ indexName: 'hot_index', queryVector: [1, 0, 0], queryMode: 'fast' as any })).rejects.toThrow(
      /queryMode/i,
    );
    await expect(
      vector.createIndex({
        indexName: 'bad_index_type',
        dimension: 3,
        indexConfig: { type: 'flat' as any },
        buildIndex: false,
      }),
    ).rejects.toThrow(/index type/i);
    await expect(
      vector.updateVector({ indexName: 'hot_index', id: 'id-1', update: { metadata: { tag: 'x' } } }),
    ).rejects.toThrow(/database failed/i);
    await expect(vector.deleteVector({ indexName: 'hot_index', id: 'id-1' })).rejects.toThrow(/database failed/i);
    await expect(vector.deleteVectors({ indexName: 'hot_index', ids: ['id-1'] })).rejects.toThrow(/database failed/i);
    expect(failingConnection.rollback).toHaveBeenCalled();

    const { vector: bitVector } = createVectorWithConnection({
      execute: vi.fn(async () => ({ rows: [] })),
      executeMany: vi.fn(async () => ({ rowsAffected: 0 })),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    });
    cacheIndex(bitVector, { indexName: 'bit_index', dimension: 8, metric: 'hamming', vectorFormat: 'bit' });
    await expect(
      bitVector.upsert({ indexName: 'bit_index', ids: ['bit-1'], vectors: [[1, 0, 2, 0, 1, 0, 1, 0]] }),
    ).rejects.toThrow(/bit vectors/i);

    const { vector: int8Vector } = createVectorWithConnection({
      execute: vi.fn(async () => ({ rows: [] })),
      executeMany: vi.fn(async () => ({ rowsAffected: 0 })),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
    });
    cacheIndex(int8Vector, { indexName: 'int8_index', dimension: 3, vectorFormat: 'int8' });
    await expect(
      int8Vector.upsert({ indexName: 'int8_index', ids: ['int8-1'], vectors: [[1, 128, 3]] }),
    ).rejects.toThrow(/int8 vectors/i);
  });

  it('validates vector memory scope and wraps Oracle ALTER SYSTEM failures', async () => {
    const connection = {
      execute: vi.fn(async () => {
        throw Object.assign(new Error('ORA-01031: insufficient privileges'), { errorNum: 1031 });
      }),
    };
    const { vector } = createVectorWithConnection(connection);

    await expect(vector.configureVectorMemory({ size: '64M', scope: 'BAD' as any })).rejects.toThrow(/vector memory scope/i);
    await expect(vector.configureVectorMemory({ size: '64M', scope: 'spfile' })).rejects.toThrow(/VECTOR_MEMORY_SIZE=64M/i);
    expect(connection.execute).toHaveBeenCalledWith('ALTER SYSTEM SET VECTOR_MEMORY_SIZE = 64M SCOPE=SPFILE');
  });
});
