import { beforeAll, describe, expect, it } from 'vitest';

import { createVectorTestSuite } from '../../../_test-utils/src';
import { OracleStore } from '../storage';
import { tableNameForIndex } from './identifiers';
import { OracleVector } from '.';

// Oracle integration coverage stays opt-in because it requires a reachable database and credentials.
const runIntegration = process.env.RUN_ORACLE_VECTOR_INTEGRATION === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

if (runIntegration) {
  // The shared suite keeps Oracle behavior aligned with Mastra's other vector providers.
  const sharedSuiteVector = new OracleVector({
    id: 'oracle-vector-shared-suite',
    user: process.env.ORACLE_DATABASE_USER,
    password: process.env.ORACLE_DATABASE_PASSWORD,
    connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
    tablePrefix: 'ORACLE_SUITE_VEC',
    defaultIndexConfig: { type: 'none' },
  });

  createVectorTestSuite({
    vector: sharedSuiteVector,
    createIndex: async (indexName, options) => {
      await sharedSuiteVector.createIndex({
        indexName,
        dimension: 1536,
        metric: options?.metric,
        buildIndex: false,
      });
    },
    deleteIndex: async indexName => {
      await sharedSuiteVector.deleteIndex({ indexName });
    },
    waitForIndexing: async () => {},
    disconnect: async () => {
      await sharedSuiteVector.disconnect();
    },
    supportsZeroVectors: false,
  });
}

// Provider-specific tests cover Oracle-only formats, shared pools, and JSON metadata behavior.
describeIntegration('OracleVector integration', () => {
  it('stores, filters, queries, updates, and deletes vectors in Oracle AI Database', async () => {
    const vector = new OracleVector({
      id: 'oracle-vector-integration',
      user: process.env.ORACLE_DATABASE_USER,
      password: process.env.ORACLE_DATABASE_PASSWORD,
      connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
      tablePrefix: 'ORACLE_IT_VEC',
      defaultIndexConfig: { type: 'none' },
    });

    const indexName = 'oracle_vector_smoke';

    try {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await vector.createIndex({
        indexName,
        dimension: 3,
        metric: 'cosine',
        buildIndex: false,
        metadataIndexes: ['resource_id', 'thread_id', 'source_id'],
      });

      await expect(
        vector.createIndex({
          indexName,
          dimension: 4,
          metric: 'cosine',
          buildIndex: false,
        }),
      ).rejects.toThrow(/dimension/i);

      await expect(
        vector.createIndex({
          indexName,
          dimension: 3,
          metric: 'euclidean',
          buildIndex: false,
        }),
      ).rejects.toThrow(/metric/i);

      const ids = await vector.upsert({
        indexName,
        ids: ['message-1', 'message-2', 'message-3'],
        vectors: [
          [0.1, 0.2, 0.3],
          [0.9, 0.1, 0.1],
          [0.1, 0.2, 0.25],
        ],
        metadata: [
          { resource_id: 'resource-1', thread_id: 'thread-1', source_id: 'doc-a', priority: 1 },
          { resource_id: 'resource-2', thread_id: 'thread-2', source_id: 'doc-b', priority: 2 },
          { resource_id: 'resource-1', thread_id: 'thread-3', source_id: 'doc-a', priority: 3 },
        ],
      });

      expect(ids).toEqual(['message-1', 'message-2', 'message-3']);

      const results = await vector.query({
        indexName,
        queryVector: [0.1, 0.2, 0.3],
        topK: 2,
        filter: { resource_id: 'resource-1' },
        includeVector: true,
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe('message-1');
      expect(results[0]?.metadata?.resource_id).toBe('resource-1');
      expect(results[0]?.vector).toHaveLength(3);

      const metadataOnly = await vector.query({
        indexName,
        topK: 5,
        filter: { source_id: 'doc-b' },
      });

      expect(metadataOnly.map(result => result.id)).toEqual(['message-2']);

      await vector.updateVector({
        indexName,
        id: 'message-2',
        update: { metadata: { resource_id: 'resource-2', thread_id: 'thread-2', source_id: 'doc-b', archived: true } },
      });

      const archived = await vector.query({
        indexName,
        topK: 1,
        filter: { archived: { $exists: true } },
      });

      expect(archived[0]?.id).toBe('message-2');

      const stats = await vector.describeIndex({ indexName });
      expect(stats).toMatchObject({ dimension: 3, count: 3, metric: 'cosine', vectorFormat: 'vector' });

      await vector.deleteVectors({ indexName, filter: { source_id: 'doc-a' } });
      const remainingStats = await vector.describeIndex({ indexName });
      expect(remainingStats.count).toBe(1);
    } finally {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await vector.disconnect();
    }
  });

  it('uses exact search by default without creating a physical vector index', async () => {
    const vector = new OracleVector({
      id: 'oracle-vector-default-none-integration',
      user: process.env.ORACLE_DATABASE_USER,
      password: process.env.ORACLE_DATABASE_PASSWORD,
      connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
      tablePrefix: 'ORACLE_IT_DEFAULT_VEC',
    });

    const indexName = 'oracle_default_exact_search';

    try {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await vector.createIndex({
        indexName,
        dimension: 3,
        metric: 'cosine',
      });

      await vector.upsert({
        indexName,
        ids: ['exact-default-1', 'exact-default-2'],
        vectors: [
          [0.2, 0.8, 0.1],
          [0.9, 0.1, 0.2],
        ],
        metadata: [{ bucket: 'default-none' }, { bucket: 'default-none' }],
      });

      await expect(vector.describeIndex({ indexName })).resolves.toMatchObject({
        indexType: 'none',
        count: 2,
      });

      const results = await vector.query({
        indexName,
        queryVector: [0.2, 0.8, 0.1],
        topK: 1,
      });

      expect(results[0]?.id).toBe('exact-default-1');
    } finally {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await vector.disconnect();
    }
  });

  it('supports explicit IVF vector index creation while keeping exact queries available', async () => {
    const vector = new OracleVector({
      id: 'oracle-vector-ivf-integration',
      user: process.env.ORACLE_DATABASE_USER,
      password: process.env.ORACLE_DATABASE_PASSWORD,
      connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
      tablePrefix: 'ORACLE_IT_IVF_VEC',
      defaultIndexConfig: { type: 'none' },
    });

    const indexName = 'oracle_ivf_search';

    try {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await vector.createIndex({
        indexName,
        dimension: 3,
        metric: 'cosine',
        indexConfig: { type: 'ivf', accuracy: 90, ivf: { neighborPartitions: 1 } },
      });

      await vector.upsert({
        indexName,
        ids: ['ivf-1', 'ivf-2', 'ivf-3'],
        vectors: [
          [0.1, 0.2, 0.3],
          [0.7, 0.2, 0.1],
          [0.1, 0.25, 0.35],
        ],
        metadata: [{ kind: 'ivf' }, { kind: 'ivf' }, { kind: 'ivf' }],
      });

      await expect(vector.describeIndex({ indexName })).resolves.toMatchObject({
        indexType: 'ivf',
        metric: 'cosine',
      });

      const results = await vector.query({
        indexName,
        queryVector: [0.1, 0.2, 0.3],
        topK: 2,
        queryMode: 'exact',
      });

      expect(results.map(result => result.id)).toContain('ivf-1');
    } finally {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await vector.disconnect();
    }
  });

  it('bulk upserts at least 500 vectors in executeMany batches', async () => {
    const vector = new OracleVector({
      id: 'oracle-vector-bulk-integration',
      user: process.env.ORACLE_DATABASE_USER,
      password: process.env.ORACLE_DATABASE_PASSWORD,
      connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
      tablePrefix: 'ORACLE_IT_BULK_VEC',
      defaultIndexConfig: { type: 'none' },
    });

    const indexName = 'oracle_bulk_vectors';
    const ids = Array.from({ length: 500 }, (_, index) => `bulk-vector-${index}`);
    const vectors = ids.map((_, index) => [
      (index + 1) / 500,
      (500 - index) / 500,
      ((index % 11) + 1) / 11,
    ]);
    const metadata = ids.map((id, index) => ({ id, group: index % 5, bulk: true }));

    try {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await vector.createIndex({
        indexName,
        dimension: 3,
        metric: 'cosine',
        buildIndex: false,
      });

      await expect(vector.upsert({ indexName, ids, vectors, metadata })).resolves.toEqual(ids);

      await expect(vector.describeIndex({ indexName })).resolves.toMatchObject({ count: 500 });
      const results = await vector.query({
        indexName,
        queryVector: vectors[0]!,
        topK: 10,
        filter: { bulk: true },
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.id).toBe('bulk-vector-0');
    } finally {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await vector.disconnect();
    }
  });

  it('supports vector, bit, and int8 vector formats', async () => {
    const vector = new OracleVector({
      id: 'oracle-vector-format-integration',
      user: process.env.ORACLE_DATABASE_USER,
      password: process.env.ORACLE_DATABASE_PASSWORD,
      connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
      tablePrefix: 'ORACLE_IT_FORMAT_VEC',
      defaultIndexConfig: { type: 'none' },
    });

    const indexes = [
      {
        indexName: 'oracle_format_vector',
        dimension: 3,
        vectorFormat: 'vector' as const,
        vectors: [[0.1, 0.2, 0.3]],
        queryVector: [0.1, 0.2, 0.3],
        metric: 'cosine' as const,
      },
      {
        indexName: 'oracle_format_bit',
        dimension: 8,
        vectorFormat: 'bit' as const,
        vectors: [[1, 0, 1, 0, 1, 0, 1, 0]],
        queryVector: [1, 0, 1, 0, 1, 0, 1, 0],
        metric: 'hamming' as const,
      },
      {
        indexName: 'oracle_format_int8',
        dimension: 4,
        vectorFormat: 'int8' as const,
        vectors: [[1, -2, 3, -4]],
        queryVector: [1, -2, 3, -4],
        metric: 'cosine' as const,
      },
    ];

    try {
      for (const index of indexes) {
        await vector.deleteIndex({ indexName: index.indexName }).catch(() => undefined);
        await vector.createIndex({
          indexName: index.indexName,
          dimension: index.dimension,
          vectorFormat: index.vectorFormat,
          metric: index.metric,
          buildIndex: false,
        });
        await vector.upsert({
          indexName: index.indexName,
          ids: [`${index.indexName}-1`],
          vectors: index.vectors,
          metadata: [{ format: index.vectorFormat }],
        });

        const results = await vector.query({
          indexName: index.indexName,
          queryVector: index.queryVector,
          topK: 1,
          includeVector: true,
        });

        expect(results[0]?.id).toBe(`${index.indexName}-1`);
        expect(results[0]?.metadata?.format).toBe(index.vectorFormat);
        expect(results[0]?.vector).toHaveLength(index.dimension);
        await expect(vector.describeIndex({ indexName: index.indexName })).resolves.toMatchObject({
          vectorFormat: index.vectorFormat,
        });
      }
    } finally {
      for (const index of indexes) {
        await vector.deleteIndex({ indexName: index.indexName }).catch(() => undefined);
      }
      await vector.disconnect();
    }
  });

  it('shares the OracleStore pool manager with vector retrieval', async () => {
    const storage = new OracleStore({
      id: 'oracle-shared-pool-storage',
      user: process.env.ORACLE_DATABASE_USER,
      password: process.env.ORACLE_DATABASE_PASSWORD,
      connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
      disableInit: true,
    });

    const vector = new OracleVector({
      id: 'oracle-shared-pool-vector',
      poolManager: storage.getPoolManager(),
      tablePrefix: 'ORACLE_IT_SHARED_VEC',
      defaultIndexConfig: { type: 'none' },
    });

    const indexName = 'oracle_shared_pool_smoke';

    try {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await vector.createIndex({
        indexName,
        dimension: 3,
        metric: 'cosine',
        buildIndex: false,
        metadataIndexes: ['resource_id'],
      });

      await vector.upsert({
        indexName,
        ids: ['shared-message-1'],
        vectors: [[0.1, 0.2, 0.3]],
        metadata: [{ resource_id: 'shared-resource' }],
      });

      const results = await vector.query({
        indexName,
        queryVector: [0.1, 0.2, 0.3],
        topK: 1,
        filter: { resource_id: 'shared-resource' },
      });

      expect(results[0]?.id).toBe('shared-message-1');

      const poolBeforeVectorDisconnect = await storage.getPool();
      await vector.deleteIndex({ indexName });
      await vector.disconnect();

      const poolAfterVectorDisconnect = await storage.getPool();
      expect(poolAfterVectorDisconnect).toBe(poolBeforeVectorDisconnect);

      const probe = await storage.db.execute<{ ok: number }>('SELECT 1 AS "ok" FROM dual');
      expect(probe[0]?.ok).toBe(1);
    } finally {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await vector.disconnect().catch(() => undefined);
      await storage.disconnect();
    }
  });

  it('serializes concurrent createIndex calls for the same Oracle vector index', async () => {
    const vector = new OracleVector({
      id: 'oracle-vector-concurrent-create',
      user: process.env.ORACLE_DATABASE_USER,
      password: process.env.ORACLE_DATABASE_PASSWORD,
      connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
      tablePrefix: 'ORACLE_IT_LOCK_VEC',
      defaultIndexConfig: { type: 'none' },
    });
    const indexName = 'oracle_vector_concurrent_create';

    try {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await Promise.all(
        Array.from({ length: 4 }, () =>
          vector.createIndex({
            indexName,
            dimension: 3,
            metric: 'cosine',
            buildIndex: false,
          }),
        ),
      );

      await expect(vector.describeIndex({ indexName })).resolves.toMatchObject({ dimension: 3, metric: 'cosine' });
      await expect(vector.createIndex({ indexName, dimension: 4, buildIndex: false })).rejects.toThrow(/dimension/i);
    } finally {
      await vector.deleteIndex({ indexName }).catch(() => undefined);
      await vector.disconnect();
    }
  });

  it('deleteIndex uses the registry table name instead of the current table prefix', async () => {
    const registryTableName = 'ORACLE_IT_DELETE_REGISTRY';
    const indexName = 'oracle_registry_delete';
    const vectorA = new OracleVector({
      id: 'oracle-vector-registry-delete-a',
      user: process.env.ORACLE_DATABASE_USER,
      password: process.env.ORACLE_DATABASE_PASSWORD,
      connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
      tablePrefix: 'ORACLE_IT_REGA_VEC',
      registryTableName,
      defaultIndexConfig: { type: 'none' },
    });
    const vectorB = new OracleVector({
      id: 'oracle-vector-registry-delete-b',
      user: process.env.ORACLE_DATABASE_USER,
      password: process.env.ORACLE_DATABASE_PASSWORD,
      connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
      tablePrefix: 'ORACLE_IT_REGB_VEC',
      registryTableName,
      defaultIndexConfig: { type: 'none' },
    });
    const tableA = tableNameForIndex(indexName, 'ORACLE_IT_REGA_VEC');

    try {
      await vectorA.deleteIndex({ indexName }).catch(() => undefined);
      await vectorB.deleteIndex({ indexName }).catch(() => undefined);
      await vectorA.createIndex({ indexName, dimension: 3, buildIndex: false });

      await vectorB.deleteIndex({ indexName });

      const probeStore = new OracleStore({
        id: 'oracle-vector-registry-delete-probe',
        user: process.env.ORACLE_DATABASE_USER,
        password: process.env.ORACLE_DATABASE_PASSWORD,
        connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
        disableInit: true,
      });
      try {
        const rows = await probeStore.db.execute<{ count: number }>(
          `SELECT COUNT(*) AS "count" FROM all_tables WHERE owner = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AND table_name = :tableName`,
          { tableName: tableA },
        );
        expect(Number(rows[0]?.count ?? 0)).toBe(0);
      } finally {
        await probeStore.disconnect();
      }
    } finally {
      await vectorA.deleteIndex({ indexName }).catch(() => undefined);
      await vectorB.deleteIndex({ indexName }).catch(() => undefined);
      await vectorA.disconnect();
      await vectorB.disconnect();
    }
  });

  // HNSW indexes live in Oracle's Vector Pool, sized by VECTOR_MEMORY_SIZE. The Docker container
  // in docker-compose.yaml only applies that setting after a `docker compose restart db` (see
  // scripts/configure-vector-memory.sql and the README's "Vector memory (HNSW only)" section), so
  // this suite must stay green whether or not that restart has happened. Exact search and IVF are
  // covered by the tests above and never depend on the Vector Pool.
  describe('HNSW vector index (requires Oracle Vector Pool memory)', () => {
    let hnswUnavailableReason: string | null = null;

    beforeAll(async () => {
      const probeStore = new OracleStore({
        id: 'oracle-hnsw-pool-probe',
        user: process.env.ORACLE_DATABASE_USER,
        password: process.env.ORACLE_DATABASE_PASSWORD,
        connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
        disableInit: true,
      });

      try {
        // Fast path: read the live parameter value directly. Regular app users (see the README's
        // minimum-grants section) are not granted SELECT on v$parameter, so ORA-00942 here is
        // expected and is not itself a reason to skip — it just means the test below decides
        // availability by attempting the real HNSW build instead.
        const rows = await probeStore.db.execute<{ value: string }>(
          `SELECT value AS "value" FROM v$parameter WHERE name = 'vector_memory_size'`,
        );
        const size = Number(rows[0]?.value ?? NaN);
        if (Number.isFinite(size) && size <= 0) {
          hnswUnavailableReason =
            'vector_memory_size is 0. Run `docker compose restart db` once after the container ' +
            'finishes initializing (see scripts/configure-vector-memory.sql) to enable HNSW.';
        }
      } catch {
        // v$parameter is not visible to this user; fall through to the direct build probe below.
      } finally {
        await probeStore.disconnect();
      }
    });

    it('builds an HNSW vector index once Oracle Vector Pool memory is configured', async context => {
      if (hnswUnavailableReason) {
        context.skip(hnswUnavailableReason);
      }

      const vector = new OracleVector({
        id: 'oracle-vector-hnsw-integration',
        user: process.env.ORACLE_DATABASE_USER,
        password: process.env.ORACLE_DATABASE_PASSWORD,
        connectString: process.env.ORACLE_DATABASE_CONNECT_STRING,
        tablePrefix: 'ORACLE_IT_HNSW_VEC',
        defaultIndexConfig: { type: 'none' },
      });

      const indexName = 'oracle_hnsw_search';

      try {
        await vector.deleteIndex({ indexName }).catch(() => undefined);

        try {
          await vector.createIndex({
            indexName,
            dimension: 3,
            metric: 'cosine',
            indexConfig: { type: 'hnsw' },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // ORA-51962: Vector Pool out of space — surfaces when VECTOR_MEMORY_SIZE has not taken
          // effect yet (needs a restart after scripts/configure-vector-memory.sql runs).
          if (/VECTOR_MEMORY_SIZE|Vector Pool|ORA-51962/i.test(message)) {
            context.skip(
              'Oracle Vector Pool is out of space (ORA-51962). Run `docker compose restart db` once ' +
                'after the container finishes initializing to enable HNSW.',
            );
          }
          throw error;
        }

        await vector.upsert({
          indexName,
          ids: ['hnsw-1', 'hnsw-2', 'hnsw-3'],
          vectors: [
            [0.1, 0.2, 0.3],
            [0.9, 0.1, 0.1],
            [0.1, 0.2, 0.25],
          ],
          metadata: [{ kind: 'hnsw' }, { kind: 'hnsw' }, { kind: 'hnsw' }],
        });

        await expect(vector.describeIndex({ indexName })).resolves.toMatchObject({
          indexType: 'hnsw',
          metric: 'cosine',
        });

        const results = await vector.query({
          indexName,
          queryVector: [0.1, 0.2, 0.3],
          topK: 2,
        });

        expect(results.map(result => result.id)).toContain('hnsw-1');
      } finally {
        await vector.deleteIndex({ indexName }).catch(() => undefined);
        await vector.disconnect();
      }
    });
  });
});
