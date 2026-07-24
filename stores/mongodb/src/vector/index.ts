import { v4 as uuidv4 } from '@lukeed/uuid';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { createVectorErrorId } from '@mastra/core/storage';
import { MastraVector, validateUpsertInput, validateVectorValues } from '@mastra/core/vector';
import type {
  QueryResult,
  IndexStats,
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  DescribeIndexParams,
  DeleteIndexParams,
  DeleteVectorParams,
  UpdateVectorParams,
  DeleteVectorsParams,
} from '@mastra/core/vector';
import { MongoClient, ObjectId } from 'mongodb';
import type { MongoClientOptions, Document, Db, Collection } from 'mongodb';
import packageJson from '../../package.json';

import { MongoDBFilterTranslator } from './filter';
import type { MongoDBVectorFilter } from './filter';

// Define necessary types and interfaces
export interface MongoDBUpsertVectorParams extends UpsertVectorParams {
  documents?: string[];
}

export interface MongoDBQueryVectorParams extends QueryVectorParams<MongoDBVectorFilter> {
  documentFilter?: MongoDBVectorFilter;
  /**
   * Number of candidates the HNSW graph considers before selecting the
   * top-K results. Higher values improve recall at the cost of latency.
   * Must be >= topK. Defaults to 20 * topK, capped at 10000.
   * See: https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-stage/
   */
  numCandidates?: number;
  /**
   * `'field'` (default) projects the managed `metadata`/`document` fields.
   * `'document'` returns the full source document as `metadata` — use for
   * bring-your-own operational collections whose documents have their own shape.
   */
  metadataMode?: 'field' | 'document';
}

export interface MongoDBCreateIndexParams extends CreateIndexParams {
  /**
   * Metadata field names to declare as filter fields in the Atlas vectorSearch
   * index (registered as `metadata.<field>`). Queries whose metadata filter
   * only touches declared fields — using operators `$vectorSearch.filter`
   * supports — are passed directly to `$vectorSearch` instead of pre-filtering
   * candidate `_id`s, avoiding the 16 MB BSON limit on large result sets.
   * Filters that reference an undeclared field, or use an unsupported
   * operator, automatically fall back to the pre-filter.
   * @see https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/
   */
  filterFields?: string[];
  /**
   * Store the vectors on an existing (operational) collection instead of a
   * managed collection named after the index. Defaults to `indexName`.
   * The collection is never created or dropped by this store when set.
   */
  collectionName?: string;
  /**
   * Name for the Atlas vectorSearch index created on the collection.
   * Defaults to `${indexName}_vector_index`.
   */
  searchIndexName?: string;
  /**
   * Opt-in to write operations (`upsert`, `updateVector`, `deleteVector`,
   * `deleteVectors`) on a bring-your-own collection. Defaults to `false`:
   * a BYO index is **read-only** — the store never mutates the caller's
   * operational documents unless explicitly allowed. Ignored for managed
   * collections (which the store owns and can always write to).
   */
  allowWrites?: boolean;
}

export interface MongoDBVectorConfig {
  /** Unique identifier for this vector store instance */
  id: string;
  /** MongoDB connection string */
  uri: string;
  /** Name of the MongoDB database to use */
  dbName: string;
  /** Optional MongoDB client options */
  options?: MongoClientOptions;
  /**
   * Path to the field that stores vector embeddings.
   * Supports nested paths using dot notation (e.g., 'text.contentEmbedding').
   * @default 'embedding'
   */
  embeddingFieldPath?: string;
}

export interface MongoDBIndexReadyParams {
  indexName: string;
  timeoutMs?: number;
  checkIntervalMs?: number;
}

/**
 * Durable target for a logical Mastra index. Recorded in the registry collection at
 * createIndex time and hydrated on resolve so BYO classification, collection routing,
 * and the text-search-index name survive a process restart.
 */
interface IndexTarget {
  /** MongoDB collection that stores the vectors (may differ from indexName for BYO). */
  collectionName: string;
  /** Atlas vectorSearch index name on that collection. */
  searchIndexName: string;
  /** True when the collection is caller-owned (bring-your-own) and must never be dropped. */
  isByo: boolean;
  /**
   * True when write operations (upsert/updateVector/deleteVector/deleteVectors) are permitted
   * on a BYO collection. Captured at createIndex time (`allowWrites` param) and persisted so
   * the write policy survives a process restart. Always true for managed collections.
   * Defaults to false for BYO: the store never mutates caller-owned documents by default.
   */
  allowWrites: boolean;
  /**
   * Atlas full-text (BM25) search index name used by textQuery/hybridQuery. Set by
   * createSearchIndex (or defaulted to `${collectionName}_search_index`).
   */
  textSearchIndexName?: string;
}

/** Shape of a registry document persisted in {@link MongoDBVector.REGISTRY_COLLECTION}. */
interface RegistryDoc extends IndexTarget {
  _id: string;
  indexName: string;
  dimension?: number;
  metric?: string;
}

// Define the document interface
interface MongoDBDocument extends Document {
  _id: string; // Explicitly declare '_id' as string
  embedding?: number[];
  metadata?: Record<string, any>;
  document?: string;
  [key: string]: any; // Index signature for additional properties
}
// The MongoDBVector class
export class MongoDBVector extends MastraVector<MongoDBVectorFilter> {
  private client: MongoClient;
  private db: Db;
  private collections: Map<string, Collection<MongoDBDocument>>;
  private readonly embeddingFieldName: string;
  private readonly metadataFieldName = 'metadata';
  private readonly documentFieldName = 'document';
  /**
   * Per-index cache of the filter paths declared in the Atlas vectorSearch index
   * (e.g. `document`, `metadata.category`). Populated when an index is created in
   * this process and lazily hydrated from the live index definition otherwise.
   * `_id` is excluded because it is materialised separately by the fallback path.
   */
  private declaredFilterPaths: Map<string, Set<string>> = new Map();
  /**
   * Per-index target: where the data lives, what the Atlas index is called, and whether
   * the collection is caller-owned (bring-your-own). `isByo` is captured at createIndex
   * time — it cannot be reliably re-derived from names later (a BYO index may legitimately
   * reuse its indexName as the collectionName), and misclassifying it risks dropping a
   * caller's operational collection in deleteIndex.
   *
   * This is an in-process cache in front of the durable registry collection
   * ({@link MongoDBVector.REGISTRY_COLLECTION}). It is populated at createIndex time and
   * lazily hydrated from the registry by {@link resolveIndexTarget} in any other process,
   * so BYO classification (and thus deleteIndex safety) survives a restart.
   */
  private indexTargets: Map<string, IndexTarget> = new Map();
  /**
   * Memoized result of the one-time `$rankFusion` support probe (a `buildInfo` round trip).
   * Cached on the instance after the first `hybridQuery` so subsequent calls skip the admin
   * command; `version` is retained for the unsupported-version error message.
   */
  private rankFusionSupport?: { ok: boolean; version: string };
  /**
   * Name of the mastra-owned collection that durably records the logical-index → target
   * mapping (`_id: <indexName>`). Kept separate from caller data so a BYO operational
   * collection is never polluted with mastra bookkeeping. Excluded from `listIndexes`.
   */
  private static readonly REGISTRY_COLLECTION = '__mastra_vector_indexes__';
  /**
   * MongoDB query operators supported inside `$vectorSearch.filter`. Intentionally
   * conservative: filters using any operator outside this set fall back to the
   * `$match` pre-filter, which supports the full query language. Widening this set
   * is safe only for operators Atlas Vector Search actually accepts in `filter`.
   */
  private static readonly PUSHDOWN_OPERATORS = new Set([
    '$and',
    '$or',
    '$eq',
    '$ne',
    '$gt',
    '$gte',
    '$lt',
    '$lte',
    '$in',
    '$nin',
  ]);
  private mongoMetricMap: { [key: string]: string } = {
    cosine: 'cosine',
    euclidean: 'euclidean',
    dotproduct: 'dotProduct',
  };

  constructor({ id, uri, dbName, options, embeddingFieldPath }: MongoDBVectorConfig) {
    super({ id });

    if (!uri) {
      throw new Error('MongoDBVector requires a connection string. Provide "uri" in the constructor options.');
    }

    const client = new MongoClient(uri, {
      ...options,
      driverInfo: {
        name: 'mastra-vector',
        version: packageJson.version || '0.0.0',
      },
    });
    this.client = client;
    this.db = this.client.db(dbName);
    this.collections = new Map();
    this.embeddingFieldName = embeddingFieldPath ?? 'embedding';
  }

  /**
   * Resolve the collection + vector-index names for an index, honoring BYO overrides.
   *
   * Resolution order:
   *   1. in-process cache ({@link indexTargets}),
   *   2. durable registry collection ({@link MongoDBVector.REGISTRY_COLLECTION}) — hydrated
   *      into the cache so BYO routing/classification survives a process restart,
   *   3. managed-index default (`collectionName: indexName`, `isByo: false`) for back-compat
   *      with indexes created before the registry existed.
   *
   * Async because the registry read is a MongoDB round-trip; all 13 call sites are inside
   * async methods so awaiting is free.
   */
  private async resolveIndexTarget(indexName: string): Promise<IndexTarget> {
    const cached = this.indexTargets.get(indexName);
    if (cached) return cached;

    const persisted = await this.readRegistryEntry(indexName);
    if (persisted) {
      // Defensive: a registry entry may be missing collectionName/searchIndexName if it was ever
      // written partially (e.g. a pre-registry managed index, or a legacy partial upsert). Fall
      // back to the managed defaults for any missing field rather than returning undefined, which
      // would break every downstream op (query/describeIndex/deleteIndex) with a null collection.
      const isByo = persisted.isByo ?? false;
      const target: IndexTarget = {
        collectionName: persisted.collectionName ?? indexName,
        searchIndexName: persisted.searchIndexName ?? `${indexName}_vector_index`,
        isByo,
        // Fail closed: a BYO entry missing the write policy (e.g. written by an older
        // version of this store) is treated as read-only. Managed is always writable.
        allowWrites: isByo ? (persisted.allowWrites ?? false) : true,
        textSearchIndexName: persisted.textSearchIndexName,
      };
      this.indexTargets.set(indexName, target);
      return target;
    }

    return {
      collectionName: indexName,
      searchIndexName: `${indexName}_vector_index`,
      isByo: false,
      allowWrites: true,
    };
  }

  /**
   * Reject metadata containing circular references BEFORE it reaches the driver.
   *
   * bson@7.x's iterative `calculateObjectSize` (used by `bulkWrite`) has no cycle
   * detection and spins forever on circular input — it does not throw, it hangs the
   * process at 100% CPU (reproduced standalone against bson 7.3.1). A pre-flight
   * check converts that hang into a clear USER error. Shared references (DAGs) are
   * legal BSON and are allowed; only true ancestor cycles are rejected.
   */
  private assertNoCircularReferences(value: unknown, operation: string): void {
    const inPath = new WeakSet<object>();
    const visit = (node: unknown): void => {
      if (node === null || typeof node !== 'object') return;
      if (inPath.has(node as object)) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', operation, 'CIRCULAR_METADATA'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: 'Metadata contains a circular reference and cannot be serialized to BSON.',
        });
      }
      inPath.add(node as object);
      for (const child of Array.isArray(node) ? node : Object.values(node as object)) {
        visit(child);
      }
      inPath.delete(node as object);
    };
    visit(value);
  }

  /**
   * Guard for write operations. A bring-your-own collection is READ-ONLY by default:
   * the caller owns those documents, and Mastra must never mutate or delete them
   * unless the caller explicitly opted in via `createIndex({ ..., allowWrites: true })`.
   * Managed collections (store-owned) are always writable. See mastra-ai/mastra#19802
   * for the design discussion.
   */
  private async assertWritable(indexName: string, operation: string): Promise<void> {
    const target = await this.resolveIndexTarget(indexName);
    if (target.isByo && !target.allowWrites) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', operation, 'READ_ONLY_INDEX'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName, collectionName: target.collectionName },
        text: `Index "${indexName}" targets the bring-your-own collection "${target.collectionName}", which is read-only by default — Mastra does not modify or delete caller-owned operational documents. To allow writes, opt in explicitly: createIndex({ indexName: "${indexName}", collectionName: "${target.collectionName}", allowWrites: true, ... }).`,
      });
    }
  }

  /**
   * Resolve the full-text (BM25) search index name for an index, honoring a persisted override.
   *
   * A managed index always has a companion dynamic full-text index (auto-created by
   * createIndex), so its name defaults to `${collectionName}_search_index`. A bring-your-own
   * index does NOT get an auto-created full-text index; until the caller opts in via
   * createSearchIndex there is no text index to target, so textQuery/hybridQuery fail clearly
   * here instead of querying a non-existent Atlas index.
   */
  private async resolveTextSearchIndexName(indexName: string): Promise<string> {
    const target = await this.resolveIndexTarget(indexName);
    if (target.textSearchIndexName) return target.textSearchIndexName;
    if (target.isByo) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'TEXT_QUERY', 'NO_TEXT_INDEX'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: `No full-text search index exists for bring-your-own index "${indexName}". Call createSearchIndex({ indexName: "${indexName}" }) to enable textQuery/hybridQuery, or pass an explicit searchIndexName.`,
      });
    }
    return `${target.collectionName}_search_index`;
  }

  /** Read a logical-index target from the durable registry collection, if present. */
  private async readRegistryEntry(indexName: string): Promise<RegistryDoc | null> {
    const registry = this.db.collection<RegistryDoc>(MongoDBVector.REGISTRY_COLLECTION);
    return (await registry.findOne({ _id: indexName })) ?? null;
  }

  /**
   * Persist (upsert) a logical-index target so it survives a process restart. Idempotent
   * createIndex refreshes it; a partial update (e.g. only the text-search-index name) merges
   * into the existing entry.
   */
  private async writeRegistryEntry(indexName: string, entry: Partial<RegistryDoc>): Promise<void> {
    const registry = this.db.collection<RegistryDoc>(MongoDBVector.REGISTRY_COLLECTION);
    await registry.updateOne({ _id: indexName }, { $set: { indexName, ...entry } }, { upsert: true });
  }

  /** Remove a logical-index target from the durable registry (called by deleteIndex). */
  private async deleteRegistryEntry(indexName: string): Promise<void> {
    const registry = this.db.collection<RegistryDoc>(MongoDBVector.REGISTRY_COLLECTION);
    await registry.deleteOne({ _id: indexName });
  }

  /**
   * $rankFusion is available in MongoDB >= 8.0. It is generally available from 8.1; on 8.0.x it
   * may require a MongoDB support case to enable (see the $rankFusion docs), but where enabled —
   * e.g. Atlas 8.0.x clusters — it runs. We therefore gate at >= 8.0 (rejecting only clearly
   * unsupported older servers) and let the server be the final authority: if $rankFusion is not
   * actually enabled on an 8.0.x deployment, the query itself surfaces the server error.
   */
  private async assertRankFusionSupported(): Promise<void> {
    // Probe the server version once and memoize: the support result cannot change for a live
    // connection, so subsequent hybridQuery calls skip the buildInfo admin round trip.
    if (!this.rankFusionSupport) {
      const info = (await this.db.admin().buildInfo()) as { version?: string };
      const version = info.version ?? 'unknown';
      const [maj = 0] = (info.version ?? '0.0').split('.').map(Number);
      const ok = maj >= 8;
      this.rankFusionSupport = { ok, version };
    }
    if (!this.rankFusionSupport.ok) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'UNSUPPORTED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `hybridQuery uses $rankFusion, which requires MongoDB >= 8.0 (found ${this.rankFusionSupport.version}). On 8.0.x it may need a MongoDB support case to enable; upgrade to >= 8.1, or run query() and textQuery() separately and fuse client-side.`,
      });
    }
  }

  /**
   * Builds the projection pipeline stage(s) for query results based on metadata mode and
   * whether to include vectors. Shared across query, textQuery, and hybridQuery to keep
   * projection logic DRY. Returns an array of stages because `metadataMode: 'document'` may
   * append a `$unset` to strip the embedding from `metadata`.
   *
   * The relevance score is computed here via `$meta: <scoreMeta>` INSIDE the projection
   * rather than by a preceding `$set { score }` stage. This is deliberate: in
   * `metadataMode: 'document'`, `metadata: '$$ROOT'` copies the source document, and if the
   * synthetic score had been `$set` onto the root first, it would (a) leak into `metadata`
   * and (b) clobber any real source field named `score`. Because `$$ROOT` here is the stage
   * input (before this projection materialises `score`), `metadata` is the clean source doc
   * and a real `score` field survives, while the top-level result still carries the synthetic
   * relevance score.
   *
   * **Embedding in document mode:** `metadata: '$$ROOT'` copies the full source document,
   * which includes the (large) embedding field — payload bloat callers rarely want. So when
   * `includeVector` is false, a trailing `$unset` drops the embedding path from `metadata`.
   * `$unset` accepts a dot path, so a nested `embeddingFieldName` (e.g. `text.contentEmbedding`)
   * is handled. When `includeVector` is true, the embedding is retained in `metadata` AND
   * exposed via the top-level `vector` field. Field mode's `metadata` is the managed
   * subdocument, which never contains the embedding, so no `$unset` is needed there.
   *
   * @param scoreMeta - metadata field holding the relevance score for the search stage in use
   *   (`vectorSearchScore` for $vectorSearch, `searchScore` for $search, `score` for $rankFusion).
   */
  private buildProjection(
    metadataMode: 'field' | 'document',
    includeVector: boolean,
    scoreMeta: 'vectorSearchScore' | 'searchScore' | 'score',
  ): Document[] {
    const score = { $meta: scoreMeta };
    if (metadataMode === 'document') {
      const project: Document = {
        _id: 1,
        score,
        metadata: '$$ROOT',
        ...(includeVector && { vector: `$${this.embeddingFieldName}` }),
      };
      if (includeVector) return [{ $project: project }];
      return [{ $project: project }, { $unset: `${this.metadataFieldName}.${this.embeddingFieldName}` }];
    }
    return [
      {
        $project: {
          _id: 1,
          score,
          metadata: `$${this.metadataFieldName}`,
          document: `$${this.documentFieldName}`,
          ...(includeVector && { vector: `$${this.embeddingFieldName}` }),
        },
      },
    ];
  }

  // Public methods
  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'CONNECT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.close();
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'DISCONNECT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Creates a MongoDB collection and the Atlas Search indexes that back a
   * Mastra index with the given name.
   *
   * **Async index lifecycle:** Atlas Search indexes transition through
   * PENDING → BUILDING → READY after this method returns. If you need to
   * `upsert` or `query` immediately after calling `createIndex`, call
   * `waitForIndexReady({ indexName })` first to block until the index is
   * queryable. Skipping that step on a real Atlas cluster may cause
   * "index not found" or "index not ready" errors on subsequent operations.
   */
  async createIndex({
    indexName,
    dimension,
    metric = 'cosine',
    filterFields,
    collectionName,
    searchIndexName,
    allowWrites,
  }: MongoDBCreateIndexParams): Promise<void> {
    let mongoMetric;
    try {
      if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error('Dimension must be a positive integer');
      }

      mongoMetric = this.mongoMetricMap[metric];
      if (!mongoMetric) {
        throw new Error(`Invalid metric: "${metric}". Must be one of: cosine, euclidean, dotproduct`);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            indexName,
            dimension,
            metric,
          },
        },
        error,
      );
    }

    const targetCollection = collectionName ?? indexName;
    const targetSearchIndex = searchIndexName ?? `${indexName}_vector_index`;
    const isByo = collectionName !== undefined;
    // Write policy: managed collections are always writable (the store owns them).
    // BYO collections are read-only unless the caller explicitly opts in — Mastra
    // must not mutate or delete caller-owned operational documents by default.
    const writable = isByo ? (allowWrites ?? false) : true;

    let collection;
    try {
      // Check if collection exists
      const collectionExists = await this.db.listCollections({ name: targetCollection }).hasNext();
      if (!collectionExists) {
        if (isByo) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INVALID_ARGS'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `collectionName "${targetCollection}" does not exist. Create and populate the collection before indexing it.`,
          });
        }
        await this.db.createCollection(targetCollection);
      }
      collection = await this.getCollection(targetCollection);

      const indexNameInternal = targetSearchIndex;
      const defaultTextSearchIndex = `${targetCollection}_search_index`;

      // Guard against a conflicting retarget: if this logical index already points at a
      // DIFFERENT physical collection, refuse rather than silently orphan the old collection's
      // search index (and its registry-less data). Idempotent re-createIndex against the same
      // collection is allowed (refreshes the entry).
      const existingEntry = await this.readRegistryEntry(indexName);
      if (existingEntry && existingEntry.collectionName !== targetCollection) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: `Index "${indexName}" is already registered against collection "${existingEntry.collectionName}", but this createIndex call resolves to "${targetCollection}". Call deleteIndex({ indexName: "${indexName}" }) first to retarget it.`,
        });
      }

      // Persist the logical-index → target mapping BEFORE provisioning any search
      // index. The registry entry is the durable record that classifies this index
      // as bring-your-own; if provisioning fails after this point, a later
      // fresh-process deleteIndex still sees isByo:true and preserves the caller's
      // collection (dropping only the search index). Persisting AFTER provisioning
      // would leave a window where a created search index has no registry entry, so
      // deleteIndex would misclassify a BYO index as managed and drop the collection.
      //
      // Text-search-index name policy:
      //   - Managed (!isByo): auto-provision the companion dynamic full-text index, so default
      //     its name here (preserving any prior custom name from createSearchIndex).
      //   - BYO (isByo): do NOT auto-create a (billable) full-text index. Leave
      //     textSearchIndexName UNSET until the caller opts in via createSearchIndex, so
      //     textQuery/hybridQuery fail clearly instead of querying a non-existent index. A
      //     custom name from a prior createSearchIndex is still preserved.
      const textSearchIndexName = isByo
        ? existingEntry?.textSearchIndexName
        : (existingEntry?.textSearchIndexName ?? defaultTextSearchIndex);
      await this.writeRegistryEntry(indexName, {
        collectionName: targetCollection,
        searchIndexName: targetSearchIndex,
        isByo,
        allowWrites: writable,
        textSearchIndexName,
        dimension,
        metric,
      });
      this.indexTargets.set(indexName, {
        collectionName: targetCollection,
        searchIndexName: targetSearchIndex,
        isByo,
        allowWrites: writable,
        textSearchIndexName,
      });

      const embeddingField = this.embeddingFieldName;
      const numDimensions = dimension;

      // Create search indexes.
      // Note that fast filtering can be done during vector search, but only if
      // we know the fields when the index is created.
      // '_id' and 'document' are always declared as filter fields. 'document'
      // lets documentFilter queries be passed directly to $vectorSearch without
      // materialising candidate IDs.
      // Metadata fields are arbitrary and unknown at index-creation time, so by
      // default they are not declared. Callers can declare the metadata fields
      // they intend to filter on via `filterFields`; those are registered as
      // `metadata.<field>` filter fields so filtered queries skip the $match /
      // $in pre-filter. See https://github.com/mastra-ai/mastra/issues/18587.
      const declaredMetadataPaths = this.buildDeclaredMetadataPaths(filterFields);
      const fields: Document[] = [
        {
          type: 'vector',
          path: embeddingField,
          numDimensions: numDimensions,
          similarity: mongoMetric,
        },
        {
          type: 'filter',
          path: '_id',
        },
        {
          type: 'filter',
          path: this.documentFieldName,
        },
        ...declaredMetadataPaths.map(path => ({ type: 'filter', path })),
      ];

      // Each creation treats IndexAlreadyExists as a no-op independently. A
      // shared catch would let an existing vector index skip creation of the
      // companion full-text index entirely (e.g. after a previously
      // interrupted createIndex), leaving the pair in a partial state.
      const vectorIndexCreated = await this.createSearchIndexIgnoringExisting(collection, {
        definition: { fields },
        name: indexNameInternal,
        type: 'vectorSearch',
      });

      // Cache the declared filter paths only when this call actually created
      // the index. An index that already existed may carry a different
      // declaration; queries hydrate the real one lazily via
      // getDeclaredFilterPaths().
      if (vectorIndexCreated) {
        this.declaredFilterPaths.set(indexName, new Set([this.documentFieldName, ...declaredMetadataPaths]));
      }

      // Companion full-text index (dynamic mapping). Only auto-created for MANAGED
      // collections (back-compat). For a bring-your-own operational collection we do NOT
      // provision a billable full-text index implicitly — the caller opts in explicitly via
      // createSearchIndex. The registry entry above records its name (managed only), so BYO
      // safety does not depend on this succeeding.
      if (!isByo) {
        await this.createSearchIndexIgnoringExisting(collection, {
          definition: {
            mappings: {
              dynamic: true,
            },
          },
          name: defaultTextSearchIndex,
          type: 'search',
        });
      }
    } catch (error: any) {
      // Preserve already-classified errors (e.g. the USER-category CONFLICT retarget guard and
      // the BYO INVALID_ARGS collection-missing error thrown above) with their id/category
      // intact, instead of re-wrapping them as a generic THIRD_PARTY CREATE_INDEX/FAILED.
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Creates an Atlas Search index, treating IndexAlreadyExists as a no-op so
   * `createIndex` stays idempotent per index. Returns true when the index was
   * actually created by this call.
   */
  private async createSearchIndexIgnoringExisting(
    collection: Collection<MongoDBDocument>,
    description: { definition: Document; name: string; type: 'vectorSearch' | 'search' },
  ): Promise<boolean> {
    try {
      await collection.createSearchIndex(description);
      return true;
    } catch (error: any) {
      if (error?.codeName === 'IndexAlreadyExists') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Drop an Atlas Search index, treating "index not found" as a no-op so deleteIndex is
   * retry-safe: an index a prior (interrupted) delete already removed does not fail the retry
   * that still needs to clear the registry entry.
   */
  private async dropSearchIndexIgnoringMissing(collection: Collection<MongoDBDocument>, name: string): Promise<void> {
    try {
      await collection.dropSearchIndex(name);
    } catch (err: any) {
      const code = err?.codeName ?? err?.code;
      if (code !== 'IndexNotFound' && code !== 'SearchIndexNotFound' && code !== 27) throw err;
    }
  }

  /**
   * Provision an Atlas Search (BM25/full-text) index on the index's collection and record
   * it as the text-search index that `textQuery`/`hybridQuery` will target.
   *
   * `fields` restricts the mapping to specific paths; omit for dynamic mapping.
   *
   * **Interaction with the auto-created dynamic index:** `createIndex` already provisions a
   * *dynamic* full-text index named `${collectionName}_search_index`. Calling
   * `createSearchIndex` with the default name and a `fields` mapping would hit
   * `IndexAlreadyExists` and silently keep the dynamic mapping. To make `fields` take effect,
   * when `fields` is provided and no explicit `searchIndexName` is given, the field-mapped
   * index is created under a DISTINCT name (`${collectionName}_${indexName}_search_fields_index`,
   * unique per logical index so two logical indexes on one collection do not collide) and
   * persisted as the text-search index, so `textQuery`/`hybridQuery` use the restricted
   * mapping instead of the dynamic one. Pass `searchIndexName` to override the name explicitly.
   */
  async createSearchIndex(params: {
    indexName: string;
    fields?: string[];
    searchIndexName?: string;
    /**
     * When true, block until the provisioned full-text index reports READY (via
     * {@link waitForSearchIndexReady}) before resolving. Defaults to false to avoid surprising
     * latency; call {@link waitForSearchIndexReady} explicitly if you prefer to await separately.
     */
    waitUntilReady?: boolean;
  }): Promise<void> {
    const { indexName, fields, searchIndexName, waitUntilReady = false } = params;
    // Resolve the FULL current target first (FIX 1): we must never persist a partial
    // {indexName, textSearchIndexName}-only registry doc, which would make a later
    // resolveIndexTarget see a truthy entry with undefined collectionName/searchIndexName.
    const target = await this.resolveIndexTarget(indexName);
    const { collectionName } = target;
    // A field-mapped index must not collide with the auto-created dynamic index (which would
    // no-op the field mapping), and two logical indexes on the SAME collection must not collide
    // with each other (FIX 6), so the default name includes the logical indexName.
    const name =
      searchIndexName ??
      (fields?.length ? `${collectionName}_${indexName}_search_fields_index` : `${collectionName}_search_index`);
    try {
      const collection = await this.getCollection(collectionName);
      const definition = fields?.length
        ? {
            mappings: {
              dynamic: false,
              fields: Object.fromEntries(fields.map(f => [f, [{ type: 'string' }]])),
            },
          }
        : { mappings: { dynamic: true } };
      const created = await this.createSearchIndexIgnoringExisting(collection, { definition, name, type: 'search' });
      // If the index already existed, its definition is NOT updated by createSearchIndex
      // (IndexAlreadyExists is a no-op). Recreating the same logical index with a different
      // `fields` mapping must actually change the mapping, so update it in place. (Idempotent:
      // updating to the identical definition is a cheap no-op server-side.)
      if (!created) {
        await collection.updateSearchIndex(name, definition);
      }
      // Persist a COMPLETE target (FIX 1): merge the resolved collectionName/searchIndexName/isByo
      // with the new textSearchIndexName so the registry entry is never left partial.
      await this.writeRegistryEntry(indexName, {
        collectionName: target.collectionName,
        searchIndexName: target.searchIndexName,
        isByo: target.isByo,
        allowWrites: target.allowWrites,
        textSearchIndexName: name,
      });
      this.indexTargets.set(indexName, { ...target, textSearchIndexName: name });
      if (waitUntilReady) {
        await this.waitForSearchIndexReady({ indexName });
      }
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Run a full-text (BM25) search against an Atlas Search index on the collection.
   * The search index is named `${collectionName}_search_index` by default.
   */
  async textQuery(params: {
    indexName: string;
    query: string;
    paths: string[];
    topK?: number;
    filter?: MongoDBVectorFilter;
    metadataMode?: 'field' | 'document';
    /** Override the resolved full-text search index name for this call. */
    searchIndexName?: string;
  }): Promise<QueryResult[]> {
    const { indexName, query, paths, topK = 10, filter, metadataMode = 'field', searchIndexName } = params;
    const { collectionName } = await this.resolveIndexTarget(indexName);
    // The full-text search index name is resolved from the persisted registry entry (set by
    // createSearchIndex / createIndex), defaulting to `${collectionName}_search_index`. A
    // caller may override it per-call via `searchIndexName`.
    const textIndex = searchIndexName ?? (await this.resolveTextSearchIndexName(indexName));
    try {
      const collection = await this.getCollection(collectionName, true);
      const metadataFilter = this.transformMetadataFilter(this.transformFilter(filter), metadataMode);
      const pipeline: Document[] = [
        { $search: { index: textIndex, text: { query, path: paths } } },
        ...(Object.keys(metadataFilter).length ? [{ $match: metadataFilter }] : []),
        { $limit: Math.min(10000, topK) },
        // Score is projected via $meta inside buildProjection (not a preceding $set) so it
        // never pollutes `metadata: '$$ROOT'` in document mode.
        ...this.buildProjection(metadataMode, false, 'searchScore'),
      ];
      const rows = await collection.aggregate(pipeline).toArray();
      return rows.map((r: any) => ({
        // Coerce _id to string (BYO collections may key on ObjectId) to honor the id contract.
        id: this.idToString(r._id),
        // Guard the score consistently with hybridQuery: a missing/non-numeric $meta score
        // becomes 0 rather than undefined.
        score: typeof r.score === 'number' ? r.score : 0,
        metadata: r.metadata,
        document: r.document,
      }));
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'TEXT_QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Run a hybrid search that fuses vector similarity and full-text (BM25) results
   * using MongoDB's server-side $rankFusion aggregation stage. Requires MongoDB >= 8.0
   * (see {@link assertRankFusionSupported}: generally available from 8.1; on 8.0.x it may
   * need a MongoDB support case to enable, and runs where enabled, e.g. Atlas 8.0.x).
   */
  async hybridQuery(params: {
    indexName: string;
    queryVector: number[];
    query: string;
    paths: string[];
    topK?: number;
    filter?: MongoDBVectorFilter;
    weights?: { vector?: number; text?: number };
    numCandidates?: number;
    metadataMode?: 'field' | 'document';
    /** Override the resolved full-text search index name for this call. */
    textSearchIndexName?: string;
  }): Promise<QueryResult[]> {
    const {
      indexName,
      queryVector,
      query,
      paths,
      topK = 10,
      filter,
      weights,
      numCandidates,
      metadataMode = 'field',
      textSearchIndexName,
    } = params;
    await this.assertRankFusionSupported();
    const { collectionName, searchIndexName } = await this.resolveIndexTarget(indexName);
    const textIndex = textSearchIndexName ?? (await this.resolveTextSearchIndexName(indexName));
    try {
      const collection = await this.getCollection(collectionName, true);
      const metadataFilter = this.transformMetadataFilter(this.transformFilter(filter), metadataMode);
      const hasMetadataFilter = Object.keys(metadataFilter).length > 0;
      // The branch limit is also capped at 10000: $vectorSearch requires numCandidates >= limit,
      // and numCandidates is itself capped at 10000, so perBranch must not exceed it or a large
      // topK (> 2500, where topK*4 > 10000) would make numCandidates < limit and error.
      const perBranch = Math.min(10000, Math.max(topK * 4, 20));
      // numCandidates must be >= the branch limit (perBranch), or $vectorSearch errors
      // server-side. Floor at perBranch (not topK), keep the 10000 cap. (FIX 3)
      const candidates = Math.min(10000, Math.max(perBranch, numCandidates ?? topK * 20));

      const vectorSearch: Document = {
        index: searchIndexName,
        path: this.embeddingFieldName,
        queryVector,
        numCandidates: candidates,
        limit: perBranch,
      };

      // Apply the metadata filter to the vector branch using the same pushdown-vs-fallback
      // logic as query(): pass the filter straight to $vectorSearch only when every field is
      // a declared filter field and every operator is supported; otherwise materialise
      // matching _ids via $match and filter by _id. This avoids a hard $vectorSearch error
      // on BYO collections whose metadata fields are typically not declared as filter fields.
      if (hasMetadataFilter) {
        let declaredPaths: Set<string>;
        try {
          declaredPaths = await this.getDeclaredFilterPaths(indexName);
        } catch {
          declaredPaths = new Set();
        }
        if (this.canPushDownFilter(metadataFilter, declaredPaths)) {
          vectorSearch.filter = metadataFilter;
        } else {
          const candidateIds = await collection
            .aggregate([{ $match: metadataFilter }, { $project: { _id: 1 } }])
            .map(doc => doc._id)
            .toArray();
          if (candidateIds.length === 0) return [];
          vectorSearch.filter = { _id: { $in: candidateIds } };
        }
      }

      const textPipeline: Document[] = [
        { $search: { index: textIndex, text: { query, path: paths } } },
        ...(hasMetadataFilter ? [{ $match: metadataFilter }] : []),
        { $limit: perBranch },
      ];

      const combination = weights ? { weights: { vector: weights.vector ?? 1, text: weights.text ?? 1 } } : undefined;
      const pipeline: Document[] = [
        {
          $rankFusion: {
            input: { pipelines: { vector: [{ $vectorSearch: vectorSearch }], text: textPipeline } },
            ...(combination ? { combination } : {}),
          },
        },
        { $limit: Math.min(10000, topK) },
        // $rankFusion places its Reciprocal Rank Fusion score in the `score` metadata field
        // (NOT `searchScore`, which is the text-branch score and is absent on vector-only hits).
        // Score is projected via $meta inside buildProjection (not a preceding $set) so it
        // never pollutes `metadata: '$$ROOT'` in document mode.
        ...this.buildProjection(metadataMode, false, 'score'),
      ];
      const rows = await collection.aggregate(pipeline).toArray();
      return rows.map((r: any) => ({
        id: this.idToString(r._id),
        score: typeof r.score === 'number' ? r.score : 0,
        metadata: r.metadata,
        document: r.document,
      }));
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Waits for the index to be ready.
   *
   * @param {string} indexName - The name of the index to wait for
   * @param {number} timeoutMs - The maximum time in milliseconds to wait for the index to be ready (default: 60000)
   * @param {number} checkIntervalMs - The interval in milliseconds at which to check if the index is ready (default: 2000)
   * @returns A promise that resolves when the index is ready
   */
  async waitForIndexReady({
    indexName,
    timeoutMs = 60000,
    checkIntervalMs = 2000,
  }: MongoDBIndexReadyParams): Promise<void> {
    const { collectionName, searchIndexName } = await this.resolveIndexTarget(indexName);
    const collection = await this.getCollection(collectionName, true);
    const indexNameInternal = searchIndexName;

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const indexInfo: any[] = await (collection as any).listSearchIndexes().toArray();
      const indexData = indexInfo.find((idx: any) => idx.name === indexNameInternal);
      const status = indexData?.status;
      if (status === 'READY') {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }
    throw new Error(`Index "${indexNameInternal}" did not become ready within timeout`);
  }

  /**
   * Waits for the full-text (BM25) search index of an index to become READY.
   *
   * `waitForIndexReady` polls only the vectorSearch index. `createSearchIndex` returns while the
   * Atlas Search full-text index is still BUILDING, so an immediate textQuery/hybridQuery can
   * intermittently fail. Call this (or pass `waitUntilReady: true` to `createSearchIndex`) to
   * block until the resolved text index reports READY.
   *
   * @param indexName - The logical Mastra index whose text index to wait on.
   * @param searchIndexName - Override the resolved text-search index name.
   * @param timeoutMs - Maximum time to wait (default: 60000).
   * @param checkIntervalMs - Poll interval (default: 2000).
   */
  async waitForSearchIndexReady({
    indexName,
    searchIndexName,
    timeoutMs = 60000,
    checkIntervalMs = 2000,
  }: {
    indexName: string;
    searchIndexName?: string;
    timeoutMs?: number;
    checkIntervalMs?: number;
  }): Promise<void> {
    const { collectionName } = await this.resolveIndexTarget(indexName);
    const textIndex = searchIndexName ?? (await this.resolveTextSearchIndexName(indexName));
    const collection = await this.getCollection(collectionName, true);

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const indexInfo: any[] = await (collection as any).listSearchIndexes().toArray();
      const indexData = indexInfo.find((idx: any) => idx.name === textIndex);
      if (indexData?.status === 'READY') {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }
    throw new Error(`Full-text search index "${textIndex}" did not become ready within timeout`);
  }

  /**
   * Inserts or updates vectors in the specified index.
   *
   * @param indexName - Name of the index (MongoDB collection) to write into.
   * @param vectors - Array of embedding vectors. Each must have the same
   *   dimension as declared when the index was created.
   * @param metadata - Optional array of metadata objects, one per vector,
   *   stored in a nested `metadata` field alongside the embedding.
   * @param ids - Optional string IDs for each vector, used as the MongoDB
   *   document `_id`. Auto-generated UUIDs are used when omitted.
   * @param documents - Optional text strings associated with each vector,
   *   stored in a `document` field.
   * @returns The IDs of the upserted vectors in input order.
   */
  async upsert({ indexName, vectors, metadata, ids, documents }: MongoDBUpsertVectorParams): Promise<string[]> {
    // Validate input parameters
    validateUpsertInput('MONGODB', vectors, metadata, ids);
    validateVectorValues('MONGODB', vectors);

    // Outside the try: these USER errors must not be re-wrapped as THIRD_PARTY.
    await this.assertWritable(indexName, 'UPSERT');
    // Circular metadata makes bson's calculateObjectSize spin forever inside bulkWrite;
    // fail fast with a clear error instead of hanging the process.
    if (metadata) this.assertNoCircularReferences(metadata, 'UPSERT');

    try {
      const { collectionName } = await this.resolveIndexTarget(indexName);
      const collection = await this.getCollection(collectionName);

      // Get index stats to check dimension
      const stats = await this.describeIndex({ indexName });

      // Validate vector dimensions
      await this.validateVectorDimensions(vectors, stats.dimension);

      // Generate IDs if not provided
      const generatedIds = ids || vectors.map(() => uuidv4());

      const operations = vectors.map((vector, idx) => {
        const id = generatedIds[idx];
        const meta = metadata?.[idx] || {};
        const doc = documents?.[idx];

        // Normalize metadata - convert Date objects to ISO strings
        const normalizedMeta = Object.keys(meta).reduce(
          (acc, key) => {
            acc[key] = meta[key] instanceof Date ? meta[key].toISOString() : meta[key];
            return acc;
          },
          {} as Record<string, any>,
        );

        const updateDoc: Partial<MongoDBDocument> = {
          [this.embeddingFieldName]: vector,
          [this.metadataFieldName]: normalizedMeta,
        };
        if (doc !== undefined) {
          updateDoc[this.documentFieldName] = doc;
        }

        return {
          updateOne: {
            filter: { _id: id }, // '_id' is a string as per MongoDBDocument interface
            update: { $set: updateDoc },
            upsert: true,
          },
        };
      });

      await collection.bulkWrite(operations);

      return generatedIds;
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }
  /**
   * Runs an approximate nearest-neighbor search against the specified index.
   *
   * @param indexName - Name of the index (MongoDB collection) to search.
   * @param queryVector - The query embedding. Must match the index dimension.
   * @param topK - Maximum number of results to return (default: 10).
   * @param filter - Optional metadata filter. Fields are matched against the
   *   nested `metadata` subdocument; no `metadata.` prefix is needed.
   * @param includeVector - When true, each result includes the stored embedding
   *   in a `vector` field (default: false).
   * @param documentFilter - Optional filter applied to the `document` text
   *   field, independent of `filter`.
   * @param numCandidates - HNSW candidate pool size. Higher values improve
   *   recall at the cost of latency. Defaults to 20 * topK, capped at 10000.
   * @returns Array of results ordered by descending similarity score.
   */
  async query({
    indexName,
    queryVector,
    topK = 10,
    filter,
    includeVector = false,
    documentFilter,
    numCandidates,
    metadataMode = 'field',
  }: MongoDBQueryVectorParams): Promise<QueryResult[]> {
    if (!queryVector) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector is required for MongoDB queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      const { collectionName, searchIndexName } = await this.resolveIndexTarget(indexName);
      const collection = await this.getCollection(collectionName, true);
      const indexNameInternal = searchIndexName;

      // Metadata filter: translate, then (field mode only) add the 'metadata.' prefix to
      // user-facing field names. In document mode (BYO), fields are matched at the root. (FIX 7)
      const metadataFilter = this.transformMetadataFilter(this.transformFilter(filter), metadataMode);
      const hasMetadataFilter = Object.keys(metadataFilter).length > 0;

      const vectorSearch: Document = {
        index: indexNameInternal,
        queryVector: queryVector,
        path: this.embeddingFieldName,
        numCandidates: Math.min(10000, Math.max(topK, numCandidates ?? topK * 20)),
        limit: Math.min(10000, topK),
      };

      if (hasMetadataFilter) {
        // Fast path: if every field the filter touches was declared via
        // `filterFields` at index creation, and every operator is one Atlas
        // Vector Search accepts inside `filter`, pass the metadata filter
        // straight to $vectorSearch — no $match, no _id materialisation, no
        // 16 MB BSON ceiling. See https://github.com/mastra-ai/mastra/issues/18587
        let declaredPaths: Set<string>;
        try {
          declaredPaths = await this.getDeclaredFilterPaths(indexName);
        } catch {
          // If the declaration can't be read, assume nothing is declared and
          // use the always-correct pre-filter below.
          declaredPaths = new Set();
        }

        if (this.canPushDownFilter(metadataFilter, declaredPaths)) {
          vectorSearch.filter = documentFilter
            ? { $and: [metadataFilter, { [this.documentFieldName]: documentFilter }] }
            : metadataFilter;
        } else {
          // Fallback: metadata fields are not (all) declared as filter fields, or
          // the filter uses an operator $vectorSearch doesn't support. Materialise
          // matching _ids via $match first, then filter by _id inside $vectorSearch.
          const candidateIds = await collection
            .aggregate([{ $match: metadataFilter }, { $project: { _id: 1 } }])
            .map(doc => doc._id)
            .toArray();

          if (candidateIds.length === 0) return [];

          // 'document' is a declared filter field — combine directly when present.
          vectorSearch.filter = documentFilter
            ? { $and: [{ _id: { $in: candidateIds } }, { [this.documentFieldName]: documentFilter }] }
            : { _id: { $in: candidateIds } };
        }
      } else if (documentFilter) {
        // 'document' is a declared filter field in the index — pass directly,
        // no candidate materialisation needed.
        vectorSearch.filter = { [this.documentFieldName]: documentFilter };
      }

      // Build the aggregation pipeline. Score is projected via $meta inside buildProjection
      // (not a preceding $set) so it never pollutes `metadata: '$$ROOT'` in document mode.
      const pipeline = [
        {
          $vectorSearch: vectorSearch,
        },
        ...this.buildProjection(metadataMode, includeVector, 'vectorSearchScore'),
      ];

      const results = await collection.aggregate(pipeline).toArray();

      return results.map((result: any) => ({
        id: this.idToString(result._id),
        score: result.score,
        metadata: result.metadata,
        vector: includeVector ? result.vector : undefined,
        document: result.document,
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }

  /**
   * Lists LOGICAL Mastra index names, not physical collection names.
   *
   * Returns the union of:
   *   (a) every logical index registered in the durable registry collection (covers BYO
   *       indexes, whose physical collection name differs from the index name), and
   *   (b) managed collections that carry a `${name}_vector_index` Atlas Search index but have
   *       no registry entry — back-compat for managed indexes created before the registry.
   *
   * The registry collection itself and raw BYO operational collections (which appear under
   * their physical names, not their logical index names) are never listed. Returning the
   * logical name is what makes a listIndexes → deleteIndex round-trip classify BYO correctly.
   */
  async listIndexes(): Promise<string[]> {
    try {
      const names = new Set<string>();

      // (a) Registered logical index names (includes BYO). One read serves both purposes:
      // the logical names to return, and the physical collection names of registered
      // (esp. BYO) indexes so step (b) does not re-list them under their physical name.
      const registry = this.db.collection<RegistryDoc>(MongoDBVector.REGISTRY_COLLECTION);
      const registered = await registry.find({}, { projection: { _id: 1, collectionName: 1 } }).toArray();
      const registeredCollections = new Set<string>();
      for (const doc of registered) {
        names.add(doc._id);
        if (doc.collectionName) registeredCollections.add(doc.collectionName);
      }

      // (b) Back-compat: managed collections with a `${name}_vector_index` search index that
      // predate the registry. Skip the registry collection and any already-registered
      // physical collection.
      const collections = await this.db.listCollections().toArray();
      for (const col of collections) {
        const name = col.name;
        if (name === MongoDBVector.REGISTRY_COLLECTION) continue;
        if (names.has(name) || registeredCollections.has(name)) continue;
        try {
          const searchIndexes: any[] = await (this.db.collection(name) as any).listSearchIndexes().toArray();
          if (searchIndexes.some((idx: any) => idx.name === `${name}_vector_index`)) {
            names.add(name);
          }
        } catch {
          // Collection has no search-index support / transient error — skip it.
        }
      }

      return [...names];
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'LIST_INDEXES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Retrieves statistics about a vector index.
   *
   * @param {string} indexName - The name of the index to describe
   * @returns A promise that resolves to the index statistics including dimension, count and metric
   */
  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    try {
      const { collectionName, searchIndexName } = await this.resolveIndexTarget(indexName);
      const collection = await this.getCollection(collectionName, true);

      // Count only documents that actually carry the embedding field (respecting a dot-path
      // embeddingFieldName). On a BYO operational collection this excludes documents that have
      // not been embedded, and it also excludes the legacy `__index_metadata__` sentinel. (FIX 8)
      const count = await collection.countDocuments({
        [this.embeddingFieldName]: { $exists: true },
        _id: { $ne: '__index_metadata__' as any },
      });

      const indexNameInternal = searchIndexName;
      const indexInfo: any[] = await (collection as any).listSearchIndexes().toArray();
      const indexData = indexInfo.find((idx: any) => idx.name === indexNameInternal);

      if (!indexData) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'DESCRIBE_INDEX', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: `Atlas Search index "${indexNameInternal}" does not exist on collection "${indexName}". The collection may predate Mastra or the index may have been dropped externally.`,
        });
      }

      const vectorField = indexData.latestDefinition?.fields?.find((f: any) => f.type === 'vector');
      if (!vectorField) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'DESCRIBE_INDEX', 'INVALID'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: `Atlas Search index "${indexNameInternal}" exists but has no vector field. The index may have been created outside of Mastra or without vector configuration.`,
        });
      }
      const dimension = vectorField.numDimensions;
      const reverseMetricMap: Record<string, 'cosine' | 'euclidean' | 'dotproduct'> = {
        cosine: 'cosine',
        euclidean: 'euclidean',
        dotProduct: 'dotproduct',
      };
      const metric = reverseMetricMap[vectorField.similarity] ?? 'cosine';

      return { dimension, count, metric };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'DESCRIBE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    // `isByo` is read from the registry (captured at createIndex time), NOT inferred from
    // names: a BYO index may reuse its indexName as the collectionName, so name equality
    // cannot distinguish managed from BYO. Managed indexes drop the collection; BYO indexes
    // drop only the search index so the caller's operational collection/data is preserved.
    const { collectionName, searchIndexName, isByo, textSearchIndexName } = await this.resolveIndexTarget(indexName);
    const collection = await this.getCollection(collectionName, false);
    try {
      if (collection) {
        if (isByo) {
          // BYO: drop the vector search index, and the companion full-text index if one was
          // provisioned (via createSearchIndex — it is not auto-created for BYO). Dropping only
          // the vector index would leak the persisted text index onto the caller's operational
          // collection with no record of it. Retry-safe (FIX 4): treat "index not found" on
          // EITHER drop as success — if a prior deleteIndex already removed the physical index
          // and then failed before clearing the registry, a retry must still clear the entry.
          await this.dropSearchIndexIgnoringMissing(collection, searchIndexName);
          if (textSearchIndexName) {
            await this.dropSearchIndexIgnoringMissing(collection, textSearchIndexName);
          }
        } else {
          // Retry-safe (FIX 4): a managed collection already dropped by a prior (partially
          // failed) deleteIndex must not block the retry from clearing the registry entry.
          try {
            await collection.drop();
          } catch (err: any) {
            const code = err?.codeName ?? err?.code;
            if (code !== 'NamespaceNotFound' && code !== 26) throw err;
          }
          this.collections.delete(collectionName);
        }
        this.declaredFilterPaths.delete(indexName);
        this.indexTargets.delete(indexName);
        // Remove the durable registry entry LAST so a fresh process no longer resolves this
        // index. Because the physical drop above is idempotent, a retry after an interrupted
        // delete still reaches this line and stops the stranded entry from being listed.
        await this.deleteRegistryEntry(indexName);
      } else {
        throw new Error(`Index (Collection) "${indexName}" does not exist`);
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'DELETE_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
          },
        },
        error,
      );
    }
  }

  /**
   * Updates a vector by its ID with the provided vector and/or metadata.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to update.
   * @param update - An object containing the vector and/or metadata to update.
   * @param update.vector - An optional array of numbers representing the new vector.
   * @param update.metadata - An optional record containing the new metadata.
   * @returns A promise that resolves when the update is complete.
   * @throws Will throw an error if no updates are provided or if the update operation fails.
   */
  async updateVector(params: UpdateVectorParams<MongoDBVectorFilter>): Promise<void> {
    const { indexName, update } = params;

    // Validate that both id and filter are not provided at the same time
    if ('id' in params && params.id && 'filter' in params && params.filter) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'UPDATE_VECTOR', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: 'id and filter are mutually exclusive - provide only one',
      });
    }

    // Check if neither id nor filter is provided
    if (!('id' in params || 'filter' in params) || (!params.id && !params.filter)) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'UPDATE_VECTOR', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Either id or filter must be provided',
        details: { indexName },
      });
    }

    await this.assertWritable(indexName, 'UPDATE_VECTOR');
    if (update.metadata) this.assertNoCircularReferences(update.metadata, 'UPDATE_VECTOR');

    try {
      if (!update.vector && !update.metadata) {
        throw new Error('No updates provided');
      }

      const { collectionName } = await this.resolveIndexTarget(indexName);
      const collection = await this.getCollection(collectionName, true);
      const updateDoc: Record<string, any> = {};

      if (update.vector) {
        const stats = await this.describeIndex({ indexName });
        await this.validateVectorDimensions([update.vector], stats.dimension);
        updateDoc[this.embeddingFieldName] = update.vector;
      }

      if (update.metadata) {
        // Normalize metadata in updates too
        const normalizedMeta = Object.keys(update.metadata).reduce(
          (acc, key) => {
            acc[key] =
              update.metadata![key] instanceof Date ? update.metadata![key].toISOString() : update.metadata![key];
            return acc;
          },
          {} as Record<string, any>,
        );

        updateDoc[this.metadataFieldName] = normalizedMeta;
      }

      // Type narrowing: check if updating by id or by filter
      if ('id' in params && params.id) {
        // Update by ID. Match both the raw string and (when valid) the ObjectId form so this
        // works on managed (string _id) and BYO (ObjectId _id) collections alike.
        await collection.findOneAndUpdate({ _id: this.buildIdMatch(params.id) as any }, { $set: updateDoc });
      } else if ('filter' in params && params.filter) {
        // Update by filter
        const filter = params.filter;

        if (!filter || Object.keys(filter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'UPDATE_VECTOR', 'EMPTY_FILTER'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
            text: 'Cannot update with empty filter',
          });
        }

        const mongoFilter = this.transformFilter(filter);
        const transformedFilter = this.transformMetadataFilter(mongoFilter);

        if (!transformedFilter || Object.keys(transformedFilter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'UPDATE_VECTOR', 'INVALID_FILTER'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
            text: 'Filter produced empty query',
          });
        }

        // Update multiple documents matching the filter
        await collection.updateMany(transformedFilter, { $set: updateDoc });
      }
    } catch (error: any) {
      // If it's already a MastraError, rethrow it
      if (error instanceof MastraError) {
        throw error;
      }

      const errorDetails: Record<string, any> = { indexName };

      if ('id' in params && params.id) {
        errorDetails.id = params.id;
      }

      if ('filter' in params && params.filter) {
        errorDetails.filter = JSON.stringify(params.filter);
      }

      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'UPDATE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: errorDetails,
        },
        error,
      );
    }
  }

  /**
   * Deletes a vector by its ID.
   * @param indexName - The name of the index containing the vector.
   * @param id - The ID of the vector to delete.
   * @returns A promise that resolves when the deletion is complete.
   * @throws Will throw an error if the deletion operation fails.
   */
  async deleteVector({ indexName, id }: DeleteVectorParams): Promise<void> {
    // Outside the try: the read-only USER error must not be re-wrapped as THIRD_PARTY.
    await this.assertWritable(indexName, 'DELETE_VECTOR');
    try {
      const { collectionName } = await this.resolveIndexTarget(indexName);
      const collection = await this.getCollection(collectionName, true);
      // Match both string and ObjectId _id forms (managed vs BYO collections).
      await collection.deleteOne({ _id: this.buildIdMatch(id) as any });
    } catch (error: any) {
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'DELETE_VECTOR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            indexName,
            id,
          },
        },
        error,
      );
    }
  }

  async deleteVectors({ indexName, filter, ids }: DeleteVectorsParams<MongoDBVectorFilter>): Promise<void> {
    // Validate that exactly one of filter or ids is provided
    if (!filter && !ids) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'NO_TARGET'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: 'Either filter or ids must be provided',
      });
    }

    if (filter && ids) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'MUTUALLY_EXCLUSIVE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: 'Cannot provide both filter and ids - they are mutually exclusive',
      });
    }

    await this.assertWritable(indexName, 'DELETE_VECTORS');

    try {
      const { collectionName } = await this.resolveIndexTarget(indexName);
      const collection = await this.getCollection(collectionName, true);

      if (ids) {
        // Delete by IDs
        if (ids.length === 0) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'EMPTY_IDS'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
            text: 'Cannot delete with empty ids array',
          });
        }

        // Include both string and ObjectId forms so managed (string _id) and BYO (ObjectId _id)
        // collections are both matched.
        const idMatches: any[] = [];
        for (const id of ids) {
          idMatches.push(id);
          if (typeof id === 'string' && ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)) {
            idMatches.push(new ObjectId(id));
          }
        }
        await collection.deleteMany({ _id: { $in: idMatches } });
      } else {
        // Delete by filter
        // Safety check: Don't allow empty filters to prevent accidental deletion of all vectors
        if (!filter || Object.keys(filter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'EMPTY_FILTER'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
            text: 'Cannot delete with empty filter',
          });
        }

        const mongoFilter = this.transformFilter(filter);
        const transformedFilter = this.transformMetadataFilter(mongoFilter);

        if (!transformedFilter || Object.keys(transformedFilter).length === 0) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'INVALID_FILTER'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
            text: 'Filter produced empty query',
          });
        }

        await collection.deleteMany(transformedFilter);
      }
    } catch (error) {
      // If it's already a MastraError, rethrow it
      if (error instanceof MastraError) {
        throw error;
      }

      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'DELETE_VECTORS', 'FAILED'),
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

  /**
   * Returns the MongoDB Collection that backs the given Mastra index.
   *
   * **Index vs. collection:** In this driver, each Mastra index is stored as a
   * MongoDB collection whose name equals the index name. The Atlas Vector Search
   * index (named `${indexName}_vector_index`) lives on that collection. The two
   * terms are distinct: "index" is the Mastra concept; "collection" is the
   * MongoDB storage primitive that implements it.
   *
   * **Caching:** Collection handles are cached on first successful lookup to
   * avoid redundant `listCollections` round-trips. Only handles for collections
   * that actually exist are cached; a handle for a missing collection is returned
   * without being cached so the next call re-checks existence rather than
   * returning a stale phantom.
   *
   * @param indexName - Mastra index name, which is also the MongoDB collection name.
   * @param throwIfNotExists - When `true` (default), throws if no MongoDB
   *   collection exists for this index name. Pass `false` when absence is not an
   *   error (e.g., inside `deleteIndex`).
   */
  private async getCollection(
    indexName: string,
    throwIfNotExists: boolean = true,
  ): Promise<Collection<MongoDBDocument>> {
    if (this.collections.has(indexName)) {
      return this.collections.get(indexName)!;
    }

    const collection = this.db.collection<MongoDBDocument>(indexName);

    const collectionExists = await this.db.listCollections({ name: indexName }).hasNext();
    if (!collectionExists && throwIfNotExists) {
      throw new Error(
        `Mastra index "${indexName}" has no backing MongoDB collection. ` +
          `Call createIndex first, or verify the collection was not dropped externally.`,
      );
    }

    if (collectionExists) {
      this.collections.set(indexName, collection);
    }
    return collection;
  }

  private async validateVectorDimensions(vectors: number[][], dimension: number): Promise<void> {
    if (vectors.length === 0) {
      throw new Error('No vectors provided for validation');
    }

    if (dimension === 0) {
      dimension = vectors[0] ? vectors[0].length : 0;
    }

    for (let i = 0; i < vectors.length; i++) {
      let v = vectors[i]?.length;
      if (v !== dimension) {
        throw new Error(`Vector at index ${i} has invalid dimension ${v}. Expected ${dimension} dimensions.`);
      }
    }
  }

  /**
   * Maps user-facing `filterFields` (bare metadata field names) to the fully
   * qualified filter paths stored in the index, e.g. `category` → `metadata.category`.
   * Blank entries are dropped and duplicates collapsed. A name already carrying the
   * `metadata.` prefix is left untouched so callers can pass either form.
   */
  private buildDeclaredMetadataPaths(filterFields?: string[]): string[] {
    if (!filterFields?.length) return [];
    const paths = new Set<string>();
    for (const field of filterFields) {
      const trimmed = field?.trim();
      if (!trimmed) continue;
      paths.add(trimmed.startsWith(`${this.metadataFieldName}.`) ? trimmed : `${this.metadataFieldName}.${trimmed}`);
    }
    return [...paths];
  }

  /**
   * Returns the set of filter paths declared in the vectorSearch index (e.g.
   * `document`, `metadata.category`), excluding `_id`. Reads the live index
   * definition once per index and caches the result. Used to decide whether a
   * metadata filter can be pushed down into `$vectorSearch.filter`.
   */
  private async getDeclaredFilterPaths(indexName: string): Promise<Set<string>> {
    const cached = this.declaredFilterPaths.get(indexName);
    if (cached) return cached;

    const { collectionName, searchIndexName } = await this.resolveIndexTarget(indexName);
    const collection = await this.getCollection(collectionName, true);
    const indexNameInternal = searchIndexName;
    const indexInfo: any[] = await (collection as any).listSearchIndexes().toArray();
    const indexData = indexInfo.find((idx: any) => idx.name === indexNameInternal);

    const paths = new Set<string>();

    // `latestDefinition` is the most recently *requested* definition, not
    // necessarily the one serving queries: while an index update is building,
    // Atlas keeps answering queries with the previous definition. Trusting a
    // staged definition could push a filter down onto an active index that
    // does not support it yet, so the definition is only read — and cached —
    // once the index reports READY. Until then (missing, PENDING, BUILDING,
    // or a transient read miss) return the empty set uncached: queries take
    // the always-correct pre-filter fallback and a later call re-reads the
    // definition instead of pushdown being permanently disabled.
    if (indexData?.status !== 'READY') {
      return paths;
    }

    for (const field of indexData.latestDefinition?.fields ?? []) {
      if (field?.type === 'filter' && typeof field.path === 'string' && field.path !== '_id') {
        paths.add(field.path);
      }
    }

    this.declaredFilterPaths.set(indexName, paths);
    return paths;
  }

  /**
   * True when `filter` can be passed directly to `$vectorSearch.filter`: every
   * field path it references is a declared filter field and every operator is in
   * {@link MongoDBVector.PUSHDOWN_OPERATORS}. Conservative by design — anything it
   * can't prove safe returns false so the caller uses the `$match` pre-filter.
   */
  private canPushDownFilter(filter: any, declaredPaths: Set<string>): boolean {
    if (filter === null || typeof filter !== 'object') return true;
    if (Array.isArray(filter)) return filter.every(item => this.canPushDownFilter(item, declaredPaths));

    for (const [key, value] of Object.entries(filter)) {
      if (key.startsWith('$')) {
        if (!MongoDBVector.PUSHDOWN_OPERATORS.has(key)) return false;
      } else if (!declaredPaths.has(key)) {
        return false;
      }
      if (!this.canPushDownFilter(value, declaredPaths)) return false;
    }
    return true;
  }

  /**
   * Coerce a MongoDB `_id` (string for managed collections, ObjectId for many bring-your-own
   * operational collections) to the string contract of `QueryResult.id`.
   */
  private idToString(id: any): string {
    return id?.toString?.() ?? String(id);
  }

  /**
   * Build an `_id` match that works for both string-keyed (managed) and ObjectId-keyed (BYO)
   * collections. Managed collections store string `_id`s; BYO operational collections commonly
   * use native ObjectId `_id`s. The incoming `id` is always a string (the QueryResult contract),
   * so match it as-is AND, when it is a valid 24-hex ObjectId, also as `new ObjectId(id)`.
   *
   * Known (accepted) ambiguity: if a collection contains BOTH the string form and the ObjectId
   * form of the same 24-hex id, a single-doc operation (`deleteOne`/`findOneAndUpdate`) matches
   * whichever the server finds first. `_id` values are unique per BSON type but not across
   * types; in practice a collection keys on one type, so this dual-form collision does not
   * occur outside deliberately mixed test data.
   */
  private buildIdMatch(id: string): any {
    if (typeof id === 'string' && ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id)) {
      return { $in: [id, new ObjectId(id)] };
    }
    return id;
  }

  private transformFilter(filter?: MongoDBVectorFilter) {
    const translator = new MongoDBFilterTranslator();
    if (!filter) return {};
    return translator.translate(filter);
  }

  /**
   * Transform metadata field filters to use MongoDB dot notation.
   * Fields that are stored in the metadata subdocument need to be prefixed with 'metadata.'
   * This handles filters from the Memory system which expects direct field access.
   *
   * @param filter - The filter object to transform
   * @returns Transformed filter with metadata fields properly prefixed
   */
  private transformMetadataFilter(filter: any, metadataMode: 'field' | 'document' = 'field'): any {
    if (!filter || typeof filter !== 'object') return filter;

    // Handle arrays (shouldn't happen at top level, but be defensive)
    if (Array.isArray(filter)) {
      return filter.map(item => this.transformMetadataFilter(item, metadataMode));
    }

    // Document mode (BYO): the source document's operational fields live at the ROOT (e.g.
    // `amount`, `lane`), not under a managed `metadata` subdocument, so bare fields must NOT be
    // rewritten to `metadata.<field>` — that would never match. An explicit `metadata.` prefix
    // from the caller is still respected. Only field (managed) mode does the prefixing. (FIX 7)
    if (metadataMode === 'document') {
      const transformed: any = {};
      for (const [key, value] of Object.entries(filter)) {
        if (key.startsWith('$')) {
          if (Array.isArray(value)) {
            transformed[key] = value.map(item => this.transformMetadataFilter(item, metadataMode));
          } else if (typeof value === 'object' && value !== null) {
            transformed[key] = this.transformMetadataFilter(value, metadataMode);
          } else {
            transformed[key] = value;
          }
        } else {
          transformed[key] = value;
        }
      }
      return transformed;
    }

    const transformed: any = {};

    for (const [key, value] of Object.entries(filter)) {
      // Check if this is a MongoDB operator (starts with $)
      if (key.startsWith('$')) {
        // For logical operators like $and, $or, recursively transform their contents
        if (Array.isArray(value)) {
          transformed[key] = value.map(item => this.transformMetadataFilter(item, metadataMode));
        } else if (typeof value === 'object' && value !== null) {
          transformed[key] = this.transformMetadataFilter(value, metadataMode);
        } else {
          transformed[key] = value;
        }
      }
      // Check if the key already has 'metadata.' prefix
      else if (key.startsWith('metadata.')) {
        // Already prefixed — keep as-is.
        transformed[key] = value;
      }
      // Check if this is a known metadata field that needs prefixing
      else if (this.isMetadataField(key)) {
        // Add metadata. prefix for fields stored in metadata subdocument
        // If the value is an object with operators, keep the operators as-is
        transformed[`metadata.${key}`] = value;
      } else {
        // Keep other fields as is
        transformed[key] = value;
      }
    }

    return transformed;
  }

  /**
   * Determine if a field should be treated as a metadata field.
   * Common metadata fields include thread_id, resource_id, message_id, and any field
   * that doesn't start with underscore (MongoDB system fields).
   */
  private isMetadataField(key: string): boolean {
    // MongoDB system fields start with underscore
    if (key.startsWith('_')) return false;

    // Document-level fields that are NOT in metadata
    const documentFields = ['_id', this.embeddingFieldName, this.documentFieldName];
    if (documentFields.includes(key)) return false;

    // Everything else is assumed to be in metadata
    // This includes thread_id, resource_id, message_id, and any custom fields
    return true;
  }
}
