import type { KnowledgeStorage, AnyArtifact } from '@mastra/core/knowledge';
import type { MastraVector } from '@mastra/core/vector';

import { BM25Index, type BM25Config, type TokenizeOptions, type BM25SearchResult } from './bm25';

/** Default prefix for static knowledge artifacts */
export const STATIC_PREFIX = 'static';

/**
 * Embedder interface - any function that takes text and returns embeddings
 */
export interface Embedder {
  (text: string): Promise<number[]>;
}

/**
 * Configuration for Knowledge indexing (vector search)
 */
export interface KnowledgeIndexConfig {
  /** Vector store for semantic search */
  vectorStore: MastraVector;
  /** Embedder function for generating vectors */
  embedder: Embedder;
  /** Index name in the vector store */
  indexName: string;
}

/**
 * Configuration for BM25 keyword search
 */
export interface KnowledgeBM25Config {
  /** BM25 algorithm parameters */
  bm25?: BM25Config;
  /** Tokenization options */
  tokenize?: TokenizeOptions;
}

/**
 * Options for adding artifacts
 */
export interface AddArtifactOptions {
  /** Skip indexing for this artifact */
  skipIndex?: boolean;
  /** Additional metadata to store with the vector */
  metadata?: Record<string, unknown>;
}

/**
 * A static artifact with its key and content
 */
export interface StaticArtifact {
  key: string;
  content: string;
}

/**
 * Search result from knowledge
 */
export interface KnowledgeSearchResult {
  /** Artifact key */
  key: string;
  /** Content of the artifact */
  content: string;
  /** Similarity/relevance score (higher is more relevant) */
  score: number;
  /** Additional metadata stored with the artifact */
  metadata?: Record<string, unknown>;
  /** Score breakdown for hybrid search */
  scoreDetails?: {
    /** Vector similarity score (0-1) */
    vector?: number;
    /** BM25 relevance score */
    bm25?: number;
  };
}

/**
 * Search mode options
 */
export type SearchMode = 'vector' | 'bm25' | 'hybrid';

/**
 * Options for searching knowledge
 */
export interface SearchOptions {
  /** Maximum number of results to return (default: 5) */
  topK?: number;
  /** Minimum similarity score threshold (0-1 for vector, varies for BM25) */
  minScore?: number;
  /** Metadata filter (only applies to vector search) */
  filter?: Record<string, unknown>;
  /**
   * Search mode:
   * - 'vector': Semantic similarity search using embeddings (default if index configured)
   * - 'bm25': Keyword-based search using BM25 algorithm (default if only BM25 configured)
   * - 'hybrid': Combine both vector and BM25 scores
   */
  mode?: SearchMode;
  /**
   * Hybrid search configuration (only applies when mode is 'hybrid')
   */
  hybrid?: {
    /**
     * Weight for vector similarity score (0-1).
     * BM25 weight is automatically (1 - vectorWeight).
     * @default 0.5
     */
    vectorWeight?: number;
  };
}

/**
 * Normalize BM25 scores to 0-1 range using min-max normalization
 */
function normalizeBM25Scores(results: BM25SearchResult[]): BM25SearchResult[] {
  if (results.length === 0) return results;

  const scores = results.map(r => r.score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore;

  if (range === 0) {
    // All scores are the same, normalize to 1
    return results.map(r => ({ ...r, score: 1 }));
  }

  return results.map(r => ({
    ...r,
    score: (r.score - minScore) / range,
  }));
}

export class Knowledge {
  storage: KnowledgeStorage;
  #indexConfig?: KnowledgeIndexConfig;
  #bm25Index?: BM25Index;
  #staticPrefix: string;

  constructor({
    storage,
    index,
    bm25,
    staticPrefix = STATIC_PREFIX,
  }: {
    storage: KnowledgeStorage;
    /** Optional indexing configuration for semantic search */
    index?: KnowledgeIndexConfig;
    /** Optional BM25 configuration for keyword search */
    bm25?: KnowledgeBM25Config | boolean;
    /** Prefix for static knowledge artifacts (default: 'static') */
    staticPrefix?: string;
  }) {
    this.storage = storage;
    this.#indexConfig = index;
    this.#staticPrefix = staticPrefix;

    // Initialize BM25 index if configured
    if (bm25 === true) {
      this.#bm25Index = new BM25Index();
    } else if (bm25 && typeof bm25 === 'object') {
      this.#bm25Index = new BM25Index(bm25.bm25, bm25.tokenize);
    }
  }

  /**
   * Add an artifact to the knowledge store.
   * If index config is provided, the artifact will also be indexed for semantic search.
   * If BM25 is enabled, the artifact will be indexed for keyword search.
   */
  async add(artifact: AnyArtifact, options?: AddArtifactOptions): Promise<void> {
    // Store the artifact
    await this.storage.add(artifact);

    // Check if this is a static artifact
    const isStatic = artifact.key.startsWith(`${this.#staticPrefix}/`);

    // Index if configured and not skipped
    // Static artifacts (under static/) are not indexed by default
    if (!options?.skipIndex && !isStatic) {
      // Vector indexing
      if (this.#indexConfig) {
        await this.#indexArtifact(artifact, options?.metadata);
      }

      // BM25 indexing
      if (this.#bm25Index) {
        const content = this.#getArtifactContent(artifact);
        const metadata: Record<string, unknown> = {
          key: artifact.key,
          type: artifact.type,
          ...options?.metadata,
        };
        this.#bm25Index.add(artifact.key, content, metadata);
      }
    }
  }

  /**
   * Get all static artifacts (for system prompt injection)
   * Static artifacts are stored under the static/ prefix
   */
  async getStatic(): Promise<StaticArtifact[]> {
    const keys = await this.storage.list(this.#staticPrefix);
    const artifacts: StaticArtifact[] = [];

    for (const key of keys) {
      try {
        const content = await this.storage.get(key);
        artifacts.push({ key, content });
      } catch {
        // Skip artifacts that can't be read
      }
    }

    return artifacts;
  }

  /**
   * Index an artifact in the vector store
   */
  async #indexArtifact(artifact: AnyArtifact, additionalMetadata?: Record<string, unknown>): Promise<void> {
    if (!this.#indexConfig) {
      return;
    }

    const { vectorStore, embedder, indexName } = this.#indexConfig;

    // Get content as string
    const content = this.#getArtifactContent(artifact);

    // Generate embedding
    const embedding = await embedder(content);

    // Prepare metadata
    const metadata: Record<string, unknown> = {
      key: artifact.key,
      type: artifact.type,
      text: content,
      ...additionalMetadata,
    };

    if (artifact.type === 'image' && 'mimeType' in artifact) {
      metadata.mimeType = artifact.mimeType;
    }

    // Upsert to vector store
    await vectorStore.upsert({
      indexName,
      vectors: [embedding],
      metadata: [metadata],
      ids: [artifact.key],
    });
  }

  /**
   * Get string content from an artifact
   */
  #getArtifactContent(artifact: AnyArtifact): string {
    if (typeof artifact.content === 'string') {
      return artifact.content;
    }
    // For Buffer content, convert to string
    return artifact.content.toString('utf-8');
  }

  /**
   * Delete an artifact from storage and optionally from the index
   */
  async delete(key: string): Promise<void> {
    await this.storage.delete(key);

    if (this.#indexConfig) {
      await this.#indexConfig.vectorStore.deleteVector({
        indexName: this.#indexConfig.indexName,
        id: key,
      });
    }

    if (this.#bm25Index) {
      this.#bm25Index.remove(key);
    }
  }

  /**
   * Get an artifact by key
   */
  async get(key: string): Promise<string> {
    return this.storage.get(key);
  }

  /**
   * List all artifact keys, optionally filtered by prefix
   */
  async list(prefix?: string): Promise<string[]> {
    return this.storage.list(prefix);
  }

  /**
   * Clear all artifacts from storage and index
   */
  async clear(): Promise<void> {
    // Get all keys before clearing
    const keys = await this.storage.list();

    // Clear storage
    await this.storage.clear();

    // Clear from vector index if configured
    if (this.#indexConfig && keys.length > 0) {
      for (const key of keys) {
        try {
          await this.#indexConfig.vectorStore.deleteVector({
            indexName: this.#indexConfig.indexName,
            id: key,
          });
        } catch {
          // Vector may not exist, ignore
        }
      }
    }

    // Clear BM25 index
    if (this.#bm25Index) {
      this.#bm25Index.clear();
    }
  }

  /**
   * Search for relevant knowledge artifacts.
   * Supports vector search, BM25 keyword search, or hybrid search combining both.
   *
   * @param query - The search query text
   * @param options - Search options (topK, minScore, filter, mode)
   * @returns Array of matching artifacts with scores
   *
   * @example
   * ```typescript
   * // Vector search (semantic similarity)
   * const results = await knowledge.search('How do I reset my password?', {
   *   mode: 'vector',
   *   topK: 3,
   *   minScore: 0.7,
   * });
   *
   * // BM25 search (keyword matching)
   * const results = await knowledge.search('password reset', {
   *   mode: 'bm25',
   *   topK: 5,
   * });
   *
   * // Hybrid search (combines both)
   * const results = await knowledge.search('reset password', {
   *   mode: 'hybrid',
   *   hybrid: { vectorWeight: 0.7 },
   * });
   * ```
   */
  async search(query: string, options: SearchOptions = {}): Promise<KnowledgeSearchResult[]> {
    const { topK = 5, minScore, filter, mode, hybrid } = options;

    // Determine the effective search mode
    const effectiveMode = this.#determineSearchMode(mode);

    if (effectiveMode === 'bm25') {
      return this.#searchBM25(query, topK, minScore);
    }

    if (effectiveMode === 'vector') {
      return this.#searchVector(query, topK, minScore, filter);
    }

    // Hybrid search
    return this.#searchHybrid(query, topK, minScore, filter, hybrid?.vectorWeight ?? 0.5);
  }

  /**
   * Determine the effective search mode based on configuration
   */
  #determineSearchMode(requestedMode?: SearchMode): SearchMode {
    if (requestedMode) {
      // Validate the requested mode is available
      if (requestedMode === 'vector' && !this.#indexConfig) {
        throw new Error('Vector search requires index configuration. Provide index config when creating Knowledge.');
      }
      if (requestedMode === 'bm25' && !this.#bm25Index) {
        throw new Error('BM25 search requires bm25 configuration. Provide bm25 config when creating Knowledge.');
      }
      if (requestedMode === 'hybrid' && (!this.#indexConfig || !this.#bm25Index)) {
        throw new Error('Hybrid search requires both index and bm25 configuration.');
      }
      return requestedMode;
    }

    // Auto-determine mode based on available configuration
    if (this.#indexConfig && this.#bm25Index) {
      // Both available, default to hybrid
      return 'hybrid';
    }
    if (this.#indexConfig) {
      return 'vector';
    }
    if (this.#bm25Index) {
      return 'bm25';
    }

    throw new Error('Knowledge search requires either index or bm25 configuration.');
  }

  /**
   * Perform vector search
   */
  async #searchVector(
    query: string,
    topK: number,
    minScore?: number,
    filter?: Record<string, unknown>,
  ): Promise<KnowledgeSearchResult[]> {
    if (!this.#indexConfig) {
      throw new Error('Vector search requires index configuration.');
    }

    const { vectorStore, embedder, indexName } = this.#indexConfig;

    // Generate embedding for the query
    const queryEmbedding = await embedder(query);

    // Query the vector store
    const results = await vectorStore.query({
      indexName,
      queryVector: queryEmbedding,
      topK,
      filter: filter as any,
    });

    // Transform results and apply minScore filter
    const searchResults: KnowledgeSearchResult[] = [];

    for (const result of results) {
      // Skip results below minimum score
      if (minScore !== undefined && result.score < minScore) {
        continue;
      }

      const key = result.metadata?.key as string;
      const content = result.metadata?.text as string;

      if (key && content) {
        // Extract metadata, excluding internal fields
        const { key: _key, text: _text, type: _type, ...restMetadata } = result.metadata ?? {};

        searchResults.push({
          key,
          content,
          score: result.score,
          metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined,
          scoreDetails: {
            vector: result.score,
          },
        });
      }
    }

    return searchResults;
  }

  /**
   * Perform BM25 keyword search
   */
  #searchBM25(query: string, topK: number, minScore?: number): KnowledgeSearchResult[] {
    if (!this.#bm25Index) {
      throw new Error('BM25 search requires bm25 configuration.');
    }

    const results = this.#bm25Index.search(query, topK, minScore);

    return results.map(result => {
      // Extract metadata, excluding internal fields
      const { key: _key, type: _type, ...restMetadata } = result.metadata ?? {};

      return {
        key: result.id,
        content: result.content,
        score: result.score,
        metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined,
        scoreDetails: {
          bm25: result.score,
        },
      };
    });
  }

  /**
   * Perform hybrid search combining vector and BM25 scores
   */
  async #searchHybrid(
    query: string,
    topK: number,
    minScore?: number,
    filter?: Record<string, unknown>,
    vectorWeight: number = 0.5,
  ): Promise<KnowledgeSearchResult[]> {
    if (!this.#indexConfig || !this.#bm25Index) {
      throw new Error('Hybrid search requires both index and bm25 configuration.');
    }

    // Get more results than requested to account for merging
    const expandedTopK = Math.min(topK * 2, 50);

    // Perform both searches in parallel
    const [vectorResults, bm25Results] = await Promise.all([
      this.#searchVector(query, expandedTopK, undefined, filter),
      Promise.resolve(this.#searchBM25(query, expandedTopK, undefined)),
    ]);

    // Normalize BM25 scores to 0-1 range for fair combination
    const normalizedBM25 = normalizeBM25Scores(
      bm25Results.map(r => ({
        id: r.key,
        content: r.content,
        score: r.scoreDetails?.bm25 ?? r.score,
        metadata: r.metadata,
      })),
    );

    // Create a map of BM25 scores by key
    const bm25ScoreMap = new Map<string, { score: number; content: string; metadata?: Record<string, unknown> }>();
    for (const result of normalizedBM25) {
      bm25ScoreMap.set(result.id, {
        score: result.score,
        content: result.content,
        metadata: result.metadata,
      });
    }

    // Create a map of vector scores by key
    const vectorScoreMap = new Map<string, { score: number; content: string; metadata?: Record<string, unknown> }>();
    for (const result of vectorResults) {
      vectorScoreMap.set(result.key, {
        score: result.scoreDetails?.vector ?? result.score,
        content: result.content,
        metadata: result.metadata,
      });
    }

    // Combine scores from both search methods
    const combinedResults = new Map<string, KnowledgeSearchResult>();
    const allKeys = new Set([...vectorScoreMap.keys(), ...bm25ScoreMap.keys()]);

    const bm25Weight = 1 - vectorWeight;

    for (const key of allKeys) {
      const vectorData = vectorScoreMap.get(key);
      const bm25Data = bm25ScoreMap.get(key);

      const vectorScore = vectorData?.score ?? 0;
      const bm25Score = bm25Data?.score ?? 0;

      // Weighted combination of scores
      const combinedScore = vectorWeight * vectorScore + bm25Weight * bm25Score;

      // Use content and metadata from whichever source has it
      const content = vectorData?.content ?? bm25Data?.content ?? '';
      const metadata = vectorData?.metadata ?? bm25Data?.metadata;

      combinedResults.set(key, {
        key,
        content,
        score: combinedScore,
        metadata,
        scoreDetails: {
          vector: vectorScore,
          bm25: bm25Data ? bm25Results.find(r => r.key === key)?.scoreDetails?.bm25 : undefined,
        },
      });
    }

    // Sort by combined score and apply filters
    let results = Array.from(combinedResults.values());
    results.sort((a, b) => b.score - a.score);

    // Apply minScore filter
    if (minScore !== undefined) {
      results = results.filter(r => r.score >= minScore);
    }

    return results.slice(0, topK);
  }

  /**
   * Check if this knowledge instance has search capabilities
   */
  get canSearch(): boolean {
    return this.#indexConfig !== undefined || this.#bm25Index !== undefined;
  }

  /**
   * Check if this knowledge instance has vector search capabilities
   */
  get canVectorSearch(): boolean {
    return this.#indexConfig !== undefined;
  }

  /**
   * Check if this knowledge instance has BM25 search capabilities
   */
  get canBM25Search(): boolean {
    return this.#bm25Index !== undefined;
  }

  /**
   * Check if this knowledge instance has hybrid search capabilities
   */
  get canHybridSearch(): boolean {
    return this.#indexConfig !== undefined && this.#bm25Index !== undefined;
  }

  /**
   * Get the BM25 index (for advanced use cases like serialization)
   */
  get bm25Index(): BM25Index | undefined {
    return this.#bm25Index;
  }
}
