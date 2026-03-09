import {
  S3VectorsClient,
  CreateIndexCommand,
  DeleteIndexCommand,
  ListIndexesCommand,
  GetIndexCommand,
  PutVectorsCommand,
  QueryVectorsCommand,
  GetVectorsCommand,
  DeleteVectorsCommand,
  ListVectorsCommand,
} from '@aws-sdk/client-s3vectors';
import type { S3VectorsClientConfig } from '@aws-sdk/client-s3vectors';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { MastraVector } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  DeleteVectorsParams,
  QueryVectorParams,
  DescribeIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  UpdateVectorParams,
} from '@mastra/core/vector';
import { v4 as uuidv4 } from 'uuid';
import { S3VectorsFilterTranslator } from './filter';
import type { S3VectorsFilter } from './filter';

/**
 * Options for the S3Vectors store.
 * @property vectorBucketName - Target S3 Vectors bucket name.
 * @property clientConfig - AWS SDK client options (e.g., region/credentials).
 * @property nonFilterableMetadataKeys - Metadata keys that must not be filterable (forwarded to S3 Vectors).
 */
export interface S3VectorsOptions {
  vectorBucketName: string;
  clientConfig?: S3VectorsClientConfig;
  nonFilterableMetadataKeys?: string[];
}

type S3DistanceMetric = 'cosine' | 'euclidean';
type MastraMetric = NonNullable<CreateIndexParams['metric']>;
type SupportedMastraMetric = Exclude<MastraMetric, 'dotproduct'>;

/**
 * Vector store backed by Amazon S3 Vectors.
 *
 * @remarks
 * - Supports `cosine` and `euclidean` distance metrics.
 * - Filters must use explicit logical operators (`$and` / `$or`). The attached translator
 *   canonicalizes implicit AND (e.g., `{a:1,b:2}` → `{ $and: [{a:1},{b:2}] }`) where permitted by spec.
 * - Methods wrap AWS errors in `MastraError` with domain/category metadata.
 */
export class S3Vectors extends MastraVector<S3VectorsFilter> {
  private readonly client: S3VectorsClient;
  private readonly vectorBucketName: string;
  private readonly nonFilterableMetadataKeys?: string[];
  private readonly filterTranslator = new S3VectorsFilterTranslator();

  private static readonly METRIC_MAP: Record<SupportedMastraMetric, S3DistanceMetric> = {
    cosine: 'cosine',
    euclidean: 'euclidean',
  } as const;

  constructor(opts: S3VectorsOptions & { id: string }) {
    super({ id: opts.id });
    if (!opts?.vectorBucketName) {
      throw new MastraError(
        {
          id: createVectorErrorId('S3VECTORS', 'INITIALIZATION', 'MISSING_BUCKET_NAME'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        new Error('vectorBucketName is required'),
      );
    }
    this.vectorBucketName = opts.vectorBucketName;
    this.nonFilterableMetadataKeys = opts.nonFilterableMetadataKeys;
    this.client = new S3VectorsClient({ ...(opts.clientConfig ?? {}) });
  }

  /**
   * No-op to satisfy the base interface.
   *
   * @remarks The AWS SDK manages HTTP per request; no persistent connection is needed.
   */
  async connect(): Promise<void> {}

  /**
   * Closes the underlying AWS SDK HTTP handler to free sockets.
   */
  async disconnect(): Promise<void> {
    try {
      this.client.destroy();
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('S3VECTORS', 'DISCONNECT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Creates an index or validates an existing one.
   *
   * @param params.indexName - Logical index name; normalized internally.
   * @param params.dimension - Vector dimension (must be a positive integer).
   * @param params.metric - Distance metric (`cosine` | `euclidean`). Defaults to `cosine`.
   * @throws {MastraError} If arguments are invalid or AWS returns an error.
   * @remarks
   * On `ConflictException`, we verify the existing index schema via the parent implementation
   * and return if it matches.
   */
  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    indexName = normalizeIndexName(indexName);

    let s3Metric: S3DistanceMetric;
    try {
      assertPositiveInteger(dimension, 'dimension');
      s3Metric = S3Vectors.toS3Metric(metric);
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('S3VECTORS', 'CREATE_INDEX', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, dimension, metric },
        },
        error,
      );
    }

    try {
      const input: any = {
        ...this.bucketParams(),
        indexName,
        dataType: 'float32',
        dimension,
        distanceMetric: s3Metric,
      };
      if (this.nonFilterableMetadataKeys?.length) {
        input.metadataConfiguration = { nonFilterableMetadataKeys: this.nonFilterableMetadataKeys };
      }

      await this.client.send(new CreateIndexCommand(input));
    } catch (error: any) {
      if (error?.name === 'ConflictException') {
        await this.validateExistingIndex(indexName, dimension, metric);
        return;
      }
      throw new MastraError(
        {
          id: createVectorErrorId('S3VECTORS', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, dimension, metric },
        },
        error,
      );
    }
  }

  /**
   * Upserts vectors in bulk.
   *
   * @param params.indexName - Index to write to.
   * @param params.vectors - Array of vectors; each must match the index dimension.
   * @param params.metadata - Optional metadata per vector; `Date` values are normalized to epoch ms.
   * @param params.ids - Optional explicit IDs; if omitted, UUIDs are generated.
   * @returns Array of IDs used for the upsert (explicit or generated).
   * @throws {MastraError} If validation fails or AWS returns an error.
   */
  async upsert({ indexName, vectors, metadata, ids }: UpsertVectorParams): Promise<string[]> {
    indexName = normalizeIndexName(indexName);
    try {
      const { dimension } = await this.getIndexInfo(indexName);
      validateVectorDimensions(vectors, dimension);

      const generatedIds = ids ?? vectors.map(() => uuidv4());

      const putInput = {
        ...this.bucketParams(),
        indexName,
        vectors: vectors.map((vec, i) => ({
          key: generatedIds[i],
          data: { float32: vec },
          metadata: normalizeMetadata(metadata?.[i]),
        })),
      };

      await this.client.send(new PutVectorsCommand(putInput));
      return generatedIds;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('S3VECTORS', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Queries nearest neighbors.
   *
   * @param params.indexName - Target index.
   * @param params.queryVector - Query vector (non-empty float32 array).
   * @param params.topK - Number of neighbors to return (positive integer). Defaults to 10.
   * @param params.filter - Metadata filter using explicit `$and`/`$or` (translator canonicalizes implicit AND).
   * @param params.includeVector - If `true`, fetches missing vector data in a second call.
   * @returns Results sorted by `score` descending.
   * @throws {MastraError} If validation fails or AWS returns an error.
   * @remarks
   * `score = 1/(1+distance)` (monotonic transform), so ranking matches the underlying distance.
   */
  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
  }: QueryVectorParams<S3VectorsFilter>): Promise<QueryResult[]> {
    indexName = normalizeIndexName(indexName);

    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('S3VECTORS', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for S3 Vectors queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      if (!Array.isArray(queryVector) || queryVector.length === 0) {
        throw new Error('queryVector must be a non-empty float32 array');
      }
      assertPositiveInteger(topK, 'topK');

      const translated = this.transformFilter(filter);

      const out = await this.client.send(
        new QueryVectorsCommand({
          ...this.bucketParams(),
          indexName,
          topK,
          queryVector: { float32: queryVector },
          filter: translated && Object.keys(translated).length > 0 ? (translated as any) : undefined,
          returnMetadata: true,
          returnDistance: true,
        }),
      );

      const vectors = (out.vectors ?? []).filter(v => !!v?.key);

      // If includeVector is requested and some results lack data, fetch only the missing ones.
      let dataMap: Record<string, number[] | undefined> | undefined;
      if (includeVector) {
        const missingKeys = vectors.filter(v => !v.data?.float32 && v.key).map(v => v.key!) as string[];

        if (missingKeys.length > 0) {
          const got = await this.client.send(
            new GetVectorsCommand({
              ...this.bucketParams(),
              indexName,
              keys: missingKeys,
              returnData: true,
              returnMetadata: false,
            }),
          );
          dataMap = {};
          for (const g of got.vectors ?? []) {
            if (g.key) dataMap[g.key] = g.data?.float32 as number[] | undefined;
          }
        }
      }

      return vectors.map(v => {
        const id = v.key!;
        const score = S3Vectors.distanceToScore(v.distance ?? 0);

        const result: QueryResult = { id, score };

        const md = v.metadata as Record<string, unknown> | undefined;
        if (md !== undefined) result.metadata = md;

        if (includeVector) {
          const vec = (v.data?.float32 as number[] | undefined) ?? dataMap?.[id];
          if (vec !== undefined) result.vector = vec;
        }

        return result;
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('S3VECTORS', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Lists indexes within the configured bucket.
   *
   * @returns Array of index names.
   * @throws {MastraError} On AWS errors.
   */
  async listIndexes(): Promise<string[]> {
    try {
      const names: string[] = [];
      let nextToken: string | undefined;

      do {
        const out = await this.client.send(
          new ListIndexesCommand({
            ...this.bucketParams(),
            nextToken,
          } as any),
        );
        for (const idx of out.indexes ?? []) {
          if (idx.indexName) names.push(idx.indexName);
        }
        nextToken = out.nextToken;
      } while (nextToken);

      return names;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('S3VECTORS', 'LIST_INDEXES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Returns index attributes.
   *
   * @param params.indexName - Index name.
   * @returns Object containing `dimension`, `metric`, and `count`.
   * @throws {MastraError} On AWS errors.
   * @remarks
   * `count` is computed via `ListVectors` pagination and may be costly (O(n)).
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    indexName = normalizeIndexName(indexName);
    try {
      const { dimension, metric } = await this.getIndexInfo(indexName);
      const count = await this.countVectors(indexName);
      return { dimension, metric, count };
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('S3VECTORS', 'DESCRIBE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Deletes an index.
   *
   * @param params.indexName - Index name.
   * @throws {MastraError} On AWS errors.
   */
  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    indexName = normalizeIndexName(indexName);
    try {
      await this.client.send(new DeleteIndexCommand({ ...this.bucketParams(), indexName } as any));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('S3VECTORS', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /**
   * Updates (replaces) a vector and/or its metadata by ID.
   *
   * @param params.indexName - Target index.
   * @param params.id - Vector ID.
   * @param params.update.vector - New vector; if omitted, the existing vector is reused.
   * @param params.update.metadata - New metadata, merged with current metadata.
   * @throws {MastraError} If the vector does not exist and `update.vector` is omitted, or on AWS error.
   * @remarks
   * S3 Vectors `PutVectors` is replace-all; we `Get` the current item, merge, then `Put`.
   */
  async updateVector({ indexName, id, update }: UpdateVectorParams): Promise<void> {
    if (!id) {
      throw new MastraError({
        id: createVectorErrorId('S3VECTORS', 'UPDATE_VECTOR', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'id is required for S3Vectors updateVector',
        details: { indexName },
      });
    }

    indexName = normalizeIndexName(indexName);
    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No updates provided');
      }

      const got = await this.client.send(
        new GetVectorsCommand({
          ...this.bucketParams(),
          indexName,
          keys: [id],
          returnData: true,
          returnMetadata: true,
        }),
      );
      const current = (got.vectors ?? [])[0];

      const newVector: number[] | undefined = update.vector ?? (current?.data?.float32 as number[] | undefined);
      if (!newVector) {
        throw new Error(`Vector "${id}" not found. Provide update.vector to create it.`);
      }

      const newMetadata =
        update.metadata !== undefined
          ? normalizeMetadata(update.metadata)
          : ((current?.metadata as Record<string, any>) ?? {});

      await this.client.send(
        new PutVectorsCommand({
          ...this.bucketParams(),
          indexName,
          vectors: [{ key: id, data: { float32: newVector }, metadata: newMetadata }],
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('S3VECTORS', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(id && { id }),
          },
        },
        error,
      );
    }
  }

  /**
   * Deletes a vector by ID.
   *
   * @param params.indexName - Target index.
   * @param params.id - Vector ID to delete.
   * @throws {MastraError} On AWS errors.
   */
  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    indexName = normalizeIndexName(indexName);
    try {
      await this.client.send(
        new DeleteVectorsCommand({
          ...this.bucketParams(),
          indexName,
          keys: [id],
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('S3VECTORS', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(id && { id }),
          },
        },
        error,
      );
    }
  }

  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams): Promise<void> {
    throw new MastraError({
      id: createVectorErrorId('S3VECTORS', 'DELETE_VECTORS', 'NOT_SUPPORTED'),
      text: 'deleteVectors is not yet implemented for S3Vectors vector store',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.SYSTEM,
      details: {
        indexName,
        ...(filter && { filter: JSON.stringify(filter) }),
        ...(ids && { idsCount: ids.length }),
      },
    });
  }

  // -------- internal helpers --------

  /**
   * Returns shared bucket parameters for AWS SDK calls.
   * @internal
   */
  private bucketParams(): { vectorBucketName: string } {
    return { vectorBucketName: this.vectorBucketName };
  }

  /**
   * Retrieves index dimension/metric via `GetIndex`.
   * @internal
   * @throws {Error} If the index does not exist.
   * @returns `{ dimension, metric }`, where `metric` includes `'dotproduct'` to satisfy Mastra types (S3 never returns it).
   */
  private async getIndexInfo(
    indexName: string,
  ): Promise<{ dimension: number; metric: 'cosine' | 'euclidean' | 'dotproduct' }> {
    const out = await this.client.send(new GetIndexCommand({ ...this.bucketParams(), indexName } as any));
    const idx = out.index;
    if (!idx) throw new Error(`Index "${indexName}" not found`);
    const metric = (idx.distanceMetric as S3DistanceMetric) ?? 'cosine';
    return {
      dimension: idx.dimension ?? 0,
      metric,
    };
  }

  /**
   * Pages through `ListVectors` and counts total items.
   * @internal
   * @remarks O(n). Avoid calling on hot paths.
   */
  private async countVectors(indexName: string): Promise<number> {
    let total = 0;
    let nextToken: string | undefined;

    do {
      const out = await this.client.send(
        new ListVectorsCommand({
          ...this.bucketParams(),
          indexName,
          maxResults: 1000,
          nextToken,
          returnData: false,
          returnMetadata: false,
        }),
      );
      total += (out.vectors ?? []).length;
      nextToken = out.nextToken;
    } while (nextToken);

    return total;
  }

  /**
   * Translates a high-level filter to the S3 Vectors filter shape.
   * @internal
   * @remarks Implicit AND is canonicalized by the translator where permitted by spec.
   */
  private transformFilter(filter?: S3VectorsFilter): any {
    if (!filter) return undefined;
    return this.filterTranslator.translate(filter);
  }

  /**
   * Converts a Mastra metric to an S3 metric.
   * @internal
   * @throws {Error} If the metric is not supported by S3 Vectors.
   */
  private static toS3Metric(metric: MastraMetric): S3DistanceMetric {
    const m = S3Vectors.METRIC_MAP[metric as SupportedMastraMetric];
    if (!m) {
      throw new Error(`Invalid metric: "${metric}". S3 Vectors supports only: cosine, euclidean`);
    }
    return m;
  }

  /**
   * Monotonic transform from distance (smaller is better) to score (larger is better).
   * @returns Number in (0, 1], preserving ranking.
   */
  private static distanceToScore(distance: number): number {
    return 1 / (1 + distance);
  }
}

// --- module-private utilities (not exported) ---

/**
 * Ensures a value is a positive integer.
 * @throws {Error} If the value is not a positive integer.
 * @internal
 */
function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

/**
 * Validates that all vectors match the required dimension.
 * @throws {Error} If any vector length differs from `dimension`.
 * @internal
 */
function validateVectorDimensions(vectors: number[][], dimension: number): void {
  if (!Array.isArray(vectors) || vectors.length === 0) {
    throw new Error('No vectors provided for validation');
  }
  for (let i = 0; i < vectors.length; i++) {
    const len = vectors[i]?.length;
    if (len !== dimension) {
      throw new Error(`Vector at index ${i} has invalid dimension ${len}. Expected ${dimension} dimensions.`);
    }
  }
}

/**
 * Normalizes metadata values for S3 Vectors: `Date` → epoch ms.
 * @internal
 */
function normalizeMetadata(meta: Record<string, any> | undefined): Record<string, any> {
  if (!meta) return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = v instanceof Date ? v.getTime() : v;
  }
  return out;
}

/**
 * Normalizes an index name to this store's canonical form (underscore → hyphen, lowercase).
 * @internal
 * @throws {TypeError} If the provided name is not a string.
 */
function normalizeIndexName(str: string) {
  if (typeof str !== 'string') {
    throw new TypeError('Index name must be a string');
  }
  return str.replace(/_/g, '-').toLowerCase();
}
