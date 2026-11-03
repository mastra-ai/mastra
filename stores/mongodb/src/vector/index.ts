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
import type { MongoDBFieldCondition, MongoDBVectorFilter } from './filter';

// Define necessary types and interfaces
export interface MongoDBUpsertVectorParams extends Omit<UpsertVectorParams, 'vectors'> {
  /**
   * Precomputed embeddings. Required unless the index was created with `autoEmbed`, where
   * MongoDB generates them from `documents` and passing vectors is an error.
   */
  vectors?: number[][];
  documents?: string[];
}

export interface MongoDBQueryVectorParams extends QueryVectorParams<MongoDBVectorFilter> {
  /**
   * Text for MongoDB to embed server-side at query time. autoEmbed indexes only, and
   * mutually exclusive with `queryVector`. For BM25 matching see
   * {@link MongoDBVector.textQuery}.
   */
  queryText?: string;
  /**
   * Embedding model for this query, overriding the index's. Requires `queryText`, and must
   * be compatible with the index's model.
   */
  model?: string;
  /**
   * Condition applied to the `document` text field, independent of `filter`.
   * For example `{ $regex: /astronaut/ }`.
   */
  documentFilter?: MongoDBFieldCondition;
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

/** Flat options for {@link MongoDBVector.hybridQuery}, sharing one limit across both branches. */
export interface MongoDBHybridQueryParams {
  indexName: string;
  /** Query embedding for the vector branch. Supply this or `queryText`, not both. */
  queryVector?: number[];
  /**
   * Text for MongoDB to embed server-side for the vector branch. autoEmbed indexes only.
   * Independent of `query`, so the two branches can search for different things.
   */
  queryText?: string;
  /**
   * Embedding model for the vector branch, overriding the index's. Requires `queryText`
   * and must be compatible with the index's model.
   */
  model?: string;
  /** Full-text (BM25) term for the text branch. */
  query: string;
  paths: string[];
  topK?: number;
  filter?: MongoDBVectorFilter;
  weights?: { vector?: number; text?: number };
  numCandidates?: number;
  metadataMode?: 'field' | 'document';
  /** Override the resolved full-text search index name for this call. */
  textSearchIndexName?: string;
}

/**
 * Per-branch retrieval and optional native reranking options for {@link MongoDBVector.hybridQuery}.
 *
 * The result shape follows the collection: managed indexes return the managed `metadata` and
 * `document` fields; bring-your-own (BYO) indexes return the source document as `metadata`,
 * without its embedding.
 */
export interface MongoDBHybridQueryBranchParams {
  /** Logical Mastra index, resolving the collection and its registered search indexes. */
  indexName: string;
  /** Final result limit, applied after fusion and optional reranking. Integer from 1 to 10000; defaults to 10. */
  topK?: number;
  /**
   * Filter applied to both retrieval branches before fusion. On managed indexes, bare keys
   * target the managed `metadata` fields; on BYO indexes, they target source document fields.
   */
  filter?: MongoDBVectorFilter;
  /** Non-negative, finite fusion weights. Each omitted weight defaults to 1; at least one must be positive. */
  weights?: { vector?: number; text?: number };
  /**
   * Return each result's stored embedding as `vector`. Defaults to false. Not supported on
   * autoEmbed indexes, whose generated embeddings are not stored on the documents.
   */
  includeVector?: boolean;
  /** Vector retrieval using either an embedding you generate or text for an autoEmbed index. */
  vector: (
    | {
        /**
         * Embedding that you generate. Mutually exclusive with query and model. Not supported on
         * autoEmbed indexes, which only accept query text; passing it there throws a USER error.
         */
        queryVector: number[];
        query?: never;
        model?: never;
      }
    | {
        /** Non-empty text for MongoDB to embed. Requires an autoEmbed index. */
        query: string;
        queryVector?: never;
        /** Query embedding model override, independent of the reranking model. */
        model?: string;
      }
  ) & {
    /**
     * Candidates considered by vector search, from 1 to 10000. Defaults to min(10000, 20 * limit),
     * following MongoDB's recommendation of at least 20 times the vector limit.
     * An explicit value is sent to MongoDB unchanged, which rejects one below the vector limit.
     */
    numCandidates?: number;
    /** Vector results contributed to fusion, from 1 to 10000. Defaults to min(10000, max(4 * topK, 20)). */
    limit?: number;
    /**
     * Bring-your-own collections only: search this existing vector index instead of the registered
     * one. Filters with this option always use the `_id` pre-filter, so the index must declare `_id`
     * as a filter field. Rejected on managed
     * indexes, which use their registered indexes.
     */
    searchIndexName?: string;
  };
  /** Full-text (BM25) retrieval, configured independently of vector retrieval. */
  text: {
    /** Non-empty full-text query. */
    query: string;
    /** Non-empty array of indexed field paths to search, relative to the document root (e.g. `metadata.text`). */
    paths: string[];
    /**
     * Bring-your-own collections only: search this existing full-text index instead of the
     * registered one. Rejected on managed indexes, which use their registered indexes.
     */
    searchIndexName?: string;
    /** Text results contributed to fusion, from 1 to 10000. Defaults to min(10000, max(4 * topK, 20)). */
    limit?: number;
  };
  /** Enable native $rerank after fusion. Omit to return fused results without reranking. */
  rerank?: {
    /** Non-empty query used to judge relevance, independent of both retrieval queries. */
    query: string;
    /** Non-empty array of field paths, relative to the document root. Missing document fields cause a server error. */
    paths: string[];
    /** Native reranking model. Defaults to 'rerank-2.5'; never changes the embedding model. */
    model?: string;
    /** Maximum fused documents to rerank and return before topK. Required integer from 1 to 1000. */
    numDocsToRerank: number;
  };
}

/**
 * Automated Embedding configuration. MongoDB embeds the text at `path` when documents are
 * written, and embeds a `queryText` string at query time, using the same model.
 *
 * @see https://www.mongodb.com/docs/vector-search/crud-embeddings/automated-embedding/
 */
export interface MongoDBAutoEmbedConfig {
  /**
   * Voyage AI model to embed with, for example `voyage-4`. MongoDB rejects a name it does
   * not support and lists the ones it does.
   *
   * @see https://www.mongodb.com/docs/vector-search/crud-embeddings/automated-embedding/models/
   */
  model: string;
  /**
   * Text field to embed. Defaults to the managed `document` field that `upsert({ documents })`
   * writes. Point it at a field of your own to index an existing collection in place.
   */
  path?: string;
  /** Vector similarity function. Defaults to MongoDB's own default when omitted. */
  similarity?: 'cosine' | 'dotProduct' | 'euclidean' | (string & {});
  /** Embedding length. Defaults to 1024 when omitted. */
  numDimensions?: 256 | 512 | 1024 | 2048 | (number & {});
  /** Storage format for the generated vectors. Defaults to `scalar` when omitted. */
  quantization?: 'float' | 'scalar' | 'binary' | 'binaryNoRescore' | (string & {});
  /** Index structure. Defaults to `hnsw` when omitted. */
  indexingMethod?: 'hnsw' | 'flat' | (string & {});
  /** HNSW graph tuning. */
  hnswOptions?: { maxEdges?: number; numEdgeCandidates?: number };
  /**
   * Any other field the `autoEmbed` index definition accepts, forwarded to MongoDB as given.
   *
   * @see https://www.mongodb.com/docs/vector-search/indexes/vector-search-type/
   */
  [option: string]: unknown;
}

export interface MongoDBCreateIndexParams extends Omit<CreateIndexParams, 'dimension'> {
  /**
   * Number of dimensions for client-side embeddings. Required unless `autoEmbed` is set,
   * in which case the embedding model determines the size and passing both is an error.
   */
  dimension?: number;
  /**
   * Enable Automated Embedding: MongoDB embeds the text at `autoEmbed.path` server-side
   * rather than accepting precomputed vectors. Mutually exclusive with `dimension`.
   */
  autoEmbed?: MongoDBAutoEmbedConfig;
  /**
   * Metadata field names to declare as filter fields in the Atlas vectorSearch
   * index (registered as `metadata.<field>`). Queries whose metadata filter
   * only touches declared fields — using operators `$vectorSearch.filter`
   * supports — are passed directly to `$vectorSearch` instead of pre-filtering
   * candidate `_id`s, avoiding the 16 MB BSON limit on large result sets.
   * Filters that reference an undeclared field, or use an unsupported
   * operator, automatically fall back to the pre-filter, which fails once it
   * matches more than 100,000 documents.
   *
   * With `collectionName` (bring-your-own), names are declared as root paths
   * as given (e.g. `lane`), matching `metadataMode: 'document'` filters.
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
   *
   * @deprecated Keep bring-your-own collections read-only: write embeddings from your
   * application or use `autoEmbed`. To be removed in the next major version.
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
  /**
   * Automated Embedding defaults for indexes this store creates. Setting it marks the store as
   * one that embeds server-side, so callers such as `Memory`'s semantic recall send text and
   * MongoDB produces the vectors. A `createIndex` call that names its own `autoEmbed` or its
   * own `dimension` takes precedence.
   */
  autoEmbed?: MongoDBAutoEmbedConfig;
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
  /** Automated Embedding config for this index, with `path` resolved to a concrete field. */
  autoEmbed?: MongoDBAutoEmbedConfig & { path: string };
  /**
   * Ownership of the physical resources, recorded only when this store created them.
   * deleteIndex drops only what is owned. A missing flag (entries written before ownership
   * was recorded) means unknown, and unknown search indexes are kept. A managed entry
   * without `ownsCollection` keeps the legacy behavior of dropping its collection.
   */
  ownsVectorIndex?: boolean;
  ownsTextIndex?: boolean;
  ownsCollection?: boolean;
}

/** The driver types listSearchIndexes() rows as `{ name }`; these are the fields this store reads. */
type SearchIndexInfo = { name: string; status?: string; latestDefinition?: Document };

/** Shape of a registry document persisted in {@link MongoDBVector.REGISTRY_COLLECTION}. */
interface RegistryDoc extends IndexTarget {
  _id: string;
  indexName: string;
  dimension?: number;
  metric?: string;
  /** Random id of the call that last wrote the entry, so a failed call rolls back only its own write. */
  claimToken?: string;
}

/** Name an index's embedding mode for a conflict message. */
function describeEmbedding(config?: { path: string; model: string } | null): string {
  return config ? `autoEmbed (path "${config.path}", model "${config.model}")` : 'client-side vectors';
}

/**
 * Whether Atlas refused a `$vectorSearch` because the index is still in its initial sync. The
 * server reports it as a generic `UnknownError`, so the state named in the message is the only
 * thing that tells it apart from other failures with the same code.
 */
function isInitialSyncError(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.includes('while in state INITIAL_SYNC');
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
  /** Automated Embedding defaults applied to indexes created without their own config. */
  private readonly defaultAutoEmbed?: MongoDBAutoEmbedConfig;
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
   * Waits between attempts while a queried index is in INITIAL_SYNC, about six seconds in all.
   * On a live Atlas cluster the window lasted around two seconds for both a regular and an
   * autoEmbed index; the budget leaves room for a slower build without holding a failing query
   * for long.
   */
  private static readonly INITIAL_SYNC_RETRY_DELAYS_MS = [250, 500, 1000, 2000, 2000];
  /**
   * Most `_id`s the pre-filter fallback loads for one query. The ids go into a single
   * `$vectorSearch` command, which must stay under 16 MB; 100,000 ids leaves room for long
   * string ids. Past this the query fails rather than silently dropping candidates.
   */
  private static readonly MAX_PREFILTER_CANDIDATES = 100_000;
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

  constructor({ id, uri, dbName, options, embeddingFieldPath, autoEmbed }: MongoDBVectorConfig) {
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
    this.defaultAutoEmbed = autoEmbed;
  }

  /** True once the store is configured with Automated Embedding defaults. */
  override get isSelfEmbedding(): boolean {
    return this.defaultAutoEmbed !== undefined;
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
  private async resolveIndexTarget(indexName: string): Promise<IndexTarget & { registered: boolean }> {
    const cached = this.indexTargets.get(indexName);
    if (cached) return { ...cached, registered: true };

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
        autoEmbed: persisted.autoEmbed,
        ownsVectorIndex: persisted.ownsVectorIndex,
        ownsTextIndex: persisted.ownsTextIndex,
        ownsCollection: persisted.ownsCollection,
      };
      this.indexTargets.set(indexName, target);
      return { ...target, registered: true };
    }

    // Unregistered fallback (pre-registry legacy managed index, or an unknown name).
    // `registered: false` tells destructive paths (deleteIndex) to verify the target
    // actually is a legacy managed index before dropping anything.
    return {
      collectionName: indexName,
      searchIndexName: `${indexName}_vector_index`,
      isByo: false,
      allowWrites: true,
      registered: false,
    };
  }

  /**
   * True when another logical index (a different registry `_id`) on the same collection
   * references `physicalIndexName` as its vector or text search index. Used by deleteIndex
   * to preserve a shared Atlas index that a sibling logical index still depends on
   * (e.g. two BYO logical indexes on one collection sharing the default dynamic text index).
   */
  private async isIndexNameReferencedElsewhere(
    indexName: string,
    collectionName: string,
    physicalIndexName: string,
  ): Promise<boolean> {
    const registry = this.db.collection<RegistryDoc>(MongoDBVector.REGISTRY_COLLECTION);
    const other = await registry.findOne({
      _id: { $ne: indexName } as any,
      collectionName,
      $or: [{ searchIndexName: physicalIndexName }, { textSearchIndexName: physicalIndexName }],
    });
    return other !== null;
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
   *
   * `claim` narrows the upsert to entries the caller considers compatible. Because the filter
   * still pins `_id`, an incompatible entry matches nothing, the upsert attempts an insert, and
   * the duplicate `_id` surfaces as a duplicate-key error (code 11000) instead of overwriting
   * the entry someone else registered. Callers that only refresh part of an entry omit it.
   */
  private async writeRegistryEntry(
    indexName: string,
    entry: Partial<RegistryDoc>,
    claim?: Document,
    upsert = true,
  ): Promise<void> {
    const registry = this.db.collection<RegistryDoc>(MongoDBVector.REGISTRY_COLLECTION);
    await registry.updateOne({ _id: indexName, ...claim }, { $set: { indexName, ...entry } }, { upsert });
  }

  /**
   * Record that this store created a search index. `claim` pins the entry to this call's
   * `claimToken` and the index name, so the flag never lands on an entry another process
   * rewrote or re-registered in the meantime. No upsert, so a deleted entry stays deleted.
   */
  private async markOwned(
    indexName: string,
    owned: Pick<IndexTarget, 'ownsVectorIndex'> | Pick<IndexTarget, 'ownsTextIndex'>,
    claim: Document,
  ): Promise<void> {
    await this.writeRegistryEntry(indexName, owned, claim, false);
  }

  /**
   * Undo a registry write after provisioning failed: remove the entry this call inserted, or
   * restore the one it overwrote. Matching on `claimToken` leaves alone an entry another
   * process rewrote since. Best effort, so the caller still sees the provisioning error.
   * Returns true when the inserted entry was removed.
   */
  private async rollbackRegistryEntry(
    indexName: string,
    previous: RegistryDoc | null,
    claimToken: string,
  ): Promise<boolean> {
    this.indexTargets.delete(indexName);
    this.declaredFilterPaths.delete(indexName);
    try {
      const registry = this.db.collection<RegistryDoc>(MongoDBVector.REGISTRY_COLLECTION);
      if (!previous) return (await registry.deleteOne({ _id: indexName, claimToken })).deletedCount === 1;
      await registry.replaceOne({ _id: indexName, claimToken }, previous);
    } catch {
      // The entry stays as written. Ownership is never claimed for a failed call, so a later
      // deleteIndex still keeps whatever it cannot prove this store created.
    }
    return false;
  }

  /** Remove a logical-index target from the durable registry (called by deleteIndex). */
  private async deleteRegistryEntry(indexName: string): Promise<void> {
    const registry = this.db.collection<RegistryDoc>(MongoDBVector.REGISTRY_COLLECTION);
    await registry.deleteOne({ _id: indexName });
  }

  /**
   * $rankFusion is available in MongoDB >= 8.0, so the gate rejects only older servers and lets the
   * server be the final authority on anything else.
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
        text: `hybridQuery uses $rankFusion, which requires MongoDB >= 8.0 (found ${this.rankFusionSupport.version}). Upgrade to 8.0 or later, or run query() and textQuery() separately and fuse client-side.`,
      });
    }
  }

  /** Validates a text upsert: `documents` is present, and `metadata`/`ids` line up with it. */
  private validateTextUpsertInput(
    indexName: string,
    documents: string[] | undefined,
    vectors: number[][] | undefined,
    metadata?: Record<string, any>[] | null,
    ids?: string[] | null,
  ): void {
    // Typed `never` so TypeScript narrows `documents` after the emptiness check below.
    const fail: (errorType: string, message: string, details?: Record<string, string | number>) => never = (
      errorType,
      message,
      details = {},
    ) => {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'UPSERT', errorType),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: message,
        details: { indexName, ...details },
      });
    };

    if (vectors?.length) {
      fail(
        'INVALID_ARGS',
        `Index "${indexName}" was created with autoEmbed, so MongoDB generates the embeddings: pass documents only. The supplied vectors would be stored in a field no index reads.`,
      );
    }
    if (!documents || documents.length === 0) {
      fail('EMPTY_DOCUMENTS', 'documents array cannot be empty when upserting into an autoEmbed index');
    }
    if (metadata && metadata.length > 0 && metadata.length !== documents.length) {
      fail('METADATA_LENGTH_MISMATCH', 'Metadata array length must match documents array length', {
        documentsLength: documents.length,
        metadataLength: metadata.length,
      });
    }
    if (ids && ids.length !== documents.length) {
      fail('IDS_LENGTH_MISMATCH', 'IDs array length must match documents array length', {
        documentsLength: documents.length,
        idsLength: ids.length,
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
    /** Field holding the text, which an autoEmbed index may place outside `document`. */
    documentPath: string = this.documentFieldName,
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
          document: `$${documentPath}`,
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
  async createIndex(params: MongoDBCreateIndexParams): Promise<void> {
    const {
      indexName,
      dimension,
      metric = 'cosine',
      filterFields,
      collectionName,
      searchIndexName,
      allowWrites,
      autoEmbed: autoEmbedParam,
    } = params;
    // The store's Automated Embedding defaults apply to a call that names neither its own
    // autoEmbed config nor a dimension.
    const autoEmbed = autoEmbedParam ?? (dimension === undefined ? this.defaultAutoEmbed : undefined);
    let mongoMetric;
    try {
      if (autoEmbed) {
        if (dimension !== undefined) {
          throw new Error(
            'dimension cannot be combined with autoEmbed. The embedding model determines the vector size; use autoEmbed.numDimensions to override it.',
          );
        }
        // Read from `params`, since `metric` above carries a default that hides whether the
        // caller named it.
        if (params.metric !== undefined) {
          throw new Error(
            'metric cannot be combined with autoEmbed. metric configures a client-side vector field; use autoEmbed.similarity instead.',
          );
        }
      } else if (dimension === undefined || !Number.isInteger(dimension) || dimension <= 0) {
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
            ...(dimension !== undefined ? { dimension } : {}),
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
    // (The effective values are finalized after reading any existing registry entry:
    // classification is sticky and the write policy is preserved on refresh.)

    let collection;
    let collectionCreated = false;
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
        collectionCreated = true;
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

      // BYO classification is STICKY: once a logical index is registered, an idempotent
      // re-createIndex must never reclassify it. Without this, a BYO index whose
      // collectionName equals its indexName could be re-created WITHOUT `collectionName`
      // (the retarget guard passes, since the resolved collection is the same) and be
      // silently flipped to managed — after which deleteIndex would drop the caller's
      // operational collection. Reclassifying requires an explicit deleteIndex first.
      // The write policy is likewise preserved on refresh unless explicitly re-specified.
      const effectiveIsByo = existingEntry ? (existingEntry.isByo ?? false) : isByo;
      const effectiveWritable = effectiveIsByo ? (allowWrites ?? existingEntry?.allowWrites ?? false) : true;
      if (effectiveIsByo && allowWrites === true) {
        this.logger.warn(
          `createIndex({ allowWrites: true }) is deprecated and will be removed in the next major version. Keep bring-your-own index "${indexName}" read-only: write embeddings from your application or use autoEmbed.`,
        );
      }

      // Vector/text index names must not collide: if the vector index were created under
      // the companion text-index name, the later text-index creation would hit
      // IndexAlreadyExists and be silently swallowed, leaving textQuery/hybridQuery
      // pointed at a vectorSearch-type index.
      if (targetSearchIndex === defaultTextSearchIndex || targetSearchIndex === existingEntry?.textSearchIndexName) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: `searchIndexName "${targetSearchIndex}" collides with the full-text search index name for collection "${targetCollection}". Choose a different vector searchIndexName.`,
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
      //   - Managed: auto-provision the companion dynamic full-text index, so default
      //     its name here (preserving any prior custom name from createSearchIndex).
      //   - BYO: do NOT auto-create a (billable) full-text index. Leave
      //     textSearchIndexName UNSET until the caller opts in via createSearchIndex, so
      //     textQuery/hybridQuery fail clearly instead of querying a non-existent index. A
      //     custom name from a prior createSearchIndex is still preserved.
      const textSearchIndexName = effectiveIsByo
        ? existingEntry?.textSearchIndexName
        : (existingEntry?.textSearchIndexName ?? defaultTextSearchIndex);
      const resolvedAutoEmbed = autoEmbed
        ? { ...autoEmbed, path: autoEmbed.path ?? this.documentFieldName }
        : undefined;

      // MongoDB leaves an existing index definition alone, so a re-create that changes how
      // the index embeds would persist a config the physical index does not match: the store
      // would read and write one field while Atlas embeds another. Refuse instead.
      const existingAutoEmbed = existingEntry?.autoEmbed;
      const embeddingChanged =
        Boolean(existingAutoEmbed) !== Boolean(resolvedAutoEmbed) ||
        (existingAutoEmbed &&
          resolvedAutoEmbed &&
          (existingAutoEmbed.path !== resolvedAutoEmbed.path || existingAutoEmbed.model !== resolvedAutoEmbed.model));
      if (existingEntry && embeddingChanged) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: `Index "${indexName}" is already registered with ${describeEmbedding(existingAutoEmbed)}, but this createIndex call resolves to ${describeEmbedding(resolvedAutoEmbed)}. Call deleteIndex({ indexName: "${indexName}" }) first to rebuild it.`,
        });
      }
      // The two guards above compare against a snapshot taken earlier in this method. Another
      // process can register the same logical index in the gap, and since both calls then
      // provision, Atlas keeps whichever definition landed first and treats the second as
      // IndexAlreadyExists. Conditioning the write on the values those guards checked makes the
      // registry the arbiter: exactly one concurrent createIndex claims the entry, and the rest
      // fail here rather than persisting a target the physical index does not match.
      //
      // Equality-to-null, not $exists:false — the driver stores an undefined autoEmbed as null,
      // and null also matches entries written before autoEmbed existed, which carry no such key.
      const registryClaim: Document = {
        collectionName: targetCollection,
        ...(resolvedAutoEmbed
          ? { 'autoEmbed.path': resolvedAutoEmbed.path, 'autoEmbed.model': resolvedAutoEmbed.model }
          : { autoEmbed: null }),
      };
      const claimToken = uuidv4();
      // A managed index adopts an existing collection when one already has its name; record
      // whether this call created it so deleteIndex never drops a collection it found.
      const ownsCollection = existingEntry ? existingEntry.ownsCollection : collectionCreated;
      // Ownership belongs to the index name it was recorded for; a new name starts out not owned.
      const sameVectorIndex = existingEntry?.searchIndexName === targetSearchIndex;
      try {
        await this.writeRegistryEntry(
          indexName,
          {
            collectionName: targetCollection,
            searchIndexName: targetSearchIndex,
            isByo: effectiveIsByo,
            allowWrites: effectiveWritable,
            // An existing text index name is left as is: rewriting it from this call's earlier
            // read could undo a concurrent createSearchIndex.
            ...(textSearchIndexName && !existingEntry?.textSearchIndexName ? { textSearchIndexName } : {}),
            dimension,
            // An autoEmbed index has no client-side metric; its similarity lives in autoEmbed.
            ...(resolvedAutoEmbed ? {} : { metric }),
            autoEmbed: resolvedAutoEmbed,
            ...(existingEntry ? {} : { ownsCollection }),
            ...(existingEntry && !sameVectorIndex ? { ownsVectorIndex: false } : {}),
            claimToken,
          },
          registryClaim,
        );
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
        const winner = await this.readRegistryEntry(indexName);
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          // The winning entry can be gone again by the time it is read back (a concurrent
          // deleteIndex), in which case there is nothing to describe and a retry will succeed.
          text: winner
            ? `Index "${indexName}" was registered concurrently against collection "${winner.collectionName}" with ${describeEmbedding(winner.autoEmbed)}, but this createIndex call resolves to collection "${targetCollection}" with ${describeEmbedding(resolvedAutoEmbed)}. Call deleteIndex({ indexName: "${indexName}" }) first to rebuild it.`
            : `Index "${indexName}" was registered concurrently by another process and removed again before this call could read it. Retry createIndex.`,
        });
      }
      this.indexTargets.set(indexName, {
        collectionName: targetCollection,
        searchIndexName: targetSearchIndex,
        isByo: effectiveIsByo,
        allowWrites: effectiveWritable,
        textSearchIndexName,
        autoEmbed: resolvedAutoEmbed,
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
      const declaredMetadataPaths = this.buildDeclaredMetadataPaths(filterFields, effectiveIsByo);
      // An index declares either a `vector` field or an `autoEmbed` one, never both.
      const autoEmbedPath = resolvedAutoEmbed?.path;
      let searchField: Document;
      if (autoEmbed) {
        // `metric` applies to client-side vectors; set `autoEmbed.similarity` instead.
        const { model, path: _path, ...indexOptions } = autoEmbed;
        searchField = { type: 'autoEmbed', modality: 'text', path: autoEmbedPath, model, ...indexOptions };
      } else {
        searchField = {
          type: 'vector',
          path: embeddingField,
          numDimensions: numDimensions,
          similarity: mongoMetric,
        };
      }
      // A path cannot be declared twice, so `document` stops being a filter field once it
      // is the embedded text. documentFilter then uses the $match pre-filter instead.
      const documentIsEmbedded = autoEmbedPath === this.documentFieldName;
      const fields: Document[] = [
        searchField,
        {
          type: 'filter',
          path: '_id',
        },
        ...(documentIsEmbedded
          ? []
          : [
              {
                type: 'filter',
                path: this.documentFieldName,
              },
            ]),
        ...declaredMetadataPaths.map(path => ({ type: 'filter', path })),
      ];

      // Each creation treats IndexAlreadyExists as a no-op independently. A
      // shared catch would let an existing vector index skip creation of the
      // companion full-text index entirely (e.g. after a previously
      // interrupted createIndex), leaving the pair in a partial state.
      let vectorIndexCreated: boolean;
      try {
        vectorIndexCreated = await this.createSearchIndexIgnoringExisting(collection, {
          definition: { fields },
          name: indexNameInternal,
          type: 'vectorSearch',
        });
      } catch (error) {
        // Nothing usable was provisioned, so the target must not keep resolving. Drop the
        // collection only if this call created it and no other process claimed the entry since.
        if ((await this.rollbackRegistryEntry(indexName, existingEntry, claimToken)) && collectionCreated) {
          this.collections.delete(targetCollection);
          await collection.drop().catch(() => {});
        }
        throw error;
      }
      if (vectorIndexCreated) {
        await this.markOwned(indexName, { ownsVectorIndex: true }, { claimToken, searchIndexName: indexNameInternal });
      }

      // Cache the declared filter paths only when this call actually created
      // the index. An index that already existed may carry a different
      // declaration; queries hydrate the real one lazily via
      // getDeclaredFilterPaths().
      if (vectorIndexCreated) {
        this.declaredFilterPaths.set(
          indexName,
          new Set(documentIsEmbedded ? declaredMetadataPaths : [this.documentFieldName, ...declaredMetadataPaths]),
        );
      }

      // Companion full-text index (dynamic mapping). Only auto-created for MANAGED
      // collections (back-compat). For a bring-your-own operational collection we do NOT
      // provision a billable full-text index implicitly — the caller opts in explicitly via
      // createSearchIndex. The registry entry above records its name (managed only), so BYO
      // safety does not depend on this succeeding.
      if (!effectiveIsByo) {
        const textIndexCreated = await this.createSearchIndexIgnoringExisting(collection, {
          definition: {
            mappings: {
              dynamic: true,
            },
          },
          // Provision under the PERSISTED name (a prior custom createSearchIndex name is
          // preserved above); for a fresh managed index this is the default.
          name: textSearchIndexName ?? defaultTextSearchIndex,
          type: 'search',
        });
        if (textIndexCreated) {
          await this.markOwned(
            indexName,
            { ownsTextIndex: true },
            { claimToken, textSearchIndexName: textSearchIndexName ?? defaultTextSearchIndex },
          );
        }
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
    // The server answers a create matching an existing index's definition with success, so
    // success alone does not prove this call created it.
    const existing = (await collection.listSearchIndexes(description.name).toArray()) as SearchIndexInfo[];
    if (existing.some(idx => idx.status !== 'DELETING' && idx.status !== 'DOES_NOT_EXIST')) return false;
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
      // NamespaceNotFound: the caller's BYO collection was dropped externally — its search
      // indexes are gone with it. getCollection(..., false) still returns a handle for a
      // missing collection, so this is reachable; treating it as success lets deleteIndex
      // proceed to clear the (now stale) registry entry instead of stranding it forever.
      const missing =
        code === 'IndexNotFound' ||
        code === 'SearchIndexNotFound' ||
        code === 27 ||
        code === 'NamespaceNotFound' ||
        code === 26;
      if (!missing) throw err;
    }
  }

  /** Atlas Search reads a dotted mapping key as a literal field name, so nested paths need `document` mappings. */
  private toSearchFieldMappings(paths: string[][]): Document {
    return Object.fromEntries(
      [...new Set(paths.map(p => p[0]!))].map(head => {
        const nested = paths.filter(p => p[0] === head && p.length > 1).map(p => p.slice(1));
        return [
          head,
          nested.length ? { type: 'document', fields: this.toSearchFieldMappings(nested) } : [{ type: 'string' }],
        ];
      }),
    );
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
    // Read the registry rather than the in-process cache, which another process can make stale.
    this.indexTargets.delete(indexName);
    const target = await this.resolveIndexTarget(indexName);
    const { collectionName } = target;
    // A field-mapped index must not collide with the auto-created dynamic index (which would
    // no-op the field mapping), and two logical indexes on the SAME collection must not collide
    // with each other (FIX 6), so the default name includes the logical indexName.
    const name =
      searchIndexName ??
      (fields?.length ? `${collectionName}_${indexName}_search_fields_index` : `${collectionName}_search_index`);
    // A text index must not squat the vector index's name: the creation below would hit
    // IndexAlreadyExists, and the subsequent updateSearchIndex would overwrite the
    // vectorSearch definition with a text mapping, breaking query().
    if (name === target.searchIndexName) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: `searchIndexName "${name}" collides with the vectorSearch index name for index "${indexName}". Choose a different full-text searchIndexName.`,
      });
    }
    // Only a text index this registration created may be updated; a different name starts out not owned.
    const sameName = name === target.textSearchIndexName;
    const previous = await this.readRegistryEntry(indexName);
    const claimToken = uuidv4();
    let provisioned = false;
    try {
      const collection = await this.getCollection(collectionName);
      const definition = fields?.length
        ? { mappings: { dynamic: false, fields: this.toSearchFieldMappings(fields.map(f => f.split('.'))) } }
        : { mappings: { dynamic: true } };
      // Persist a COMPLETE target (FIX 1) BEFORE provisioning, mirroring createIndex's
      // persist-before-provision ordering: if the process crashes between provisioning and
      // persisting, the created text index would be unregistered — deleteIndex would then
      // drop only the vector index and leak the text index onto a caller-owned collection.
      // If provisioning fails, the write is rolled back below.
      // An existing entry gets only the text-index fields and no upsert, so this call never
      // overwrites another process's policy or brings back an entry deleted in the meantime.
      const textFields = { textSearchIndexName: name, ...(sameName ? {} : { ownsTextIndex: false }), claimToken };
      await this.writeRegistryEntry(
        indexName,
        previous
          ? textFields
          : {
              collectionName: target.collectionName,
              searchIndexName: target.searchIndexName,
              isByo: target.isByo,
              allowWrites: target.allowWrites,
              ...textFields,
            },
        undefined,
        !previous,
      );
      this.indexTargets.set(indexName, { ...target, textSearchIndexName: name });
      const created = await this.createSearchIndexIgnoringExisting(collection, { definition, name, type: 'search' });
      if (created) {
        await this.markOwned(indexName, { ownsTextIndex: true }, { claimToken, textSearchIndexName: name });
      } else if (sameName && target.ownsTextIndex) {
        // Recreating our own index with a different `fields` mapping must change the mapping.
        await collection.updateSearchIndex(name, definition);
      } else {
        // Someone else's index: attach to it as-is, and refuse if it maps different fields.
        const [existing] = (await collection.listSearchIndexes(name).toArray()) as SearchIndexInfo[];
        const mapping = (m?: Document) => JSON.stringify([m?.dynamic ?? false, Object.keys(m?.fields ?? {}).sort()]);
        if (mapping(existing?.latestDefinition?.mappings) !== mapping(definition.mappings)) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName, collectionName },
            text: `Full-text search index "${name}" already exists on collection "${collectionName}" with a different mapping, and Mastra did not create it, so it will not be modified. Pass a different searchIndexName, or update or drop the existing index yourself.`,
          });
        }
      }
      provisioned = true;
      if (waitUntilReady) {
        await this.waitForSearchIndexReady({ indexName });
      }
    } catch (error: any) {
      if (!provisioned) await this.rollbackRegistryEntry(indexName, previous, claimToken);
      if (error instanceof MastraError) throw error;
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
    const { collectionName, autoEmbed } = await this.resolveIndexTarget(indexName);
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
        ...this.buildProjection(metadataMode, false, 'searchScore', autoEmbed?.path),
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
   * (see {@link assertRankFusionSupported}).
   */
  hybridQuery(params: MongoDBHybridQueryParams): Promise<QueryResult[]>;
  /**
   * Fuse vector and full-text results with independent retrieval limits and optional native
   * reranking. Returns QueryResult[] with the final fusion or reranking score.
   *
   * @see https://mastra.ai/reference/vectors/mongodb#per-branch-options-and-native-reranking
   * @see https://www.mongodb.com/docs/vector-search/query/aggregation-stages/rerank/
   * @throws {MastraError} Invalid inputs, incompatible indexes, or server failures. Server
   * errors retain their causes; reranking is never silently skipped or substituted.
   */
  hybridQuery(params: MongoDBHybridQueryBranchParams): Promise<QueryResult[]>;
  async hybridQuery(params: MongoDBHybridQueryParams | MongoDBHybridQueryBranchParams): Promise<QueryResult[]> {
    if ('vector' in params || 'text' in params) {
      return this.hybridQueryBranches(params as MongoDBHybridQueryBranchParams);
    }
    const {
      indexName,
      queryVector,
      queryText,
      model,
      query,
      paths,
      topK = 10,
      filter,
      weights,
      numCandidates,
      metadataMode = 'field',
      textSearchIndexName,
    } = params;
    if (model && !queryText) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'INVALID_ARGS'),
        text: 'model only applies to queryText, which MongoDB embeds server-side for the vector branch.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }
    if (queryVector && queryText) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'MUTUALLY_EXCLUSIVE'),
        text: 'queryVector and queryText are mutually exclusive: the vector branch takes one or the other.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }
    if (!queryVector && !queryText) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'MISSING_VECTOR'),
        text: 'The vector branch needs queryVector (or queryText on an autoEmbed index).',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }
    await this.assertRankFusionSupported();
    const { collectionName, searchIndexName, autoEmbed } = await this.resolveIndexTarget(indexName);
    if (queryText && !autoEmbed) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'NOT_AUTO_EMBED'),
        text: `Index "${indexName}" was not created with autoEmbed, so MongoDB cannot embed a query string for it. Pass queryVector instead.`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }
    const textIndex = textSearchIndexName ?? (await this.resolveTextSearchIndexName(indexName));
    try {
      // The branch limit is also capped at 10000: $vectorSearch requires numCandidates >= limit,
      // and numCandidates is itself capped at 10000, so perBranch must not exceed it or a large
      // topK (> 2500, where topK*4 > 10000) would make numCandidates < limit and error.
      const perBranch = Math.min(10000, Math.max(topK * 4, 20));
      // numCandidates must be >= the branch limit (perBranch), or $vectorSearch errors
      // server-side. Floor at perBranch (not topK), keep the 10000 cap. (FIX 3)
      const candidates = Math.min(10000, Math.max(perBranch, numCandidates ?? topK * 20));
      return await this.runHybridPipeline({
        indexName,
        collectionName,
        searchIndexName,
        autoEmbed,
        metadataMode,
        filter,
        weights,
        topK,
        vector: {
          ...(queryText ? { query: queryText } : { queryVector }),
          ...(model ? { model } : {}),
          numCandidates: candidates,
          limit: perBranch,
        },
        text: { query, paths, searchIndexName: textIndex, limit: perBranch },
      });
    } catch (error: any) {
      if (error instanceof MastraError) throw error;
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

  private async hybridQueryBranches(params: MongoDBHybridQueryBranchParams): Promise<QueryResult[]> {
    this.validateHybridQueryBranchParams(params);
    const { indexName, vector, text, rerank, topK = 10, filter, weights, includeVector = false } = params;
    const defaultLimit = Math.min(10000, Math.max(topK * 4, 20));
    const vectorLimit = vector.limit ?? defaultLimit;
    const textLimit = text.limit ?? defaultLimit;
    // MongoDB recommends numCandidates of at least 20x the limit. An explicit value is sent as-is,
    // so MongoDB reports an invalid one (for example, below the vector limit) instead of it being rewritten.
    const candidates = vector.numCandidates ?? Math.min(10000, vectorLimit * 20);

    try {
      await this.assertRankFusionSupported();
      const { collectionName, searchIndexName, autoEmbed, isByo } = await this.resolveIndexTarget(indexName);
      if (!isByo && (vector.searchIndexName !== undefined || text.searchIndexName !== undefined)) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'INVALID_ARGS'),
          text: `vector.searchIndexName and text.searchIndexName are only supported for bring-your-own collections. Managed index "${indexName}" uses its registered search indexes.`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }
      if (vector.query !== undefined && !autoEmbed) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'NOT_AUTO_EMBED'),
          text: `Index "${indexName}" was not created with autoEmbed. Supply vector.queryVector instead of vector.query.`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }
      if (vector.queryVector !== undefined && autoEmbed) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'INVALID_ARGS'),
          text: `Index "${indexName}" was created with autoEmbed, so MongoDB only accepts query text for it. Supply vector.query instead of vector.queryVector.`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }
      if (includeVector && autoEmbed) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'INVALID_ARGS'),
          text: `includeVector is not supported on autoEmbed index "${indexName}": MongoDB keeps the generated embeddings in its own internal database, so they are not on the returned documents.`,
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
        });
      }
      const textIndex = text.searchIndexName ?? (await this.resolveTextSearchIndexName(indexName));
      const { searchIndexName: vectorIndexOverride, ...vectorInput } = vector;
      return await this.runHybridPipeline({
        indexName,
        collectionName,
        searchIndexName: vectorIndexOverride ?? searchIndexName,
        pushDownFilter: vectorIndexOverride === undefined,
        autoEmbed,
        includeVector,
        metadataMode: isByo ? 'document' : 'field',
        filter,
        weights,
        topK,
        vector: { ...vectorInput, numCandidates: candidates, limit: vectorLimit },
        text: { query: text.query, paths: text.paths, searchIndexName: textIndex, limit: textLimit },
        rerank,
      });
    } catch (error) {
      if (error instanceof MastraError && error.category === ErrorCategory.USER) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'FAILED'),
          text: rerank
            ? 'hybridQuery with native $rerank failed. Check Atlas Native Reranking support, model availability, and that rerank.paths exist in every candidate document.'
            : 'hybridQuery failed. Check the collection, search indexes, and $rankFusion support.',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
        },
        error,
      );
    }
  }

  /** Builds and runs the $rankFusion pipeline shared by both hybridQuery shapes. */
  private async runHybridPipeline({
    indexName,
    collectionName,
    searchIndexName,
    pushDownFilter = true,
    autoEmbed,
    includeVector = false,
    metadataMode,
    filter,
    weights,
    topK,
    vector,
    text,
    rerank,
  }: {
    indexName: string;
    collectionName: string;
    searchIndexName: string;
    /** False when the vector index is overridden, since declared filter fields belong to the registered index. */
    pushDownFilter?: boolean;
    autoEmbed?: IndexTarget['autoEmbed'];
    includeVector?: boolean;
    metadataMode: 'field' | 'document';
    filter?: MongoDBVectorFilter;
    weights?: { vector?: number; text?: number };
    topK: number;
    vector: { queryVector?: number[]; query?: string; model?: string; numCandidates: number; limit: number };
    text: { query: string; paths: string[]; searchIndexName: string; limit: number };
    rerank?: MongoDBHybridQueryBranchParams['rerank'];
  }): Promise<QueryResult[]> {
    const collection = await this.getCollection(collectionName, true);
    const metadataFilter = this.transformMetadataFilter(this.transformFilter(filter), metadataMode);
    const hasMetadataFilter = Object.keys(metadataFilter).length > 0;
    const vectorSearch: Document = {
      index: searchIndexName,
      path: autoEmbed ? autoEmbed.path : this.embeddingFieldName,
      ...(vector.query !== undefined ? { query: { text: vector.query } } : { queryVector: vector.queryVector }),
      ...(vector.model !== undefined ? { model: vector.model } : {}),
      numCandidates: vector.numCandidates,
      limit: vector.limit,
    };

    // Apply the metadata filter to the vector branch using the same pushdown-vs-fallback
    // logic as query(): pass the filter straight to $vectorSearch only when every field is
    // a declared filter field and every operator is supported; otherwise materialise
    // matching _ids via $match and filter by _id. This avoids a hard $vectorSearch error
    // on BYO collections whose metadata fields are typically not declared as filter fields.
    if (hasMetadataFilter) {
      let declaredPaths = new Set<string>();
      if (pushDownFilter) {
        try {
          declaredPaths = await this.getDeclaredFilterPaths(indexName);
        } catch {
          declaredPaths = new Set();
        }
      }
      if (this.canPushDownFilter(metadataFilter, declaredPaths)) {
        vectorSearch.filter = metadataFilter;
      } else {
        const candidateIds = await this.collectCandidateIds(collection, metadataFilter, indexName, 'HYBRID_QUERY');
        if (candidateIds.length === 0) return [];
        vectorSearch.filter = { _id: { $in: candidateIds } };
      }
    }

    const pipeline: Document[] = [
      {
        $rankFusion: {
          input: {
            pipelines: {
              vector: [{ $vectorSearch: vectorSearch }],
              text: [
                { $search: { index: text.searchIndexName, text: { query: text.query, path: text.paths } } },
                ...(hasMetadataFilter ? [{ $match: metadataFilter }] : []),
                { $limit: text.limit },
              ],
            },
          },
          ...(weights ? { combination: { weights: { vector: weights.vector ?? 1, text: weights.text ?? 1 } } } : {}),
        },
      },
      ...(rerank
        ? [
            {
              $rerank: {
                query: { text: rerank.query },
                path: rerank.paths,
                model: rerank.model ?? 'rerank-2.5',
                numDocsToRerank: rerank.numDocsToRerank,
              },
            },
          ]
        : []),
      { $limit: Math.min(10000, topK) },
      // $rankFusion and $rerank both publish their score as `$meta: 'score'` (NOT `searchScore`,
      // which is the text-branch score and is absent on vector-only hits). Score is projected via
      // $meta inside buildProjection (not a preceding $set) so it never pollutes
      // `metadata: '$$ROOT'` in document mode, and only after reranking so $rerank sees source fields.
      ...this.buildProjection(metadataMode, includeVector, 'score', autoEmbed?.path),
    ];
    const rows = await collection.aggregate(pipeline).toArray();
    return rows.map((row: Document) => ({
      id: this.idToString(row._id),
      score: typeof row.score === 'number' ? row.score : 0,
      metadata: row.metadata,
      document: row.document,
      ...(includeVector ? { vector: row.vector } : {}),
    }));
  }

  private validateHybridQueryBranchParams(params: MongoDBHybridQueryBranchParams): void {
    const fail = (text: string): never => {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'HYBRID_QUERY', 'INVALID_ARGS'),
        text,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
      });
    };
    const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
    const integer = (value: unknown, name: string, max = 10000) => {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
        fail(`${name} must be an integer from 1 to ${max}.`);
      }
    };
    const paths = (value: unknown, name: string) => {
      if (!Array.isArray(value) || value.length === 0 || !value.every(nonEmptyString)) {
        fail(`${name} must be a non-empty array of non-empty field paths.`);
      }
    };
    if (!params || !nonEmptyString(params.indexName)) fail('indexName must be a non-empty string.');
    const { vector, text, rerank, weights } = params;
    if (!vector || typeof vector !== 'object') fail('vector retrieval configuration is required.');
    if ((vector.queryVector !== undefined) === (vector.query !== undefined)) {
      fail('Supply exactly one of vector.queryVector or vector.query.');
    }
    if (vector.queryVector !== undefined) {
      if (
        !Array.isArray(vector.queryVector) ||
        vector.queryVector.length === 0 ||
        !vector.queryVector.every(value => typeof value === 'number' && Number.isFinite(value))
      ) {
        fail('vector.queryVector must be a non-empty array of finite numbers.');
      }
    } else if (!nonEmptyString(vector.query)) fail('vector.query must be a non-empty string.');
    if (vector.model !== undefined && (vector.query === undefined || !nonEmptyString(vector.model))) {
      fail('vector.model must be a non-empty string and requires vector.query.');
    }
    if (!text || !nonEmptyString(text.query)) fail('text.query must be a non-empty string.');
    paths(text.paths, 'text.paths');
    if (text.searchIndexName !== undefined && !nonEmptyString(text.searchIndexName)) {
      fail('text.searchIndexName must be a non-empty string.');
    }
    if (vector.searchIndexName !== undefined && !nonEmptyString(vector.searchIndexName)) {
      fail('vector.searchIndexName must be a non-empty string.');
    }
    if (params.topK !== undefined) integer(params.topK, 'topK');
    if (vector.limit !== undefined) integer(vector.limit, 'vector.limit');
    if (text.limit !== undefined) integer(text.limit, 'text.limit');
    if (vector.numCandidates !== undefined) integer(vector.numCandidates, 'vector.numCandidates');
    if (params.includeVector !== undefined && typeof params.includeVector !== 'boolean') {
      fail('includeVector must be a boolean.');
    }
    if (weights !== undefined) {
      if (!weights || typeof weights !== 'object') fail('weights must be an object.');
      const values = [weights.vector ?? 1, weights.text ?? 1];
      if (values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        fail('weights.vector and weights.text must be finite, non-negative numbers.');
      }
      if (values.every(value => value === 0)) fail('At least one fusion weight must be positive.');
    }
    if (rerank !== undefined) {
      if (!rerank || !nonEmptyString(rerank.query)) fail('rerank.query must be a non-empty string.');
      paths(rerank.paths, 'rerank.paths');
      integer(rerank.numDocsToRerank, 'rerank.numDocsToRerank', 1000);
      if (rerank.model !== undefined && !nonEmptyString(rerank.model)) fail('rerank.model must be a non-empty string.');
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
      const indexInfo = (await collection.listSearchIndexes().toArray()) as SearchIndexInfo[];
      const indexData = indexInfo.find(idx => idx.name === indexNameInternal);
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
      const indexInfo = (await collection.listSearchIndexes().toArray()) as SearchIndexInfo[];
      const indexData = indexInfo.find(idx => idx.name === textIndex);
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
    // An autoEmbed index takes `documents`, any other index takes `vectors`.
    const { collectionName, autoEmbed } = await this.resolveIndexTarget(indexName);

    // Validate input parameters
    if (autoEmbed) {
      this.validateTextUpsertInput(indexName, documents, vectors, metadata, ids);
    } else {
      // validateUpsertInput rejects a missing or empty array, so `vectors` is present below.
      validateUpsertInput('MONGODB', vectors, metadata, ids);
      validateVectorValues('MONGODB', vectors!);
    }

    // Outside the try: these USER errors must not be re-wrapped as THIRD_PARTY.
    await this.assertWritable(indexName, 'UPSERT');
    // Circular metadata makes bson's calculateObjectSize spin forever inside bulkWrite;
    // fail fast with a clear error instead of hanging the process.
    if (metadata) this.assertNoCircularReferences(metadata, 'UPSERT');

    try {
      const collection = await this.getCollection(collectionName);

      if (!autoEmbed) {
        // Validate vector dimensions against the index definition (no document count)
        const { dimension } = await this.readVectorIndexDefinition(indexName);
        await this.validateVectorDimensions(vectors!, dimension);
      }

      // One operation per input: vectors when the caller embeds, documents when MongoDB does.
      const rowCount = (autoEmbed ? documents : vectors)?.length ?? 0;

      // Generate IDs if not provided
      const generatedIds = ids || Array.from({ length: rowCount }, () => uuidv4());

      const operations = Array.from({ length: rowCount }, (_unused, idx) => {
        const vector = vectors?.[idx];
        const id = generatedIds[idx];
        const meta = metadata?.[idx] || {};
        const doc = documents?.[idx];

        const normalizedMeta = this.normalizeMetadata(meta);

        // MongoDB stores the generated vectors itself, so the document carries text only.
        const updateDoc: Partial<MongoDBDocument> = {
          ...(autoEmbed ? {} : { [this.embeddingFieldName]: vector }),
          [this.metadataFieldName]: normalizedMeta,
        };
        if (doc !== undefined) {
          // On an autoEmbed index the text must land on the field the index embeds.
          updateDoc[autoEmbed ? autoEmbed.path : this.documentFieldName] = doc;
        }

        // Match both the raw string and (when the id is 24-hex) the ObjectId form, so an
        // opted-in BYO upsert UPDATES an existing ObjectId-keyed document instead of
        // inserting a duplicate with a string _id. With an operator ($in) filter the server
        // cannot infer the _id to insert, so $setOnInsert pins the requested string id —
        // preserving the managed contract when no document matches. Plain string ids
        // (e.g. UUIDs) keep the equality filter, whose _id is inferred on insert as before.
        const idMatch = this.buildIdMatch(id!);
        return {
          updateOne: {
            filter: { _id: idMatch } as any,
            update:
              typeof idMatch === 'string'
                ? { $set: updateDoc }
                : ({ $set: updateDoc, $setOnInsert: { _id: id } } as any),
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
    queryText,
    model,
    topK = 10,
    filter,
    includeVector = false,
    documentFilter,
    numCandidates,
    metadataMode = 'field',
  }: MongoDBQueryVectorParams): Promise<QueryResult[]> {
    if (model && !queryText) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'QUERY', 'INVALID_ARGS'),
        text: 'model only applies to queryText, which MongoDB embeds server-side. A precomputed queryVector has already been embedded.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }
    if (queryVector && queryText) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'QUERY', 'MUTUALLY_EXCLUSIVE'),
        text: 'queryVector and queryText are mutually exclusive: pass a vector you embedded yourself, or a string for MongoDB to embed server-side.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }
    if (!queryVector && !queryText) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'QUERY', 'MISSING_VECTOR'),
        text: 'queryVector (or queryText on an autoEmbed index) is required for MongoDB queries. Metadata-only queries are not supported by this vector store.',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    // Outside the try: these USER errors must not be re-wrapped as THIRD_PARTY.
    const { collectionName, searchIndexName, autoEmbed, isByo } = await this.resolveIndexTarget(indexName);
    if (queryText && !autoEmbed) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'QUERY', 'NOT_AUTO_EMBED'),
        text: `Index "${indexName}" was not created with autoEmbed, so MongoDB cannot embed a query string for it. Pass queryVector instead, or use textQuery() for full-text search.`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }
    if (includeVector && autoEmbed) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'QUERY', 'INVALID_ARGS'),
        text: `includeVector is not supported on autoEmbed index "${indexName}": MongoDB keeps the generated embeddings in its own internal database, so they are not on the returned documents.`,
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
      });
    }

    try {
      const collection = await this.getCollection(collectionName, true);
      const indexNameInternal = searchIndexName;

      // Metadata filter: translate, then (field mode only) add the 'metadata.' prefix to
      // user-facing field names. In document mode (BYO), fields are matched at the root. (FIX 7)
      const metadataFilter = this.transformMetadataFilter(this.transformFilter(filter), metadataMode);
      const hasMetadataFilter = Object.keys(metadataFilter).length > 0;

      const vectorSearch: Document = {
        index: indexNameInternal,
        ...(queryText ? { query: { text: queryText } } : { queryVector }),
        ...(model ? { model } : {}),
        path: autoEmbed ? autoEmbed.path : this.embeddingFieldName,
        numCandidates: Math.min(10000, Math.max(topK, numCandidates ?? topK * 20)),
        limit: Math.min(10000, topK),
      };

      // documentFilter applies to whichever field holds the text: `document` on a managed
      // index, or the field an autoEmbed index embeds.
      const documentTextField = autoEmbed ? autoEmbed.path : this.documentFieldName;
      const documentFilterExpr = documentFilter ? { [documentTextField]: documentFilter } : undefined;
      // Whether the text field can be filtered inside $vectorSearch depends on who built the
      // index. createIndex always declares `document`, except on an autoEmbed index where the
      // embedded path cannot also be a filter field. A BYO collection may carry an Atlas index
      // Mastra never created, which need not declare it at all, and filtering an undeclared
      // path fails with "Path 'document' needs to be indexed as filter". So trust the
      // declaration for indexes we build and read it for the ones we do not.
      const verifyDocumentPath = Boolean(documentFilterExpr) && !autoEmbed && isByo;

      if (hasMetadataFilter || documentFilterExpr) {
        // Fast path: if every field the filter touches was declared via
        // `filterFields` at index creation, and every operator is one Atlas
        // Vector Search accepts inside `filter`, pass the metadata filter
        // straight to $vectorSearch — no $match, no _id materialisation, no
        // 16 MB BSON ceiling. See https://github.com/mastra-ai/mastra/issues/18587
        let declaredPaths = new Set<string>();
        if (hasMetadataFilter || verifyDocumentPath) {
          try {
            declaredPaths = await this.getDeclaredFilterPaths(indexName);
          } catch {
            // If the declaration can't be read, assume nothing is declared and
            // use the always-correct pre-filter below.
            declaredPaths = new Set();
          }
        }

        const pushMetadata = !hasMetadataFilter || this.canPushDownFilter(metadataFilter, declaredPaths);
        const pushDocument =
          !documentFilterExpr ||
          (!autoEmbed &&
            (!verifyDocumentPath || declaredPaths.has(documentTextField)) &&
            // Operators like $regex are not accepted inside $vectorSearch.filter
            this.canPushDownFilter(documentFilter, new Set()));
        const pushed: Document[] = [
          ...(hasMetadataFilter && pushMetadata ? [metadataFilter] : []),
          ...(documentFilterExpr && pushDocument ? [documentFilterExpr] : []),
        ];

        if (!pushMetadata || !pushDocument) {
          // Whatever cannot be pushed down is materialised as candidate _ids via $match
          // first, then filtered by _id inside $vectorSearch.
          const preFilter: Document[] = [
            ...(hasMetadataFilter && !pushMetadata ? [metadataFilter] : []),
            ...(documentFilterExpr && !pushDocument ? [documentFilterExpr] : []),
          ];
          const candidateIds = await this.collectCandidateIds(
            collection,
            preFilter.length > 1 ? { $and: preFilter } : preFilter[0]!,
            indexName,
            'QUERY',
          );

          if (candidateIds.length === 0) return [];
          pushed.unshift({ _id: { $in: candidateIds } });
        }

        vectorSearch.filter = pushed.length > 1 ? { $and: pushed } : pushed[0];
      }

      // Build the aggregation pipeline. Score is projected via $meta inside buildProjection
      // (not a preceding $set) so it never pollutes `metadata: '$$ROOT'` in document mode.
      const pipeline = [
        {
          $vectorSearch: vectorSearch,
        },
        ...this.buildProjection(metadataMode, includeVector, 'vectorSearchScore', autoEmbed?.path),
      ];

      const results = await this.aggregateVectorSearch(collection, pipeline);

      return results.map((result: any) => ({
        id: this.idToString(result._id),
        score: result.score,
        metadata: result.metadata,
        vector: includeVector ? result.vector : undefined,
        document: result.document,
      }));
    } catch (error) {
      if (error instanceof MastraError) throw error;
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
   * Runs a filter that `$vectorSearch` cannot apply itself and returns the matching `_id`s.
   * Reads one id past {@link MongoDBVector.MAX_PREFILTER_CANDIDATES} so an oversized set fails
   * with a USER error instead of exhausting memory or the 16 MB command limit.
   */
  private async collectCandidateIds(
    collection: Collection<MongoDBDocument>,
    match: Document,
    indexName: string,
    operation: 'QUERY' | 'HYBRID_QUERY',
  ): Promise<unknown[]> {
    const max = MongoDBVector.MAX_PREFILTER_CANDIDATES;
    const ids = await collection
      .aggregate([{ $match: match }, { $project: { _id: 1 } }, { $limit: max + 1 }])
      .map(doc => doc._id)
      .toArray();
    if (ids.length > max) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', operation, 'TOO_MANY_CANDIDATES'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName, maxCandidates: max },
        text: `The filter for index "${indexName}" cannot run inside $vectorSearch and matches more than ${max} documents, so it would load every matching _id into memory. Declare the filtered fields with createIndex({ filterFields }) so the filter runs inside $vectorSearch, or narrow the filter.`,
      });
    }
    return ids;
  }

  /**
   * Runs a `$vectorSearch` pipeline, retrying while the index is in INITIAL_SYNC.
   *
   * While Atlas first builds a vector search index it usually answers with an empty result, but
   * for a few seconds it fails with "cannot query vector index ... while in state INITIAL_SYNC"
   * instead. A caller that creates an index and queries it straight away, as `Memory` does on a
   * fresh database, can land in that window. Any other error, and an INITIAL_SYNC that outlasts
   * the retry budget, is thrown unchanged.
   */
  private async aggregateVectorSearch<T extends Document>(
    collection: Collection<T>,
    pipeline: Document[],
  ): Promise<Document[]> {
    for (const delayMs of MongoDBVector.INITIAL_SYNC_RETRY_DELAYS_MS) {
      try {
        return await collection.aggregate(pipeline).toArray();
      } catch (error) {
        if (!isInitialSyncError(error)) throw error;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return collection.aggregate(pipeline).toArray();
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
          const searchIndexes = await this.db.collection(name).listSearchIndexes().toArray();
          if (searchIndexes.some(idx => idx.name === `${name}_vector_index`)) {
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
      const { collectionName, autoEmbed } = await this.resolveIndexTarget(indexName);
      const collection = await this.getCollection(collectionName, true);
      const { dimension, metric } = await this.readVectorIndexDefinition(indexName);

      // Count only documents that actually carry the embedding field (respecting a dot-path
      // embeddingFieldName). On a BYO operational collection this excludes documents that have
      // not been embedded, and it also excludes the legacy `__index_metadata__` sentinel. (FIX 8)
      // An autoEmbed index keeps its vectors outside the collection, so the text field is
      // what marks a document as embedded.
      const embeddedFieldName = autoEmbed ? autoEmbed.path : this.embeddingFieldName;
      const count = await collection.countDocuments({
        [embeddedFieldName]: { $exists: true },
        _id: { $ne: '__index_metadata__' as any },
      });

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

  /**
   * Reads dimension and metric from the Atlas vectorSearch index definition. Unlike
   * {@link describeIndex} it never counts documents, so writes can validate dimensions
   * without scanning the collection.
   */
  private async readVectorIndexDefinition(indexName: string): Promise<Omit<IndexStats, 'count'>> {
    const { collectionName, searchIndexName } = await this.resolveIndexTarget(indexName);
    const collection = await this.getCollection(collectionName, true);
    const indexInfo = (await collection.listSearchIndexes().toArray()) as SearchIndexInfo[];
    const indexData = indexInfo.find(idx => idx.name === searchIndexName);

    if (!indexData) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'DESCRIBE_INDEX', 'NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName, collectionName },
        text: `Atlas Search index "${searchIndexName}" does not exist on collection "${collectionName}". The collection may predate Mastra or the index may have been dropped externally.`,
      });
    }

    const vectorField = indexData.latestDefinition?.fields?.find(
      (f: any) => f.type === 'vector' || f.type === 'autoEmbed',
    );
    if (!vectorField) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'DESCRIBE_INDEX', 'INVALID'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: `Atlas Search index "${searchIndexName}" exists but has no vector field. The index may have been created outside of Mastra or without vector configuration.`,
      });
    }
    // autoEmbed's numDimensions is optional; MongoDB defaults it to 1024.
    const dimension =
      vectorField.type === 'autoEmbed' ? (vectorField.numDimensions ?? 1024) : vectorField.numDimensions;
    const reverseMetricMap: Record<string, 'cosine' | 'euclidean' | 'dotproduct'> = {
      cosine: 'cosine',
      euclidean: 'euclidean',
      dotProduct: 'dotproduct',
    };
    // `similarity` is optional on an autoEmbed field, and Atlas reports nothing for it when
    // the index did not set one, so the function the server applies is not knowable from
    // here. Report a metric only where the index declares one. `similarity` is required on a
    // plain vector field, so that path always has a value.
    const metric =
      vectorField.type === 'autoEmbed' && vectorField.similarity === undefined
        ? undefined
        : (reverseMetricMap[vectorField.similarity] ?? 'cosine');

    return { dimension, metric };
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    // `isByo` is read from the registry (captured at createIndex time), NOT inferred from
    // names: a BYO index may reuse its indexName as the collectionName, so name equality
    // cannot distinguish managed from BYO. Managed indexes drop the collection; BYO indexes
    // drop only the search index so the caller's operational collection/data is preserved.
    // Decide from the registry, not the in-process cache, which another process can make stale.
    this.indexTargets.delete(indexName);
    const {
      collectionName,
      searchIndexName,
      isByo,
      textSearchIndexName,
      registered,
      ownsVectorIndex,
      ownsTextIndex,
      ownsCollection,
    } = await this.resolveIndexTarget(indexName);
    const collection = await this.getCollection(collectionName, false);
    try {
      if (collection) {
        // A managed index that adopted an existing collection is handled like BYO: the collection stays.
        if (isByo || ownsCollection === false) {
          // BYO: drop the vector search index, and the companion full-text index if one was
          // provisioned (via createSearchIndex — it is not auto-created for BYO). Dropping only
          // the vector index would leak the persisted text index onto the caller's operational
          // collection with no record of it. Retry-safe (FIX 4): treat "index not found" on
          // EITHER drop as success — if a prior deleteIndex already removed the physical index
          // and then failed before clearing the registry, a retry must still clear the entry.
          // A physical index still referenced by ANOTHER logical index on this collection
          // (e.g. a shared default dynamic text index) is preserved for the sibling.
          // Only indexes this store created are dropped; unknown ownership means keep.
          if (
            ownsVectorIndex &&
            !(await this.isIndexNameReferencedElsewhere(indexName, collectionName, searchIndexName))
          ) {
            await this.dropSearchIndexIgnoringMissing(collection, searchIndexName);
          }
          if (
            textSearchIndexName &&
            ownsTextIndex &&
            !(await this.isIndexNameReferencedElsewhere(indexName, collectionName, textSearchIndexName))
          ) {
            await this.dropSearchIndexIgnoringMissing(collection, textSearchIndexName);
          }
        } else {
          // Fail closed: nothing records that this store created an unregistered collection, and an
          // `${indexName}_vector_index` on it may be a caller's index left behind by a BYO delete.
          if (!registered) {
            throw new Error(
              `Index "${indexName}" is not registered, so this store cannot verify that it created collection "${collectionName}". Nothing was dropped; drop the collection directly if it is no longer needed.`,
            );
          }
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

      const { collectionName, autoEmbed } = await this.resolveIndexTarget(indexName);
      const collection = await this.getCollection(collectionName, true);
      const updateDoc: Record<string, any> = {};

      if (update.vector && autoEmbed) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'UPDATE_VECTOR', 'INVALID_ARGS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: `Index "${indexName}" was created with autoEmbed, so MongoDB owns the embeddings and a vector cannot be written directly. Upsert the document with new text instead.`,
        });
      }

      if (update.vector) {
        const { dimension } = await this.readVectorIndexDefinition(indexName);
        await this.validateVectorDimensions([update.vector], dimension);
        updateDoc[this.embeddingFieldName] = update.vector;
      }

      if (update.metadata) {
        updateDoc[this.metadataFieldName] = this.normalizeMetadata(update.metadata);
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
   *
   * A bring-your-own collection keeps its fields at the document root, where document-mode
   * filters address them, so its names are declared as given. `_id` and `document` are
   * skipped there because createIndex always declares them.
   */
  private buildDeclaredMetadataPaths(filterFields?: string[], isByo = false): string[] {
    if (!filterFields?.length) return [];
    const paths = new Set<string>();
    for (const field of filterFields) {
      const trimmed = field?.trim();
      if (!trimmed) continue;
      if (isByo) {
        if (trimmed !== '_id' && trimmed !== this.documentFieldName) paths.add(trimmed);
        continue;
      }
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
    const indexInfo = (await collection.listSearchIndexes().toArray()) as SearchIndexInfo[];
    const indexData = indexInfo.find(idx => idx.name === indexNameInternal);

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
    // $vectorSearch.filter has no regex semantics
    if (filter instanceof RegExp) return false;
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

  /**
   * Convert Date values to ISO strings. Object.fromEntries keeps a `__proto__` key as data
   * instead of replacing the prototype and losing it.
   */
  private normalizeMetadata(meta: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(meta).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
    );
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

    // Object.fromEntries defines own properties, so a `__proto__` key stays a filter field
    // instead of replacing the prototype and silently dropping out of the filter.
    return Object.fromEntries(
      Object.entries(filter).map(([key, value]) => {
        // Logical operators like $and/$or: recursively transform their contents
        if (key.startsWith('$')) {
          if (Array.isArray(value)) return [key, value.map(item => this.transformMetadataFilter(item, metadataMode))];
          if (typeof value === 'object' && value !== null)
            return [key, this.transformMetadataFilter(value, metadataMode)];
          return [key, value];
        }
        // Document mode (BYO): the source document's operational fields live at the ROOT (e.g.
        // `amount`, `lane`), not under a managed `metadata` subdocument, so bare fields must NOT
        // be rewritten to `metadata.<field>`. Only field (managed) mode prefixes. (FIX 7)
        if (metadataMode === 'field' && !key.startsWith('metadata.') && this.isMetadataField(key)) {
          return [`metadata.${key}`, value];
        }
        return [key, value];
      }),
    );
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
