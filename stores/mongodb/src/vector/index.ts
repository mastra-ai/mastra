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
import { BSON, MongoClient, ObjectId, ReadPreference } from 'mongodb';
import type {
  MongoClientOptions,
  Document,
  Db,
  Collection,
  ClientSession,
  ListSearchIndexesOptions,
  TransactionOptions,
} from 'mongodb';
import packageJson from '../../package.json';

import { MongoDBFilterTranslator } from './filter';
import type { MongoDBFieldCondition, MongoDBVectorFilter } from './filter';
import { idFor, owns, planDeleteCleanup } from './ownership';
import type { DeleteCleanupPlan, OwnershipView } from './ownership';
import {
  CREATE_TIMEOUT_MS,
  ID_TIMESTAMP_MARGIN_MS,
  LEASE_MS,
  RECONCILE_BATCH,
  classify,
  idTimestampMs,
  isLiveRow,
  isNewerId,
  p4OutcomeOf,
  planOrphanCleanup,
  resolveCreating,
  rollbackRestore,
} from './provisioning';
import type { JournalDoc, ListPhase, P0Pin, P4Outcome, SearchIndexRow } from './provisioning';
import { searchDefinitionsEquivalent } from './search-definition';

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
 * `document` fields; bring-your-own (BYO) indexes return the source document as `metadata`.
 * The embedding is excluded unless `includeVector` is true, which also returns it as `vector`.
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
     * as a filter field. It must also index the registered embedding field with the same embedding
     * mode (vectors or `autoEmbed`), or MongoDB rejects the query. Rejected on managed indexes,
     * which use their registered indexes.
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
   * matches more than 100,000 documents or its candidate `_id` array exceeds 12 MiB of BSON.
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
   * without `ownsCollection` refuses deleteIndex until claimLegacyIndex records ownership.
   */
  ownsVectorIndex?: boolean;
  ownsTextIndex?: boolean;
  ownsCollection?: boolean;
}

/** Shape of a registry document persisted in {@link MongoDBVector.REGISTRY_COLLECTION}. */
interface RegistryDoc extends IndexTarget {
  _id: string;
  indexName: string;
  dimension?: number;
  metric?: string;
  /** Random id of the call that last wrote the entry, so a failed call rolls back only its own write. */
  claimToken?: string;
  /** The registration lifetime (UUID): set by the first write and never changed while the doc exists. */
  generation?: string;
  /** Text-index names this registration owned and has since replaced; dropped by deleteIndex. */
  retiredTextIndexNames?: string[];
  /** Vector-index names this registration owned and has since replaced (§3.3); dropped by deleteIndex. */
  retiredVectorIndexNames?: string[];
  /** Bumped by every registry mutation (I5), so concurrent writers and delete transactions conflict. */
  rev?: number;
  /** The proven Atlas id of each search index this registration created (I11b); an array, as names may contain `.`. */
  indexIds?: { name: string; id: string }[];
  /** Set once a delete committed its decision; the entry then holds only its own drop set. */
  deleting?: boolean;
  /** Identifies the delete attempt that set `deleting`, so a stale call never finalizes a newer one. */
  deleteToken?: string;
}

/** A journal doc whose lease ran out on the server's clock; only such a doc is the reconciler's. */
const LEASE_EXPIRED = { $expr: { $lt: ['$leaseUntil', '$$NOW'] } };

/** Pipeline expression: `indexIds` with the entry for `name` set to `id` (I11b callers decide when). */
function indexIdsWith(name: string, id: string): Document {
  return {
    $concatArrays: [
      { $filter: { input: { $ifNull: ['$indexIds', []] }, cond: { $ne: ['$$this.name', { $literal: name }] } } },
      { $literal: [{ name, id }] },
    ],
  };
}

/** Pipeline `$set` fields every mutating registry write carries: backfilled generation, `rev + 1`, a fresh token. */
function mutationFields(claimToken: string = uuidv4(), generation: string = uuidv4()): Document {
  return {
    generation: { $ifNull: ['$generation', { $literal: generation }] },
    rev: { $add: [{ $ifNull: ['$rev', 0] }, 1] },
    claimToken: { $literal: claimToken },
  };
}

/**
 * Wrap each value in `$literal`, so a value starting with `$` is never read as an expression.
 * `undefined` is written as `null`, which the driver does by default anyway: with the client's
 * `ignoreUndefined` it would otherwise be stored as `{}`, which readers take for a set value (an
 * absent `autoEmbed` would read as an auto-embedding index).
 */
function literals(fields: Document): Document {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { $literal: v ?? null }]));
}

/** What a P0 write left (`pin`) and the document it overwrote (`before`; null when it inserted). */
interface P0Result {
  pin: P0Pin;
  before: RegistryDoc | null;
}

/**
 * A provisioning failure. `rollback` is true only when nothing was proven in the call, so the
 * caller may still undo its P0 write (I4); the caller rethrows `error`.
 */
class ProvisionAbort extends Error {
  constructor(
    readonly error: unknown,
    readonly rollback: boolean,
  ) {
    super('provisioning aborted');
  }
}

/** Names a `deleting` entry is still responsible for dropping (its drop set, as rewritten by T1). */
function recordedDropSet(entry: RegistryDoc): string[] {
  return [
    ...new Set([
      ...(entry.ownsVectorIndex === true ? [entry.searchIndexName] : []),
      ...(entry.ownsTextIndex === true && entry.textSearchIndexName ? [entry.textSearchIndexName] : []),
      ...(entry.retiredTextIndexNames ?? []),
      ...(entry.retiredVectorIndexNames ?? []),
    ]),
  ];
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
  /** Filter paths per logical index, with the physical index (`collection/searchIndex`) they were read from. */
  private declaredFilterPaths: Map<string, { source: string; paths: Set<string> }> = new Map();
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
  /** Cached result of a successful transaction capability probe; a failed probe is never cached. */
  private transactionSupport?: boolean;
  /** @internal test seam; never set in production. */
  private testHooks?: {
    probeTransactions?: () => Promise<boolean>;
    /** Called inside the delete transaction callback, after both registry reads and before any write. */
    insideDeleteTransaction?: (indexName: string, attempt: number) => Promise<void>;
    afterDeleteCommit?: (indexName: string) => Promise<void>;
    afterDeleteStep1?: (indexName: string) => Promise<void>;
    beforeDeleteDrop?: (indexName: string, physicalName: string) => Promise<void>;
    /** Called when a delete found a registration using a name it is about to drop, before handing it over. */
    beforeDeleteHandover?: (indexName: string, physicalName: string) => Promise<void>;
    /** Called by createIndex/createSearchIndex after the registry write and before the pending-drop check. */
    beforePendingDropCheck?: (indexName: string) => Promise<void>;
    beforeDeleteFinalize?: (indexName: string) => Promise<void>;
    afterClaimRead?: (indexName: string) => Promise<void>; // called by claimLegacyIndex after its first registry read
    /** Called by claimLegacyIndex after its IN_USE pre-check, right before it inserts a new entry. */
    beforeClaimInsert?: (indexName: string) => Promise<void>;
    /** Called by claimLegacyIndex right after its registry write, before the handshake and the re-list. */
    afterClaimWrite?: (indexName: string) => Promise<void>;
    /** Called by claimLegacyIndex after it decided to undo its write, right before the pinned undo. */
    beforeClaimUndo?: (indexName: string) => Promise<void>;
    /** Called by createIndex right after it reads the existing registry entry. */
    afterCreateIndexRead?: (indexName: string) => Promise<void>;
    /** Called by createSearchIndex right after it reads the existing registry entry. */
    afterCreateSearchIndexRead?: (indexName: string) => Promise<void>;
    /** Called by createSearchIndex after it resolves the target and before it reads the registry entry. */
    afterCreateSearchIndexTarget?: (indexName: string) => Promise<void>;
    /** Called by createSearchIndex after the registry write and before provisioning; a throw simulates a provisioning failure. */
    beforeSearchIndexProvision?: (indexName: string) => Promise<void>;
    /** Wraps every `createSearchIndexes` command; `run` sends the real one. */
    createSearchIndexesCommand?: (command: Document, run: () => Promise<Document>) => Promise<Document>;
    beforeDecisivePreList?: (indexName: string, name: string) => Promise<void>;
    /** Replaces a listing's result for a phase; undefined means the real listing. May throw. */
    listSearchIndexesStub?: (name: string, phase: ListPhase) => SearchIndexRow[] | undefined;
    /** Called right after the P2 intent insert. */
    afterProvisionIntent?: (indexName: string, name: string) => Promise<void>;
    /** Called after the decisive pre-list found the name absent, right before the P3b fence and the create. */
    beforeAtlasCreate?: (indexName: string, name: string) => Promise<void>;
    /** Called after a proven verdict, right before the P6 proof write. */
    beforeProof?: (indexName: string, name: string) => Promise<void>;
    /** Overrides the journal lease (LEASE_MS). */
    leaseMs?: number;
    /** Called after the create returned or failed. May throw. */
    afterAtlasCreate?: (indexName: string, name: string) => Promise<void>;
    /** Called by refresh-time TOFU after listing a name, right before recording its id. */
    beforeTofuWrite?: (indexName: string, name: string) => Promise<void>;
    /** Called right before every search-index drop, which is by `id`. */
    beforeSearchIndexDrop?: (collectionName: string, name: string, id: string) => Promise<void>;
    /** Called after the P6 proof, right before P7 records ownership. */
    beforeRecordOwnership?: (indexName: string, name: string) => Promise<void>;
    /** Called by orphan cleanup (§3.8) right after step 1 marked the journal doc `orphaned`. */
    afterOrphanMarked?: (indexName: string, name: string) => Promise<void>;
    /** Called by orphan cleanup (§3.8) right before its drop by id; a throw is a failed drop. */
    beforeOrphanDrop?: (indexName: string, name: string) => Promise<void>;
    /** Called inside the step-3 transaction of orphan cleanup, right after it read the journal doc. */
    afterOrphanJournalRead?: (indexName: string, name: string) => Promise<void>;
  };
  /**
   * Name of the mastra-owned collection that durably records the logical-index → target
   * mapping (`_id: <indexName>`). Kept separate from caller data so a BYO operational
   * collection is never polluted with mastra bookkeeping. Excluded from `listIndexes`.
   */
  private static readonly REGISTRY_COLLECTION = '__mastra_vector_indexes__';
  /** The provisioning journal (§2.2): one doc per search-index create attempt. Excluded from `listIndexes`. */
  private static readonly JOURNAL_COLLECTION = '__mastra_vector_ops__';
  /** The journal's indexes, ensured once per instance; reset on failure so a later call retries. */
  private journalIndexes?: Promise<unknown>;
  /** Set once the journal-index failure was logged, so a persistent failure warns once per instance. */
  private journalIndexWarned = false;
  /**
   * Registry reads and writes, and their transactions, never inherit the client's read preference
   * or concerns (I7a): a read from a lagging secondary would miss a committed registration.
   */
  private static readonly TXN_OPTIONS: TransactionOptions = {
    readPreference: 'primary',
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority' },
  };
  /**
   * Waits between attempts while a queried index is in INITIAL_SYNC, about six seconds in all.
   * On a live Atlas cluster the window lasted around two seconds for both a regular and an
   * autoEmbed index; the budget leaves room for a slower build without holding a failing query
   * for long.
   */
  private static readonly INITIAL_SYNC_RETRY_DELAYS_MS = [250, 500, 1000, 2000, 2000];
  /** Maximum number of matching `_id`s materialized by the pre-filter fallback. */
  private static readonly MAX_PREFILTER_CANDIDATES = 100_000;
  /** BSON array budget, reserving 4 MiB of the 16 MiB command limit for the rest of the pipeline. */
  private static readonly MAX_PREFILTER_ID_BYTES = 12 * 1024 * 1024;
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

  /** The registry handle, pinned to the primary with majority concerns (I7a). */
  private registry(): Collection<RegistryDoc> {
    return this.db.collection<RegistryDoc>(MongoDBVector.REGISTRY_COLLECTION, MongoDBVector.TXN_OPTIONS);
  }

  /** The journal handle, with the registry's I7a options. */
  private journal(): Collection<JournalDoc> {
    const journal = this.db.collection<JournalDoc>(MongoDBVector.JOURNAL_COLLECTION, MongoDBVector.TXN_OPTIONS);
    this.journalIndexes ??= journal
      .createIndexes([{ key: { collectionName: 1, name: 1, state: 1 } }, { key: { indexName: 1, generation: 1 } }])
      .catch(error => {
        if (!this.journalIndexWarned) {
          this.journalIndexWarned = true;
          this.logger.warn(
            `could not create the indexes of ${MongoDBVector.JOURNAL_COLLECTION}; retrying on the next call: ${error}`,
          );
        }
        this.journalIndexes = undefined;
      });
    return journal;
  }

  /** Run `fn` in a transaction with the I7a options. */
  private async inTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      }, MongoDBVector.TXN_OPTIONS);
      return result;
    } finally {
      await session.endSession();
    }
  }

  /**
   * The lazy reconciler (§4): resolves this collection's journal docs whose lease expired. An
   * `intent` never reached Atlas and goes; a `creating` one goes when its name is absent or its
   * row is explained, and otherwise becomes `uncertain` (I9). Every write is conditioned on the
   * observed state, so concurrent reconcilers and a live op never double-apply. A `created` doc
   * is recorded (P7, P7b or P7c), an `orphaned` one cleaned from §3.8 step 2. Never throws.
   * Returns the ids of the docs it tried, so the call's handshake cleans a stale block only once.
   */
  private async reconcile(collectionName: string): Promise<Set<string>> {
    const tried = new Set<string>();
    try {
      const journal = this.journal();
      // `uncertain` docs are never resolved here; selecting them could starve the rest of the batch.
      const docs = await journal
        .find({ collectionName, state: { $ne: 'uncertain' }, ...LEASE_EXPIRED })
        // Oldest lease first; a failure expires the doc anew, so docs that keep failing rotate to the back.
        .sort({ leaseUntil: 1 })
        .limit(RECONCILE_BATCH)
        .toArray();
      for (const doc of docs) {
        tried.add(doc._id);
        try {
          if (doc.state === 'intent')
            await journal.findOneAndDelete({ _id: doc._id, state: 'intent', ...LEASE_EXPIRED });
          else if (doc.state === 'creating') await this.reconcileCreating(doc);
          else if (doc.state === 'created') await this.reconcileCreated(doc);
          else if (doc.state === 'orphaned') await this.cleanupOrphan(doc, 2);
        } catch (error) {
          this.logger.warn(`could not reconcile provisioning record ${doc._id} on "${collectionName}": ${error}`);
          await this.expireLease(doc);
        }
      }
    } catch (error) {
      this.logger.warn(`could not reconcile the provisioning records of "${collectionName}": ${error}`);
    }
    return tried;
  }

  /** Expire a journal doc still in `doc.state` now, so any call retries it at once and behind older ones (R14). */
  private async expireLease(doc: Pick<JournalDoc, '_id' | 'state'>): Promise<void> {
    await this.journal()
      .updateOne({ _id: doc._id, state: doc.state }, [{ $set: { leaseUntil: '$$NOW' } }])
      .catch(error => this.logger.warn(`could not expire provisioning record ${doc._id}: ${error}`));
  }

  /**
   * §4.2 `created`: P7 with the stored id, else P7b (retired) or P7c (§3.8 from step 1), as the op
   * would; their CONFLICT is only logged here. P7 and P7b take the doc in their transaction, so a
   * second reconciler's transaction conflicts, then finds it gone and stops.
   */
  private async reconcileCreated(doc: JournalDoc): Promise<void> {
    const { _id, indexName, collectionName, name, role, generation } = doc;
    const R = doc.indexId!;
    const resolved = new Error('reconcile: the record was resolved by another call');
    const missed = new Error('reconcile: the registration did not match');
    const record = async (retire: boolean) => {
      try {
        await this.inTransaction(async session => {
          const taken = await this.journal().deleteOne({ _id, state: 'created', ...LEASE_EXPIRED }, { session });
          if (taken.deletedCount === 0) throw resolved;
          if (!(await this.recordOwnership(indexName, role, name, generation, R, session, retire))) throw missed;
        });
        return true;
      } catch (error) {
        if (error === missed) return false;
        throw error;
      }
    };
    const what = `search index "${name}" (id ${R}) on "${collectionName}" of provisioning record ${_id}`;
    await this.testHooks?.beforeRecordOwnership?.(indexName, name);
    try {
      for (let round = 0; round < 3; round++) {
        if (await record(false)) return;
        const current = await this.readRegistryEntry(indexName);
        if (!current || current.generation !== generation || current.deleting) {
          const outcome = await this.cleanupOrphan(doc, 1);
          this.logger.warn(`${what}: index "${indexName}" was removed or recreated; the index was ${outcome}`);
          return;
        }
        if (await record(true)) {
          this.logger.warn(`${what}: index "${indexName}" changed its target; kept as a retired index`);
          return;
        }
      }
      this.logger.warn(`${what}: index "${indexName}" kept changing; left for a later reconcile`);
      await this.expireLease(doc);
    } catch (error) {
      if (error !== resolved) throw error;
    }
  }

  /** §4.2 `creating`: list the name, then delete the doc or mark it `uncertain`. */
  private async reconcileCreating(doc: JournalDoc): Promise<void> {
    const { _id, collectionName, name } = doc;
    const [row] = await this.listSearchIndexRows(this.db.collection(collectionName), name, 'reconciler');
    const heldIds = new Set<string>();
    if (row) {
      for (const e of await this.registry().find({ collectionName }).toArray())
        for (const x of e.indexIds ?? []) heldIds.add(x.id);
      for (const j of await this.journal()
        .find({ collectionName, _id: { $ne: _id } })
        .toArray()) {
        if (j.indexId) heldIds.add(j.indexId);
        if (j.candidateId) heldIds.add(j.candidateId);
      }
    }
    const creatingAt = doc.creatingAt ?? new Date(0);
    const resolution = resolveCreating(row, creatingAt, heldIds);
    if (resolution.action === 'delete') {
      const deleted = await this.journal().findOneAndDelete({ _id, state: 'creating' });
      if (deleted && resolution.byTimestamp) this.warnForeignByTimestamp(name, collectionName, row!.id!, creatingAt);
      return;
    }
    const marked = await this.journal().updateOne(
      { _id, state: 'creating' },
      { $set: { state: 'uncertain', candidateId: resolution.candidateId } },
    );
    if (marked.modifiedCount === 1) this.warnUncertain(name, collectionName, resolution.candidateId);
  }

  private warnUncertain(name: string, collectionName: string, candidateId: string | undefined): void {
    this.logger.warn(
      `search index "${name}" on "${collectionName}" (id ${candidateId}) may have been created by Mastra; kept; drop it manually if unused`,
    );
  }

  private warnForeignByTimestamp(name: string, collectionName: string, id: string, creatingAt: Date): void {
    this.logger.warn(
      `search index "${name}" on "${collectionName}" (id ${id}) is not recorded as created by Mastra: its id time ${new Date(idTimestampMs(id)!).toISOString()} is more than ${ID_TIMESTAMP_MARGIN_MS / 1000} s before the pre-list at ${creatingAt.toISOString()}`,
    );
  }

  /**
   * The only path for `createSearchIndexes`, `dropSearchIndex` and `updateSearchIndex` (I7a): on the
   * primary, with no read or write concern, which the server rejects for these commands.
   */
  private async runSearchIndexCommand(command: Document, timeoutMS?: number): Promise<Document> {
    // `timeoutMS` is the client deadline; driver 7.x does not derive `maxTimeMS` from it for a
    // generic command, so the server-side limit is sent explicitly.
    if (timeoutMS) command = { ...command, maxTimeMS: timeoutMS };
    const run = () => this.db.command(command, { readPreference: 'primary', ...(timeoutMS ? { timeoutMS } : {}) });
    const hook = this.testHooks?.createSearchIndexesCommand;
    return 'createSearchIndexes' in command && hook ? hook(command, run) : run();
  }

  /**
   * List the search indexes named `name` on the primary with `readConcern: local` (I7a). The driver's
   * listing cursor ignores the handle's and the client's settings, and takes a read preference only
   * as a `ReadPreference` instance, so both are passed per call. A missing collection has none.
   */
  private async listSearchIndexRows(
    collection: Collection<MongoDBDocument>,
    name: string,
    phase: ListPhase,
  ): Promise<SearchIndexRow[]> {
    const stubbed = this.testHooks?.listSearchIndexesStub?.(name, phase);
    if (stubbed) return stubbed;
    try {
      return (await collection
        // The driver's type omits readConcern, but the cursor sends it; without it a client with
        // readConcernLevel=majority would send none.
        .listSearchIndexes(name, {
          readPreference: ReadPreference.primary,
          readConcern: { level: 'local' },
        } as ListSearchIndexesOptions)
        .toArray()) as SearchIndexRow[];
    } catch (err: any) {
      if (err?.codeName === 'NamespaceNotFound' || err?.code === 26) return [];
      throw err;
    }
  }

  /** The id of the live row listed for `name`; a dying row is present but not ours (§3.1), so it counts as none. */
  private async liveIdOf(
    collection: Collection<MongoDBDocument>,
    name: string,
    phase: ListPhase,
  ): Promise<string | undefined> {
    return (await this.listSearchIndexRows(collection, name, phase)).find(isLiveRow)?.id;
  }

  /**
   * §2.3 refresh-time TOFU (Q5): for each owned name with no `indexIds` entry, list it and record the
   * observed id. Filtered on the name still owned, no entry yet, and the call's P0 pin, so only a
   * call whose P0 is still the latest write records it, and only once. A write advances `pin` in
   * place, so the call's rollback (§3.9) still matches and undoes P0's fields; it keeps the id,
   * which is TOFU proof of a name the registration already owned (§2.3), not part of P0's write.
   * Best effort: delete-time TOFU (§3.7) covers a name it misses.
   */
  private async tofuIndexIds(
    indexName: string,
    pin: P0Pin,
    names: { role: 'vector' | 'text'; name: string }[],
    collection: Collection<MongoDBDocument>,
  ): Promise<void> {
    try {
      const entry = await this.readRegistryEntry(indexName);
      if (!entry || entry.generation !== pin.generation) return;
      for (const { role, name } of names) {
        const nameField = role === 'vector' ? 'searchIndexName' : 'textSearchIndexName';
        const ownsField = role === 'vector' ? 'ownsVectorIndex' : 'ownsTextIndex';
        if (entry[nameField] !== name || entry[ownsField] !== true || idFor(entry, name)) continue;
        const id = await this.liveIdOf(collection, name, 'tofu');
        if (!id) continue;
        await this.testHooks?.beforeTofuWrite?.(indexName, name);
        const claimToken = uuidv4();
        const written = await this.registry().updateOne(
          {
            _id: indexName,
            generation: pin.generation,
            claimToken: pin.claimToken,
            rev: pin.rev,
            deleting: { $ne: true },
            [nameField]: name,
            [ownsField]: true,
            indexIds: { $not: { $elemMatch: { name } } },
          },
          [{ $set: { indexIds: indexIdsWith(name, id), ...mutationFields(claimToken) } }],
        );
        // Someone else wrote since P0: leave it, and the rollback misses as it should.
        if (written.matchedCount === 0) return;
        pin.claimToken = claimToken;
        pin.rev += 1;
      }
    } catch (error) {
      this.logger.warn(`could not record the listed search index ids of index "${indexName}": ${error}`);
    }
  }

  /** Read a logical-index target from the durable registry collection, if present. */
  private async readRegistryEntry(indexName: string): Promise<RegistryDoc | null> {
    const registry = this.registry();
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
   *
   * Every write backfills `generation`, bumps `rev` and sets the `claimToken` in `entry` (a fresh
   * one if absent). `expressions` are pipeline expressions set in the same stage, so they read the
   * pre-write document. Returns what it left, or null when nothing matched without upsert.
   */
  private async writeRegistryEntry(
    indexName: string,
    entry: Partial<RegistryDoc>,
    claim?: Document,
    upsert = true,
    expressions: Document = {},
  ): Promise<P0Result | null> {
    const { claimToken = uuidv4(), ...fields } = entry;
    return this.p0Write(
      { _id: indexName, ...claim },
      mutation => [{ $set: { ...literals({ indexName, ...fields }), ...expressions, ...mutation } }],
      claimToken,
      upsert,
    );
  }

  /**
   * A P0 write. It returns the document as it was before the write, so a rollback restores what
   * this write overwrote (not what the call read earlier) and removes the entry only when this
   * write inserted it (I4). The pin is derived from that pre-image: the same `$ifNull` generation
   * and `rev + 1` the pipeline computes. Null when nothing matched and nothing was inserted.
   */
  private async p0Write(
    filter: Document,
    update: (mutation: Document) => Document[],
    claimToken: string,
    upsert: boolean,
  ): Promise<P0Result | null> {
    const generation = uuidv4();
    const result = await this.registry().findOneAndUpdate(filter, update(mutationFields(claimToken, generation)), {
      upsert,
      returnDocument: 'before',
      includeResultMetadata: true,
    });
    const before = result.value;
    if (!before && !result.lastErrorObject?.upserted) return null;
    return { before, pin: { generation: before?.generation ?? generation, claimToken, rev: (before?.rev ?? 0) + 1 } };
  }

  /**
   * P7: record that this store created search index `name` for `role`, with its proven `id`.
   * Pinned on the registration's `generation` and on `name` still being its current name for the
   * role, not on the call's `claimToken`, so an identical concurrent refresh never makes it miss.
   * The id guard (I11b) requires the name's `indexIds` entry to be absent, `id`, or the R′ read
   * just before; a newer R′ (another call's later create) is kept and logged. No upsert, so a
   * deleted entry stays deleted. Bumps `rev` and sets a fresh `claimToken`, so a concurrent
   * call's rollback never restores a snapshot from before this flag. Returns the id recorded
   * for the name (`id`, or the newer R′ kept), or undefined when the write missed.
   */
  private async recordOwnership(
    indexName: string,
    role: 'vector' | 'text',
    name: string,
    generation: string,
    id: string,
    session?: ClientSession,
    retire = false,
  ): Promise<string | undefined> {
    const registry = this.registry();
    const nameField = role === 'vector' ? 'searchIndexName' : 'textSearchIndexName';
    const ownsField = role === 'vector' ? 'ownsVectorIndex' : 'ownsTextIndex';
    const retiredField = role === 'vector' ? 'retiredVectorIndexNames' : 'retiredTextIndexNames';
    // P7b: owned again if the name is current again (A -> B -> A), otherwise retired.
    const current = { $eq: [`$${nameField}`, { $literal: name }] };
    const ownership = retire
      ? {
          [ownsField]: { $cond: [current, true, `$${ownsField}`] },
          [retiredField]: {
            $cond: [
              current,
              `$${retiredField}`,
              { $setUnion: [{ $ifNull: [`$${retiredField}`, []] }, { $literal: [name] }] },
            ],
          },
        }
      : { [ownsField]: { $literal: true } };
    const recorded = (await registry.findOne({ _id: indexName }, { session }))?.indexIds?.find(
      e => e.name === name,
    )?.id;
    let keep = id;
    if (recorded && recorded !== id && isNewerId(recorded, id)) {
      keep = recorded;
      this.logger.warn(
        `search index "${name}" of index "${indexName}": kept the newer recorded id ${recorded} instead of ${id}, which this call created`,
      );
    }
    const written = await registry.updateOne(
      {
        _id: indexName,
        generation,
        deleting: { $ne: true },
        ...(retire ? {} : { [nameField]: name }),
        $or: [
          { indexIds: { $not: { $elemMatch: { name } } } },
          { indexIds: { $elemMatch: { name, id: { $in: recorded ? [id, recorded] : [id] } } } },
        ],
      },
      [
        {
          $set: {
            ...ownership,
            indexIds: indexIdsWith(name, keep),
            ...mutationFields(),
          },
        },
      ],
      { session },
    );
    return written.matchedCount === 1 ? keep : undefined;
  }

  /**
   * Provision one search index (§3.1): the attach fast path (P1), the journal intent (P2), the P3
   * check, the decisive pre-list (P3a), the fence (P3b), the create by raw command (P4), the
   * verdict (P5), the durable proof (P6) and recording the proven id (P7). Never rolls back itself;
   * every failure is a {@link ProvisionAbort} telling the caller whether it still may.
   */
  private async provisionSearchIndex(args: {
    indexName: string;
    collection: Collection<MongoDBDocument>;
    role: 'vector' | 'text';
    op: 'CREATE_INDEX' | 'CREATE_SEARCH_INDEX';
    description: { name: string; type: 'vectorSearch' | 'search'; definition: Document };
    pin: P0Pin;
    check: () => Promise<void>;
  }): Promise<{ outcome: 'owned'; id: string } | { outcome: 'attached'; row: SearchIndexRow | undefined }> {
    const { indexName, collection, role, op, description, pin, check } = args;
    const { name, type } = description;
    const collectionName = collection.collectionName;
    const leaseMs = this.testHooks?.leaseMs ?? LEASE_MS;
    const journal = this.journal();
    const _id = `${pin.claimToken}:${role}`;
    const identity = { indexName, generation: pin.generation, collectionName, name, type, role };
    const stuck = (row: SearchIndexRow) =>
      new MastraError({
        id: createVectorErrorId('MONGODB', op, 'CONFLICT'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName, collectionName },
        text: `search index "${name}" on "${collectionName}" is in status ${row.status} (id ${row.id}); the previous index under this name is still being removed. Retry. If it persists, drop it manually.`,
      });
    // A reconciler may have removed it already; then this matches nothing.
    const dropIntent = () => journal.findOneAndDelete({ _id, state: 'intent' });
    let hasIntent = false;
    let p4: P4Outcome | undefined;
    try {
      // P1: an existing live row is attached without a journal doc.
      const [listed] = await this.listSearchIndexRows(collection, name, 'P1');
      if (listed) {
        if (!isLiveRow(listed)) throw stuck(listed);
        await check();
        // R12: a cleanup may have dropped R and removed its record between the listing and the
        // check, which then sees nothing; re-list so a dropped index is never attached. Once the
        // check passed, any such drop is complete: absent means provision below, dying means retry.
        const [again] = await this.listSearchIndexRows(collection, name, 'P1');
        if (again) {
          if (!isLiveRow(again)) throw stuck(again);
          return { outcome: 'attached', row: again };
        }
      }
      // P2. An upsert only so the lease is on the server's clock, as the reconciler compares it there;
      // `_id` is this call's own, so it always inserts. Filtered on no state, so an existing doc
      // raises 11000 instead of being reset to `intent`.
      await journal.updateOne(
        { _id, state: { $exists: false } },
        [
          {
            $set: {
              ...literals({ ...identity, state: 'intent' }),
              leaseUntil: { $add: ['$$NOW', leaseMs] },
              createdAt: '$$NOW',
            },
          },
        ],
        { upsert: true },
      );
      hasIntent = true;
      await this.testHooks?.afterProvisionIntent?.(indexName, name);
      await check();
      await this.testHooks?.beforeDecisivePreList?.(indexName, name);
      const [pre] = await this.listSearchIndexRows(collection, name, 'P3a');
      if (pre) {
        await dropIntent();
        hasIntent = false;
        if (!isLiveRow(pre)) throw stuck(pre);
        return { outcome: 'attached', row: pre };
      }
      await this.testHooks?.beforeAtlasCreate?.(indexName, name);
      // P3b: the server's clock, so client skew can't trip the id-timestamp rule.
      const fenced = await journal.findOneAndUpdate(
        { _id, state: 'intent' },
        [
          {
            $set: {
              state: { $literal: 'creating' },
              preListAbsent: { $literal: true },
              creatingAt: '$$NOW',
              leaseUntil: { $add: ['$$NOW', leaseMs] },
            },
          },
        ],
        { returnDocument: 'after' },
      );
      hasIntent = false;
      if (!fenced) {
        // A reconciler removed the intent: this call outlived its lease and must not call Atlas.
        throw new MastraError({
          id: createVectorErrorId('MONGODB', op, 'CONFLICT'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName, collectionName },
          text: `Index "${indexName}" was removed or recreated by another call while this one ran, so nothing was provisioned. Retry.`,
        });
      }
      const creatingAt = fenced.creatingAt!;
      try {
        const reply = await this.runSearchIndexCommand(
          { createSearchIndexes: collectionName, indexes: [description] },
          CREATE_TIMEOUT_MS,
        );
        const id = reply.indexesCreated?.[0]?.id;
        p4 = id ? { kind: 'ok', id: String(id) } : { kind: 'unknown', error: new Error('create returned no id') };
      } catch (error) {
        p4 = p4OutcomeOf(error);
      }
      await this.testHooks?.afterAtlasCreate?.(indexName, name);
      // A failed listing counts as no row: after `ok R` that still proves R (P5, I1).
      const [row] = await this.listSearchIndexRows(collection, name, 'P5').catch(() => []);
      const verdict = classify(p4, row, creatingAt);
      if (verdict.kind === 'proven') {
        await this.testHooks?.beforeProof?.(indexName, name);
        // P6: restores a complete doc even if a reconciler removed it meanwhile.
        await journal.updateOne(
          { _id },
          {
            $set: { state: 'created', indexId: verdict.id },
            $setOnInsert: { ...identity, createdAt: new Date(), leaseUntil: new Date(Date.now() + leaseMs) },
          },
          { upsert: true },
        );
        await this.testHooks?.beforeRecordOwnership?.(indexName, name);
        const conflict = (text: string, cleanup?: string) =>
          new ProvisionAbort(
            new MastraError({
              id: createVectorErrorId('MONGODB', op, 'CONFLICT'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              details: { indexName, collectionName, searchIndexName: name, ...(cleanup ? { cleanup } : {}) },
              text,
            }),
            false,
          );
        // P7 (retire false) or P7b (retire true), each deleting the journal doc in its transaction.
        const record = (retire: boolean) =>
          this.inTransaction(async session => {
            const kept = await this.recordOwnership(indexName, role, name, pin.generation, verdict.id, session, retire);
            if (kept) await journal.deleteOne({ _id }, { session });
            return kept;
          });
        for (let round = 0; round < 3; round++) {
          const recorded = await record(false);
          if (recorded) return { outcome: 'owned', id: recorded };
          // P7a: the match failed; a fresh read decides between P7b and P7c.
          const current = await this.readRegistryEntry(indexName);
          if (!current || current.generation !== pin.generation || current.deleting) {
            // P7c: no registration of this lifetime is left to hold the index.
            const now = new Date();
            // details.cleanup says what actually happened, e.g. `failed` when the drop did not go through.
            const cleanup = await this.cleanupOrphan(
              { _id, ...identity, state: 'created', indexId: verdict.id, leaseUntil: now, createdAt: now },
              1,
              op,
            );
            throw conflict(
              'the registration was removed or recreated while this call ran; what it created was handed over or removed',
              cleanup,
            );
          }
          // P7b: kept as a retired index of this registration, dropped by deleteIndex (Q4).
          if (await record(true)) {
            throw conflict(
              'the target changed concurrently; the index this call created is kept as a retired index of the registration and removed by deleteIndex',
            );
          }
        }
        // Only a registration changing on every round gets here; the doc stays `created` for the reconciler.
        throw conflict(
          `Index "${indexName}" kept changing while this call recorded search index "${name}" (id ${verdict.id}); it is kept under a cleanup record. Retry.`,
        );
      }
      switch (verdict.kind) {
        case 'uncertain':
          // Kept, never owned or dropped (I9); upserted in case a reconciler removed the doc meanwhile.
          await journal.updateOne(
            { _id },
            {
              $set: { state: 'uncertain', candidateId: verdict.candidateId },
              $setOnInsert: { ...identity, createdAt: new Date(), leaseUntil: new Date(Date.now() + leaseMs) },
            },
            { upsert: true },
          );
          this.warnUncertain(name, collectionName, verdict.candidateId);
          if (!isLiveRow(row)) throw new ProvisionAbort(stuck(row!), false);
          return { outcome: 'attached', row };
        case 'pending':
          // The doc stays `creating`: the reconciler deletes it, or marks a late create uncertain.
          throw new ProvisionAbort(
            new MastraError(
              {
                id: createVectorErrorId('MONGODB', op, 'FAILED'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.THIRD_PARTY,
                details: { indexName, collectionName },
                text: `The create of search index "${name}" on "${collectionName}" may or may not have reached Atlas. Retry.`,
              },
              (p4 as { error: unknown }).error,
            ),
            false,
          );
      }
      // Foreign or not created: nothing of this attempt to record.
      await journal.deleteOne({ _id });
      if (row && !isLiveRow(row)) throw new ProvisionAbort(stuck(row), true);
      if (verdict.kind === 'foreign') {
        if (verdict.byTimestamp)
          this.warnForeignByTimestamp(name, collectionName, (p4 as { id: string }).id, creatingAt);
        return { outcome: 'attached', row };
      }
      const error = (p4 as { error: any }).error;
      // A create racing another one under the same name is refused as a duplicate: Atlas Local
      // says BadValue "duplicate index names", a cluster IndexAlreadyExists (68) "is already
      // defined". The name is the winner's, never this call's: attach it like P1 (I6), with the
      // check re-run and a re-list after it (R12).
      const message = String(error?.message);
      if (
        (error?.code === 2 && /duplicate index name/i.test(message)) ||
        error?.code === 68 ||
        /is already defined for collection/i.test(message)
      ) {
        await check();
        const [again] = await this.listSearchIndexRows(collection, name, 'P5');
        if (again && !isLiveRow(again)) throw new ProvisionAbort(stuck(again), true);
        if (again) {
          // debug, not warn: the expected outcome of identical concurrent calls, nothing to act on.
          this.logger.debug(
            `search index "${name}" on "${collectionName}": a concurrent create won (id ${again.id}); attached, not recorded as created by this call`,
          );
          return { outcome: 'attached', row: again };
        }
      }
      throw new ProvisionAbort(error, true);
    } catch (error) {
      if (error instanceof ProvisionAbort) throw error;
      // P3 failure: the intent goes (best effort; the reconciler removes it otherwise).
      if (hasIntent) await dropIntent().catch(() => {});
      // Before the create every failure is rollback-eligible; after it, nothing is known.
      throw new ProvisionAbort(error, !p4 || p4.kind === 'refused');
    }
  }

  /**
   * Undo this call's P0 write after provisioning failed (§3.9). Pinned on the `generation`,
   * `claimToken` and `rev` P0 left (I4): any write since (a refresh, a P7, a claim, a delete
   * transaction) makes it miss, and then everything stays as it is. `restore` null means P0
   * inserted the entry, so it is removed; otherwise only the fields P0 wrote are restored, with
   * `rev` bumped and a fresh `claimToken`, so `rev` never goes down and a backfilled `generation`
   * stays. Callers never run it after a P7 of the same call. Best effort, so the caller still sees
   * the provisioning error. Returns true when the inserted entry was removed.
   */
  private async rollbackRegistryEntry(
    indexName: string,
    pin: P0Pin,
    restore: { $set: Document; $unset: Record<string, ''> } | null,
  ): Promise<boolean> {
    this.indexTargets.delete(indexName);
    this.declaredFilterPaths.delete(indexName);
    try {
      const registry = this.registry();
      const filter = {
        _id: indexName,
        generation: pin.generation,
        claimToken: pin.claimToken,
        rev: pin.rev,
        deleting: { $ne: true },
      };
      if (!restore) return (await registry.deleteOne(filter)).deletedCount === 1;
      await registry.updateOne(filter, {
        $set: { ...restore.$set, rev: pin.rev + 1, claimToken: uuidv4() },
        ...(Object.keys(restore.$unset).length ? { $unset: restore.$unset } : {}),
      });
    } catch {
      // The entry stays as written. Ownership is never claimed for a failed call, so a later
      // deleteIndex still keeps whatever it cannot prove this store created.
    }
    return false;
  }

  /** Refuse to reuse an entry whose deletion has started; only finishing the delete clears it. */
  private assertNotDeleting(
    entry: RegistryDoc | null,
    op: 'CREATE_INDEX' | 'CREATE_SEARCH_INDEX' | 'CLAIM_LEGACY_INDEX',
  ): void {
    if (!entry?.deleting) return;
    throw new MastraError({
      id: createVectorErrorId('MONGODB', op, 'INDEX_DELETING'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      details: { indexName: entry._id },
      text: `Index "${entry._id}" is being deleted. Retry deleteIndex({ indexName: "${entry._id}" }) to finish the deletion, then try again.`,
    });
  }

  /**
   * Whether the deployment supports transactions (replica set or sharded cluster). Throws when
   * the check itself fails: a failed check must never be mistaken for a standalone server.
   */
  private async probeTransactionSupport(): Promise<boolean> {
    if (this.testHooks?.probeTransactions) return this.testHooks.probeTransactions();
    if (this.transactionSupport === undefined) {
      const hello = await this.db.admin().command({ hello: 1 });
      this.transactionSupport = Boolean(hello.setName) || hello.msg === 'isdbgrid';
    }
    return this.transactionSupport;
  }

  /**
   * Run a delete decision in a transaction, or directly on a confirmed standalone server.
   * Returns only the result of the attempt that committed. Never rolls registry state back.
   */
  private async runDeleteTransaction<T>(indexName: string, fn: (session?: ClientSession) => Promise<T>): Promise<T> {
    const fail = (code: 'CAPABILITY_CHECK_FAILED' | 'OUTCOME_UNKNOWN' | 'FAILED', error: unknown) =>
      new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'DELETE_INDEX', code),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
          ...(code === 'OUTCOME_UNKNOWN'
            ? {
                text: `The delete of index "${indexName}" may or may not have committed. Retry deleteIndex({ indexName: "${indexName}" }); a not-registered error on retry means it completed. A retry deletes whatever is registered under this name then, and no read can tell the original registration from a re-created one: if another process may re-create it, coordinate with it first, and don't retry by name if you can't rule out a re-create.`,
              }
            : {}),
        },
        error,
      );
    let supported: boolean;
    try {
      supported = await this.probeTransactionSupport();
    } catch (error) {
      throw fail('CAPABILITY_CHECK_FAILED', error);
    }
    if (!supported) return await fn(undefined);

    const session = this.client.startSession();
    let result!: T;
    let committed = false;
    try {
      await session.withTransaction(async () => {
        result = await fn(session);
      }, MongoDBVector.TXN_OPTIONS);
      committed = true;
      await this.testHooks?.afterDeleteCommit?.(indexName);
      return result;
    } catch (error: any) {
      if (committed || error?.hasErrorLabel?.('UnknownTransactionCommitResult')) throw fail('OUTCOME_UNKNOWN', error);
      if (error instanceof MastraError) throw error;
      throw fail('FAILED', error);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Whether `own` (read inside a delete transaction) is a newer lifetime than `entry` (the call's
   * first read): true means the registration to delete is finished and `own` replaced it. An entry
   * read without a generation can't tell a backfill from a replacement, so that refuses retryably.
   */
  private replacedSince(entry: RegistryDoc, own: RegistryDoc): boolean {
    if (entry.generation) return own.generation !== entry.generation;
    if (!own.generation) return false;
    throw new MastraError({
      id: createVectorErrorId('MONGODB', 'DELETE_INDEX', 'CONFLICT'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      details: { indexName: entry._id },
      text: `Index "${entry._id}" changed while deleteIndex ran, so nothing was dropped. Retry deleteIndex({ indexName: "${entry._id}" }).`,
    });
  }

  /**
   * Delete a registration whose collection stays (BYO, or managed with `ownsCollection: false`).
   * Step 1 decides, in one transaction, which Mastra-created search indexes to drop and which to
   * hand to a sibling still using them; steps 2 and 3 drop the rest and remove the entry. A
   * `null` collection means it is gone, so every drop is already done.
   */
  private async deleteKeepCollection(
    entry: RegistryDoc,
    collection: Collection<MongoDBDocument> | null,
  ): Promise<void> {
    const indexName = entry._id;
    const registry = this.registry();
    let work: { drop: string[]; deleteToken: string } | 'gone' | 'handed-off';
    if (entry.deleting && entry.deleteToken) {
      work = { drop: recordedDropSet(entry), deleteToken: entry.deleteToken };
    } else {
      // Evidence for I11b only (Atlas can't be read inside the transaction): each candidate's listed id.
      const observed: Record<string, string | undefined> = {};
      for (const name of collection ? recordedDropSet(entry) : [])
        observed[name] = await this.liveIdOf(collection!, name, 'delete');
      let attempt = 0;
      let uncertain: JournalDoc[] = [];
      work = await this.runDeleteTransaction(indexName, async session => {
        attempt++;
        uncertain = [];
        const own = await registry.findOne({ _id: indexName }, { session });
        // Missing, or recreated elsewhere since our first read: the registration we were asked
        // to delete is already finished, and the replacement is not ours to touch.
        if (!own || own.collectionName !== entry.collectionName || !(own.isByo || own.ownsCollection === false))
          return 'gone' as const;
        if (this.replacedSince(entry, own)) return 'gone' as const;
        // Another call committed this delete's decision since our first read: continue its attempt.
        if (own.deleting && own.deleteToken) return { drop: recordedDropSet(own), deleteToken: own.deleteToken };
        const live = { collectionName: own.collectionName, _id: { $ne: indexName }, deleting: { $ne: true } };
        const siblings = await registry.find(live, { session }).toArray();
        await this.testHooks?.insideDeleteTransaction?.(indexName, attempt);
        const plan = planDeleteCleanup(own, siblings, observed);
        // Record the listed id of every name to drop that has none (registered by an earlier
        // version), so a resumed delete drops that index by id instead of listing the name again,
        // possibly much later. A name with no id and no listing is already gone.
        const idOf = (name: string) => own.indexIds?.find(e => e.name === name)?.id ?? observed[name];
        const drop = collection ? plan.drop.filter(name => idOf(name)) : plan.drop;
        if (!(await this.applyCleanupWrites(indexName, own.collectionName, plan, siblings, session))) {
          // Only a deployment without transactions sees this; there the plan's earlier writes stay,
          // and the retry plans from them.
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'DELETE_INDEX', 'CONFLICT'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName },
            text: `Registrations using the search indexes of index "${indexName}" changed while deleteIndex ran, so nothing was dropped. Retry deleteIndex({ indexName: "${indexName}" }).`,
          });
        }
        // Uncertain records of this lifetime, and of lifetimes no registration on the collection holds.
        const held = (
          await registry.find({ collectionName: own.collectionName, _id: { $ne: indexName } }, { session }).toArray()
        ).flatMap(d => (d.generation ? [d.generation] : []));
        uncertain = await this.journal()
          .find(
            {
              collectionName: own.collectionName,
              state: 'uncertain',
              $or: [...(own.generation ? [{ generation: own.generation }] : []), { generation: { $nin: held } }],
            },
            { session },
          )
          .toArray();
        if (uncertain.length) await this.journal().deleteMany({ _id: { $in: uncertain.map(d => d._id) } }, { session });
        if (!drop.length) {
          await registry.deleteOne({ _id: indexName }, { session });
          return 'handed-off' as const;
        }
        const deleteToken = uuidv4();
        await registry.updateOne(
          { _id: indexName },
          {
            $set: {
              ownsVectorIndex: own.ownsVectorIndex === true && drop.includes(own.searchIndexName),
              ownsTextIndex:
                own.ownsTextIndex === true && !!own.textSearchIndexName && drop.includes(own.textSearchIndexName),
              retiredTextIndexNames: (own.retiredTextIndexNames ?? []).filter(n => drop.includes(n)),
              retiredVectorIndexNames: (own.retiredVectorIndexNames ?? []).filter(n => drop.includes(n)),
              indexIds: drop.flatMap(name => {
                const id = idOf(name);
                return id ? [{ name, id }] : [];
              }),
              deleting: true,
              deleteToken,
            },
            $inc: { rev: 1 },
          },
          { session },
        );
        return { drop, deleteToken };
      });
      // Logged after the commit, so a retried transaction logs each once.
      for (const d of uncertain) this.warnUncertain(d.name, d.collectionName, d.candidateId);
    }
    if (typeof work === 'string') return;

    const { drop, deleteToken } = work;
    await this.testHooks?.afterDeleteStep1?.(indexName);
    for (const name of drop) {
      await this.testHooks?.beforeDeleteDrop?.(indexName, name);
      // Another call finished this attempt, and the name may have been reused since: leave it.
      const current = await registry.findOne({ _id: indexName, deleting: true, deleteToken });
      if (!current) return;
      const outcome = await this.handOverPendingDrop(entry.collectionName, indexName, deleteToken, name);
      if (outcome === 'gone') return;
      if (outcome === 'drop' && collection)
        await this.dropRecordedOrListed(entry.collectionName, name, idFor(current, name));
    }
    await this.testHooks?.beforeDeleteFinalize?.(indexName);
    // Matches nothing when another call already finished this attempt; that is success too.
    await registry.deleteOne({ _id: indexName, deleting: true, deleteToken });
  }

  /**
   * Write a delete plan's transfers (the owns flag, plus the id when the plan carries one) and id
   * rewrites, and log its kept names. Every user the plan chose (a recipient, or an owner of a
   * released name among `siblings`) gets `rev + 1` and a fresh `claimToken` (R4-2, R5-2), so a
   * pinned undo by its own op misses; the other live siblings get `rev + 1`. False when a recipient
   * no longer uses the name it was planned for, or an owner no longer owns the name it was to
   * rewrite, which only a deployment without transactions can see.
   */
  private async applyCleanupWrites(
    indexName: string,
    collectionName: string,
    plan: DeleteCleanupPlan,
    siblings: OwnershipView[],
    session?: ClientSession,
  ): Promise<boolean> {
    const registry = this.registry();
    for (const t of plan.transfers) {
      const nameField = t.field === 'ownsTextIndex' ? 'textSearchIndexName' : 'searchIndexName';
      const moved = await registry.updateOne(
        { _id: t.toId, [nameField]: t.name, deleting: { $ne: true } },
        [{ $set: { [t.field]: { $literal: true }, ...(t.id ? { indexIds: indexIdsWith(t.name, t.id) } : {}) } }],
        { session },
      );
      if (moved.matchedCount === 0) return false;
    }
    for (const r of plan.rewrites) {
      const rewritten = await registry.updateOne(
        {
          _id: r.toId,
          deleting: { $ne: true },
          // Still owned by the entry; otherwise its id is no longer this plan's to set.
          $or: [
            { searchIndexName: r.name, ownsVectorIndex: true },
            { textSearchIndexName: r.name, ownsTextIndex: true },
            { retiredTextIndexNames: r.name },
            { retiredVectorIndexNames: r.name },
          ],
        },
        [{ $set: { indexIds: indexIdsWith(r.name, r.id) } }],
        { session },
      );
      if (rewritten.matchedCount === 0) return false;
    }
    const chosen = [
      ...new Set([
        ...plan.transfers.map(t => t.toId),
        ...siblings.filter(s => !s.deleting && plan.released.some(n => owns(s, n))).map(s => s._id),
      ]),
    ];
    for (const _id of chosen)
      await registry.updateOne({ _id, deleting: { $ne: true } }, [{ $set: mutationFields() }], { session });
    // Every concurrent delete transaction on this collection writes these documents, so they conflict.
    await registry.updateMany(
      { collectionName, _id: { $nin: [indexName, ...chosen] }, deleting: { $ne: true } },
      { $inc: { rev: 1 } },
      { session },
    );
    for (const name of plan.kept) {
      this.logger.warn(
        `search index "${name}" on "${collectionName}": the incarnation index "${indexName}" recorded is gone or was replaced, and other registrations still reference the name; neither dropped nor handed over. Drop it manually if unused`,
      );
    }
    return true;
  }

  /**
   * Last check before a delete drops `name`: a registration that started using it after the delete
   * committed its drop set takes over the cleanup responsibility instead (or keeps it, if it
   * already owns the index), and the name leaves this delete's drop set. This is the delete half
   * of a write-then-read handshake with {@link assertNoPendingDrop}: each side writes its
   * registration state before reading the other's, and both reads go to the primary (the client's
   * default), which returns every committed write, so at least one side sees the conflict.
   * Returns `drop` when nothing uses the name, `kept` when it was handed over, `gone` when another
   * call finished this delete attempt.
   */
  private async handOverPendingDrop(
    collectionName: string,
    indexName: string,
    deleteToken: string,
    name: string,
  ): Promise<'drop' | 'kept' | 'gone'> {
    const registry = this.registry();
    const live = { collectionName, _id: { $ne: indexName }, deleting: { $ne: true } };
    const users = {
      ...live,
      $or: [
        { searchIndexName: name },
        { textSearchIndexName: name },
        { retiredTextIndexNames: name },
        { retiredVectorIndexNames: name },
      ],
    };
    // Further rounds cover a user that changes between the read and the transfer on a deployment
    // without transactions; inside a transaction a concurrent change is a write conflict and retries.
    for (let round = 0; round < 3; round++) {
      if (!(await registry.findOne(users))) return 'drop';
      await this.testHooks?.beforeDeleteHandover?.(indexName, name);
      // A fresh listing right before the transfer, evidence for I11b only.
      const observed = { [name]: await this.liveIdOf(this.db.collection(collectionName), name, 'delete') };
      const outcome = await this.runDeleteTransaction(indexName, async session => {
        const own = await registry.findOne({ _id: indexName, deleting: true, deleteToken }, { session });
        if (!own) return 'gone' as const;
        const current = await registry.find(users, { session }).toArray();
        const plan = planDeleteCleanup(
          { _id: indexName, searchIndexName: name, ownsVectorIndex: true, indexIds: own.indexIds },
          current,
          observed,
        );
        if (plan.drop.length) return 'drop' as const;
        // Same conflict rule as the delete decision: concurrent delete transactions on the collection serialize.
        if (!(await this.applyCleanupWrites(indexName, collectionName, plan, current, session)))
          return 'recheck' as const;
        await registry.updateOne(
          { _id: indexName, deleteToken },
          {
            $set: {
              ownsVectorIndex: own.ownsVectorIndex === true && own.searchIndexName !== name,
              ownsTextIndex: own.ownsTextIndex === true && own.textSearchIndexName !== name,
            },
            $pull: { retiredTextIndexNames: name, retiredVectorIndexNames: name, indexIds: { name } },
            $inc: { rev: 1 },
          },
          { session },
        );
        return 'kept' as const;
      });
      if (outcome !== 'recheck') return outcome;
    }
    throw new MastraError({
      id: createVectorErrorId('MONGODB', 'DELETE_INDEX', 'CONFLICT'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      details: { indexName, searchIndexName: name },
      text: `Registrations using search index "${name}" kept changing while deleteIndex ran, so it was not dropped. Retry deleteIndex({ indexName: "${indexName}" }).`,
    });
  }

  /**
   * §3.8: proven incarnation `doc.indexId` (R) of `doc.name` lost the registration of its lifetime.
   * Step 1 marks the journal doc `orphaned` (the cleaner half of the I7 handshake: written before
   * the users are read, so an attach either sees it or is seen). Step 3 decides in a transaction
   * that re-reads the doc and the users: any live user blocks the drop (I11a); owners are released,
   * else the lowest-`_id` user gets R when the listing confirms it; every user written gets
   * `rev + 1` and a fresh `claimToken` (R4-2). With no user, the decision to drop is written to the
   * doc (R11), so every later cleaner drops too instead of handing R to a later attacher, and step
   * 4 drops R by id. The doc goes only after the drop, so attaches stay refused (M8) until then. A
   * failed drop keeps the doc, logs at error and returns `failed`.
   */
  private async cleanupOrphan(
    doc: JournalDoc,
    fromStep: 1 | 2,
    op: 'CREATE_INDEX' | 'CREATE_SEARCH_INDEX' | 'CLAIM_LEGACY_INDEX' = 'CREATE_INDEX',
  ): Promise<'dropped' | 'released' | 'transferred' | 'kept' | 'failed'> {
    const { _id, indexName, collectionName, name } = doc;
    const R = doc.indexId!;
    const journal = this.journal();
    const registry = this.registry();
    const leaseMs = this.testHooks?.leaseMs ?? LEASE_MS;
    const renewLease = { leaseUntil: { $add: ['$$NOW', leaseMs] } };
    if (fromStep === 1) {
      const marked = await journal.updateOne({ _id, state: { $in: ['created', 'orphaned'] } }, [
        { $set: { state: { $literal: 'orphaned' }, indexId: { $literal: R }, ...renewLease } },
      ]);
      // Another cleaner finished it already.
      if (marked.matchedCount === 0) return 'kept';
      await this.testHooks?.afterOrphanMarked?.(indexName, name);
    }
    const users = {
      collectionName,
      deleting: { $ne: true },
      $or: [
        { searchIndexName: name },
        { textSearchIndexName: name },
        { retiredTextIndexNames: name },
        { retiredVectorIndexNames: name },
      ],
    };
    const ownsName = [
      { searchIndexName: name, ownsVectorIndex: true },
      { textSearchIndexName: name, ownsTextIndex: true },
      { retiredTextIndexNames: name },
      { retiredVectorIndexNames: name },
    ];
    // Thrown inside the step-3 transaction when a filter missed, so the round commits nothing.
    const recheck = new Error('orphan cleanup: a user changed; recheck');
    for (let round = 0; round < 3; round++) {
      // Outside the transaction: listings never run in one (I7a). Evidence for I11b only.
      const observed = await this.liveIdOf(this.db.collection(collectionName), name, 'orphan');
      let outcome: 'gone' | 'drop' | 'released' | 'transferred' | 'kept';
      try {
        outcome = await this.inTransaction(async session => {
          const j = await journal.findOne({ _id, state: 'orphaned' }, { session });
          await this.testHooks?.afterOrphanJournalRead?.(indexName, name);
          if (!j) return 'gone' as const;
          if (j.dropDecided) return 'drop' as const;
          const current: (OwnershipView & { generation?: string })[] = await registry
            .find(users, { session })
            .toArray();
          const plan = planOrphanCleanup(name, R, observed, current);
          if (plan.kind === 'drop') {
            // R11: durable, and a write to J, so a concurrent step 3 on J conflicts and re-reads it.
            await journal.updateOne(
              { _id, state: 'orphaned' },
              [{ $set: { dropDecided: { $literal: true }, ...renewLease } }],
              { session },
            );
            return 'drop' as const;
          }
          const userOf = (toId: string) => current.find(u => u._id === toId)!;
          const generationOf = (toId: string) => userOf(toId).generation ?? { $exists: false as const };
          if (plan.kind === 'release') {
            for (const o of plan.owners) {
              const held = idFor(userOf(o.toId), name);
              if (!o.rewriteId && held !== undefined && held !== R) {
                this.logger.warn(
                  `search index "${name}" on "${collectionName}": index "${o.toId}" records id ${held}, not ${R} (cleanup record ${_id}); kept, as the listing does not confirm ${R}`,
                );
              }
              const rewrite = o.rewriteId ? { indexIds: indexIdsWith(name, o.rewriteId) } : {};
              const released = await registry.updateOne(
                { _id: o.toId, generation: generationOf(o.toId), deleting: { $ne: true }, $or: ownsName },
                [{ $set: { ...rewrite, ...mutationFields() } }],
                { session },
              );
              if (released.matchedCount === 0) throw recheck;
            }
          } else if (plan.kind === 'transfer') {
            const nameField = plan.field === 'ownsTextIndex' ? 'textSearchIndexName' : 'searchIndexName';
            const owned = { [plan.field]: { $literal: true }, indexIds: indexIdsWith(name, plan.id) };
            const moved = await registry.updateOne(
              { _id: plan.toId, generation: generationOf(plan.toId), deleting: { $ne: true }, [nameField]: name },
              [{ $set: { ...owned, ...mutationFields() } }],
              { session },
            );
            if (moved.matchedCount === 0) throw recheck;
          } else {
            this.logger.warn(
              `search index "${name}" on "${collectionName}": the incarnation ${R} of cleanup record ${_id} is no longer listed, and registrations still reference the name; neither dropped nor handed over`,
            );
          }
          await journal.deleteOne({ _id, state: 'orphaned' }, { session });
          return plan.kind === 'release' ? 'released' : plan.kind === 'transfer' ? 'transferred' : 'kept';
        });
      } catch (error) {
        if (error === recheck) continue;
        throw error;
      }
      if (outcome === 'gone') return 'kept';
      if (outcome !== 'drop') return outcome;
      // Step 4. The doc stays until the drop by id is done; IndexNotFound counts as done.
      try {
        await this.testHooks?.beforeOrphanDrop?.(indexName, name);
        await this.dropSearchIndexById(collectionName, name, R);
      } catch (error) {
        this.logger.error(
          `could not drop search index "${name}" (id ${R}) on "${collectionName}"; cleanup record ${_id} keeps blocking the name: ${error}`,
        );
        // R14: nobody holds the cleanup now; the next call on the collection retries it.
        await this.expireLease({ _id, state: 'orphaned' });
        return 'failed';
      }
      await journal.deleteOne({ _id, state: 'orphaned' });
      return 'dropped';
    }
    throw new MastraError({
      id: createVectorErrorId('MONGODB', op, 'CONFLICT'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      details: { indexName, collectionName, searchIndexName: name },
      text: `Registrations using search index "${name}" on "${collectionName}" kept changing during its cleanup (cleanup record ${_id}), so it was neither handed over nor dropped. Retry.`,
    });
  }

  /**
   * Refuse to reference a search index that a delete in progress is about to drop. The attach half
   * of the handshake described on {@link handOverPendingDrop}: callers run it after writing their
   * registration, so either this read sees the pending drop or the delete's read sees the registration.
   *
   * It also re-reads this call's own entry, which a deleteIndex may have removed or started removing
   * since the write: provisioning then would leave a search index no registration records. Callers
   * run it last before provisioning. The entry must still record `collectionName` and every name in
   * `expected`, the targets this call provisions: another call may have retargeted it since, and
   * provisioning the old target would leave an index nothing records. A rewrite with the same
   * targets (an identical concurrent call) passes. Last, it must still carry `generation`, the one
   * this call's write left: a delete and an identical recreate (or an old-code recreate without a
   * generation) is another registration, and this call must not provision for it.
   */
  private async assertNoPendingDrop(
    collectionName: string,
    indexName: string,
    names: (string | undefined)[],
    op: 'CREATE_INDEX' | 'CREATE_SEARCH_INDEX',
    expected: Partial<Pick<RegistryDoc, 'searchIndexName' | 'textSearchIndexName'>>,
    generation: string,
    reconciled: Set<string>,
  ): Promise<void> {
    await this.testHooks?.beforePendingDropCheck?.(indexName);
    const registry = this.registry();
    const own = await registry.findOne({ _id: indexName });
    if (!own) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', op, 'CONFLICT'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: `Index "${indexName}" was removed by another call while this one ran, so nothing was provisioned. Retry.`,
      });
    }
    this.assertNotDeleting(own, op);
    // Same managed defaults as resolveIndexTarget, so a legacy entry missing these fields still matches.
    const recorded: RegistryDoc = {
      ...own,
      collectionName: own.collectionName ?? indexName,
      searchIndexName: own.searchIndexName ?? `${indexName}_vector_index`,
    };
    const changed = Object.entries({ collectionName, ...expected })
      .filter(([field, value]) => recorded[field as keyof RegistryDoc] !== value)
      .map(([field, value]) => `${field} "${String(recorded[field as keyof RegistryDoc])}" instead of "${value}"`);
    if (changed.length) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', op, 'CONFLICT'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: `Index "${indexName}" was changed by another call while this one ran (it now records ${changed.join(' and ')}), so nothing was provisioned. Check the index and retry.`,
      });
    }
    if (own.generation !== generation) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', op, 'CONFLICT'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: `Index "${indexName}" was removed or recreated by another call while this one ran, so nothing was provisioned. Retry.`,
      });
    }
    const pending = await this.pendingDropError(collectionName, indexName, names, op, reconciled);
    if (pending) throw pending;
  }

  /**
   * The read half of the I7 handshake: the `INDEX_DELETING` error for the first of `names` an
   * `orphaned` journal doc or another registration's `deleting` drop set covers, if any. A stale
   * orphan block is cleaned once per call (the call's own reconcile counts), then re-checked (P3).
   */
  private async pendingDropError(
    collectionName: string,
    indexName: string,
    names: (string | undefined)[],
    op: 'CREATE_INDEX' | 'CREATE_SEARCH_INDEX' | 'CLAIM_LEGACY_INDEX',
    reconciled: Set<string>,
  ): Promise<MastraError | undefined> {
    const registry = this.registry();
    // M8: a name whose orphan cleanup (§3.8) is pending; its step 1 wrote before reading users (I7).
    const pending = {
      collectionName,
      name: { $in: names.filter((n): n is string => !!n) },
      state: 'orphaned' as const,
    };
    const stale = await this.journal().findOne({ ...pending, _id: { $nin: [...reconciled] }, ...LEASE_EXPIRED });
    if (stale) {
      reconciled.add(stale._id);
      await this.cleanupOrphan(stale, 2, op).catch(error =>
        this.logger.warn(`could not clean up provisioning record ${stale._id} on "${collectionName}": ${error}`),
      );
    }
    const orphan = await this.journal().findOne(pending);
    if (orphan) {
      return new MastraError({
        id: createVectorErrorId('MONGODB', op, 'INDEX_DELETING'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName, searchIndexName: orphan.name, cleanupRecord: orphan._id },
        text: `search index "${orphan.name}" on "${collectionName}" is pending removal of an index Mastra created (cleanup record ${orphan._id}). Retry: retrying runs the cleanup. If the drop keeps failing, the block remains and the failure is logged at error level.`,
      });
    }
    for (const other of await registry.find({ collectionName, deleting: true, _id: { $ne: indexName } }).toArray()) {
      // A managed delete drops the whole collection, so every name on it is pending.
      const name =
        other.ownsCollection === true && !other.isByo
          ? names.find(Boolean)
          : names.find(n => n && recordedDropSet(other).includes(n));
      if (!name) continue;
      return new MastraError({
        id: createVectorErrorId('MONGODB', op, 'INDEX_DELETING'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName, searchIndexName: name, deletingIndexName: other._id },
        text: `The search index "${name}" is being dropped by a deleteIndex in progress (index "${other._id}"). Retry after it finishes; retrying is safe. If that delete was interrupted, retry deleteIndex({ indexName: "${other._id}" }) first. The delete may already have handed the index to this registration, in which case the registration was kept.`,
      });
    }
    return undefined;
  }

  /**
   * Delete a managed registration with recorded ownership (`ownsCollection: true`) by dropping
   * its collection, which removes every search index on it. Refuses with `IN_USE` while any other
   * registration points at the collection. Same token protocol as `deleteKeepCollection`.
   */
  private async deleteManagedCollection(entry: RegistryDoc): Promise<void> {
    const indexName = entry._id;
    const collectionName = entry.collectionName;
    const registry = this.registry();
    const othersFilter = { collectionName, _id: { $ne: indexName } };
    const inUse = (others: RegistryDoc[]) =>
      new MastraError({
        id: createVectorErrorId('MONGODB', 'DELETE_INDEX', 'IN_USE'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName, collectionName, usedBy: others.map(o => o._id).join(', ') },
        text: `Collection "${collectionName}" of index "${indexName}" is still used by ${others.map(o => `"${o._id}"`).join(', ')}. Nothing was dropped. Delete those indexes first, then retry deleteIndex({ indexName: "${indexName}" }).`,
      });
    let deleteToken = entry.deleting ? entry.deleteToken : undefined;
    if (!deleteToken) {
      let attempt = 0;
      const work = await this.runDeleteTransaction(indexName, async session => {
        attempt++;
        const own = await registry.findOne({ _id: indexName }, { session });
        // Missing, or recreated as something else since our first read: not ours to touch.
        if (!own || own.collectionName !== collectionName || own.isByo || own.ownsCollection !== true)
          return 'gone' as const;
        if (this.replacedSince(entry, own)) return 'gone' as const;
        if (own.deleting && own.deleteToken) return { deleteToken: own.deleteToken };
        const others = await registry.find(othersFilter, { session }).toArray();
        await this.testHooks?.insideDeleteTransaction?.(indexName, attempt);
        if (others.length) throw inUse(others);
        const token = uuidv4();
        await registry.updateOne(
          { _id: indexName },
          { $set: { deleting: true, deleteToken: token }, $inc: { rev: 1 } },
          { session },
        );
        return { deleteToken: token };
      });
      if (work === 'gone') return;
      deleteToken = work.deleteToken;
    }

    await this.testHooks?.afterDeleteStep1?.(indexName);
    await this.testHooks?.beforeDeleteDrop?.(indexName, collectionName);
    // Re-check on every attempt: a resumed delete may run long after T1, once someone else has
    // attached to the collection. The entry stays `deleting`, so a later retry can finish.
    const others = await registry.find(othersFilter).toArray();
    // Another call finished this attempt, and the collection may have been recreated since: leave it.
    if (!(await registry.findOne({ _id: indexName, deleting: true, deleteToken }))) return;
    if (others.length) throw inUse(others);
    try {
      await this.db.collection(collectionName).drop();
    } catch (err: any) {
      const code = err?.codeName ?? err?.code;
      if (code !== 'NamespaceNotFound' && code !== 26) throw err;
    }
    this.collections.delete(collectionName);
    await this.testHooks?.beforeDeleteFinalize?.(indexName);
    // Matches nothing when another call already finished this attempt; that is success too.
    await registry.deleteOne({ _id: indexName, deleting: true, deleteToken });
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
    return this.createIndexAttempt(params, false);
  }

  /** `refresh` marks the single retry after losing a registration race to a compatible entry. */
  private async createIndexAttempt(params: MongoDBCreateIndexParams, refresh: boolean): Promise<void> {
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

    const reconciled = await this.reconcile(targetCollection);
    let collection;
    let collectionCreated = false;
    try {
      // Read before creating anything, so refusing a deleting entry has no side effects.
      const existingEntry = await this.readRegistryEntry(indexName);
      this.assertNotDeleting(existingEntry, 'CREATE_INDEX');
      await this.testHooks?.afterCreateIndexRead?.(indexName);
      // Before creating anything, so a refused retarget leaves no empty collection behind.
      // Guard against a conflicting retarget: if this logical index already points at a
      // DIFFERENT physical collection, refuse rather than silently orphan the old collection's
      // search index (and its registry-less data). Idempotent re-createIndex against the same
      // collection is allowed (refreshes the entry).
      if (existingEntry && existingEntry.collectionName !== targetCollection) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: `Index "${indexName}" is already registered against collection "${existingEntry.collectionName}", but this createIndex call resolves to "${targetCollection}". Call deleteIndex({ indexName: "${indexName}" }) first to retarget it.`,
        });
      }

      // Check if collection exists
      const collectionExists = await this.db
        .listCollections({ name: targetCollection }, { readPreference: ReadPreference.primary })
        .hasNext();
      if (!collectionExists) {
        if (isByo) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'INVALID_ARGS'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `collectionName "${targetCollection}" does not exist. Create and populate the collection before indexing it.`,
          });
        }
        try {
          // `create` also succeeds for an existing collection with identical options, so a plain
          // create can't prove this call made it. `validationLevel: 'off'` changes nothing on a
          // collection without a validator, but makes `create` fail with NamespaceExists when the
          // collection was created first with other options, defaults included. One created first
          // with this same option is still taken for Mastra's (a documented cleanup limit).
          await this.db.createCollection(targetCollection, { validationLevel: 'off' });
          collectionCreated = true;
        } catch (error: any) {
          // Created by someone else since the check above: adopt it, never own it.
          if (error?.code !== 48 && error?.codeName !== 'NamespaceExists') throw error;
        }
      }
      collection = await this.getCollection(targetCollection);

      const indexNameInternal = targetSearchIndex;
      const defaultTextSearchIndex = `${targetCollection}_search_index`;

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
      // A retired name keeps its role until deleteIndex drops it (§3.3).
      if (existingEntry?.retiredTextIndexNames?.includes(targetSearchIndex)) {
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          text: `searchIndexName "${targetSearchIndex}" was a full-text search index of index "${indexName}"; choose a different name.`,
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
      const sameEmbedding = (other?: { path: string; model: string } | null) =>
        Boolean(other) === Boolean(resolvedAutoEmbed) &&
        (!other ||
          !resolvedAutoEmbed ||
          (other.path === resolvedAutoEmbed.path && other.model === resolvedAutoEmbed.model));
      if (existingEntry && !sameEmbedding(existingAutoEmbed)) {
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
        // A deleting entry fails the filter, so the upsert hits 11000 and the call refuses with INDEX_DELETING.
        deleting: { $ne: true },
        ...(resolvedAutoEmbed
          ? { 'autoEmbed.path': resolvedAutoEmbed.path, 'autoEmbed.model': resolvedAutoEmbed.model }
          : { autoEmbed: null }),
        // A refresh is pinned on the lifetime it read, so it never writes this call's policy into
        // a replacement (or resurrects a deleted entry). Of concurrent first refreshes of an entry
        // without a generation only one matches; the rest re-run once from a fresh read (below).
        // Otherwise nothing was registered when this call read the entry. Every entry current code
        // writes carries a claimToken, so one written since (a claim, another createIndex) fails
        // the filter, and the upsert's insert hits 11000 instead of overwriting it.
        ...(existingEntry
          ? { generation: existingEntry.generation ?? { $exists: false } }
          : { claimToken: { $exists: false } }),
        // The name-collision guards above read `existingEntry`; a concurrent createSearchIndex
        // renaming the text index to this name since fails the filter (11000, CONFLICT).
        textSearchIndexName: { $ne: targetSearchIndex },
        retiredTextIndexNames: { $ne: targetSearchIndex },
      };
      const claimToken = uuidv4();
      // A managed index adopts an existing collection when one already has its name; record
      // whether this call created it so deleteIndex never drops a collection it found.
      const ownsCollection = existingEntry ? existingEntry.ownsCollection : collectionCreated;
      // What P0 writes besides the protocol fields; a rollback restores exactly these (I4).
      const p0Fields: Partial<RegistryDoc> = {
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
      };
      // §3.3, decided from the STORED name in the same $set stage (every expression reads the
      // pre-write document), never from this call's earlier read: a concurrent rename landing in
      // between keeps its ownership, and its owned name is retired rather than lost.
      const newName = { $literal: targetSearchIndex };
      const retiredVector = { $ifNull: ['$retiredVectorIndexNames', []] };
      const keepVector = {
        $or: [{ $eq: ['$searchIndexName', newName] }, { $eq: [{ $type: '$searchIndexName' }, 'missing'] }],
      };
      const vectorRename: Document = {
        ownsVectorIndex: { $cond: [keepVector, '$ownsVectorIndex', { $in: [newName, retiredVector] }] },
        retiredVectorIndexNames: {
          $cond: [
            keepVector,
            '$retiredVectorIndexNames',
            {
              $setDifference: [
                {
                  $setUnion: [
                    retiredVector,
                    { $cond: [{ $eq: ['$ownsVectorIndex', true] }, ['$searchIndexName'], []] },
                  ],
                },
                [newName],
              ],
            },
          ],
        },
      };
      let p0: P0Result | null;
      try {
        // Upsert only when nothing was registered; a refresh updates the entry it read or nothing.
        p0 = await this.writeRegistryEntry(
          indexName,
          { ...p0Fields, claimToken },
          registryClaim,
          !existingEntry,
          vectorRename,
        );
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
        p0 = null;
      }
      if (!p0) {
        // The cached target may be the lifetime that just changed; the next call re-reads it.
        this.indexTargets.delete(indexName);
        // A collection this call created for an entry deleted meanwhile is no one's: drop it, as the
        // rollback does, unless a registration references it (read after the miss).
        if (
          collectionCreated &&
          !(await this.registry()
            .findOne({ collectionName: targetCollection })
            .catch(() => true))
        ) {
          this.collections.delete(targetCollection);
          await collection.drop().catch(() => {});
        }
        const winner = await this.readRegistryEntry(indexName);
        this.assertNotDeleting(winner, 'CREATE_INDEX');
        const sameCollection = winner?.collectionName === targetCollection;
        // Another call registered the same target first (e.g. replicas creating it at boot), or
        // backfilled the generation of the entry without one this call read: run once more as an
        // ordinary refresh, which re-reads the entry and keeps its classification and ownership.
        if (!existingEntry?.generation && !refresh && winner && sameCollection && sameEmbedding(winner.autoEmbed)) {
          return await this.createIndexAttempt(params, true);
        }
        const differs = winner
          ? [
              ...(sameCollection ? [] : [`collection "${winner.collectionName}" instead of "${targetCollection}"`]),
              ...(sameEmbedding(winner.autoEmbed)
                ? []
                : [`${describeEmbedding(winner.autoEmbed)} instead of ${describeEmbedding(resolvedAutoEmbed)}`]),
            ]
          : [];
        throw new MastraError({
          id: createVectorErrorId('MONGODB', 'CREATE_INDEX', 'CONFLICT'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { indexName },
          // The winning entry can be gone again by the time it is read back (a concurrent
          // deleteIndex), or change again during the refresh; either way a retry can succeed.
          text: differs.length
            ? `Index "${indexName}" was registered concurrently by another call with ${differs.join(' and ')}. Nothing was changed. Use the registered target, or pick a different indexName.`
            : `Index "${indexName}" was registered or removed concurrently by another call while this one ran. Nothing was changed. Retry createIndex.`,
        });
      }
      const { pin, before: p0Before } = p0;
      await this.tofuIndexIds(
        indexName,
        pin,
        [
          { role: 'vector', name: targetSearchIndex },
          ...(textSearchIndexName ? [{ role: 'text' as const, name: textSearchIndexName }] : []),
        ],
        collection,
      );
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

      // The vector index, then (managed only) the companion text index, each provisioned on its
      // own: an existing vector index must not skip the text index (an interrupted createIndex).
      const check = () =>
        this.assertNoPendingDrop(
          targetCollection,
          indexName,
          [indexNameInternal, textSearchIndexName],
          'CREATE_INDEX',
          {
            searchIndexName: indexNameInternal,
            // Only a managed index provisions the companion text index below.
            ...(effectiveIsByo ? {} : { textSearchIndexName: textSearchIndexName ?? defaultTextSearchIndex }),
          },
          pin.generation,
          reconciled,
        );
      let vector: Awaited<ReturnType<MongoDBVector['provisionSearchIndex']>>;
      try {
        vector = await this.provisionSearchIndex({
          indexName,
          collection,
          role: 'vector',
          op: 'CREATE_INDEX',
          description: { definition: { fields }, name: indexNameInternal, type: 'vectorSearch' },
          pin,
          check,
        });
      } catch (abort) {
        const { error, rollback } = abort instanceof ProvisionAbort ? abort : { error: abort, rollback: true };
        if (rollback) {
          // Nothing usable was provisioned, so the target must not keep resolving. Drop the
          // collection only if this call created it, removed the entry it inserted, and no
          // registration references the collection (read after the delete).
          const removed = await this.rollbackRegistryEntry(
            indexName,
            pin,
            p0Before
              ? rollbackRestore(p0Before, {
                  indexName,
                  ...p0Fields,
                  ownsVectorIndex: true,
                  retiredVectorIndexNames: true,
                })
              : null,
          );
          if (
            removed &&
            collectionCreated &&
            !(await this.registry()
              .findOne({ collectionName: targetCollection })
              .catch(() => true))
          ) {
            this.collections.delete(targetCollection);
            await collection.drop().catch(() => {});
          }
        }
        throw error;
      }

      // Cache the declared filter paths only when this call created the index. An index that
      // already existed may carry a different declaration; queries hydrate the real one lazily
      // via getDeclaredFilterPaths().
      if (vector.outcome === 'owned') {
        this.declaredFilterPaths.set(indexName, {
          source: `${targetCollection}/${targetSearchIndex}`,
          paths: new Set(
            documentIsEmbedded ? declaredMetadataPaths : [this.documentFieldName, ...declaredMetadataPaths],
          ),
        });
      }

      // Companion full-text index (dynamic mapping). Only auto-created for MANAGED
      // collections (back-compat). For a bring-your-own operational collection we do NOT
      // provision a billable full-text index implicitly — the caller opts in explicitly via
      // createSearchIndex. The registry entry above records its name (managed only), so BYO
      // safety does not depend on this succeeding.
      if (!effectiveIsByo) {
        try {
          await this.provisionSearchIndex({
            indexName,
            collection,
            role: 'text',
            op: 'CREATE_INDEX',
            // Provision under the PERSISTED name (a prior custom createSearchIndex name is
            // preserved above); for a fresh managed index this is the default.
            description: {
              definition: { mappings: { dynamic: true } },
              name: textSearchIndexName ?? defaultTextSearchIndex,
              type: 'search',
            },
            pin,
            check,
          });
        } catch (abort) {
          // No rollback after the vector step (I4): a proven vector index stays owned, and the
          // text name stays recorded, unowned.
          throw abort instanceof ProvisionAbort ? abort.error : abort;
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
   * The only search-index drop (I1): by `id`, so only that incarnation goes. `IndexNotFound` and
   * `NamespaceNotFound` mean it is already gone (with its collection, for the latter), which
   * counts as done, so a retried delete still clears its registry entry.
   */
  private async dropSearchIndexById(collectionName: string, name: string, id: string): Promise<void> {
    await this.testHooks?.beforeSearchIndexDrop?.(collectionName, name, id);
    try {
      await this.runSearchIndexCommand({ dropSearchIndex: collectionName, id });
    } catch (err: any) {
      const code = err?.codeName ?? err?.code;
      const missing =
        code === 'IndexNotFound' ||
        code === 'SearchIndexNotFound' ||
        code === 27 ||
        code === 'NamespaceNotFound' ||
        code === 26;
      if (!missing) throw err;
    }
  }

  /**
   * Drop `name` by its recorded `id`. A legacy name with none is listed and dropped by the observed
   * id (§3.7, delete-time TOFU); absent means done. Residual X2: an external drop and recreate
   * before this listing makes the observed id the stranger's.
   */
  private async dropRecordedOrListed(collectionName: string, name: string, id: string | undefined): Promise<void> {
    id ??= await this.liveIdOf(this.db.collection(collectionName), name, 'delete');
    if (id) await this.dropSearchIndexById(collectionName, name, id);
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
    const reconciled = await this.reconcile(collectionName);
    // A field-mapped index must not collide with the auto-created dynamic index (which would
    // no-op the field mapping), and two logical indexes on the SAME collection must not collide
    // with each other (FIX 6), so the default name includes the logical indexName.
    const name =
      searchIndexName ??
      (fields?.length ? `${collectionName}_${indexName}_search_fields_index` : `${collectionName}_search_index`);
    await this.testHooks?.afterCreateSearchIndexTarget?.(indexName);
    const previous = await this.readRegistryEntry(indexName);
    this.assertNotDeleting(previous, 'CREATE_SEARCH_INDEX');
    // Raised when the entry this call read was removed, registered or rewritten by someone else meanwhile.
    const concurrentConflict = (what: 'removed' | 'registered' | 'changed') =>
      new MastraError({
        id: createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: `Index "${indexName}" was ${what} by another call while createSearchIndex ran, so nothing was provisioned. Check the index and retry.`,
      });
    // The target came from a registration that is gone now: don't recreate it from that stale read.
    if (target.registered && !previous) throw concurrentConflict('removed');
    // A text index must not squat the vector index's name: the creation below would hit
    // IndexAlreadyExists, and the subsequent updateSearchIndex would overwrite the
    // vectorSearch definition with a text mapping, breaking query(). `previous` is the
    // document the registry write below is conditioned on, so a concurrent rename is caught.
    if (name === target.searchIndexName || name === previous?.searchIndexName) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: `searchIndexName "${name}" collides with the vectorSearch index name for index "${indexName}". Choose a different full-text searchIndexName.`,
      });
    }
    // A retired name keeps its role until deleteIndex drops it (§3.3).
    if (previous?.retiredVectorIndexNames?.includes(name)) {
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName },
        text: `searchIndexName "${name}" was a vector search index of index "${indexName}"; choose a different name.`,
      });
    }
    // Only a text index this registration created may be updated; a different name starts out not owned.
    // Judged on `previous`, the document the registry write below is conditioned on.
    const sameName = !!previous && name === previous.textSearchIndexName;
    await this.testHooks?.afterCreateSearchIndexRead?.(indexName);
    const claimToken = uuidv4();
    const textFields = { textSearchIndexName: name, ...(sameName ? {} : { ownsTextIndex: false }) };
    let provisioned = false;
    let p0: P0Result | null = null;
    // The fields P0 writes besides the protocol fields; a rollback restores exactly these (I4).
    let written: Document = textFields;
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
      if (previous) {
        // One $set stage: every expression reads the pre-write document, so retiring the old
        // name, reactivating a retired one and the ownership flag change atomically.
        const retired = { $ifNull: ['$retiredTextIndexNames', []] };
        const rename = (mutation: Document) => [
          {
            $set: {
              retiredTextIndexNames: {
                $setDifference: [
                  {
                    $setUnion: [
                      retired,
                      {
                        $cond: [
                          {
                            $and: [
                              { $eq: ['$ownsTextIndex', true] },
                              { $eq: [{ $type: '$textSearchIndexName' }, 'string'] },
                            ],
                          },
                          ['$textSearchIndexName'],
                          [],
                        ],
                      },
                    ],
                  },
                  { $literal: [name] },
                ],
              },
              ownsTextIndex: { $cond: [{ $in: [{ $literal: name }, retired] }, true, false] },
              textSearchIndexName: { $literal: name },
              ...mutation,
            },
          },
        ];
        // Compare-and-set on the document this call read: a rename, a createIndex refresh or a
        // delete by another call since fails the filter. A rollback restores the pre-image P0
        // returns, not `previous`, so a write the filter lets through (a claim) is kept too.
        // Equality-to-null matches a missing field and one the driver stored as null.
        const observed: Document = {
          _id: indexName,
          claimToken: previous.claimToken ?? null,
          textSearchIndexName: previous.textSearchIndexName ?? null,
          deleting: { $ne: true },
        };
        written = sameName ? textFields : { ...textFields, retiredTextIndexNames: null };
        p0 = await this.p0Write(
          observed,
          sameName ? mutation => [{ $set: { ...literals(textFields), ...mutation } }] : rename,
          claimToken,
          false,
        );
        if (!p0) {
          const current = await this.readRegistryEntry(indexName);
          this.assertNotDeleting(current, 'CREATE_SEARCH_INDEX');
          throw concurrentConflict(current ? 'changed' : 'removed');
        }
      } else {
        written = {
          indexName,
          collectionName: target.collectionName,
          searchIndexName: target.searchIndexName,
          isByo: target.isByo,
          allowWrites: target.allowWrites,
          ...textFields,
        };
        try {
          p0 = await this.writeRegistryEntry(
            indexName,
            { ...written, claimToken },
            // Nothing was registered when this call read the entry: one written since (a claim,
            // a createIndex) carries a claimToken, so the insert hits 11000 instead of overwriting it.
            { claimToken: { $exists: false } },
          );
        } catch (error: any) {
          if (error?.code === 11000) throw concurrentConflict('registered');
          throw error;
        }
      }
      await this.tofuIndexIds(indexName, p0!.pin, [{ role: 'text', name }], collection);
      this.indexTargets.set(indexName, { ...target, textSearchIndexName: name });
      let created: Awaited<ReturnType<MongoDBVector['provisionSearchIndex']>>;
      try {
        created = await this.provisionSearchIndex({
          indexName,
          collection,
          role: 'text',
          op: 'CREATE_SEARCH_INDEX',
          description: { definition, name, type: 'search' },
          pin: p0!.pin,
          check: async () => {
            await this.assertNoPendingDrop(
              collectionName,
              indexName,
              [name],
              'CREATE_SEARCH_INDEX',
              { textSearchIndexName: name },
              p0!.pin.generation,
              reconciled,
            );
            await this.testHooks?.beforeSearchIndexProvision?.(indexName);
          },
        });
      } catch (abort) {
        if (!(abort instanceof ProvisionAbort)) throw abort;
        // Something may exist now: a proven create is never rolled back (I4).
        if (!abort.rollback) provisioned = true;
        throw abort.error;
      }
      // Ours already: either unchanged, or a retired name this rename just reactivated.
      const ours = (sameName && previous?.ownsTextIndex) || previous?.retiredTextIndexNames?.includes(name);
      const listedId = created.outcome === 'attached' ? created.row?.id : undefined;
      const recordedId = ours
        ? (await this.readRegistryEntry(indexName))?.indexIds?.find(e => e.name === name)?.id
        : undefined;
      if (created.outcome === 'owned') {
        // Recorded with its id by the P7 above.
      } else if (listedId && listedId === recordedId) {
        // The incarnation we recorded (§3.2): recreating it with a different `fields` mapping must
        // change the mapping, by id.
        await this.runSearchIndexCommand({ updateSearchIndex: collection.collectionName, id: listedId, definition });
      } else {
        if (ours) {
          this.logger.warn(
            `search index "${name}" on "${collectionName}" is ${listedId ? `listed with id ${listedId}` : 'not listed'} but recorded with ${recordedId ? `id ${recordedId}` : 'no id'}; treated as not created by Mastra and not modified`,
          );
        }
        // Someone else's index: attach to it as-is, and refuse if it maps different fields.
        const [existing] = await this.listSearchIndexRows(collection, name, 'P1');
        if (!searchDefinitionsEquivalent(existing?.latestDefinition, definition)) {
          const hint =
            !target.isByo && target.ownsTextIndex === undefined
              ? ` If Mastra created this index (registered by an earlier version), call claimLegacyIndex({ indexName: "${indexName}" }) once, then retry.`
              : '';
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'CREATE_SEARCH_INDEX', 'CONFLICT'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName, collectionName },
            text: `Full-text search index "${name}" already exists on collection "${collectionName}" with a different mapping, and Mastra did not create it, so it will not be modified. Pass a different searchIndexName, or update or drop the existing index yourself.${hint}`,
          });
        }
      }
      provisioned = true;
      if (waitUntilReady) {
        await this.waitForSearchIndexReady({ indexName });
      }
    } catch (error: any) {
      if (!provisioned && p0) {
        await this.rollbackRegistryEntry(indexName, p0.pin, p0.before ? rollbackRestore(p0.before, written) : null);
      }
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
      const indexInfo = (await collection.listSearchIndexes().toArray()) as SearchIndexRow[];
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
      const indexInfo = (await collection.listSearchIndexes().toArray()) as SearchIndexRow[];
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
          // The pushed predicates narrow the candidates too, so the cap counts only real matches.
          const allPredicates = [...preFilter, ...pushed];
          const candidateIds = await this.collectCandidateIds(
            collection,
            allPredicates.length > 1 ? { $and: allPredicates } : allPredicates[0]!,
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
    const maxBytes = MongoDBVector.MAX_PREFILTER_ID_BYTES;
    const ids: unknown[] = [];
    let bytes = 5; // BSON document length and terminator for the array.
    const cursor = collection.aggregate([{ $match: match }, { $project: { _id: 1 } }, { $limit: max + 1 }]);
    try {
      for await (const doc of cursor) {
        // BSON arrays use decimal index keys; include their growing key lengths and the ID's type.
        bytes += BSON.calculateObjectSize({ [ids.length]: doc._id }) - 5;
        if (ids.length >= max || bytes > maxBytes) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', operation, 'TOO_MANY_CANDIDATES'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName, maxCandidates: max, maxCandidateBytes: maxBytes },
            text: `The filter for index "${indexName}" cannot run inside $vectorSearch and exceeds the pre-filter limit of ${max} matching documents or ${maxBytes} BSON bytes of candidate _ids. Declare the filtered fields with createIndex({ filterFields }) so the filter runs inside $vectorSearch, or narrow the filter.`,
          });
        }
        ids.push(doc._id);
      }
    } finally {
      await cursor.close();
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
      const registry = this.registry();
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
        if (name === MongoDBVector.REGISTRY_COLLECTION || name === MongoDBVector.JOURNAL_COLLECTION) continue;
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
    const indexInfo = (await collection.listSearchIndexes().toArray()) as SearchIndexRow[];
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
    // cannot distinguish managed from BYO. Managed indexes with recorded ownership drop the
    // collection; BYO indexes drop only search indexes so the caller's data is preserved.
    // Decide from the registry, not the in-process cache, which another process can make stale.
    this.indexTargets.delete(indexName);
    try {
      const entry = await this.readRegistryEntry(indexName);
      if (entry) await this.reconcile(entry.collectionName);
      // A managed index that adopted an existing collection is handled like BYO: the collection stays.
      if (entry && (entry.isByo || entry.ownsCollection === false)) {
        // A lagging secondary could report the collection missing and leak the indexes Mastra created.
        const exists = await this.db
          .listCollections({ name: entry.collectionName }, { readPreference: ReadPreference.primary })
          .hasNext();
        await this.deleteKeepCollection(
          entry,
          exists ? this.db.collection<MongoDBDocument>(entry.collectionName) : null,
        );
        this.declaredFilterPaths.delete(indexName);
        this.indexTargets.delete(indexName);
        return;
      }
      if (entry) {
        // Only a recorded `ownsCollection: true` proves this store created the collection.
        if (entry.ownsCollection !== true) {
          throw new MastraError({
            id: createVectorErrorId('MONGODB', 'DELETE_INDEX', 'OWNERSHIP_UNKNOWN'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { indexName, collectionName: entry.collectionName },
            text: `Index "${indexName}" was registered by an earlier version that did not record whether this store created collection "${entry.collectionName}". Nothing was dropped. If Mastra created it, call claimLegacyIndex({ indexName: "${indexName}" }) first.`,
          });
        }
        await this.deleteManagedCollection(entry);
        this.declaredFilterPaths.delete(indexName);
        this.indexTargets.delete(indexName);
        return;
      }
      // Fail closed: nothing records that this store created an unregistered collection, and an
      // `${indexName}_vector_index` on it may be a caller's index left behind by a BYO delete.
      throw new MastraError({
        id: createVectorErrorId('MONGODB', 'DELETE_INDEX', 'NOT_REGISTERED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName, collectionName: indexName },
        text: `Index "${indexName}" is not registered, so this store cannot verify that it created collection "${indexName}". Nothing was dropped. If Mastra created it before the registry existed, call claimLegacyIndex({ indexName }) first.`,
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
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
   * One-time upgrade helper for managed indexes created before `@mastra/mongodb@1.15.0`, or registered by 1.15–1.27 without ownership records. Calling it asserts that Mastra created the collection and its recorded search indexes; `deleteIndex()` will then drop the collection and all its data.
   */
  async claimLegacyIndex({ indexName }: { indexName: string }): Promise<void> {
    const reconciled = await this.reconcile(indexName);
    const registry = this.registry();
    const vectorIndex = `${indexName}_vector_index`;
    const refuse = (
      code: 'BYO' | 'CONFLICT' | 'IN_USE' | 'NOT_FOUND',
      text: string,
      details: Record<string, any> = {},
    ) =>
      new MastraError({
        id: createVectorErrorId('MONGODB', 'CLAIM_LEGACY_INDEX', code),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { indexName, ...details },
        text,
      });
    const byo = (entry: RegistryDoc) =>
      refuse(
        'BYO',
        `Index "${indexName}" is a bring-your-own index on collection "${entry.collectionName}". Its collection belongs to the caller and cannot be claimed.`,
        { collectionName: entry.collectionName },
      );
    const conflict = (current: RegistryDoc | null) =>
      refuse(
        'CONFLICT',
        current
          ? `Index "${indexName}" now targets collection "${current.collectionName}" (vector index "${current.searchIndexName}"), not the one this claim validated. Nothing was claimed.`
          : `Index "${indexName}" was removed while it was being claimed. Nothing was claimed.`,
        { collectionName: current?.collectionName ?? null, searchIndexName: current?.searchIndexName ?? null },
      );
    const otherUsers = () =>
      registry.find({ collectionName: indexName, _id: { $ne: indexName } }, { projection: { _id: 1 } }).toArray();
    const inUse = (others: { _id: string }[]) =>
      refuse(
        'IN_USE',
        `Collection "${indexName}" is used by ${others.map(o => `"${o._id}"`).join(', ')}, so it cannot be claimed for index "${indexName}". Nothing was claimed.`,
        { collectionName: indexName, usedBy: others.map(o => o._id).join(', ') },
      );

    const relistConflict = () =>
      refuse('CONFLICT', 'index changed while it was being claimed; nothing was claimed; retry');
    /** The live id listed for each name, on the primary (I7a). */
    const listIds = async (collectionName: string, names: string[]) => {
      const ids: Record<string, string | undefined> = {};
      for (const name of names) ids[name] = await this.liveIdOf(this.db.collection(collectionName), name, 'claim');
      return ids;
    };
    /** Every id recorded for a claimed name is the one the re-list shows (§3.10 step 4). */
    const idsMatch = (
      indexIds: RegistryDoc['indexIds'],
      names: string[],
      relisted: Record<string, string | undefined>,
    ) => (indexIds ?? []).every(e => !names.includes(e.name) || relisted[e.name] === e.id);
    /** Pipeline stages adding `ids[name]` to `indexIds` for each owned claimed name with no entry yet (Q5 TOFU). */
    const tofuStages = (ids: Record<string, string | undefined>, vectorName: string, textName?: string) => {
      const stage = (name: string, owned: Document) => ({
        $set: {
          indexIds: {
            $cond: [
              { $and: [owned, { $not: [{ $in: [{ $literal: name }, { $ifNull: ['$indexIds.name', []] }] }] }] },
              indexIdsWith(name, ids[name]!),
              '$indexIds',
            ],
          },
        },
      });
      return [
        ...(ids[vectorName] ? [stage(vectorName, { $eq: ['$ownsVectorIndex', true] })] : []),
        ...(textName && ids[textName]
          ? [
              stage(textName, {
                $and: [{ $eq: ['$textSearchIndexName', { $literal: textName }] }, { $eq: ['$ownsTextIndex', true] }],
              }),
            ]
          : []),
      ];
    };
    /**
     * §3.10 step 5, after an undo missed (or another write landed first): a cleaner may have handed
     * responsibility to the entry (R4-2, R5-2), so it stays; the claim succeeds only if the entry is
     * still on the claimed target and records what the re-list shows. On the insert path
     * (`requireLive`) every claimed name must also be listed live (R16).
     */
    const settle = async (
      collectionName: string,
      searchIndexName: string,
      names: string[],
      relisted: Record<string, string | undefined>,
      requireLive = false,
    ) => {
      this.indexTargets.delete(indexName);
      const current = await this.readRegistryEntry(indexName);
      if (
        current &&
        current.deleting !== true &&
        current.isByo !== true &&
        current.collectionName === collectionName &&
        current.searchIndexName === searchIndexName &&
        current.ownsCollection === true &&
        idsMatch(current.indexIds, names, relisted) &&
        (!requireLive || names.every(n => relisted[n] !== undefined))
      )
        return;
      throw relistConflict();
    };

    // Claim exactly the observed target, so a claim never applies to a replacement registration.
    const claimRegistered = async (seen: RegistryDoc) => {
      const { collectionName, searchIndexName, textSearchIndexName } = seen;
      const names = [searchIndexName, ...(textSearchIndexName ? [textSearchIndexName] : [])];
      // TOFU (Q5): the listing before the write; an id is recorded only for an owned name with none.
      const listed = await listIds(collectionName, names);
      const claimToken = uuidv4();
      // Chosen here, so the claim knows the generation it leaves without reading the entry back.
      const backfill = uuidv4();
      const before = await registry.findOneAndUpdate(
        {
          _id: indexName,
          isByo: { $ne: true },
          collectionName,
          searchIndexName,
          deleting: { $ne: true },
          // A pre-PR entry is pinned on having none, so a replacement misses and is re-read below.
          generation: seen.generation ?? { $exists: false },
        },
        [
          {
            $set: {
              ownsCollection: { $literal: true },
              // An explicit false records that the index existed before registration; keep it.
              ownsVectorIndex: { $ifNull: ['$ownsVectorIndex', true] },
              ...(textSearchIndexName ? { ownsTextIndex: { $ifNull: ['$ownsTextIndex', true] } } : {}),
              ...mutationFields(claimToken, backfill),
            },
          },
          ...tofuStages(listed, searchIndexName, textSearchIndexName),
        ],
        { returnDocument: 'before' },
      );
      this.indexTargets.delete(indexName);
      if (!before) {
        const current = await this.readRegistryEntry(indexName);
        this.assertNotDeleting(current, 'CLAIM_LEGACY_INDEX');
        if (
          current &&
          current.isByo !== true &&
          current.collectionName === collectionName &&
          current.searchIndexName === searchIndexName &&
          current.ownsCollection === true
        )
          return;
        throw conflict(current);
      }
      await this.testHooks?.afterClaimWrite?.(indexName);
      // The entry exactly as this write left it: an undo pinned to it needs no read first, and any
      // later write (a cleaner's release or transfer, another claim) makes it miss.
      const written = { generation: before.generation ?? backfill, rev: (before.rev ?? 0) + 1 };
      /** Restore the fields this claim wrote; true when the entry was still as the claim left it. */
      const undo = async () => {
        await this.testHooks?.beforeClaimUndo?.(indexName);
        const restore = (v: unknown) => (v === undefined ? '$$REMOVE' : { $literal: v });
        const undone = await registry.updateOne(
          { _id: indexName, generation: written.generation, claimToken, rev: written.rev },
          [
            {
              $set: {
                ownsCollection: restore(before.ownsCollection),
                ownsVectorIndex: restore(before.ownsVectorIndex),
                ownsTextIndex: restore(before.ownsTextIndex),
                indexIds: restore(before.indexIds),
                ...mutationFields(),
              },
            },
          ],
        );
        this.indexTargets.delete(indexName);
        return undone.matchedCount === 1;
      };
      // No handshake here: the names were referenced before this write, which already blocks a drop (I11a).
      let relisted: Record<string, string | undefined>;
      let after: RegistryDoc | null;
      try {
        relisted = await listIds(collectionName, names);
        after = await this.readRegistryEntry(indexName);
      } catch (error) {
        // An unverified claim must not stay behind: deleteIndex would drop the collection on it.
        const undone = await undo().catch(undoError => {
          this.logger.error(
            `claimLegacyIndex("${indexName}") could not verify its claim or undo it, so the registration may still record that Mastra created collection "${collectionName}": ${undoError}`,
          );
          return true;
        });
        // A later write to the registration makes the pinned undo miss, which keeps that writer's state.
        if (!undone)
          this.logger.warn(
            `claimLegacyIndex("${indexName}") could not verify its claim, and the registration changed since, so the claim was not undone: it may still record that Mastra created collection "${collectionName}"`,
          );
        throw error;
      }
      if (after?.claimToken === claimToken) {
        // The expected ids are the ones recorded after the write.
        if (idsMatch(after.indexIds, names, relisted)) return;
        if (await undo()) throw relistConflict();
      }
      await settle(collectionName, searchIndexName, names, relisted);
    };

    try {
      const entry = await this.readRegistryEntry(indexName);
      await this.testHooks?.afterClaimRead?.(indexName);
      if (entry) {
        this.assertNotDeleting(entry, 'CLAIM_LEGACY_INDEX');
        if (entry.isByo === true) throw byo(entry);
        return await claimRegistered(entry);
      }

      const claimed = this.db.collection<MongoDBDocument>(indexName);
      const textIndex = `${indexName}_search_index`;
      const searchIndexes: string[] = [];
      // TOFU (Q5): the live ids listed before the insert, recorded only once the re-list confirms them (R16).
      const tofuIds: Record<string, string | undefined> = {};
      for (const name of [vectorIndex, textIndex]) {
        const rows = await this.listSearchIndexRows(claimed, name, 'claim');
        if (rows.length) searchIndexes.push(name);
        tofuIds[name] = rows.find(isLiveRow)?.id;
      }
      if (!searchIndexes.includes(vectorIndex)) {
        throw refuse(
          'NOT_FOUND',
          `No collection "${indexName}" with vector index "${vectorIndex}" exists, so there is no legacy managed index to claim.`,
          { collectionName: indexName },
        );
      }
      const before = await otherUsers();
      if (before.length) throw inUse(before);

      const names = searchIndexes;
      const claimToken = uuidv4();
      const generation = uuidv4();
      await this.testHooks?.beforeClaimInsert?.(indexName);
      try {
        // insertOne, never an upsert: a registration written meanwhile must win, not be overwritten.
        await registry.insertOne({
          _id: indexName,
          indexName,
          collectionName: indexName,
          searchIndexName: vectorIndex,
          isByo: false,
          allowWrites: true,
          ownsCollection: true,
          ownsVectorIndex: true,
          ...(searchIndexes.includes(textIndex) ? { textSearchIndexName: textIndex, ownsTextIndex: true } : {}),
          generation,
          rev: 1,
          claimToken,
        });
      } catch (error: any) {
        if (error?.code !== 11000) throw error;
        this.indexTargets.delete(indexName);
        const winner = await this.readRegistryEntry(indexName);
        if (winner?.isByo === true) throw byo(winner);
        // The claim asserted ownership of collection `indexName` only; never extend it to another target.
        if (!winner || winner.collectionName !== indexName || winner.searchIndexName !== vectorIndex) {
          throw conflict(winner);
        }
        this.assertNotDeleting(winner, 'CLAIM_LEGACY_INDEX');
        return await claimRegistered(winner);
      }
      this.indexTargets.delete(indexName);
      await this.testHooks?.afterClaimWrite?.(indexName);
      // The claim adds references, so it runs the attach handshake (R3-3) after its write, then re-lists (R4-3).
      let pending: MastraError | undefined;
      let after: { _id: string }[];
      let relisted: Record<string, string | undefined>;
      try {
        pending = await this.pendingDropError(indexName, indexName, names, 'CLAIM_LEGACY_INDEX', reconciled);
        after = await otherUsers();
        relisted = await listIds(indexName, names);
      } catch (error) {
        // An unverified claim must not stay behind: deleteIndex would drop the collection on it.
        await registry
          .deleteOne({ _id: indexName, generation, claimToken, rev: 1 })
          .catch(undoError =>
            this.logger.error(
              `claimLegacyIndex("${indexName}") could not verify its claim or undo it, so the registration may still record that Mastra created collection "${indexName}": ${undoError}`,
            ),
          );
        this.indexTargets.delete(indexName);
        throw error;
      }
      // R16: a claimed name is present only when the re-list shows a live row with the id listed before.
      const present = names.every(n => tofuIds[n] !== undefined && relisted[n] === tofuIds[n]);
      const refusal = after.length ? inUse(after) : (pending ?? (present ? undefined : relistConflict()));
      if (!refusal) {
        // The confirmed ids, pinned like the undo (R16); a miss means another writer came first: step 5.
        const recorded = await registry.updateOne({ _id: indexName, generation, claimToken, rev: 1 }, [
          { $set: mutationFields() },
          ...tofuStages(tofuIds, vectorIndex, names.includes(textIndex) ? textIndex : undefined),
        ]);
        if (recorded.matchedCount === 1) return;
        return await settle(indexName, vectorIndex, names, relisted, true);
      }
      await this.testHooks?.beforeClaimUndo?.(indexName);
      // Pinned on rev too (R5-2): a cleaner's release or transfer to this entry makes it miss.
      const undone = await registry.deleteOne({ _id: indexName, generation, claimToken, rev: 1 });
      this.indexTargets.delete(indexName);
      if (undone.deletedCount === 1) throw refusal;
      await settle(indexName, vectorIndex, names, relisted, true);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createVectorErrorId('MONGODB', 'CLAIM_LEGACY_INDEX', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { indexName },
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
    const { collectionName, searchIndexName } = await this.resolveIndexTarget(indexName);
    const source = `${collectionName}/${searchIndexName}`;
    // A retarget, here or in another process, leaves the paths of the old index behind.
    const cached = this.declaredFilterPaths.get(indexName);
    if (cached?.source === source) return cached.paths;

    const collection = await this.getCollection(collectionName, true);
    const indexNameInternal = searchIndexName;
    const indexInfo = (await collection.listSearchIndexes().toArray()) as SearchIndexRow[];
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

    this.declaredFilterPaths.set(indexName, { source, paths });
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
    // __proto__ is stored as an own metadata property, not a reserved document field.
    if (key === '__proto__') return true;
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
