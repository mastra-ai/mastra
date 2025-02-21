import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import {
  baseTestConfigs,
  TestConfig,
  TestResult,
  calculateTimeout,
  generateRandomVectors,
  findNearestBruteForce,
  calculateRecall,
  formatTable,
  groupBy,
  mean,
  min,
  max,
  measureLatency,
  getListCount,
  getSearchEf,
  generateClusteredVectors,
  generateSkewedVectors,
} from './performance.helpers';
import { IndexConfig } from './types';

import { PgVector } from '.';

interface IndexTestConfig extends IndexConfig {
  rebuild?: boolean;
}

export function getIndexDescription(indexConfig: IndexTestConfig): string {
  if (indexConfig.type === 'hnsw') {
    return `HNSW(m=${indexConfig.hnsw?.m},ef=${indexConfig.hnsw?.efConstruction})`;
  }

  if (indexConfig.type === 'ivfflat') {
    if (indexConfig.ivf?.lists) {
      return `IVF(lists=${indexConfig.ivf.lists}), rebuild=${indexConfig.rebuild ?? false}`;
    }
    return `IVF(dynamic), rebuild=${indexConfig.rebuild ?? false}`;
  }

  return 'Flat';
}

const warmupCache = new Map<string, boolean>();
async function smartWarmup(vectorDB: PgVector, testIndexName: string, indexType: string, dimension: number, k: number) {
  const cacheKey = `${dimension}-${k}-${indexType}`;
  if (!warmupCache.has(cacheKey)) {
    console.log(`Warming up ${indexType} index for ${dimension}d vectors, k=${k}`);
    const warmupVector = generateRandomVectors(1, dimension)[0] as number[];
    await vectorDB.query(testIndexName, warmupVector, k);
    warmupCache.set(cacheKey, true);
  }
}

const pgOptions = ['maintenance_work_mem=512MB', 'work_mem=256MB', 'temp_buffers=256MB'].join(' -c ');

const connectionString =
  process.env.DB_URL ||
  `postgresql://postgres:postgres@localhost:5434/mastra?options=-c%20${encodeURIComponent(pgOptions)}`;
describe('PostgreSQL Index Performance', () => {
  let vectorDB: PgVector;
  const testIndexName = 'test_index_performance';
  const results: TestResult[] = [];

  const indexConfigs: IndexTestConfig[] = [
    { type: 'flat' }, // Test flat/linear search as baseline
    // { type: 'ivfflat', ivf: { lists: 100 } }, // Test IVF with fixed lists
    // { type: 'ivfflat', ivf: { dynamic: true } }, // Test IVF with dynamic lists
    // { type: 'ivfflat', ivf: { lists: 100 }, rebuild: true }, // Test IVF with fixed lists and rebuild
    // { type: 'ivfflat', ivf: { dynamic: true }, rebuild: true }, // Test IVF with dynamic lists and rebuild
    // { type: 'hnsw', hnsw: { m: 16, efConstruction: 64 } }, // Default settings
    // { type: 'hnsw', hnsw: { m: 64, efConstruction: 256 } }, // Maximum quality
  ];
  beforeAll(async () => {
    // Initialize PgVector
    vectorDB = new PgVector(connectionString);
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
    ...baseTestConfigs.dimension,
    ...baseTestConfigs.k,
    // ...baseTestConfigs.size,
    // ...baseTestConfigs.smokeTests,
    // ...baseTestConfigs.stressTests,
  ];

  // For each index config
  for (const indexConfig of indexConfigs) {
    describe(`Index: ${getIndexDescription(indexConfig)}`, () => {
      for (const testConfig of allConfigs) {
        const timeout = calculateTimeout(testConfig.dimension, testConfig.size, testConfig.k);
        const testDesc = `dim=${testConfig.dimension} size=${testConfig.size} k=${testConfig.k}`;

        it(
          testDesc,
          async () => {
            // Test each distribution type
            const distributions = {
              random: generateRandomVectors,
              clustered: generateClusteredVectors,
              skewed: generateSkewedVectors,
            };

            for (const [distType, generator] of Object.entries(distributions)) {
              const testVectors = generator(testConfig.size, testConfig.dimension);
              const queryVectors = generator(testConfig.queryCount, testConfig.dimension);
              const vectorIds = testVectors.map((_, idx) => `vec_${idx}`);
              const metadata = testVectors.map((_, idx) => ({ index: idx }));

              // Create index and insert vectors
              const lists =
                indexConfig.type === 'ivfflat'
                  ? getListCount({ size: testConfig.size, indexConfig, metrics: {} } as TestResult)
                  : undefined;

              await vectorDB.createIndex(testIndexName, testConfig.dimension, 'cosine', indexConfig);
              await vectorDB.upsert(testIndexName, testVectors, metadata, vectorIds);
              if (indexConfig.rebuild) {
                await vectorDB.rebuildIndex(testIndexName, {
                  m: indexConfig.hnsw?.m,
                  efConstruction: indexConfig.hnsw?.efConstruction,
                  lists: indexConfig.ivf?.lists,
                });
              }
              await smartWarmup(vectorDB, testIndexName, indexConfig.type, testConfig.dimension, testConfig.k);

              // For HNSW, test different EF values
              const efValues =
                indexConfig.type === 'hnsw'
                  ? getSearchEf(testConfig.k, indexConfig.hnsw?.m || 16)
                  : { default: undefined };

              for (const [efType, ef] of Object.entries(efValues)) {
                const recalls: number[] = [];
                const latencies: number[] = [];

                for (const queryVector of queryVectors) {
                  const expectedNeighbors = findNearestBruteForce(queryVector, testVectors, testConfig.k);

                  // Measure latency AND get results in one go
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
                  indexConfig,
                  metrics: {
                    recall: mean(recalls),
                    minRecall: min(recalls),
                    maxRecall: max(recalls),
                    latency: {
                      p50: sorted[Math.floor(sorted.length * 0.5)],
                      p95: sorted[Math.floor(sorted.length * 0.95)],
                      ...(indexConfig.type === 'ivfflat' && {
                        lists,
                        vectorsPerList: Math.round(testConfig.size / (lists || 1)),
                      }),
                      ...(indexConfig.type === 'hnsw' && {
                        m: indexConfig.hnsw?.m,
                        ef,
                        efType,
                      }),
                    },
                    ...(indexConfig.type === 'ivfflat' && {
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
            }
          },
          timeout,
        );
      }
    });
  }
});

function analyzeResults(results: TestResult[]) {
  const byType = groupBy(results, (r: TestResult) => r.indexConfig.type);
  Object.entries(byType).forEach(([type, typeResults]) => {
    console.log(`\n=== ${type.toUpperCase()} Index Analysis ===\n`);

    const byDimension = groupBy(typeResults, (r: TestResult) => r.dimension.toString());
    Object.entries(byDimension).forEach(([dim, dimResults]) => {
      console.log(`\n--- Analysis for ${dim} dimensions ---\n`);

      // Recall Analysis
      console.log('Recall Analysis:');
      const recallColumns = ['Distribution', 'Dataset Size', 'K'];
      if (type === 'hnsw') {
        recallColumns.push('M', 'EF', 'EF Type');
      } else if (type === 'ivfflat') {
        recallColumns.push('Lists', 'Vectors/List');
      }
      recallColumns.push('Min Recall', 'Avg Recall', 'Max Recall');

      // Group by size and config first, then show distributions together
      const recallData = Object.values(
        groupBy(
          dimResults,
          (r: any) => `${r.size}-${r.k}-${type === 'ivfflat' ? r.metrics.latency.lists : r.indexConfig.hnsw?.m}`,
          (results: any[]) => {
            // Sort by distribution type for consistent ordering
            const sortedResults = [...results].sort(
              (a, b) =>
                ['random', 'clustered', 'skewed'].indexOf(a.distribution) -
                ['random', 'clustered', 'skewed'].indexOf(b.distribution),
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
                    M: result.indexConfig.hnsw?.m,
                    EF: result.metrics.latency.ef,
                    'EF Type': result.metrics.latency.efType,
                  }
                : {}),
              'Min Recall': result.metrics.minRecall.toFixed(3),
              'Avg Recall': result.metrics.recall.toFixed(3),
              'Max Recall': result.metrics.maxRecall.toFixed(3),
            }));
          },
        ),
      ).flat(); // Flatten to show all distributions
      console.log(formatTable(recallData, recallColumns));

      // Latency Analysis
      console.log('\nLatency Analysis:');
      const latencyColumns = ['Distribution', 'Dataset Size', 'K'];
      if (type === 'hnsw') {
        latencyColumns.push('M', 'EF', 'EF Type');
      } else if (type === 'ivfflat') {
        latencyColumns.push('Lists', 'Vectors/List');
      }
      latencyColumns.push('P50 (ms)', 'P95 (ms)');

      const latencyData = Object.values(
        groupBy(
          dimResults,
          (r: any) => `${r.size}-${r.k}-${type === 'ivfflat' ? r.metrics.latency.lists : r.indexConfig.hnsw?.m}`,
          (results: any[]) => {
            const sortedResults = [...results].sort(
              (a, b) =>
                ['random', 'clustered', 'skewed'].indexOf(a.distribution) -
                ['random', 'clustered', 'skewed'].indexOf(b.distribution),
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
                    M: result.indexConfig.hnsw?.m,
                    EF: result.metrics.latency.ef,
                    'EF Type': result.metrics.latency.efType,
                  }
                : {}),
              'P50 (ms)': result.metrics.latency.p50.toFixed(2),
              'P95 (ms)': result.metrics.latency.p95.toFixed(2),
            }));
          },
        ),
      ).flat();
      console.log(formatTable(latencyData, latencyColumns));

      // IVF-specific Clustering Analysis
      if (type === 'ivfflat') {
        console.log('\nClustering Analysis:');
        const clusteringColumns = [
          'Distribution',
          'Dataset Size',
          'Lists',
          'Vectors/List',
          'Recommended Lists',
          'Efficiency',
        ];
        const clusteringData = Object.values(
          groupBy(
            dimResults,
            (r: any) => r.size.toString(),
            (results: any[]) => {
              const sortedResults = [...results].sort(
                (a, b) =>
                  ['random', 'clustered', 'skewed'].indexOf(a.distribution) -
                  ['random', 'clustered', 'skewed'].indexOf(b.distribution),
              );
              return sortedResults.map(result => ({
                Distribution: result.distribution,
                'Dataset Size': result.size,
                Lists: result.metrics.clustering.numLists,
                'Vectors/List': Math.round(result.metrics.clustering.avgVectorsPerList),
                'Recommended Lists': result.metrics.clustering.recommendedLists,
                Efficiency: (result.metrics.clustering.recommendedLists / result.metrics.clustering.numLists).toFixed(
                  2,
                ),
              }));
            },
          ),
        ).flat();
        console.log(formatTable(clusteringData, clusteringColumns));
      }
    });
  });
}
