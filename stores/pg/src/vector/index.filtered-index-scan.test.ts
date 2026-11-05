import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PgVector } from '.';

// Memory searches always filter by resource_id, and before #28949 any filter kept PgVector.query off the HNSW index.
describe('PgVector filtered search on vector indexes (#28949)', () => {
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
  const suffix = Date.now();
  const hnswIndex = `filtered_scan_hnsw_${suffix}`;
  const ivfflatIndex = `filtered_scan_ivf_${suffix}`;
  const dimension = 16;
  const topK = 10;

  // enable_sort=off makes the planner use the vector index whenever the query allows it, so results
  // don't depend on this small table's cost estimates. max_scan_tuples=100 stops the iterative scan
  // early, as a rare filter value does on a large table.
  const indexFriendlyOptions = '-c enable_sort=off -c hnsw.max_scan_tuples=100';

  // Seeded so every run uses the same vectors.
  let seed = 28949;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const randomVector = () => Array.from({ length: dimension }, () => random() * 2 - 1);

  // 2400 rows for a large resource, 15 for a small one, 3 for a tiny one and 20 for each of the others.
  const rows: { id: string; vector: number[]; metadata: { resource_id: string } }[] = [];
  const addRows = (resourceId: string, count: number) => {
    for (let i = 0; i < count; i++) {
      rows.push({ id: `${resourceId}-${i}`, vector: randomVector(), metadata: { resource_id: resourceId } });
    }
  };
  addRows('big', 2400);
  addRows('small', 15);
  addRows('tiny', 3);
  for (let r = 0; r < 29; r++) addRows(`other-${r}`, 20);
  const queryVector = randomVector();

  const cosine = (a: number[], b: number[]) => {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      na += a[i]! * a[i]!;
      nb += b[i]! * b[i]!;
    }
    return dot / Math.sqrt(na * nb);
  };
  const exactTopK = (resourceId: string | undefined, minScore = -1) =>
    rows
      .filter(row => resourceId === undefined || row.metadata.resource_id === resourceId)
      .map(row => ({ id: row.id, score: cosine(row.vector, queryVector) }))
      .filter(row => row.score > minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

  let admin: pg.Client;

  // A backend flushes its index statistics when it exits, so read them after the store disconnects.
  const indexScans = async (indexName: string) => {
    await admin.query('SELECT pg_stat_clear_snapshot()');
    const { rows } = await admin.query(`SELECT idx_scan FROM pg_stat_user_indexes WHERE indexrelname = $1`, [
      `${indexName}_vector_idx`,
    ]);
    return Number(rows[0].idx_scan);
  };

  const queryCountingIndexScans = async (params: Parameters<PgVector['query']>[0]) => {
    const indexName = params.indexName;
    const before = await indexScans(indexName);
    const store = new PgVector({
      connectionString,
      id: 'pg-filtered-index-scan-query',
      pgPoolOptions: { options: indexFriendlyOptions },
    });
    const results = await store.query(params);
    await store.disconnect();

    let scans = before;
    for (let attempt = 0; attempt < 30 && scans === before; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      scans = await indexScans(indexName);
    }
    return { results, indexScans: scans - before };
  };

  beforeAll(async () => {
    admin = new pg.Client({ connectionString });
    await admin.connect();

    const setup = new PgVector({ connectionString, id: 'pg-filtered-index-scan-setup' });
    // Created before any data exists, as @mastra/memory does.
    await setup.createIndex({ indexName: hnswIndex, dimension, indexConfig: { type: 'hnsw' } });
    await setup.createIndex({ indexName: ivfflatIndex, dimension, indexConfig: { type: 'ivfflat' } });
    for (const indexName of [hnswIndex, ivfflatIndex]) {
      await setup.upsert({
        indexName,
        ids: rows.map(row => row.id),
        vectors: rows.map(row => row.vector),
        metadata: rows.map(row => row.metadata),
      });
      await admin.query(`ANALYZE "${indexName}"`);
    }
    await setup.disconnect();
  }, 60_000);

  afterAll(async () => {
    const cleanup = new PgVector({ connectionString, id: 'pg-filtered-index-scan-cleanup' });
    await cleanup.deleteIndex({ indexName: hnswIndex });
    await cleanup.deleteIndex({ indexName: ivfflatIndex });
    await cleanup.disconnect();
    await admin.end();
  });

  it('searching a large resource uses the HNSW index and returns its nearest rows', async () => {
    const { results, indexScans } = await queryCountingIndexScans({
      indexName: hnswIndex,
      queryVector,
      topK,
      filter: { resource_id: 'big' },
    });

    expect(indexScans).toBeGreaterThan(0);
    expect(results).toHaveLength(topK);
    expect(results.every(r => r.metadata?.resource_id === 'big')).toBe(true);
    // HNSW is approximate, so allow one miss.
    const exactIds = new Set(exactTopK('big').map(r => r.id));
    expect(results.filter(r => exactIds.has(r.id)).length).toBeGreaterThanOrEqual(topK - 1);
  });

  it.each([
    ['small', 15],
    ['tiny', 3],
  ])(
    'searching a %s resource returns its exact nearest rows even when the index walk stops early',
    async resourceId => {
      // The iterative scan alone must return fewer than topK rows here, or the fallback is never exercised.
      const raw = new pg.Client({ connectionString, options: indexFriendlyOptions });
      await raw.connect();
      try {
        await raw.query('BEGIN');
        await raw.query('SET LOCAL hnsw.iterative_scan = strict_order');
        const { rows: indexOnly } = await raw.query(
          `SELECT vector_id FROM "${hnswIndex}" WHERE metadata->>'resource_id' = $1
           ORDER BY embedding <=> $2::vector LIMIT $3`,
          [resourceId, `[${queryVector.join(',')}]`, topK],
        );
        await raw.query('COMMIT');
        expect(indexOnly.length).toBeLessThan(topK);
      } finally {
        await raw.end();
      }

      const { results } = await queryCountingIndexScans({
        indexName: hnswIndex,
        queryVector,
        topK,
        filter: { resource_id: resourceId },
      });

      expect(results.map(r => r.id)).toEqual(exactTopK(resourceId).map(r => r.id));
    },
  );

  it('minScore keeps only rows above the threshold while still using the HNSW index', async () => {
    const exact = exactTopK(undefined);
    // Threshold between the 5th and 6th best rows, so half of the top 10 pass.
    const minScore = (exact[4]!.score + exact[5]!.score) / 2;

    const { results, indexScans } = await queryCountingIndexScans({
      indexName: hnswIndex,
      queryVector,
      topK,
      minScore,
    });

    expect(indexScans).toBeGreaterThan(0);
    expect(results.every(r => r.score > minScore)).toBe(true);
    const exactIds = exactTopK(undefined, minScore).map(r => r.id);
    expect(exactIds).toHaveLength(5);
    expect(results.filter(r => exactIds.includes(r.id)).length).toBeGreaterThanOrEqual(exactIds.length - 1);
  });

  it('filtered search on an ivfflat index stays exact and does not use the index', async () => {
    // Memory builds ivfflat on an empty table, so querying through it would lose matches.
    const { results, indexScans } = await queryCountingIndexScans({
      indexName: ivfflatIndex,
      queryVector,
      topK,
      filter: { resource_id: 'small' },
    });

    expect(indexScans).toBe(0);
    expect(results.map(r => r.id)).toEqual(exactTopK('small').map(r => r.id));
  });
});
