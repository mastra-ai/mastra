/**
 * SearchEngine - Unified search engine supporting BM25, vector, and hybrid search.
 *
 * Provides search capabilities for Workspace, enabling keyword-based (BM25),
 * semantic (vector), and combined hybrid search across indexed content.
 */

import pMap from 'p-map';

import type { MastraVector, VectorFilter } from '../../vector';
import type { LineRange } from '../line-utils';

import { BM25Index, tokenize, findLineRange } from './bm25';
import type { BM25Config, TokenizeOptions } from './bm25';

/**
 * Search mode options
 */
export type SearchMode = 'vector' | 'bm25' | 'hybrid';

// =============================================================================
// Types
// =============================================================================

/**
 * Single-text embedder - takes one text and returns its embedding.
 *
 * This is the legacy embedder shape and remains the default. Each document is
 * embedded with a separate call.
 */
export interface SingleEmbedder {
  (text: string): Promise<number[]>;
}

/**
 * Batch-capable embedder - takes an array of texts and returns their embeddings
 * in the same order.
 *
 * Branded with `batch: true` so {@link SearchEngine} can detect batch support at
 * runtime and dispatch to a single batched embedder call instead of one call
 * per document. This dramatically speeds up large index rebuilds against
 * providers that support batch embedding (e.g. OpenAI's `embedMany`).
 *
 * @example
 * ```ts
 * import { embedMany } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 *
 * const model = openai.embedding('text-embedding-3-small');
 * const embedder: BatchEmbedder = Object.assign(
 *   async (texts: string[]) => {
 *     const { embeddings } = await embedMany({ model, values: texts });
 *     return embeddings;
 *   },
 *   { batch: true as const, maxBatchSize: 2048 },
 * );
 * ```
 */
export interface BatchEmbedder {
  (texts: string[]): Promise<number[][]>;
  /** Brand that marks this embedder as batch-capable. */
  readonly batch: true;
  /**
   * Maximum number of texts the underlying provider accepts per call. When
   * unset, all pending texts are sent in a single request.
   */
  readonly maxBatchSize?: number;
}

/**
 * Embedder interface - either a legacy single-text embedder or a batch-capable
 * embedder branded with `batch: true`.
 */
export type Embedder = SingleEmbedder | BatchEmbedder;

/**
 * Type guard: returns true when the embedder is the batch-capable variant.
 */
export function isBatchEmbedder(embedder: Embedder): embedder is BatchEmbedder {
  return typeof embedder === 'function' && (embedder as Partial<BatchEmbedder>).batch === true;
}

/**
 * Configuration for vector search
 */
export interface VectorConfig {
  /** Vector store for semantic search */
  vectorStore: MastraVector;
  /** Embedder function for generating vectors */
  embedder: Embedder;
  /** Index name for the vector store */
  indexName: string;
}

/**
 * Configuration for BM25 search
 */
export interface BM25SearchConfig {
  /** BM25 algorithm parameters */
  bm25?: BM25Config;
  /** Tokenization options */
  tokenize?: TokenizeOptions;
}

/**
 * A document to be indexed
 */
export interface IndexDocument {
  /** Unique identifier for this document */
  id: string;
  /** Text content to index */
  content: string;
  /** Optional metadata to store with the document */
  metadata?: Record<string, unknown>;
  /**
   * For chunked documents: the starting line number of this chunk in the original document.
   * When provided, lineRange in search results will be adjusted to reflect original document lines.
   * (1-indexed)
   */
  startLineOffset?: number;
}

/**
 * Base search result with common fields
 */
export interface SearchResult {
  /** Document identifier */
  id: string;
  /** Document content */
  content: string;
  /** Search score (0-1 for normalized results) */
  score: number;
  /** Line range where query terms appear */
  lineRange?: LineRange;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Score breakdown by search type */
  scoreDetails?: {
    vector?: number;
    bm25?: number;
  };
}

/**
 * Options for searching
 */
export interface SearchOptions {
  /** Maximum number of results to return */
  topK?: number;
  /** Minimum score threshold */
  minScore?: number;
  /** Search mode: 'bm25', 'vector', or 'hybrid' */
  mode?: SearchMode;
  /** Weight for vector scores in hybrid search (0-1, default 0.5) */
  vectorWeight?: number;
  /** Filter for vector search */
  filter?: Record<string, unknown>;
}

/** Options for batch indexing */
export interface IndexManyOptions {
  /**
   * Maximum number of documents to index concurrently (embedder + vector upsert).
   * Must be a safe integer ≥ 1 (same rule as `p-map`).
   * @default 8
   */
  concurrency?: number;
  /**
   * When `true` (default), the first rejected `index` rejects the whole `indexMany` call.
   * When `false`, all documents are processed; if any failed, the promise rejects with an `AggregateError`.
   */
  stopOnError?: boolean;
}

/** Default `indexMany` / lazy-vector flush concurrency (embedder + upsert). */
const DEFAULT_INDEX_MANY_CONCURRENCY = 8;

/**
 * Configuration for SearchEngine
 */
export interface SearchEngineConfig {
  /** BM25 configuration (enables BM25 search) */
  bm25?: BM25SearchConfig;
  /** Vector configuration (enables vector search) */
  vector?: VectorConfig;
  /** Whether to use lazy vector indexing (default: false = eager) */
  lazyVectorIndex?: boolean;
}

// =============================================================================
// Chunking
// =============================================================================

const DEFAULT_MAX_CHUNK_CHARS = 4000;
const DEFAULT_OVERLAP_LINES = 3;

export interface ChunkOptions {
  maxChunkChars?: number;
  overlapLines?: number;
}

export interface TextChunk {
  content: string;
  startLine: number;
}

/**
 * Split text into line-based chunks that stay within a character budget.
 *
 * Each chunk is formed by accumulating whole lines until adding the next line
 * would exceed `maxChunkChars`. Adjacent chunks share `overlapLines` lines so
 * that context around chunk boundaries is preserved for embedding quality.
 *
 * Returns the original text as a single chunk when it already fits.
 */
export function splitIntoChunks(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxChars = Math.max(1, Math.floor(options.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS));
  const overlapLines = Math.max(0, Math.floor(options.overlapLines ?? DEFAULT_OVERLAP_LINES));

  if (text.length <= maxChars) {
    return [{ content: text, startLine: 1 }];
  }

  const lines = text.split('\n');
  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < lines.length) {
    let end = start;
    let charCount = 0;

    while (end < lines.length) {
      const lineLen = lines[end]!.length + (end > start ? 1 : 0);
      if (charCount + lineLen > maxChars && end > start) break;
      charCount += lineLen;
      end++;
    }

    const chunkContent = lines.slice(start, end).join('\n');

    if (chunkContent.length <= maxChars) {
      chunks.push({ content: chunkContent, startLine: start + 1 });
    } else {
      // Single line exceeds maxChars — split by character boundaries.
      for (let offset = 0; offset < chunkContent.length; offset += maxChars) {
        chunks.push({
          content: chunkContent.slice(offset, offset + maxChars),
          startLine: start + 1,
        });
      }
    }

    const nextStart = end - overlapLines;
    start = nextStart <= start ? end : nextStart;
  }

  return chunks;
}

// =============================================================================
// SearchEngine
// =============================================================================

/**
 * Unified search engine supporting BM25, vector, and hybrid search.
 *
 * Used internally by Workspace to provide consistent search functionality.
 *
 * @example
 * ```typescript
 * const engine = new SearchEngine({
 *   bm25: { tokenize: { lowercase: true } },
 *   vector: { vectorStore, embedder, indexName: 'my-index' },
 * });
 *
 * // Index documents
 * await engine.index({ id: 'doc1', content: 'Hello world' });
 *
 * // Search
 * const results = await engine.search('hello', { mode: 'hybrid', topK: 5 });
 * ```
 */
export class SearchEngine {
  /** BM25 index for keyword search */
  #bm25Index?: BM25Index;

  /** Tokenization options (stored for lineRange computation) */
  #tokenizeOptions?: TokenizeOptions;

  /** Vector configuration */
  #vectorConfig?: VectorConfig;

  /** Whether to use lazy vector indexing */
  #lazyVectorIndex: boolean;

  /** All indexed document IDs (used for prefix-based removal across backends) */
  #indexedIds: Set<string> = new Set();

  /** Documents pending vector indexing (for lazy mode) */
  #pendingVectorDocs: IndexDocument[] = [];

  /** Whether vector index has been built (for lazy mode) */
  #vectorIndexBuilt: boolean = false;

  /** Whether createIndex has been attempted on the vector store */
  #vectorIndexReady: boolean = false;

  constructor(config: SearchEngineConfig = {}) {
    // Initialize BM25 if configured
    if (config.bm25 !== undefined) {
      this.#tokenizeOptions = config.bm25.tokenize;
      this.#bm25Index = new BM25Index(config.bm25.bm25, this.#tokenizeOptions);
    }

    // Store vector config if provided
    if (config.vector) {
      this.#vectorConfig = config.vector;
    }

    this.#lazyVectorIndex = config.lazyVectorIndex ?? false;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Index a document for search
   */
  async index(doc: IndexDocument): Promise<void> {
    // Merge startLineOffset into metadata for retrieval at search time
    const metadata: Record<string, unknown> = {
      ...doc.metadata,
    };
    if (doc.startLineOffset !== undefined) {
      metadata._startLineOffset = doc.startLineOffset;
    }

    this.#indexedIds.add(doc.id);

    // BM25 indexing (always synchronous and immediate)
    if (this.#bm25Index) {
      this.#bm25Index.add(doc.id, doc.content, metadata);
    }

    // Vector indexing
    if (this.#vectorConfig) {
      const docWithMergedMetadata = { ...doc, metadata };
      if (this.#lazyVectorIndex) {
        // Store for later indexing
        this.#pendingVectorDocs.push(docWithMergedMetadata);
        this.#vectorIndexBuilt = false;
      } else {
        // Index immediately
        await this.#indexVector(docWithMergedMetadata);
      }
    }
  }

  /**
   * Index multiple documents (up to `concurrency` at a time when async vector work runs).
   *
   * @param docs - Documents to index
   * @param options - `p-map` options; `concurrency` defaults to 8
   */
  async indexMany(docs: IndexDocument[], options?: IndexManyOptions): Promise<void> {
    const stopOnError = options?.stopOnError;
    const concurrency = options?.concurrency ?? DEFAULT_INDEX_MANY_CONCURRENCY;
    await pMap(docs, doc => this.index(doc), { stopOnError, concurrency });
  }

  /**
   * Remove a document from the index
   */
  async remove(id: string): Promise<void> {
    this.#indexedIds.delete(id);

    // Remove from BM25
    if (this.#bm25Index) {
      this.#bm25Index.remove(id);
    }

    // Remove from vector store
    if (this.#vectorConfig) {
      try {
        await this.#vectorConfig.vectorStore.deleteVector({
          indexName: this.#vectorConfig.indexName,
          id,
        });
      } catch {
        // Vector may not exist, ignore
      }

      // Also remove from pending docs if in lazy mode
      if (this.#lazyVectorIndex) {
        this.#pendingVectorDocs = this.#pendingVectorDocs.filter(d => d.id !== id);
      }
    }
  }

  /**
   * Remove all documents whose ID starts with the given prefix.
   * Used to remove all chunks belonging to a single source document.
   */
  async removeByPrefix(prefix: string): Promise<void> {
    const matchedIds = [...this.#indexedIds].filter(id => id.startsWith(prefix));

    for (const id of matchedIds) {
      this.#indexedIds.delete(id);
    }

    if (this.#bm25Index) {
      for (const id of matchedIds) {
        this.#bm25Index.remove(id);
      }
    }

    if (this.#vectorConfig) {
      if (this.#lazyVectorIndex) {
        this.#pendingVectorDocs = this.#pendingVectorDocs.filter(d => !d.id.startsWith(prefix));
      }

      for (const id of matchedIds) {
        try {
          await this.#vectorConfig.vectorStore.deleteVector({
            indexName: this.#vectorConfig.indexName,
            id,
          });
        } catch {
          // Vector may not exist, ignore
        }
      }
    }
  }

  /**
   * Remove a source document and all of its chunked variants.
   *
   * This also attempts a metadata-based bulk delete for chunk vectors so stale
   * chunk IDs from previous process runs are cleaned up in persistent stores.
   */
  async removeSource(sourceId: string): Promise<void> {
    await this.remove(sourceId);
    await this.removeByPrefix(`${sourceId}#chunk-`);

    if (this.#vectorConfig) {
      try {
        await this.#vectorConfig.vectorStore.deleteVectors({
          indexName: this.#vectorConfig.indexName,
          filter: { sourceFile: sourceId } as VectorFilter,
        });
      } catch {
        // Bulk delete/filter may not be supported by all vector backends.
      }
    }
  }

  /**
   * Clear all indexed documents
   */
  clear(): void {
    this.#indexedIds.clear();
    if (this.#bm25Index) {
      this.#bm25Index.clear();
    }
    this.#pendingVectorDocs = [];
    this.#vectorIndexBuilt = false;
    // Note: We don't clear the vector store here as it may be shared
  }

  /**
   * Search for documents
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { topK = 10, minScore, mode, vectorWeight = 0.5, filter } = options;

    const effectiveMode = this.#determineSearchMode(mode);

    if (effectiveMode === 'bm25') {
      return this.#searchBM25(query, topK, minScore);
    }

    if (effectiveMode === 'vector') {
      return this.#searchVector(query, topK, minScore, filter);
    }

    // Hybrid search
    return this.#searchHybrid(query, topK, minScore, vectorWeight, filter);
  }

  /**
   * Check if BM25 search is available
   */
  get canBM25(): boolean {
    return !!this.#bm25Index;
  }

  /**
   * Check if vector search is available
   */
  get canVector(): boolean {
    return !!this.#vectorConfig;
  }

  /**
   * Check if hybrid search is available
   */
  get canHybrid(): boolean {
    return this.canBM25 && this.canVector;
  }

  /**
   * Get the BM25 index (for serialization/debugging)
   */
  get bm25Index(): BM25Index | undefined {
    return this.#bm25Index;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Determine the effective search mode
   */
  #determineSearchMode(requestedMode?: SearchMode): SearchMode {
    if (requestedMode) {
      if (requestedMode === 'vector' && !this.canVector) {
        throw new Error('Vector search requires vector configuration.');
      }
      if (requestedMode === 'bm25' && !this.canBM25) {
        throw new Error('BM25 search requires BM25 configuration.');
      }
      if (requestedMode === 'hybrid' && !this.canHybrid) {
        throw new Error('Hybrid search requires both vector and BM25 configuration.');
      }
      return requestedMode;
    }

    // Auto-determine based on available configuration
    if (this.canHybrid) {
      return 'hybrid';
    }
    if (this.canVector) {
      return 'vector';
    }
    if (this.canBM25) {
      return 'bm25';
    }

    throw new Error('No search configuration available. Provide bm25 or vector config.');
  }

  /**
   * Embed a single text, dispatching to the batch path with a one-element array
   * when the configured embedder is batch-capable.
   */
  async #embedOne(text: string): Promise<number[]> {
    if (!this.#vectorConfig) {
      throw new Error('Vector configuration is required to embed text.');
    }
    const { embedder } = this.#vectorConfig;
    if (isBatchEmbedder(embedder)) {
      const [embedding] = await embedder([text]);
      if (!embedding) {
        throw new Error('Batch embedder returned no embedding for input text.');
      }
      return embedding;
    }
    return embedder(text);
  }

  /**
   * Embed many texts. Uses a single batched call (chunked by `maxBatchSize`)
   * when the embedder is batch-capable; otherwise falls back to parallel
   * single-text calls.
   */
  async #embedAll(texts: string[]): Promise<number[][]> {
    if (!this.#vectorConfig) {
      throw new Error('Vector configuration is required to embed texts.');
    }
    if (texts.length === 0) return [];

    const { embedder } = this.#vectorConfig;

    if (isBatchEmbedder(embedder)) {
      const max = embedder.maxBatchSize;
      if (max === undefined || texts.length <= max) {
        return embedder(texts);
      }
      // Chunk by maxBatchSize and run chunks in parallel up to DEFAULT_INDEX_MANY_CONCURRENCY.
      const chunks: string[][] = [];
      for (let i = 0; i < texts.length; i += max) {
        chunks.push(texts.slice(i, i + max));
      }
      const results = await pMap(chunks, chunk => embedder(chunk), {
        concurrency: DEFAULT_INDEX_MANY_CONCURRENCY,
      });
      return results.flat();
    }

    return pMap(texts, text => embedder(text), {
      concurrency: DEFAULT_INDEX_MANY_CONCURRENCY,
    });
  }

  /**
   * Index a single document in the vector store.
   *
   * Used by the eager (non-lazy) write path. The lazy flush path embeds all
   * pending docs together via {@link SearchEngine.#flushVectorBatch} for true
   * batch embedding when supported.
   */
  async #indexVector(doc: IndexDocument): Promise<void> {
    if (!this.#vectorConfig) return;

    const { vectorStore, indexName } = this.#vectorConfig;

    const embedding = await this.#embedOne(doc.content);

    if (!this.#vectorIndexReady) {
      // Some backends (e.g. LibSQLVector) require createIndex before upsert.
      // createIndex is expected to be idempotent; we ignore errors here and let
      // upsert determine whether the index is actually usable.
      try {
        await vectorStore.createIndex({ indexName, dimension: embedding.length });
      } catch {
        // Already exists, temporarily unavailable, or not required by backend.
      }
    }

    await vectorStore.upsert({
      indexName,
      vectors: [embedding],
      metadata: [
        {
          id: doc.id,
          text: doc.content,
          ...doc.metadata,
        },
      ],
      ids: [doc.id],
    });

    // Mark index as ready only after a successful upsert so createIndex is retried
    // on subsequent writes if the previous attempt did not produce a usable index.
    this.#vectorIndexReady = true;
  }

  /**
   * Embed and upsert a batch of documents in as few provider calls as possible.
   *
   * - If the embedder is batch-capable, all texts go through a single embedder
   *   call (chunked by `maxBatchSize`), then a single `upsert` with all vectors.
   * - Otherwise falls back to per-doc embedding via {@link SearchEngine.#indexVector}.
   */
  async #flushVectorBatch(docs: IndexDocument[]): Promise<void> {
    if (!this.#vectorConfig || docs.length === 0) return;

    const { vectorStore, embedder, indexName } = this.#vectorConfig;

    if (!isBatchEmbedder(embedder)) {
      // Single-text embedder: parallelize per-doc work, preserving prior semantics.
      await pMap(docs, doc => this.#indexVector(doc), {
        concurrency: DEFAULT_INDEX_MANY_CONCURRENCY,
      });
      return;
    }

    const embeddings = await this.#embedAll(docs.map(d => d.content));
    if (embeddings.length !== docs.length) {
      throw new Error(`Batch embedder returned ${embeddings.length} embeddings for ${docs.length} inputs.`);
    }

    if (!this.#vectorIndexReady) {
      const dim = embeddings[0]!.length;
      try {
        await vectorStore.createIndex({ indexName, dimension: dim });
      } catch {
        // Already exists, temporarily unavailable, or not required by backend.
      }
    }

    await vectorStore.upsert({
      indexName,
      vectors: embeddings,
      metadata: docs.map(doc => ({
        id: doc.id,
        text: doc.content,
        ...doc.metadata,
      })),
      ids: docs.map(d => d.id),
    });

    this.#vectorIndexReady = true;
  }

  /**
   * Collapse duplicate document ids so a single deterministic upsert runs per id (last queue entry wins).
   */
  #dedupePendingVectorDocsLastWins(docs: readonly IndexDocument[]): IndexDocument[] {
    const byId = new Map<string, IndexDocument>();
    for (const doc of docs) {
      byId.set(doc.id, doc);
    }
    return [...byId.values()];
  }

  /**
   * Ensure vector index is built (for lazy mode).
   *
   * Drains the pending queue into a local batch before awaiting upserts so concurrent `index()` calls
   * append to a fresh queue and are not wiped by a blanket clear. Loops until the queue is empty so
   * documents added mid-flush are indexed before search runs. Re-queues the batch on flush failure.
   */
  async #ensureVectorIndex(): Promise<void> {
    if (!this.#lazyVectorIndex) {
      return;
    }

    if (this.#pendingVectorDocs.length === 0) {
      this.#vectorIndexBuilt = true;
      return;
    }

    while (this.#pendingVectorDocs.length > 0) {
      const batch = this.#pendingVectorDocs;
      this.#pendingVectorDocs = [];

      const uniqueDocs = this.#dedupePendingVectorDocsLastWins(batch);

      try {
        await this.#flushVectorBatch(uniqueDocs);
      } catch (error) {
        this.#pendingVectorDocs = [...uniqueDocs, ...this.#pendingVectorDocs];
        throw error;
      }
    }

    this.#vectorIndexBuilt = true;
  }

  /**
   * BM25 keyword search
   */
  #searchBM25(query: string, topK: number, minScore?: number): SearchResult[] {
    if (!this.#bm25Index) {
      throw new Error('BM25 search requires BM25 configuration.');
    }

    const results = this.#bm25Index.search(query, topK, minScore);
    const queryTokens = tokenize(query, this.#tokenizeOptions);

    return results.map(result => {
      const rawLineRange = findLineRange(result.content, queryTokens, this.#tokenizeOptions);
      const lineRange = this.#adjustLineRange(rawLineRange, result.metadata);
      const { _startLineOffset, ...cleanMetadata } = result.metadata ?? {};

      return {
        id: result.id,
        content: result.content,
        score: result.score,
        lineRange,
        metadata: Object.keys(cleanMetadata).length > 0 ? cleanMetadata : undefined,
        scoreDetails: { bm25: result.score },
      };
    });
  }

  /**
   * Vector semantic search
   */
  async #searchVector(
    query: string,
    topK: number,
    minScore?: number,
    filter?: Record<string, unknown>,
  ): Promise<SearchResult[]> {
    if (!this.#vectorConfig) {
      throw new Error('Vector search requires vector configuration.');
    }

    // Ensure lazy index is built
    await this.#ensureVectorIndex();

    const { vectorStore, indexName } = this.#vectorConfig;

    const queryEmbedding = await this.#embedOne(query);

    const vectorResults = await vectorStore.query({
      indexName,
      queryVector: queryEmbedding,
      topK,
      filter: filter as VectorFilter,
    });

    const queryTokens = tokenize(query, this.#tokenizeOptions);
    const results: SearchResult[] = [];

    for (const result of vectorResults) {
      if (minScore !== undefined && result.score < minScore) {
        continue;
      }

      const id = (result.metadata?.id as string) ?? result.id;
      const content = (result.metadata?.text as string) ?? '';

      // Extract metadata, excluding internal fields
      const { id: _id, text: _text, _startLineOffset, ...restMetadata } = result.metadata ?? {};

      const rawLineRange = findLineRange(content, queryTokens, this.#tokenizeOptions);
      const lineRange = this.#adjustLineRange(rawLineRange, result.metadata);

      results.push({
        id,
        content,
        score: result.score,
        lineRange,
        metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined,
        scoreDetails: { vector: result.score },
      });
    }

    return results;
  }

  /**
   * Hybrid search combining vector and BM25 scores
   */
  async #searchHybrid(
    query: string,
    topK: number,
    minScore?: number,
    vectorWeight: number = 0.5,
    filter?: Record<string, unknown>,
  ): Promise<SearchResult[]> {
    // Get more results than requested to account for merging
    const expandedTopK = Math.min(topK * 2, 50);

    // Perform both searches in parallel
    const [vectorResults, bm25Results] = await Promise.all([
      this.#searchVector(query, expandedTopK, undefined, filter),
      Promise.resolve(this.#searchBM25(query, expandedTopK, undefined)),
    ]);

    // Normalize BM25 scores to 0-1 range
    const normalizedBM25 = this.#normalizeBM25Scores(bm25Results);

    // Create score maps by document id
    const bm25Map = new Map<string, SearchResult>();
    for (const result of normalizedBM25) {
      bm25Map.set(result.id, result);
    }

    const vectorMap = new Map<string, SearchResult>();
    for (const result of vectorResults) {
      vectorMap.set(result.id, result);
    }

    // Combine scores
    const combinedResults = new Map<string, SearchResult>();
    const allIds = new Set([...vectorMap.keys(), ...bm25Map.keys()]);
    const bm25Weight = 1 - vectorWeight;

    for (const id of allIds) {
      const vectorResult = vectorMap.get(id);
      const bm25Result = bm25Map.get(id);

      const vectorScore = vectorResult?.scoreDetails?.vector ?? 0;
      const bm25Score = bm25Result?.score ?? 0; // Already normalized

      const combinedScore = vectorWeight * vectorScore + bm25Weight * bm25Score;

      // Use data from whichever source has it
      const baseResult = vectorResult ?? bm25Result!;

      combinedResults.set(id, {
        id,
        content: baseResult.content,
        score: combinedScore,
        lineRange: bm25Result?.lineRange ?? vectorResult?.lineRange,
        metadata: baseResult.metadata,
        scoreDetails: {
          vector: vectorResult?.scoreDetails?.vector,
          bm25: bm25Result?.scoreDetails?.bm25,
        },
      });
    }

    // Sort by combined score and apply filters
    let results = Array.from(combinedResults.values());
    results.sort((a, b) => b.score - a.score);

    if (minScore !== undefined) {
      results = results.filter(r => r.score >= minScore);
    }

    return results.slice(0, topK);
  }

  /**
   * Normalize BM25 scores to 0-1 range using min-max normalization
   */
  #normalizeBM25Scores(results: SearchResult[]): SearchResult[] {
    if (results.length === 0) return results;

    const scores = results.map(r => r.scoreDetails?.bm25 ?? r.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const range = maxScore - minScore;

    if (range === 0) {
      return results.map(r => ({ ...r, score: 1 }));
    }

    return results.map(r => ({
      ...r,
      score: ((r.scoreDetails?.bm25 ?? r.score) - minScore) / range,
    }));
  }

  /**
   * Adjust line range for chunked documents.
   * If the document has a _startLineOffset in metadata, adjust the line range
   * to reflect the original document's line numbers.
   */
  #adjustLineRange(lineRange: LineRange | undefined, metadata?: Record<string, unknown>): LineRange | undefined {
    if (!lineRange) return undefined;

    const startLineOffset = metadata?._startLineOffset;
    if (typeof startLineOffset !== 'number') {
      return lineRange;
    }

    // Adjust line numbers: chunk lines are 1-indexed relative to chunk,
    // offset is 1-indexed relative to original document
    // So line 1 in chunk with offset 10 becomes line 10 in original
    return {
      start: lineRange.start + startLineOffset - 1,
      end: lineRange.end + startLineOffset - 1,
    };
  }
}
