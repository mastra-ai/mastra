/**
 * SearchEngine - Unified search engine supporting BM25, vector, and hybrid search.
 *
 * Provides search capabilities for Workspace, enabling keyword-based (BM25),
 * semantic (vector), and combined hybrid search across indexed content.
 */

import type { SearchMode, LineRange } from '../artifacts';
import type { MastraVector, VectorFilter } from '../vector';

import { BM25Index, tokenize, findLineRange } from './bm25';
import type { BM25Config, TokenizeOptions, BM25SearchResult } from './bm25';

// Re-export SearchMode for consumers
export type { SearchMode };

// =============================================================================
// Types
// =============================================================================

/**
 * Embedder interface - any function that takes text and returns embeddings
 */
export interface Embedder {
  (text: string): Promise<number[]>;
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

  /** Documents pending vector indexing (for lazy mode) */
  #pendingVectorDocs: IndexDocument[] = [];

  /** Whether vector index has been built (for lazy mode) */
  #vectorIndexBuilt: boolean = false;

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
   * Index multiple documents
   */
  async indexMany(docs: IndexDocument[]): Promise<void> {
    for (const doc of docs) {
      await this.index(doc);
    }
  }

  /**
   * Remove a document from the index
   */
  async remove(id: string): Promise<void> {
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
   * Clear all indexed documents
   */
  clear(): void {
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
   * Index a single document in the vector store
   */
  async #indexVector(doc: IndexDocument): Promise<void> {
    if (!this.#vectorConfig) return;

    const { vectorStore, embedder, indexName } = this.#vectorConfig;

    const embedding = await embedder(doc.content);

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
  }

  /**
   * Ensure vector index is built (for lazy mode)
   */
  async #ensureVectorIndex(): Promise<void> {
    if (!this.#lazyVectorIndex || this.#vectorIndexBuilt || this.#pendingVectorDocs.length === 0) {
      return;
    }

    for (const doc of this.#pendingVectorDocs) {
      await this.#indexVector(doc);
    }

    this.#pendingVectorDocs = [];
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

    const { vectorStore, embedder, indexName } = this.#vectorConfig;

    const queryEmbedding = await embedder(query);

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
