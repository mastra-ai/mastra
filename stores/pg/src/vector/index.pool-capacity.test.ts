import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';

import { PgVector } from '.';

it('supports cold-cache vector operations with a single-connection pool', async () => {
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
  const indexName = `pool_${randomUUID().replaceAll('-', '')}`;
  const admin = new PgVector({ id: 'pool-capacity-admin', connectionString, pgPoolOptions: { max: 1 } });
  const createClient = () => {
    // Prevent constructor warmup from filling the metadata cache before the operation under test.
    const listIndexes = vi.spyOn(PgVector.prototype, 'listIndexes').mockResolvedValue([]);
    try {
      return new PgVector({
        id: 'pool-capacity-client',
        connectionString,
        disableInit: true,
        pgPoolOptions: { max: 1, connectionTimeoutMillis: 500 },
      });
    } finally {
      listIndexes.mockRestore();
    }
  };

  try {
    await admin.createIndex({ indexName, dimension: 3 });
    // A fresh client for each operation ensures metadata has not been cached by a previous operation.
    for (const operation of ['upsert', 'query', 'update', 'build'] as const) {
      const client = createClient();
      try {
        if (operation === 'upsert') {
          await client.upsert({ indexName, vectors: [[1, 0, 0]], ids: ['vector-1'] });
        } else if (operation === 'query') {
          const results = await client.query({ indexName, queryVector: [1, 0, 0] });
          expect(results[0]?.id).toBe('vector-1');
        } else if (operation === 'update') {
          await client.updateVector({ indexName, id: 'vector-1', update: { vector: [0, 1, 0] } });
        } else {
          await client.buildIndex({ indexName, metric: 'cosine', indexConfig: { type: 'flat' } });
        }
        expect(client.pool.totalCount).toBe(1);
        expect(client.pool.idleCount).toBe(1);
      } finally {
        await client.disconnect();
      }
    }
  } finally {
    await admin.deleteIndex({ indexName });
    await admin.disconnect();
  }
});

it('creates metadata indexes with a single-connection pool', async () => {
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
  const indexName = `pool_${randomUUID().replaceAll('-', '')}`;
  const vector = new PgVector({
    id: 'pool-capacity-metadata-indexes',
    connectionString,
    pgPoolOptions: { max: 1, connectionTimeoutMillis: 500 },
  });

  try {
    await vector.createIndex({ indexName, dimension: 3, metadataIndexes: ['resource_id', 'thread_id'] });

    const { rows } = await vector.pool.query(`SELECT indexdef FROM pg_indexes WHERE tablename = $1`, [indexName]);
    const indexDefs = rows.map(row => row.indexdef).join('\n');
    expect(indexDefs).toContain(`(metadata ->> 'resource_id'::text)`);
    expect(indexDefs).toContain(`(metadata ->> 'thread_id'::text)`);
  } finally {
    await vector.deleteIndex({ indexName });
    await vector.disconnect();
  }
});
