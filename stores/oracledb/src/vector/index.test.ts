import { describe, expect, it, vi } from 'vitest';

import { OracleVector } from '.';

// Unit tests avoid opening a real pool by validating failures that occur before connection use.
function createVector() {
  return new OracleVector({
    id: 'oracle-vector-unit',
    pool: {} as any,
  });
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
});

describe('OracleVector hot path SQL shape', () => {
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
