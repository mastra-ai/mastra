import pg from 'pg';
import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import type { TestConfig, TestResult } from './performance.helpers';
import {
  baseTestConfigs,
  calculateTimeout,
  generateRandomVectors,
  findNearestBruteForce,
  calculateRecall,
  formatTable,
  groupBy,
  measureLatency,
  getListCount,
  getSearchEf,
  generateClusteredVectors,
  generateSkewedVectors,
  getHNSWConfig,
  getIndexDescription,
} from './performance.helpers';
import type { IndexConfig, IndexType } from './types';

import { PgVector } from '.';

interface IndexTestConfig extends IndexConfig {
  type: IndexType;
  rebuild?: boolean;
}

class PGPerformanceVector extends PgVector {
  private perfPool: pg.Pool;

  constructor(connectionString: string) {
    super(connectionString);

    const basePool = new pg.Pool({
      connectionString,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 2000, // Fail fast if can't connect
    });

    this.perfPool = basePool;
  }

  async bulkUpsert(indexName: string, vectors: number[][], metadata?: any[], ids?: string[]) {
    const client = await this.perfPool.connect();
    try {
      await client.query('BEGIN');
      const vectorIds = ids || vectors.map(() => crypto.randomUUID());

      // Same query structure as upsert, just using unnest for bulk operation
      const query = `
        INSERT INTO ${indexName} (vector_id, embedding, metadata)
        SELECT * FROM unnest(
          $1::text[],
          $2::vector[],
          $3::jsonb[]
        )
        ON CONFLICT (vector_id)
        DO UPDATE SET
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata
        RETURNING embedding::text
      `;

      // Same parameter structure as upsert, just as arrays
      await client.query(query, [
        vectorIds,
        vectors.map(v => `[${v.join(',')}]`),
        (metadata || vectors.map(() => ({}))).map(m => JSON.stringify(m)),
      ]);
      await client.query('COMMIT');
      return vectorIds;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

const warmupCache = new Map<string, boolean>();
async function smartWarmup(
  vectorDB: PGPerformanceVector,
  testIndexName: string,
  indexType: string,
  dimension: number,
  k: number,
) {
  const cacheKey = `${dimension}-${k}-${indexType}`;
  if (!warmupCache.has(cacheKey)) {
    console.log(`Warming up ${indexType} index for ${dimension}d vectors, k=${k}`);
    const warmupVector = generateRandomVectors(1, dimension)[0] as number[];
    await vectorDB.query(testIndexName, warmupVector, k);
    warmupCache.set(cacheKey, true);
  }
}

const connectionString = process.env.DB_URL || `postgresql://postgres:postgres@localhost:5435/mastra`;
describe('PostgreSQL Index Performance', () => {
  let vectorDB: PGPerformanceVector;
  const testIndexName = 'test_index_performance';
  const results: TestResult[] = [];

  const indexConfigs: IndexTestConfig[] = [
    { type: 'flat' }, // Test flat/linear search as baseline
    { type: 'ivfflat', ivf: { lists: 100 } }, // Test IVF with fixed lists
    { type: 'ivfflat', rebuild: true }, // Test IVF with calculated lists and rebuild
    { type: 'hnsw' }, // Test HNSW with default parameters
    { type: 'hnsw', hnsw: { m: 16, efConstruction: 64 } }, // Test HNSW with custom parameters
  ];
  beforeAll(async () => {
    // Initialize PGPerformanceVector
    vectorDB = new PGPerformanceVector(connectionString);
  });
  beforeEach(async () => {
    await vectorDB.deleteIndex(testIndexName);
  });

  afterEach(async () => {
    await vectorDB.deleteIndex(testIndexName);
  });

  afterAll(async () => {
    await vectorDB.disconnect();
    analyzeResults(results);
  });

  // Combine all test configs
  const allConfigs: TestConfig[] = [
    ...baseTestConfigs['64'],
    ...baseTestConfigs['384'],
    ...baseTestConfigs['1024'],
    ...baseTestConfigs.smokeTests,
    ...baseTestConfigs.stressTests,
  ];

  // For each index config
  for (const indexConfig of indexConfigs) {
    const indexType = indexConfig.type;
    const rebuild = indexConfig.rebuild ?? false;
    const hnswConfig = getHNSWConfig(indexConfig);
    const indexDescription = getIndexDescription({
      type: indexType,
      hnsw: hnswConfig,
    });

    describe(`Index: ${indexDescription}`, () => {
      for (const testConfig of allConfigs) {
        const timeout = calculateTimeout(testConfig.dimension, testConfig.size, testConfig.k);
        const testDesc = `dim=${testConfig.dimension} size=${testConfig.size} k=${testConfig.k}`;

        for (const [distType, generator] of Object.entries(distributions)) {
          it(
            testDesc,
            async () => {
              const testVectors = generator(testConfig.size, testConfig.dimension);
              const queryVectors = generator(testConfig.queryCount, testConfig.dimension);

              // Create index and insert vectors
              const lists = getListCount(indexConfig, testConfig.size);

              await vectorDB.createIndex(
                testIndexName,
                testConfig.dimension,
                'cosine',
                indexConfig,
                indexType === 'ivfflat',
              );

              console.log(
                `Batched bulk upserting ${testVectors.length} ${distType} vectors into index ${testIndexName}`,
              );
              const batchSizes = splitIntoRandomBatches(testConfig.size, testConfig.dimension);
              await batchedBulkUpsert(vectorDB, testIndexName, testVectors, batchSizes);
              if (indexType === 'hnsw' || rebuild) {
                console.log('rebuilding index');
                await vectorDB.buildIndex(testIndexName, 'cosine', indexConfig);
                console.log('index rebuilt');
              }
              await smartWarmup(vectorDB, testIndexName, indexType, testConfig.dimension, testConfig.k);

              // For HNSW, test different EF values
              const efValues = indexType === 'hnsw' ? getSearchEf(testConfig.k, hnswConfig.m) : { default: undefined };

              for (const [efType, ef] of Object.entries(efValues)) {
                const recalls: number[] = [];
                const latencies: number[] = [];

                for (const queryVector of queryVectors) {
                  const expectedNeighbors = findNearestBruteForce(queryVector, testVectors, testConfig.k);

                  const [latency, actualResults] = await measureLatency(async () =>
                    vectorDB.query(
                      testIndexName,
                      queryVector,
                      testConfig.k,
                      undefined,
                      false,
                      0,
                      { ef }, // For HNSW
                    ),
                  );

                  const actualNeighbors = actualResults.map(r => r.metadata?.index);
                  const recall = calculateRecall(actualNeighbors, expectedNeighbors, testConfig.k);
                  recalls.push(recall);
                  latencies.push(latency);
                }

                const sorted = [...latencies].sort((a, b) => a - b);
                results.push({
                  distribution: distType,
                  dimension: testConfig.dimension,
                  size: testConfig.size,
                  k: testConfig.k,
                  type: indexType,
                  metrics: {
                    recall: recalls.length > 0 ? recalls.reduce((a, b) => a + b, 0) / recalls.length : 0,
                    minRecall: Math.min(...recalls),
                    maxRecall: Math.max(...recalls),
                    latency: {
                      p50: sorted[Math.floor(sorted.length * 0.5)],
                      p95: sorted[Math.floor(sorted.length * 0.95)],
                      ...(indexType === 'ivfflat' && {
                        lists,
                        vectorsPerList: Math.round(testConfig.size / (lists || 1)),
                      }),
                      ...(indexType === 'hnsw' && {
                        m: hnswConfig.m,
                        efConstruction: hnswConfig.efConstruction,
                        ef,
                        efType,
                      }),
                    },
                    ...(indexType === 'ivfflat' && {
                      clustering: {
                        numLists: lists,
                        avgVectorsPerList: testConfig.size / (lists || 1),
                        recommendedLists: Math.floor(Math.sqrt(testConfig.size)),
                        distribution: distType,
                      },
                    }),
                  },
                });
              }
            },
            timeout,
          );
        }
      }
    });
  }
});

function analyzeResults(results: TestResult[]) {
  const byType = groupBy(results, (r: TestResult) => r.type);
  Object.entries(byType).forEach(([type, typeResults]) => {
    console.log(`\n=== ${type.toUpperCase()} Index Analysis ===\n`);

    const byDimension = groupBy(typeResults, (r: TestResult) => r.dimension.toString());
    Object.entries(byDimension).forEach(([dim, dimResults]) => {
      console.log(`\n--- Analysis for ${dim} dimensions ---\n`);

      // Combined Performance Analysis
      const columns = ['Distribution', 'Dataset Size', 'K'];
      if (type === 'hnsw') {
        columns.push('M', 'EF Construction', 'EF', 'EF Type');
      } else if (type === 'ivfflat') {
        columns.push('Lists', 'Vectors/List');
      }
      columns.push('Min Recall', 'Avg Recall', 'Max Recall', 'P50 (ms)', 'P95 (ms)');

      const performanceData = Object.values(
        groupBy(
          dimResults,
          (r: any) => `${r.size}-${r.k}-${type === 'ivfflat' ? r.metrics.latency.lists : r.metrics.latency.m}`,
          (results: any[]) => {
            const sortedResults = [...results].sort(
              (a, b) =>
                ['random', 'clustered', 'skewed', 'mixed'].indexOf(a.distribution) -
                ['random', 'clustered', 'skewed', 'mixed'].indexOf(b.distribution),
            );
            return sortedResults.map(result => ({
              Distribution: result.distribution,
              'Dataset Size': result.size,
              K: result.k,
              ...(type === 'ivfflat'
                ? {
                    Lists: result.metrics.latency.lists,
                    'Vectors/List': result.metrics.latency.vectorsPerList,
                  }
                : {}),
              ...(type === 'hnsw'
                ? {
                    M: result.metrics.latency.m,
                    'EF Construction': result.metrics.latency.efConstruction,
                    EF: result.metrics.latency.ef,
                    'EF Type': result.metrics.latency.efType,
                  }
                : {}),
              'Min Recall': result.metrics.minRecall.toFixed(3),
              'Avg Recall': result.metrics.recall.toFixed(3),
              'Max Recall': result.metrics.maxRecall.toFixed(3),
              'P50 (ms)': result.metrics.latency.p50.toFixed(2),
              'P95 (ms)': result.metrics.latency.p95.toFixed(2),
            }));
          },
        ),
      ).flat();

      console.log(formatTable(performanceData, columns));
    });
  });
}

function splitIntoRandomBatches(total: number, dimension: number): number[] {
  const batches: number[] = [];
  let remaining = total;

  const batchRange = dimension === 1024 ? 5000 : 15000;

  while (remaining > 0) {
    const batchSize = Math.min(remaining, batchRange + Math.floor(Math.random() * batchRange));
    batches.push(batchSize);
    remaining -= batchSize;
  }

  return batches;
}

async function batchedBulkUpsert(
  vectorDB: PGPerformanceVector,
  testIndexName: string,
  vectors: number[][],
  batchSizes: number[],
) {
  let offset = 0;
  const vectorIds = vectors.map((_, idx) => `vec_${idx}`);
  const metadata = vectors.map((_, idx) => ({ index: idx }));

  for (const size of batchSizes) {
    const batch = vectors.slice(offset, offset + size);
    const batchIds = vectorIds.slice(offset, offset + size);
    const batchMetadata = metadata.slice(offset, offset + size);
    await vectorDB.bulkUpsert(testIndexName, batch, batchMetadata, batchIds);
    offset += size;
    console.log(`${offset} of ${vectors.length} vectors upserted`);
  }
}

const distributions = {
  random: generateRandomVectors,
  clustered: generateClusteredVectors,
  skewed: generateSkewedVectors,
  mixed: (size: number, dimension: number) => {
    const generators = [generateRandomVectors, generateClusteredVectors, generateSkewedVectors];
    const batchSizes = splitIntoRandomBatches(size, dimension);

    let vectors: number[][] = [];
    for (const batchSize of batchSizes) {
      const generator = generators[Math.floor(Math.random() * generators.length)];
      vectors = vectors.concat(generator(batchSize, dimension));
    }

    return vectors;
  },
};
