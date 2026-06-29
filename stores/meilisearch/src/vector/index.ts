import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import type {
  CreateIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  DescribeIndexParams,
  IndexStats,
  QueryResult,
  QueryVectorParams,
  UpdateVectorParams,
  UpsertVectorParams,
  DeleteVectorsParams,
} from '@mastra/core/vector';
import { MastraVector, validateUpsert, validateTopK } from '@mastra/core/vector';
import { Meilisearch } from 'meilisearch';
import type { Config, EnqueuedTaskPromise, Task } from 'meilisearch';
import { MeilisearchFilterTranslator, MEILISEARCH_MATCH_NONE } from './filter';
import type { MeilisearchVectorFilter } from './filter';

/**
 * Configuration for {@link MeilisearchVector}.
 *
 * Extends the Meilisearch client {@link Config} with a required `id`.
 *
 * @example
 * ```typescript
 * const vector = new MeilisearchVector({
 *   id: 'my-vector',
 *   host: 'http://localhost:7700',
 *   apiKey: 'masterKey',
 * });
 * ```
 */
export type MeilisearchVectorConfig = Config & { id: string };

// Embedder name used for the single user-provided embedder per index. Mastra
// always hands us pre-computed vectors, so we never let Meilisearch embed.
const EMBEDDER = 'default';

// Document field that holds the (encoded) Meilisearch primary key. Meilisearch
// primary keys must match /^[A-Za-z0-9_-]+$/, so we store a base64url-encoded
// key here and keep the caller's original id in the `id` field.
const PK = 'pk';

// Recall keys the Memory system filters on. Declared filterable at createIndex.
const RECALL_KEYS = ['metadata.thread_id', 'metadata.resource_id', 'metadata.message_id'];

type MeilisearchQueryVectorParams = QueryVectorParams<MeilisearchVectorFilter>;

export class MeilisearchVector extends MastraVector<MeilisearchVectorFilter> {
  private client: Meilisearch;
  // Per-index caches to avoid redundant settings round-trips.
  private dimensionCache = new Map<string, number>();
  private filterableCache = new Map<string, Set<string>>();

  /**
   * Creates a new MeilisearchVector client.
   *
   * @param config - Meilisearch client configuration plus a required id.
   */
  constructor({ id, ...config }: MeilisearchVectorConfig) {
    super({ id });
    // Generous default task timeout: large batches (1000+ vectors) can take a
    // while to index and embed.
    this.client = new Meilisearch({ defaultWaitOptions: { timeout: 120_000 }, ...config });
  }

  /** Encodes an arbitrary caller id into a Meilisearch-safe primary key. */
  private encodeId(id: string): string {
    return Buffer.from(String(id), 'utf-8').toString('base64url');
  }

  /** Awaits an enqueued task and throws a MastraError if it failed. */
  private async awaitTask(enqueued: EnqueuedTaskPromise, op: string, indexName: string): Promise<Task> {
    const task = await enqueued.waitTask();
    if (task.status === 'failed') {
      throw new MastraError({
        id: createVectorErrorId('MEILISEARCH', op, 'TASK_FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        text: task.error?.message || `Meilisearch task failed during ${op}`,
        details: { indexName, code: task.error?.code || '', op },
      });
    }
    return task;
  }

  async createIndex({ indexName, dimension, metric = 'cosine' }: CreateIndexParams): Promise<void> {
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new MastraError({
        id: createVectorErrorId('MEILISEARCH', 'CREATE_INDEX', 'INVALID_ARGS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Dimension must be a positive integer',
        details: { indexName, dimension },
      });
    }

    if (metric !== 'cosine') {
      this.logger?.warn(
        `Meilisearch only supports cosine similarity. Requested metric "${metric}" will be treated as "cosine".`,
      );
    }

    try {
      const task = await this.client.createIndex(indexName, { primaryKey: PK }).waitTask();
      if (task.status === 'failed') {
        if (task.error?.code === 'index_already_exists') {
          await this.validateExistingIndex(indexName, dimension, metric);
          return;
        }
        throw new MastraError({
          id: createVectorErrorId('MEILISEARCH', 'CREATE_INDEX', 'TASK_FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: task.error?.message || 'Meilisearch index creation failed',
          details: { indexName, code: task.error?.code || '' },
        });
      }

      const index = this.client.index(indexName);
      // userProvided embedder: Mastra supplies vectors; Meilisearch never embeds.
      await this.awaitTask(
        index.updateEmbedders({ [EMBEDDER]: { source: 'userProvided', dimensions: dimension } }),
        'CREATE_INDEX',
        indexName,
      );
      // Pre-declare recall keys so Memory semantic recall can filter immediately.
      await this.awaitTask(index.updateFilterableAttributes([...RECALL_KEYS]), 'CREATE_INDEX', indexName);

      this.dimensionCache.set(indexName, dimension);
      this.filterableCache.set(indexName, new Set(RECALL_KEYS));
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MEILISEARCH', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, dimension, metric },
        },
        error,
      );
    }
  }

  async listIndexes(): Promise<string[]> {
    try {
      const { results } = await this.client.getIndexes({ limit: 1000 });
      return results.map(index => index.uid);
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MEILISEARCH', 'LIST_INDEXES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    try {
      const index = this.client.index(indexName);
      const [embedders, stats] = await Promise.all([index.getEmbedders(), index.getStats()]);
      const embedder = embedders?.[EMBEDDER];
      const dimension = embedder && 'dimensions' in embedder ? Number(embedder.dimensions) : 0;
      if (dimension) this.dimensionCache.set(indexName, dimension);

      return {
        dimension,
        count: stats.numberOfDocuments,
        metric: 'cosine',
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MEILISEARCH', 'DESCRIBE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    try {
      await this.awaitTask(this.client.deleteIndex(indexName), 'DELETE_INDEX', indexName);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createVectorErrorId('MEILISEARCH', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
      this.logger?.error(mastraError.toString());
      this.logger?.trackException(mastraError);
    } finally {
      this.dimensionCache.delete(indexName);
      this.filterableCache.delete(indexName);
    }
  }

  /** Returns the index's configured embedder dimension; throws if it doesn't exist. */
  private async getDimension(indexName: string, op: string): Promise<number> {
    const cached = this.dimensionCache.get(indexName);
    if (cached) return cached;
    try {
      const embedders = await this.client.index(indexName).getEmbedders();
      const embedder = embedders?.[EMBEDDER];
      const dimension = embedder && 'dimensions' in embedder ? Number(embedder.dimensions) : 0;
      if (!dimension) {
        throw new Error(`Index "${indexName}" has no userProvided embedder configured`);
      }
      this.dimensionCache.set(indexName, dimension);
      return dimension;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MEILISEARCH', op, 'INDEX_NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Index "${indexName}" not found or not initialized`,
          details: { indexName },
        },
        error,
      );
    }
  }

  private validateVectorDimensions(vectors: number[][], dimension: number) {
    for (const vector of vectors) {
      if (vector.length !== dimension) {
        throw new MastraError({
          id: createVectorErrorId('MEILISEARCH', 'UPSERT', 'DIMENSION_MISMATCH'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Vector dimension ${vector.length} does not match index dimension ${dimension}`,
          details: { expected: dimension, actual: vector.length },
        });
      }
    }
  }

  /** Declares any not-yet-filterable metadata keys on the index. */
  private async ensureFilterable(indexName: string, metadataKeys: string[]): Promise<void> {
    const needed = metadataKeys.map(key => (key.startsWith('metadata.') ? key : `metadata.${key}`));
    if (needed.length === 0) return;

    let known = this.filterableCache.get(indexName);
    if (!known) {
      const current = await this.client.index(indexName).getFilterableAttributes();
      known = new Set([
        ...RECALL_KEYS,
        ...((current ?? []).filter((attr): attr is string => typeof attr === 'string') as string[]),
      ]);
      this.filterableCache.set(indexName, known);
    }

    const missing = needed.filter(key => !known!.has(key));
    if (missing.length === 0) return;

    const union = new Set([...known, ...needed]);
    await this.awaitTask(
      this.client.index(indexName).updateFilterableAttributes([...union]),
      'UPDATE_FILTERABLE',
      indexName,
    );
    this.filterableCache.set(indexName, union);
  }

  /** Collects top-level metadata field names referenced by a filter. */
  private collectFilterFields(filter: any, out: Set<string> = new Set()): Set<string> {
    if (!filter || typeof filter !== 'object') return out;
    if (Array.isArray(filter)) {
      filter.forEach(item => this.collectFilterFields(item, out));
      return out;
    }
    for (const [key, value] of Object.entries(filter)) {
      if (key === '$and' || key === '$or' || key === '$nor' || key === '$not') {
        this.collectFilterFields(value, out);
      } else if (!key.startsWith('$')) {
        out.add(key);
      }
    }
    return out;
  }

  async upsert({ indexName, vectors, metadata = [], ids }: UpsertVectorParams): Promise<string[]> {
    validateUpsert('MEILISEARCH', vectors, metadata, ids, true);

    try {
      const dimension = await this.getDimension(indexName, 'UPSERT');
      this.validateVectorDimensions(vectors, dimension);

      const vectorIds = ids || vectors.map(() => crypto.randomUUID());

      const metadataKeys = new Set<string>();
      for (const meta of metadata) {
        if (meta) Object.keys(meta).forEach(key => metadataKeys.add(key));
      }
      await this.ensureFilterable(indexName, [...metadataKeys]);

      const documents = vectors.map((vector, i) => ({
        [PK]: this.encodeId(vectorIds[i]!),
        id: vectorIds[i],
        metadata: metadata[i] ?? {},
        _vectors: { [EMBEDDER]: { embeddings: vector, regenerate: false } },
      }));

      await this.awaitTask(
        this.client.index(indexName).addDocuments(documents, { primaryKey: PK }),
        'UPSERT',
        indexName,
      );

      return vectorIds;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MEILISEARCH', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, vectorCount: vectors?.length || 0 },
        },
        error,
      );
    }
  }

  async query({
    indexName,
    queryVector,
    filter,
    topK = 10,
    includeVector = false,
  }: MeilisearchQueryVectorParams): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('MEILISEARCH', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for Meilisearch queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    validateTopK('MEILISEARCH', topK);

    try {
      const dimension = await this.getDimension(indexName, 'QUERY');
      if (queryVector.length !== dimension) {
        throw new MastraError({
          id: createVectorErrorId('MEILISEARCH', 'QUERY', 'DIMENSION_MISMATCH'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Query vector dimension ${queryVector.length} does not match index dimension ${dimension}`,
          details: { expected: dimension, actual: queryVector.length },
        });
      }

      const translatedFilter = this.transformFilter(filter);
      if (translatedFilter === MEILISEARCH_MATCH_NONE) return [];

      const response = await this.client.index(indexName).search(null, {
        vector: queryVector,
        hybrid: { embedder: EMBEDDER, semanticRatio: 1.0 },
        limit: topK,
        filter: translatedFilter,
        showRankingScore: true,
        retrieveVectors: includeVector,
      });

      return response.hits.map((hit: any) => {
        const result: QueryResult = {
          id: String(hit.id ?? ''),
          score: typeof hit._rankingScore === 'number' ? hit._rankingScore : 0,
          metadata: hit.metadata ?? {},
        };
        if (includeVector) {
          const stored = hit._vectors?.[EMBEDDER];
          result.vector = Array.isArray(stored) ? stored : stored?.embeddings;
        }
        return result;
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MEILISEARCH', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, topK },
        },
        error,
      );
    }
  }

  private transformFilter(filter?: MeilisearchVectorFilter) {
    const translator = new MeilisearchFilterTranslator();
    return translator.translate(filter);
  }

  async updateVector(params: UpdateVectorParams<MeilisearchVectorFilter>): Promise<void> {
    const { indexName, update } = params;

    if ('id' in params && 'filter' in params && params.id && params.filter) {
      throw new MastraError({
        id: createVectorErrorId('MEILISEARCH', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'id and filter are mutually exclusive',
        details: { indexName },
      });
    }

    if (!update || (!update.vector && !update.metadata)) {
      throw new MastraError({
        id: createVectorErrorId('MEILISEARCH', 'UPDATE_VECTOR', 'NO_UPDATES'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'No updates provided',
        details: { indexName },
      });
    }

    if ('filter' in params && params.filter && Object.keys(params.filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('MEILISEARCH', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Cannot update with empty filter',
        details: { indexName },
      });
    }

    if ('id' in params && params.id) {
      await this.updateVectorById(indexName, params.id, update);
    } else if ('filter' in params && params.filter) {
      await this.updateVectorsByFilter(indexName, params.filter, update);
    } else {
      throw new MastraError({
        id: createVectorErrorId('MEILISEARCH', 'UPDATE_VECTOR', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Either id or filter must be provided',
        details: { indexName },
      });
    }
  }

  private buildPartialDocument(
    update: { vector?: number[]; metadata?: Record<string, any> },
    dimension: number,
  ): Record<string, any> {
    const doc: Record<string, any> = {};
    if (update.vector) {
      this.validateVectorDimensions([update.vector], dimension);
      doc._vectors = { [EMBEDDER]: { embeddings: update.vector, regenerate: false } };
    }
    if (update.metadata) {
      doc.metadata = update.metadata;
    }
    return doc;
  }

  private async updateVectorById(
    indexName: string,
    id: string,
    update: { vector?: number[]; metadata?: Record<string, any> },
  ): Promise<void> {
    try {
      const dimension = await this.getDimension(indexName, 'UPDATE_VECTOR');
      if (update.metadata) {
        await this.ensureFilterable(indexName, Object.keys(update.metadata));
      }
      const doc = { [PK]: this.encodeId(id), ...this.buildPartialDocument(update, dimension) };
      // updateDocuments merges at the top-level field granularity, so omitting
      // `_vectors` or `metadata` preserves the existing value.
      await this.awaitTask(this.client.index(indexName).updateDocuments([doc]), 'UPDATE_VECTOR', indexName);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MEILISEARCH', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, id },
        },
        error,
      );
    }
  }

  private async updateVectorsByFilter(
    indexName: string,
    filter: MeilisearchVectorFilter,
    update: { vector?: number[]; metadata?: Record<string, any> },
  ): Promise<void> {
    try {
      const dimension = await this.getDimension(indexName, 'UPDATE_VECTOR');
      await this.ensureFilterable(indexName, [...this.collectFilterFields(filter)]);
      if (update.metadata) {
        await this.ensureFilterable(indexName, Object.keys(update.metadata));
      }

      const translatedFilter = this.transformFilter(filter);
      if (translatedFilter === MEILISEARCH_MATCH_NONE) return;

      // Find the primary keys of all matching documents, then patch each.
      const { results } = await this.client.index(indexName).getDocuments({
        filter: translatedFilter,
        fields: [PK],
        limit: 100_000,
      });
      if (results.length === 0) return;

      const partial = this.buildPartialDocument(update, dimension);
      const docs = results.map((doc: any) => ({ [PK]: doc[PK], ...partial }));
      await this.awaitTask(this.client.index(indexName).updateDocuments(docs), 'UPDATE_VECTOR', indexName);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MEILISEARCH', 'UPDATE_VECTOR_BY_FILTER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, filter: JSON.stringify(filter) },
        },
        error,
      );
    }
  }

  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    try {
      await this.awaitTask(this.client.index(indexName).deleteDocument(this.encodeId(id)), 'DELETE_VECTOR', indexName);
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MEILISEARCH', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName, ...(id && { id }) },
        },
        error,
      );
    }
  }

  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<MeilisearchVectorFilter>): Promise<void> {
    if (ids && filter) {
      throw new MastraError({
        id: createVectorErrorId('MEILISEARCH', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'ids and filter are mutually exclusive',
        details: { indexName },
      });
    }

    if (!ids && !filter) {
      throw new MastraError({
        id: createVectorErrorId('MEILISEARCH', 'DELETE_VECTORS', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Either filter or ids must be provided',
        details: { indexName },
      });
    }

    if (ids && ids.length === 0) {
      throw new MastraError({
        id: createVectorErrorId('MEILISEARCH', 'DELETE_VECTORS', 'EMPTY_IDS'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Cannot delete with empty ids array',
        details: { indexName },
      });
    }

    if (filter && Object.keys(filter).length === 0) {
      throw new MastraError({
        id: createVectorErrorId('MEILISEARCH', 'DELETE_VECTORS', 'EMPTY_FILTER'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Cannot delete with empty filter',
        details: { indexName },
      });
    }

    try {
      // Ensure the index exists so deletes against a missing index throw.
      await this.getDimension(indexName, 'DELETE_VECTORS');

      if (ids) {
        await this.awaitTask(
          this.client.index(indexName).deleteDocuments(ids.map(id => this.encodeId(id))),
          'DELETE_VECTORS',
          indexName,
        );
      } else if (filter) {
        await this.ensureFilterable(indexName, [...this.collectFilterFields(filter)]);
        const translatedFilter = this.transformFilter(filter);
        if (translatedFilter === MEILISEARCH_MATCH_NONE) return;
        if (translatedFilter === undefined) {
          await this.awaitTask(this.client.index(indexName).deleteAllDocuments(), 'DELETE_VECTORS', indexName);
        } else {
          await this.awaitTask(
            this.client.index(indexName).deleteDocuments({ filter: translatedFilter }),
            'DELETE_VECTORS',
            indexName,
          );
        }
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MEILISEARCH', 'DELETE_VECTORS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            ...(filter && { filter: JSON.stringify(filter) }),
            ...(ids && { idsCount: ids.length }),
          },
        },
        error,
      );
    }
  }
}
