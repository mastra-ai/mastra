import crypto from 'node:crypto';

import { MastraVector } from '@mastra/core/vector';
import type {
  CreateIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  DeleteVectorsParams,
  DescribeIndexParams,
  IndexStats,
  QueryResult,
  QueryVectorParams,
  UpdateVectorParams,
  UpsertVectorParams,
} from '@mastra/core/vector';

import { ConvexAdminClient, type ConvexAdminClientConfig } from '../storage/client';
import type { StorageRequest } from '../storage/types';

type VectorRecord = {
  id: string;
  embedding: number[];
  metadata?: Record<string, any>;
};

type VectorFilter = {
  metadata?: Record<string, any>;
};

const INDEX_METADATA_TABLE = 'mastra_vector_indexes';

export type ConvexVectorConfig = ConvexAdminClientConfig & {
  id: string;
};

export class ConvexVector extends MastraVector<VectorFilter> {
  private readonly client: ConvexAdminClient;

  constructor(config: ConvexVectorConfig) {
    super({ id: config.id });
    this.client = new ConvexAdminClient(config);
  }

  async createIndex({ indexName, dimension }: CreateIndexParams): Promise<void> {
    await this.callStorage({
      op: 'insert',
      tableName: INDEX_METADATA_TABLE,
      record: {
        id: indexName,
        dimension,
        metric: 'cosine',
        createdAt: new Date().toISOString(),
      },
    });
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    await this.callStorage({
      op: 'deleteMany',
      tableName: INDEX_METADATA_TABLE,
      ids: [indexName],
    });
    await this.callStorage({
      op: 'clearTable',
      tableName: this.vectorTable(indexName),
    });
  }

  async truncateIndex({ indexName }: DeleteIndexParams): Promise<void> {
    await this.callStorage({
      op: 'clearTable',
      tableName: this.vectorTable(indexName),
    });
  }

  async listIndexes(): Promise<string[]> {
    const indexes = await this.callStorage<{ id: string }[]>({
      op: 'queryTable',
      tableName: INDEX_METADATA_TABLE,
    });
    return indexes.map(index => index.id);
  }

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    const index = await this.callStorage<{ dimension: number } | null>({
      op: 'load',
      tableName: INDEX_METADATA_TABLE,
      keys: { id: indexName },
    });
    if (!index) {
      throw new Error(`Index ${indexName} not found`);
    }

    const vectors = await this.callStorage<VectorRecord[]>({
      op: 'queryTable',
      tableName: this.vectorTable(indexName),
    });

    return {
      dimension: index.dimension,
      count: vectors.length,
      metric: 'cosine',
    };
  }

  async upsert({ indexName, vectors, ids, metadata }: UpsertVectorParams<VectorFilter>): Promise<string[]> {
    const vectorIds = ids ?? vectors.map(() => crypto.randomUUID());

    const records: VectorRecord[] = vectors.map((vector, i) => ({
      id: vectorIds[i],
      embedding: vector,
      metadata: metadata?.[i],
    }));

    await this.callStorage({
      op: 'batchInsert',
      tableName: this.vectorTable(indexName),
      records,
    });

    return vectorIds;
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    includeVector = false,
    filter,
  }: QueryVectorParams<VectorFilter>): Promise<QueryResult[]> {
    const vectors = await this.callStorage<VectorRecord[]>({
      op: 'queryTable',
      tableName: this.vectorTable(indexName),
    });

    const filtered = filter?.metadata
      ? vectors.filter(record => this.matchesMetadata(record.metadata, filter.metadata))
      : vectors;

    const scored = filtered
      .map(record => ({
        id: record.id,
        score: cosineSimilarity(queryVector, record.embedding),
        metadata: record.metadata,
        ...(includeVector ? { vector: record.embedding } : {}),
      }))
      .filter(result => Number.isFinite(result.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }

  async updateVector(params: UpdateVectorParams<VectorFilter>): Promise<void> {
    if (!('id' in params) || !params.id) {
      throw new Error('ConvexVector.updateVector: id is required');
    }

    const existing = await this.callStorage<VectorRecord | null>({
      op: 'load',
      tableName: this.vectorTable(params.indexName),
      keys: { id: params.id },
    });
    if (!existing) return;

    const updated: VectorRecord = {
      ...existing,
      ...(params.update.vector ? { embedding: params.update.vector } : {}),
      ...(params.update.metadata ? { metadata: { ...existing.metadata, ...params.update.metadata } } : {}),
    };

    await this.callStorage({
      op: 'insert',
      tableName: this.vectorTable(params.indexName),
      record: updated,
    });
  }

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    await this.callStorage({
      op: 'deleteMany',
      tableName: this.vectorTable(indexName),
      ids: [id],
    });
  }

  async deleteVectors({ indexName, ids }: DeleteVectorsParams<VectorFilter>): Promise<void> {
    if (!ids || ids.length === 0) return;
    await this.callStorage({
      op: 'deleteMany',
      tableName: this.vectorTable(indexName),
      ids,
    });
  }

  private vectorTable(indexName: string) {
    return `mastra_vector_${indexName}`;
  }

  private matchesMetadata(
    recordMetadata: Record<string, any> | undefined,
    target: Record<string, any>,
  ): boolean {
    if (!recordMetadata) return false;
    return Object.entries(target).every(([key, value]) => recordMetadata[key] === value);
  }

  private async callStorage<T = any>(request: StorageRequest): Promise<T> {
    return this.client.callStorage<T>(request);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return -1;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) {
    return -1;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
