import type { IndexConfig, IndexType } from './types';

import type { PgVector } from '.';

export interface TestResult {
  distribution: string;
  dimension: number;
  type: IndexType;
  size: number;
  k?: number;
  metrics: {
    recall?: number;
    minRecall?: number;
    maxRecall?: number;
    latency?: {
      p50: number;
      p95: number;
      lists?: number;
      vectorsPerList?: number;
      m?: number;
      ef?: number;
    };
    clustering?: {
      numLists?: number;
      avgVectorsPerList?: number;
      recommendedLists?: number;
      distribution?: string;
    };
  };
}

export const generateRandomVectors = (count: number, dim: number) => {
  return Array.from({ length: count }, () => {
    return Array.from({ length: dim }, () => Math.random() * 2 - 1);
  });
};

export const generateClusteredVectors = (count: number, dim: number, numClusters: number = 10) => {
  // Generate cluster centers
  const centers = Array.from({ length: numClusters }, () => Array.from({ length: dim }, () => Math.random() * 2 - 1));

  // Generate vectors around centers with varying spread
  return Array.from({ length: count }, () => {
    // Pick a random cluster, with some clusters being more popular
    const centerIdx = Math.floor(Math.pow(Math.random(), 2) * numClusters);
    const center = centers[centerIdx] as number[];

    // Add noise, with some vectors being further from centers
    const spread = Math.random() < 0.8 ? 0.1 : 0.5; // 80% close, 20% far
    return center.map(c => c + (Math.random() * spread - spread / 2));
  });
};

// Or even more extreme:
export const generateSkewedVectors = (count: number, dim: number) => {
  // Create dense clusters with sparse regions
  const vectors: number[][] = [];

  const denseCount = Math.floor(count * 0.6);
  const sparseCount = count - denseCount;

  // Dense cluster (60% of vectors)
  const denseCenter = Array.from({ length: dim }, () => Math.random() * 0.2);
  for (let i = 0; i < denseCount; i++) {
    vectors.push(denseCenter.map(c => c + (Math.random() * 0.1 - 0.05)));
  }

  // Scattered vectors (40%)
  for (let i = 0; i < sparseCount; i++) {
    vectors.push(Array.from({ length: dim }, () => Math.random() * 2 - 1));
  }

  return vectors.sort(() => Math.random() - 0.5); // Shuffle
};

export const findNearestBruteForce = (query: number[], vectors: number[][], k: number) => {
  const similarities = vectors.map((vector, idx) => {
    const similarity = cosineSimilarity(query, vector);
    return { idx, dist: similarity };
  });

  const sorted = similarities.sort((a, b) => b.dist - a.dist);
  return sorted.slice(0, k).map(x => x.idx);
};

export const calculateRecall = (actual: number[], expected: number[], k: number): number => {
  let score = 0;
  for (let i = 0; i < k; i++) {
    if (actual[i] === expected[i]) {
      score += 1;
    } else if (expected.includes(actual[i] ?? 0)) {
      score += 0.5;
    }
  }
  return score / k;
};

export function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + (val ?? 0) * (b[i] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (normA * normB);
}

export const formatTable = (data: any[], columns: string[]) => {
  const colWidths = columns.map(col =>
    Math.max(
      col.length,
      ...data.map(row => {
        const value = row[col];
        return value === undefined || value === null ? '-'.length : value.toString().length;
      }),
    ),
  );

  const topBorder = '┌' + colWidths.map(w => '─'.repeat(w)).join('┬') + '┐';
  const headerSeparator = '├' + colWidths.map(w => '─'.repeat(w)).join('┼') + '┤';
  const bottomBorder = '└' + colWidths.map(w => '─'.repeat(w)).join('┴') + '┘';

  const header = '│' + columns.map((col, i) => col.padEnd(colWidths[i] ?? 0)).join('│') + '│';
  const rows = data.map(
    row =>
      '│' +
      columns
        .map((col, i) => {
          const value = row[col];
          const displayValue = value === undefined || value === null ? '-' : value.toString();
          return displayValue.padEnd(colWidths[i]);
        })
        .join('│') +
      '│',
  );

  return [topBorder, header, headerSeparator, ...rows, bottomBorder].join('\n');
};

export const groupBy = <T, K extends keyof T>(
  array: T[],
  key: K | ((item: T) => string),
  reducer?: (group: T[]) => any,
): Record<string, any> => {
  const grouped = array.reduce(
    (acc, item) => {
      const value = typeof key === 'function' ? key(item) : item[key];
      if (!acc[value as any]) acc[value as any] = [];
      acc[value as any]?.push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );

  if (reducer) {
    return Object.fromEntries(Object.entries(grouped).map(([key, group]) => [key, reducer(group)]));
  }

  return grouped;
};

export const calculateTimeout = (dimension: number, size: number, k: number) => {
  let timeout = 600000;
  if (dimension >= 1024) timeout *= 3;
  else if (dimension >= 384) timeout *= 1.5;
  if (size >= 10000) timeout *= 2;
  if (k >= 75) timeout *= 1.5;
  return timeout * 5;
};

export const baseTestConfigs = {
  smokeTests: [{ dimension: 384, size: 1_000, k: 10, queryCount: 10 }],
  '64': [
    { dimension: 64, size: 100, k: 10, queryCount: 30 },
    { dimension: 64, size: 100, k: 25, queryCount: 30 },
    { dimension: 64, size: 100, k: 50, queryCount: 30 },
    { dimension: 64, size: 100, k: 100, queryCount: 30 },
    { dimension: 64, size: 1_000, k: 10, queryCount: 30 },
    { dimension: 64, size: 1_000, k: 25, queryCount: 30 },
    { dimension: 64, size: 1_000, k: 50, queryCount: 30 },
    { dimension: 64, size: 1_000, k: 100, queryCount: 30 },
    { dimension: 64, size: 10_000, k: 10, queryCount: 30 },
    { dimension: 64, size: 100_000, k: 10, queryCount: 30 },
    { dimension: 64, size: 100_000, k: 25, queryCount: 30 },
    { dimension: 64, size: 100_000, k: 50, queryCount: 30 },
    { dimension: 64, size: 100_000, k: 100, queryCount: 30 },
    { dimension: 64, size: 500_000, k: 10, queryCount: 30 },
    { dimension: 64, size: 1_000_000, k: 10, queryCount: 30 },
  ],
  '384': [
    { dimension: 384, size: 100, k: 10, queryCount: 30 },
    { dimension: 384, size: 100, k: 25, queryCount: 30 },
    { dimension: 384, size: 100, k: 50, queryCount: 30 },
    { dimension: 384, size: 100, k: 100, queryCount: 30 },
    { dimension: 384, size: 1_000, k: 10, queryCount: 30 },
    { dimension: 384, size: 1_000, k: 25, queryCount: 30 },
    { dimension: 384, size: 1_000, k: 50, queryCount: 30 },
    { dimension: 384, size: 1_000, k: 100, queryCount: 30 },
    { dimension: 384, size: 10_000, k: 10, queryCount: 30 },
    { dimension: 384, size: 100_000, k: 10, queryCount: 30 },
    { dimension: 384, size: 100_000, k: 25, queryCount: 30 },
    { dimension: 384, size: 100_000, k: 50, queryCount: 30 },
    { dimension: 384, size: 100_000, k: 100, queryCount: 30 },
    { dimension: 384, size: 500_000, k: 10, queryCount: 30 },
  ],
  '1024': [
    { dimension: 1024, size: 100, k: 10, queryCount: 30 },
    { dimension: 1024, size: 100, k: 25, queryCount: 30 },
    { dimension: 1024, size: 100, k: 50, queryCount: 30 },
    { dimension: 1024, size: 100, k: 100, queryCount: 30 },
    { dimension: 1024, size: 1_000, k: 10, queryCount: 30 },
    { dimension: 1024, size: 1_000, k: 25, queryCount: 30 },
    { dimension: 1024, size: 1_000, k: 50, queryCount: 30 },
    { dimension: 1024, size: 1_000, k: 100, queryCount: 30 },
    { dimension: 1024, size: 10_000, k: 10, queryCount: 30 },
    { dimension: 1024, size: 10_000, k: 25, queryCount: 30 },
    { dimension: 1024, size: 10_000, k: 50, queryCount: 30 },
    { dimension: 1024, size: 10_000, k: 100, queryCount: 30 },
    { dimension: 1024, size: 50_000, k: 10, queryCount: 30 },
    { dimension: 1024, size: 50_000, k: 25, queryCount: 30 },
  ],
  stressTests: [
    // Maximum load
    { dimension: 512, size: 1_000_000, k: 50, queryCount: 5 },

    // Dense search
    { dimension: 256, size: 1_000_000, k: 100, queryCount: 5 },

    { dimension: 1024, size: 500_000, k: 50, queryCount: 5 },
  ],
};

export interface TestConfig {
  dimension: number;
  size: number;
  k: number;
  queryCount: number;
}

export async function warmupQuery(vectorDB: PgVector, indexName: string, dimension: number, k: number) {
  const warmupVector = generateRandomVectors(1, dimension)[0] as number[];
  await vectorDB.query(indexName, warmupVector, k);
}

export async function measureLatency<T>(fn: () => Promise<T>): Promise<[number, T]> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return [end - start, result];
}

export const getListCount = (indexConfig: IndexConfig, size: number): number | undefined => {
  if (indexConfig.type !== 'ivfflat') return undefined;
  if (indexConfig.ivf?.lists) return indexConfig.ivf.lists;
  return Math.max(100, Math.min(4000, Math.floor(Math.sqrt(size) * 2)));
};

export const getHNSWConfig = (indexConfig: IndexConfig): { m: number; efConstruction: number } => {
  return {
    m: indexConfig.hnsw?.m ?? 8,
    efConstruction: indexConfig.hnsw?.efConstruction ?? 32,
  };
};

export function getSearchEf(k: number, m: number) {
  return {
    default: Math.max(k, m * k), // Default calculation
    lower: Math.max(k, (m * k) / 2), // Lower quality, faster
    higher: Math.max(k, m * k * 2), // Higher quality, slower
  };
}

export function getIndexDescription({
  type,
  hnsw,
}: {
  type: IndexType;
  hnsw: { m: number; efConstruction: number };
}): string {
  if (type === 'hnsw') {
    return `HNSW(m=${hnsw.m},ef=${hnsw.efConstruction})`;
  }

  if (type === 'ivfflat') {
    return `IVF`;
  }

  return 'Flat';
}
