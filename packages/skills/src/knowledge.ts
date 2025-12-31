import type {
  KnowledgeStorage,
  AnyArtifact,
  MastraKnowledge,
  KnowledgeNamespaceInfo,
  CreateNamespaceOptions,
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
} from '@mastra/core/knowledge';
import type { MastraVector } from '@mastra/core/vector';

import {
  BM25Index,
  tokenize,
  findLineRange,
  type BM25Config,
  type TokenizeOptions,
  type BM25SearchResult,
} from './bm25';

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
  /** Index name prefix - will be combined with namespace */
  indexNamePrefix?: string;
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
 * Internal namespace state - tracks BM25 index and vector config per namespace
 */
interface NamespaceState {
  bm25Index?: BM25Index;
  vectorIndexName?: string;
  enableBM25: boolean;
  hasVectorConfig: boolean;
}

/**
 * Search mode options
 */
export type SearchMode = 'vector' | 'bm25' | 'hybrid';

/**
 * Options for searching knowledge (re-export for convenience)
 */
export interface SearchOptions extends KnowledgeSearchOptions {}

// Re-export types for convenience
export type { KnowledgeSearchResult } from '@mastra/core/knowledge';

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

/**
 * Knowledge - manages multiple namespaces of knowledge artifacts.
 *
 * Each namespace can have:
 * - A storage backend (filesystem, etc.)
 * - BM25 keyword search index
 * - Vector search configuration
 *
 * @example
 * ```typescript
 * const knowledge = new Knowledge({
 *   id: 'my-knowledge',
 *   storage: new FilesystemStorage({ basePath: './knowledge-data' }),
 *   bm25: true, // Enable BM25 for all namespaces
 *   index: { vectorStore, embedder }, // Optional vector search
 * });
 *
 * // Create a namespace
 * await knowledge.createNamespace({ namespace: 'docs' });
 *
 * // Add artifacts
 * await knowledge.add('docs', { type: 'text', key: 'intro.md', content: '...' });
 *
 * // Search
 * const results = await knowledge.search('docs', 'how to get started');
 * ```
 */
export class Knowledge implements MastraKnowledge {
  /** Unique identifier for this knowledge instance */
  readonly id: string;

  /** Storage backend */
  readonly storage: KnowledgeStorage;

  /** Global index config (applied to all namespaces) */
  #indexConfig?: KnowledgeIndexConfig;

  /** Global BM25 config */
  #bm25Config?: KnowledgeBM25Config;

  /** Whether BM25 is enabled globally */
  #enableBM25: boolean;

  /** Prefix for static artifacts */
  #staticPrefix: string;

  /** Per-namespace state (BM25 indexes, etc.) */
  #namespaceStates: Map<string, NamespaceState> = new Map();

  constructor({
    id,
    storage,
    index,
    bm25,
    staticPrefix = STATIC_PREFIX,
  }: {
    /** Unique identifier for this knowledge instance */
    id: string;
    /** Storage backend for artifacts */
    storage: KnowledgeStorage;
    /** Optional indexing configuration for semantic search */
    index?: KnowledgeIndexConfig;
    /** Optional BM25 configuration for keyword search */
    bm25?: KnowledgeBM25Config | boolean;
    /** Prefix for static knowledge artifacts (default: 'static') */
    staticPrefix?: string;
  }) {
    this.id = id;
    this.storage = storage;
    this.#indexConfig = index;
    this.#staticPrefix = staticPrefix;

    // Parse BM25 config
    if (bm25 === true) {
      this.#enableBM25 = true;
      this.#bm25Config = {};
    } else if (bm25 && typeof bm25 === 'object') {
      this.#enableBM25 = true;
      this.#bm25Config = bm25;
    } else {
      this.#enableBM25 = false;
    }
  }

  // ============================================================================
  // Namespace Management
  // ============================================================================

  async listNamespaces(): Promise<KnowledgeNamespaceInfo[]> {
    const storageNamespaces = await this.storage.listNamespaces();

    // Enrich with search capability info from our state
    return storageNamespaces.map(ns => {
      const state = this.#namespaceStates.get(ns.namespace);
      return {
        ...ns,
        hasBM25: state?.enableBM25 ?? this.#enableBM25,
        hasVector: state?.hasVectorConfig ?? !!this.#indexConfig,
      };
    });
  }

  async createNamespace(options: CreateNamespaceOptions): Promise<KnowledgeNamespaceInfo> {
    // Create in storage
    const storageInfo = await this.storage.createNamespace({
      namespace: options.namespace,
      description: options.description,
    });

    // Initialize namespace state
    const enableBM25 = options.enableBM25 ?? this.#enableBM25;
    const hasVectorConfig = !!options.vectorConfig || !!this.#indexConfig;

    const state: NamespaceState = {
      enableBM25,
      hasVectorConfig,
    };

    // Create BM25 index if enabled
    if (enableBM25 && this.#bm25Config) {
      state.bm25Index = new BM25Index(this.#bm25Config.bm25, this.#bm25Config.tokenize);
    } else if (enableBM25) {
      state.bm25Index = new BM25Index();
    }

    // Determine vector index name (use underscores for SQL compatibility)
    if (hasVectorConfig) {
      const prefix = (this.#indexConfig?.indexNamePrefix || this.id).replace(/-/g, '_');
      const safeNamespace = options.namespace.replace(/-/g, '_');
      state.vectorIndexName = options.vectorConfig?.indexName || `${prefix}_${safeNamespace}`;
    }

    this.#namespaceStates.set(options.namespace, state);

    return {
      ...storageInfo,
      hasBM25: enableBM25,
      hasVector: hasVectorConfig,
    };
  }

  async deleteNamespace(namespace: string): Promise<void> {
    // Delete from storage
    await this.storage.deleteNamespace(namespace);

    // Clean up namespace state
    this.#namespaceStates.delete(namespace);
  }

  async hasNamespace(namespace: string): Promise<boolean> {
    return this.storage.hasNamespace(namespace);
  }

  // ============================================================================
  // Artifact Operations
  // ============================================================================

  async add(
    namespace: string,
    artifact: AnyArtifact,
    options?: { skipIndex?: boolean; metadata?: Record<string, unknown> },
  ): Promise<void> {
    // Ensure namespace exists and get/create its state
    await this.#ensureNamespaceState(namespace);

    // Store the artifact
    await this.storage.add(namespace, artifact);

    // Check if this is a static artifact (not indexed)
    const isStatic = artifact.key.startsWith(`${this.#staticPrefix}/`);

    // Index if not skipped and not static
    if (!options?.skipIndex && !isStatic) {
      await this.#indexArtifact(namespace, artifact, options?.metadata);
    }
  }

  async get(namespace: string, key: string): Promise<string> {
    return this.storage.get(namespace, key);
  }

  async delete(namespace: string, key: string): Promise<void> {
    await this.storage.delete(namespace, key);

    // Remove from indexes
    const state = this.#namespaceStates.get(namespace);

    if (state?.bm25Index) {
      state.bm25Index.remove(key);
    }

    if (this.#indexConfig && state?.vectorIndexName) {
      try {
        await this.#indexConfig.vectorStore.deleteVector({
          indexName: state.vectorIndexName,
          id: key,
        });
      } catch {
        // Vector may not exist, ignore
      }
    }
  }

  async list(namespace: string, prefix?: string): Promise<string[]> {
    return this.storage.list(namespace, prefix);
  }

  // ============================================================================
  // Search
  // ============================================================================

  async search(
    namespace: string,
    query: string,
    options: KnowledgeSearchOptions = {},
  ): Promise<KnowledgeSearchResult[]> {
    const state = await this.#ensureNamespaceState(namespace);
    const { topK = 5, minScore, filter, mode, hybrid } = options;

    // Determine the effective search mode
    const effectiveMode = this.#determineSearchMode(state, mode);

    if (effectiveMode === 'bm25') {
      return this.#searchBM25(state, query, topK, minScore);
    }

    if (effectiveMode === 'vector') {
      return this.#searchVector(state, query, topK, minScore, filter);
    }

    // Hybrid search
    return this.#searchHybrid(state, query, topK, minScore, filter, hybrid?.vectorWeight ?? 0.5);
  }

  async getNamespaceCapabilities(namespace: string): Promise<{
    canVectorSearch: boolean;
    canBM25Search: boolean;
    canHybridSearch: boolean;
  }> {
    const state = await this.#ensureNamespaceState(namespace);

    const canBM25 = !!state.bm25Index;
    const canVector = !!this.#indexConfig && !!state.vectorIndexName;

    return {
      canVectorSearch: canVector,
      canBM25Search: canBM25,
      canHybridSearch: canVector && canBM25,
    };
  }

  // ============================================================================
  // Static Artifacts (for agent system prompts)
  // ============================================================================

  /**
   * Get all static artifacts from a namespace (for system prompt injection).
   * Static artifacts are stored under the static/ prefix.
   */
  async getStatic(namespace: string): Promise<StaticArtifact[]> {
    const keys = await this.storage.list(namespace, this.#staticPrefix);
    const artifacts: StaticArtifact[] = [];

    for (const key of keys) {
      try {
        const content = await this.storage.get(namespace, key);
        artifacts.push({ key, content });
      } catch {
        // Skip artifacts that can't be read
      }
    }

    return artifacts;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Ensure a namespace has its state initialized
   */
  async #ensureNamespaceState(namespace: string): Promise<NamespaceState> {
    let state = this.#namespaceStates.get(namespace);

    if (!state) {
      // Check if namespace exists in storage
      const exists = await this.storage.hasNamespace(namespace);

      if (!exists) {
        // Auto-create the namespace
        await this.createNamespace({ namespace });
        state = this.#namespaceStates.get(namespace)!;
      } else {
        // Initialize state for existing namespace
        state = {
          enableBM25: this.#enableBM25,
          hasVectorConfig: !!this.#indexConfig,
        };

        if (this.#enableBM25) {
          state.bm25Index = this.#bm25Config
            ? new BM25Index(this.#bm25Config.bm25, this.#bm25Config.tokenize)
            : new BM25Index();
        }

        if (this.#indexConfig) {
          const prefix = (this.#indexConfig.indexNamePrefix || this.id).replace(/-/g, '_');
          const safeNamespace = namespace.replace(/-/g, '_');
          state.vectorIndexName = `${prefix}_${safeNamespace}`;
        }

        this.#namespaceStates.set(namespace, state);

        // Rebuild BM25 index from existing artifacts
        if (state.bm25Index) {
          await this.#rebuildBM25Index(namespace, state);
        }
      }
    }

    return state;
  }

  /**
   * Rebuild the BM25 index from existing artifacts in storage
   */
  async #rebuildBM25Index(namespace: string, state: NamespaceState): Promise<void> {
    if (!state.bm25Index) return;

    try {
      // List all artifact keys (excluding static/ prefix which shouldn't be indexed)
      const keys = await this.storage.list(namespace);

      for (const key of keys) {
        // Skip static artifacts - they shouldn't be in the search index
        if (key.startsWith(`${this.#staticPrefix}/`)) {
          continue;
        }

        try {
          const content = await this.storage.get(namespace, key);
          // Add to BM25 index with basic metadata
          state.bm25Index.add(key, content, { key, type: 'text' });
        } catch {
          // Skip artifacts that can't be read
        }
      }
    } catch {
      // Failed to rebuild index, will start empty
    }
  }

  /**
   * Index an artifact in both BM25 and vector stores
   */
  async #indexArtifact(
    namespace: string,
    artifact: AnyArtifact,
    additionalMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const state = this.#namespaceStates.get(namespace);
    if (!state) return;

    const content = this.#getArtifactContent(artifact);

    // BM25 indexing
    if (state.bm25Index) {
      const metadata: Record<string, unknown> = {
        key: artifact.key,
        type: artifact.type,
        ...additionalMetadata,
      };
      state.bm25Index.add(artifact.key, content, metadata);
    }

    // Vector indexing
    if (this.#indexConfig && state.vectorIndexName) {
      const { vectorStore, embedder } = this.#indexConfig;

      // Generate embedding
      const embedding = await embedder(content);

      // Prepare metadata
      const metadata: Record<string, unknown> = {
        key: artifact.key,
        type: artifact.type,
        text: content,
        namespace,
        ...additionalMetadata,
      };

      if (artifact.type === 'image' && 'mimeType' in artifact) {
        metadata.mimeType = artifact.mimeType;
      }

      // Upsert to vector store
      await vectorStore.upsert({
        indexName: state.vectorIndexName,
        vectors: [embedding],
        metadata: [metadata],
        ids: [artifact.key],
      });
    }
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
   * Determine the effective search mode based on configuration
   */
  #determineSearchMode(
    state: NamespaceState,
    requestedMode?: 'vector' | 'bm25' | 'hybrid',
  ): 'vector' | 'bm25' | 'hybrid' {
    const canVector = !!this.#indexConfig && !!state.vectorIndexName;
    const canBM25 = !!state.bm25Index;

    if (requestedMode) {
      // Validate the requested mode is available
      if (requestedMode === 'vector' && !canVector) {
        throw new Error('Vector search requires index configuration. Provide index config when creating Knowledge.');
      }
      if (requestedMode === 'bm25' && !canBM25) {
        throw new Error('BM25 search requires bm25 configuration. Provide bm25 config when creating Knowledge.');
      }
      if (requestedMode === 'hybrid' && (!canVector || !canBM25)) {
        throw new Error('Hybrid search requires both index and bm25 configuration.');
      }
      return requestedMode;
    }

    // Auto-determine mode based on available configuration
    if (canVector && canBM25) {
      return 'hybrid';
    }
    if (canVector) {
      return 'vector';
    }
    if (canBM25) {
      return 'bm25';
    }

    throw new Error('Knowledge search requires either index or bm25 configuration.');
  }

  /**
   * Perform BM25 keyword search
   */
  #searchBM25(state: NamespaceState, query: string, topK: number, minScore?: number): KnowledgeSearchResult[] {
    if (!state.bm25Index) {
      throw new Error('BM25 search requires bm25 configuration.');
    }

    const results = state.bm25Index.search(query, topK, minScore);

    // Tokenize query for line range finding
    const queryTokens = tokenize(query, this.#bm25Config?.tokenize);

    return results.map(result => {
      // Extract metadata, excluding internal fields
      const { key: _key, type: _type, ...restMetadata } = result.metadata ?? {};

      // Find line range where query terms appear
      const lineRange = findLineRange(result.content, queryTokens, this.#bm25Config?.tokenize);

      return {
        key: result.id,
        content: result.content,
        score: result.score,
        lineRange,
        metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined,
        scoreDetails: {
          bm25: result.score,
        },
      };
    });
  }

  /**
   * Perform vector search
   */
  async #searchVector(
    state: NamespaceState,
    query: string,
    topK: number,
    minScore?: number,
    filter?: Record<string, unknown>,
  ): Promise<KnowledgeSearchResult[]> {
    if (!this.#indexConfig || !state.vectorIndexName) {
      throw new Error('Vector search requires index configuration.');
    }

    const { vectorStore, embedder } = this.#indexConfig;

    // Generate embedding for the query
    const queryEmbedding = await embedder(query);

    // Query the vector store
    const results = await vectorStore.query({
      indexName: state.vectorIndexName,
      queryVector: queryEmbedding,
      topK,
      filter: filter as any,
    });

    // Tokenize query for line range finding
    const queryTokens = tokenize(query, this.#bm25Config?.tokenize);

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
        const { key: _key, text: _text, type: _type, namespace: _ns, ...restMetadata } = result.metadata ?? {};

        // Find line range where query terms appear
        const lineRange = findLineRange(content, queryTokens, this.#bm25Config?.tokenize);

        searchResults.push({
          key,
          content,
          score: result.score,
          lineRange,
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
   * Perform hybrid search combining vector and BM25 scores
   */
  async #searchHybrid(
    state: NamespaceState,
    query: string,
    topK: number,
    minScore?: number,
    filter?: Record<string, unknown>,
    vectorWeight: number = 0.5,
  ): Promise<KnowledgeSearchResult[]> {
    if (!this.#indexConfig || !state.bm25Index || !state.vectorIndexName) {
      throw new Error('Hybrid search requires both index and bm25 configuration.');
    }

    // Get more results than requested to account for merging
    const expandedTopK = Math.min(topK * 2, 50);

    // Perform both searches in parallel
    const [vectorResults, bm25Results] = await Promise.all([
      this.#searchVector(state, query, expandedTopK, undefined, filter),
      Promise.resolve(this.#searchBM25(state, query, expandedTopK, undefined)),
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

  // ============================================================================
  // Legacy Compatibility Getters
  // ============================================================================

  /** @deprecated Use getNamespaceCapabilities instead */
  get canVectorSearch(): boolean {
    return !!this.#indexConfig;
  }

  /** @deprecated Use getNamespaceCapabilities instead */
  get canBM25Search(): boolean {
    return this.#enableBM25;
  }

  /** @deprecated Use getNamespaceCapabilities instead */
  get canHybridSearch(): boolean {
    return this.canVectorSearch && this.canBM25Search;
  }

  /** @deprecated Use getNamespaceCapabilities instead */
  get canSearch(): boolean {
    return this.canVectorSearch || this.canBM25Search;
  }
}
