import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
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

import { ConvexAdminClient } from '../storage/client';
import type { ConvexAdminClientConfig } from '../storage/client';

type NativeFilterValue = string | number | boolean | null;

type NativeFilterClause = {
  field: string;
  value: NativeFilterValue;
};

type NativeActionFilter = NativeFilterClause | { $or: NativeFilterClause[] };

type NativeFieldFilter = Record<string, NativeFilterValue | { $eq: NativeFilterValue }>;

export type ConvexNativeVectorFilter =
  | NativeFieldFilter
  | { metadata: NativeFieldFilter }
  | {
      $or: NativeFieldFilter[];
    };

export type ConvexNativeVectorIndexConfig = {
  /**
   * Convex table that stores this Mastra vector index.
   */
  tableName: string;
  /**
   * Convex vector index name on `tableName`.
   */
  vectorIndexName?: string;
  /**
   * Number of dimensions configured in the Convex vector index.
   */
  dimension: number;
  /**
   * Mastra vector ID field in the Convex table.
   *
   * @default 'id'
   */
  idField?: string;
  /**
   * Convex database index used for lookup by `idField`.
   *
   * @default 'by_record_id'
   */
  idIndexName?: string;
  /**
   * Vector field in the Convex table.
   *
   * @default 'embedding'
   */
  vectorField?: string;
  /**
   * Metadata field in the Convex table.
   *
   * @default 'metadata'
   */
  metadataField?: string;
  /**
   * Top-level fields copied from metadata on writes and available to Convex
   * native vector filters.
   */
  filterFields?: string[];
};

export type ConvexNativeVectorConfig = ConvexAdminClientConfig & {
  id: string;
  /**
   * Maps Mastra `indexName` values to deployed Convex table/index definitions.
   */
  indexes: Record<string, ConvexNativeVectorIndexConfig>;
  /**
   * Path to the deployed native vector action.
   *
   * @default 'mastra/nativeVector:query'
   */
  nativeVectorAction?: string;
  /**
   * Path to the deployed native vector query.
   *
   * @default 'mastra/nativeVector:read'
   */
  nativeVectorQuery?: string;
  /**
   * Path to the deployed native vector mutation.
   *
   * @default 'mastra/nativeVector:write'
   */
  nativeVectorMutation?: string;
  /**
   * Maximum number of documents read when estimating `describeIndex().count`.
   *
   * @default 10000
   */
  describeCountLimit?: number;
};

type NativeSearchResult = {
  id: string;
  score: number;
};

type NativeVectorDocument = Record<string, any>;

const DEFAULT_VECTOR_INDEX = 'by_embedding';
const DEFAULT_ID_FIELD = 'id';
const DEFAULT_ID_INDEX = 'by_record_id';
const DEFAULT_VECTOR_FIELD = 'embedding';
const DEFAULT_METADATA_FIELD = 'metadata';
const DEFAULT_NATIVE_ACTION = 'mastra/nativeVector:query';
const DEFAULT_NATIVE_QUERY = 'mastra/nativeVector:read';
const DEFAULT_NATIVE_MUTATION = 'mastra/nativeVector:write';
const MAX_CONVEX_VECTOR_RESULTS = 256;
const NATIVE_VECTOR_UPSERT_BATCH_SIZE = 100;

function isMetadataRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class ConvexNativeVector extends MastraVector<ConvexNativeVectorFilter> {
  private readonly client: ConvexAdminClient;
  private readonly indexes: Record<string, Required<ConvexNativeVectorIndexConfig> & { filterFields: string[] }>;
  private readonly nativeVectorAction: string;
  private readonly nativeVectorQuery: string;
  private readonly nativeVectorMutation: string;
  private readonly describeCountLimit: number;

  constructor(config: ConvexNativeVectorConfig) {
    super({ id: config.id });
    this.client = new ConvexAdminClient(config);
    this.indexes = Object.fromEntries(
      Object.entries(config.indexes).map(([indexName, index]) => [
        indexName,
        {
          tableName: index.tableName,
          vectorIndexName: index.vectorIndexName ?? DEFAULT_VECTOR_INDEX,
          dimension: index.dimension,
          idField: index.idField ?? DEFAULT_ID_FIELD,
          idIndexName: index.idIndexName ?? DEFAULT_ID_INDEX,
          vectorField: index.vectorField ?? DEFAULT_VECTOR_FIELD,
          metadataField: index.metadataField ?? DEFAULT_METADATA_FIELD,
          filterFields: index.filterFields ?? [],
        },
      ]),
    );
    this.nativeVectorAction = config.nativeVectorAction ?? DEFAULT_NATIVE_ACTION;
    this.nativeVectorQuery = config.nativeVectorQuery ?? DEFAULT_NATIVE_QUERY;
    this.nativeVectorMutation = config.nativeVectorMutation ?? DEFAULT_NATIVE_MUTATION;
    this.describeCountLimit = config.describeCountLimit ?? 10000;
  }

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    const index = this.getIndex(indexName);
    if (index.dimension !== dimension) {
      throw new Error(
        `ConvexNativeVector.createIndex: deployed Convex index "${indexName}" has ${index.dimension} dimensions, but ${dimension} were requested`,
      );
    }
    if (metric !== 'cosine') {
      throw new Error('ConvexNativeVector.createIndex: Convex native vector search currently supports cosine only');
    }
  }

  async listIndexes(): Promise<string[]> {
    return Object.keys(this.indexes);
  }

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    const index = this.getIndex(indexName);
    const result = await this.client.callQuery<{ count: number; countIsLimited: boolean }>(this.nativeVectorQuery, {
      op: 'describe',
      config: index,
      countLimit: this.describeCountLimit,
    });

    if (result.countIsLimited) {
      this.logger.warn(
        `ConvexNativeVector.describeIndex: count for "${indexName}" reached ${this.describeCountLimit}; reported count is capped.`,
      );
    }

    return {
      dimension: index.dimension,
      count: result.count,
      metric: 'cosine',
    };
  }

  async upsert({ indexName, vectors, ids, metadata, deleteFilter }: UpsertVectorParams<ConvexNativeVectorFilter>) {
    if (deleteFilter) {
      throw new Error('ConvexNativeVector.upsert: deleteFilter is not supported. Delete by IDs before upserting.');
    }
    const index = this.getIndex(indexName);
    if (ids && ids.length !== vectors.length) {
      throw new Error(
        `ConvexNativeVector.upsert: ids length (${ids.length}) must match vectors length (${vectors.length})`,
      );
    }
    if (metadata && metadata.length !== vectors.length) {
      throw new Error(
        `ConvexNativeVector.upsert: metadata length (${metadata.length}) must match vectors length (${vectors.length})`,
      );
    }
    if (metadata && !metadata.every(isMetadataRecord)) {
      throw new Error('ConvexNativeVector.upsert: metadata entries must be objects when provided');
    }
    const vectorIds = ids ?? vectors.map(() => crypto.randomUUID());
    if (new Set(vectorIds).size !== vectorIds.length) {
      throw new Error('ConvexNativeVector.upsert: ids must be unique');
    }

    for (let start = 0; start < vectors.length; start += NATIVE_VECTOR_UPSERT_BATCH_SIZE) {
      const end = start + NATIVE_VECTOR_UPSERT_BATCH_SIZE;
      await this.client.callMutation(this.nativeVectorMutation, {
        op: 'upsert',
        config: index,
        ids: vectorIds.slice(start, end),
        vectors: vectors.slice(start, end),
        ...(metadata ? { metadata: metadata.slice(start, end) } : {}),
      });
    }

    return vectorIds;
  }

  async query({
    indexName,
    queryVector,
    topK = 10,
    includeVector = false,
    filter,
  }: QueryVectorParams<ConvexNativeVectorFilter>): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('CONVEX_NATIVE', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Convex native vector queries.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }
    if (!Number.isFinite(topK) || !Number.isInteger(topK) || topK < 1 || topK > MAX_CONVEX_VECTOR_RESULTS) {
      throw new Error(`ConvexNativeVector.query: topK must be an integer between 1 and ${MAX_CONVEX_VECTOR_RESULTS}`);
    }

    const index = this.getIndex(indexName);
    const nativeFilter = this.toNativeFilter(filter, index);
    const searchResults = await this.client.callAction<NativeSearchResult[]>(this.nativeVectorAction, {
      config: index,
      vector: queryVector,
      limit: topK,
      ...(nativeFilter ? { filter: nativeFilter } : {}),
    });

    if (searchResults.length === 0) return [];

    const docs = await this.client.callQuery<Array<NativeVectorDocument | null>>(this.nativeVectorQuery, {
      op: 'getByConvexIds',
      config: index,
      ids: searchResults.map(result => result.id),
      includeVector,
    });
    const scoresByConvexId = new Map(searchResults.map(result => [result.id, result.score]));

    return docs.flatMap(doc => {
      if (!doc?._id) return [];
      return [
        {
          id: String(doc[index.idField]),
          score: scoresByConvexId.get(String(doc._id)) ?? 0,
          metadata: doc[index.metadataField],
          ...(includeVector ? { vector: doc[index.vectorField] } : {}),
        },
      ];
    });
  }

  async updateVector(params: UpdateVectorParams<ConvexNativeVectorFilter>): Promise<void> {
    if ('filter' in params && params.filter !== undefined) {
      throw new Error('ConvexNativeVector.updateVector: filter-based updates are not supported. Update by ID instead.');
    }
    if (params.update.metadata !== undefined && !isMetadataRecord(params.update.metadata)) {
      throw new Error('ConvexNativeVector.updateVector: metadata must be an object when provided');
    }
    const index = this.getIndex(params.indexName);
    await this.client.callMutation(this.nativeVectorMutation, {
      op: 'updateById',
      config: index,
      id: params.id,
      vector: params.update.vector,
      metadata: params.update.metadata,
    });
  }

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    const index = this.getIndex(indexName);
    await this.client.callMutation(this.nativeVectorMutation, {
      op: 'deleteByIds',
      config: index,
      ids: [id],
    });
  }

  async deleteVectors(params: DeleteVectorsParams<ConvexNativeVectorFilter>): Promise<void> {
    if (params.filter !== undefined) {
      throw new Error(
        'ConvexNativeVector.deleteVectors: filter-based deletes are not supported. Delete by IDs instead.',
      );
    }
    if (!params.ids || params.ids.length === 0) {
      throw new Error('ConvexNativeVector.deleteVectors: ids are required');
    }
    const index = this.getIndex(params.indexName);
    await this.client.callMutation(this.nativeVectorMutation, {
      op: 'deleteByIds',
      config: index,
      ids: params.ids,
    });
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    this.getIndex(indexName);
    throw new Error('ConvexNativeVector.deleteIndex: Convex native vector indexes are managed in convex/schema.ts.');
  }

  private getIndex(indexName: string) {
    const index = this.indexes[indexName];
    if (!index) {
      throw new Error(`ConvexNativeVector: index "${indexName}" is not configured`);
    }
    return index;
  }

  private toNativeFilter(
    filter: ConvexNativeVectorFilter | undefined,
    index: Required<ConvexNativeVectorIndexConfig> & { filterFields: string[] },
  ): NativeActionFilter | undefined {
    if (!filter || Object.keys(filter).length === 0) return undefined;

    if (this.isOrFilter(filter)) {
      const clauses = filter.$or.map(branch => this.toSingleClause(branch, index));
      return { $or: clauses };
    }

    const fieldFilter = this.isMetadataFilter(filter) ? filter.metadata : filter;
    return this.toSingleClause(fieldFilter, index);
  }

  private toSingleClause(
    filter: NativeFieldFilter,
    index: Required<ConvexNativeVectorIndexConfig> & { filterFields: string[] },
  ): NativeFilterClause {
    const entries = Object.entries(filter).filter(([, value]) => value !== undefined);
    if (entries.length !== 1) {
      throw new Error(
        'ConvexNativeVector.query: native Convex filters support one equality field or $or of equality fields',
      );
    }

    const [field, rawValue] = entries[0]!;
    if (!index.filterFields.includes(field)) {
      throw new Error(`ConvexNativeVector.query: field "${field}" is not configured as a Convex vector filter field`);
    }

    const value =
      typeof rawValue === 'object' && rawValue !== null && '$eq' in rawValue
        ? rawValue.$eq
        : (rawValue as NativeFilterValue);

    if (!['string', 'number', 'boolean'].includes(typeof value) && value !== null) {
      throw new Error(
        'ConvexNativeVector.query: native Convex filters support string, number, boolean, and null values',
      );
    }

    return { field, value };
  }

  private isOrFilter(filter: ConvexNativeVectorFilter): filter is { $or: NativeFieldFilter[] } {
    return Array.isArray((filter as { $or?: unknown }).$or);
  }

  private isMetadataFilter(filter: ConvexNativeVectorFilter): filter is { metadata: NativeFieldFilter } {
    const metadata = (filter as { metadata?: unknown }).metadata;
    return typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata);
  }
}
