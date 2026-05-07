import crypto from 'node:crypto';

import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
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

import type { ConvexAdminClientConfig } from '../storage/client';
import { ConvexAdminClient } from '../storage/client';
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
        indexName,
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
    // Delete in batches since each mutation can only delete a small number of docs
    // to stay within Convex's 1-second mutation timeout.
    await this.callStorageUntilComplete({
      op: 'clearTable',
      tableName: this.vectorTable(indexName),
    });
  }

  async truncateIndex({ indexName }: DeleteIndexParams): Promise<void> {
    // Delete in batches since each mutation can only delete a small number of docs
    // to stay within Convex's 1-second mutation timeout.
    await this.callStorageUntilComplete({
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
      id: vectorIds[i]!,
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
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('CONVEX', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Convex queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    const vectors = await this.callStorage<VectorRecord[]>({
      op: 'queryTable',
      tableName: this.vectorTable(indexName),
    });

    const filtered =
      filter && !this.isEmptyFilter(filter)
        ? vectors.filter(record => this.matchesFilter(record.metadata, filter))
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
    const hasId = 'id' in params && params.id;
    const hasFilter = 'filter' in params && params.filter !== undefined;

    // Check for mutually exclusive parameters
    if (hasId && hasFilter) {
      throw new Error('ConvexVector.updateVector: id and filter are mutually exclusive');
    }

    // Check for filter-based update
    if (hasFilter) {
      const filter = params.filter as VectorFilter;
      // Check for empty filter
      if (this.isEmptyFilter(filter)) {
        throw new Error('ConvexVector.updateVector: cannot update with empty filter');
      }

      // Update by filter - find all matching records and update them
      const vectors = await this.callStorage<VectorRecord[]>({
        op: 'queryTable',
        tableName: this.vectorTable(params.indexName),
      });

      const matching = vectors.filter(record => this.matchesFilter(record.metadata, filter));

      for (const existing of matching) {
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
      return;
    }

    // Update by id
    if (!hasId) {
      throw new Error('ConvexVector.updateVector: Either id or filter must be provided');
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

  async deleteVectors(params: DeleteVectorsParams<VectorFilter>): Promise<void> {
    const { indexName } = params;
    const hasIds = 'ids' in params && params.ids !== undefined;
    const hasFilter = 'filter' in params && params.filter !== undefined;

    // Check for mutually exclusive parameters
    if (hasIds && hasFilter) {
      throw new Error('ConvexVector.deleteVectors: ids and filter are mutually exclusive');
    }

    // Check that at least one is provided
    if (!hasIds && !hasFilter) {
      throw new Error('ConvexVector.deleteVectors: Either filter or ids must be provided');
    }

    // Handle ID-based deletion
    if (hasIds) {
      const ids = params.ids as string[];
      if (ids.length === 0) {
        throw new Error('ConvexVector.deleteVectors: cannot delete with empty ids array');
      }
      await this.callStorage({
        op: 'deleteMany',
        tableName: this.vectorTable(indexName),
        ids,
      });
      return;
    }

    // Handle filter-based deletion
    const filter = params.filter as VectorFilter;
    if (this.isEmptyFilter(filter)) {
      throw new Error('ConvexVector.deleteVectors: cannot delete with empty filter');
    }

    // Find all matching vectors and delete them
    const vectors = await this.callStorage<VectorRecord[]>({
      op: 'queryTable',
      tableName: this.vectorTable(indexName),
    });

    const matchingIds = vectors.filter(record => this.matchesFilter(record.metadata, filter)).map(record => record.id);

    if (matchingIds.length > 0) {
      await this.callStorage({
        op: 'deleteMany',
        tableName: this.vectorTable(indexName),
        ids: matchingIds,
      });
    }
  }

  private vectorTable(indexName: string) {
    return `mastra_vector_${indexName}`;
  }

  private isEmptyFilter(filter: VectorFilter | Record<string, any>): boolean {
    if (!filter) return true;
    return Object.keys(filter).length === 0;
  }

  private matchesFilter(
    recordMetadata: Record<string, any> | undefined,
    filter: VectorFilter | Record<string, any>,
  ): boolean {
    if (!recordMetadata) return false;
    if (!filter || Object.keys(filter).length === 0) return true;

    // Handle VectorFilter with metadata property
    if ('metadata' in filter && filter.metadata) {
      return this.matchesFilterConditions(recordMetadata, filter.metadata);
    }

    // Handle direct filter conditions
    return this.matchesFilterConditions(recordMetadata, filter);
  }

  private matchesFilterConditions(recordMetadata: Record<string, any>, conditions: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      // Handle $and operator
      if (key === '$and' && Array.isArray(value)) {
        const allMatch = value.every((cond: Record<string, any>) => this.matchesFilterConditions(recordMetadata, cond));
        if (!allMatch) return false;
        continue;
      }

      // Handle $or operator
      if (key === '$or' && Array.isArray(value)) {
        const anyMatch = value.some((cond: Record<string, any>) => this.matchesFilterConditions(recordMetadata, cond));
        if (!anyMatch) return false;
        continue;
      }

      // Handle $in operator
      if (typeof value === 'object' && value !== null && '$in' in value) {
        if (!Array.isArray(value.$in) || !value.$in.includes(recordMetadata[key])) {
          return false;
        }
        continue;
      }

      // Handle $nin operator
      if (typeof value === 'object' && value !== null && '$nin' in value) {
        if (Array.isArray(value.$nin) && value.$nin.includes(recordMetadata[key])) {
          return false;
        }
        continue;
      }

      // Handle $gt operator
      if (typeof value === 'object' && value !== null && '$gt' in value) {
        if (!(recordMetadata[key] > value.$gt)) {
          return false;
        }
        continue;
      }

      // Handle $gte operator
      if (typeof value === 'object' && value !== null && '$gte' in value) {
        if (!(recordMetadata[key] >= value.$gte)) {
          return false;
        }
        continue;
      }

      // Handle $lt operator
      if (typeof value === 'object' && value !== null && '$lt' in value) {
        if (!(recordMetadata[key] < value.$lt)) {
          return false;
        }
        continue;
      }

      // Handle $lte operator
      if (typeof value === 'object' && value !== null && '$lte' in value) {
        if (!(recordMetadata[key] <= value.$lte)) {
          return false;
        }
        continue;
      }

      // Handle $ne operator
      if (typeof value === 'object' && value !== null && '$ne' in value) {
        if (recordMetadata[key] === value.$ne) {
          return false;
        }
        continue;
      }

      // Handle simple equality
      if (recordMetadata[key] !== value) {
        return false;
      }
    }

    return true;
  }

  private async callStorage<T = any>(request: StorageRequest): Promise<T> {
    return this.client.callStorage<T>(request);
  }

  /**
   * Call storage repeatedly until hasMore is false.
   * Use for bulk operations like clearTable that may need multiple batches.
   */
  private async callStorageUntilComplete(request: StorageRequest): Promise<void> {
    let hasMore = true;
    while (hasMore) {
      const response = await this.client.callStorageRaw(request);
      hasMore = response.hasMore ?? false;
    }
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
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dot += aVal * bVal;
    magA += aVal * aVal;
    magB += bVal * bVal;
  }

  if (magA === 0 || magB === 0) {
    return -1;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
