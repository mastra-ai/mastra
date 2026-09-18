import { LibSQLVector } from '@mastra/libsql';

import type { StorageConfig } from '../../db/config.js';
import { readStorageConfig } from '../../db/config.js';

export type VectorMatch = Readonly<{
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}>;

export interface RunbookVectorStore {
  ensureIndex(indexName: string, dimension: number): Promise<void>;
  upsert(
    indexName: string,
    ids: readonly string[],
    vectors: readonly (readonly number[])[],
    metadata: readonly Record<string, unknown>[],
  ): Promise<void>;
  query(indexName: string, vector: readonly number[], topK: number): Promise<readonly VectorMatch[]>;
  describe(indexName: string): Promise<Readonly<{ dimension: number; count: number }>>;
  deleteIndex(indexName: string): Promise<void>;
  close(): Promise<void>;
}

export class LibSqlRunbookVectorStore implements RunbookVectorStore {
  private readonly vector: LibSQLVector;

  constructor(config: StorageConfig = readStorageConfig()) {
    this.vector = new LibSQLVector({
      id: 'security-runbook-vectors',
      ...config,
    });
  }

  async ensureIndex(indexName: string, dimension: number): Promise<void> {
    const indexes = await this.vector.listIndexes();
    if (indexes.includes(indexName)) {
      const stats = await this.vector.describeIndex({ indexName });
      if (stats.dimension !== dimension) throw new Error('Vector index dimension mismatch');
      return;
    }
    await this.vector.createIndex({ indexName, dimension, metric: 'cosine' });
  }

  async upsert(
    indexName: string,
    ids: readonly string[],
    vectors: readonly (readonly number[])[],
    metadata: readonly Record<string, unknown>[],
  ): Promise<void> {
    await this.vector.upsert({
      indexName,
      ids: [...ids],
      vectors: vectors.map(item => [...item]),
      metadata: metadata.map(item => ({ ...item })),
    });
  }

  async query(indexName: string, vector: readonly number[], topK: number): Promise<readonly VectorMatch[]> {
    const results = await this.vector.query({
      indexName,
      queryVector: [...vector],
      topK,
      includeVector: false,
    });
    return results.map(result => ({
      id: result.id,
      score: result.score,
      ...(result.metadata ? { metadata: result.metadata as Record<string, unknown> } : {}),
    }));
  }

  async describe(indexName: string): Promise<Readonly<{ dimension: number; count: number }>> {
    const stats = await this.vector.describeIndex({ indexName });
    return { dimension: stats.dimension, count: stats.count };
  }

  async deleteIndex(indexName: string): Promise<void> {
    const indexes = await this.vector.listIndexes();
    if (indexes.includes(indexName)) await this.vector.deleteIndex({ indexName });
  }

  async close(): Promise<void> {
    await this.vector.close();
  }
}
