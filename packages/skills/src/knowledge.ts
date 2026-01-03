import type {
  KnowledgeStorage,
  AnyArtifact,
  MastraKnowledge,
  KnowledgeNamespaceInfo,
  CreateNamespaceOptions,
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
} from '@mastra/core/knowledge';

import { SearchEngine } from './search-engine';
import type { Embedder, SearchEngineConfig, BM25SearchConfig } from './search-engine';
import type { MastraVector } from '@mastra/core/vector';

/** Default prefix for static knowledge artifacts */
export const STATIC_PREFIX = 'static';

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
 * Internal namespace state - tracks search engine per namespace
 */
interface NamespaceState {
  searchEngine: SearchEngine;
  vectorIndexName?: string;
}

/**
 * Options for searching knowledge (re-export for convenience)
 */
export interface SearchOptions extends KnowledgeSearchOptions {}

// Re-export types for convenience
export type { KnowledgeSearchResult } from '@mastra/core/knowledge';

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
 *   storage: new FilesystemStorage({ paths: './knowledge-data' }),
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
  #bm25Config?: BM25SearchConfig;

  /** Whether BM25 is enabled globally */
  #enableBM25: boolean;

  /** Prefix for static artifacts */
  #staticPrefix: string;

  /** Per-namespace state (search engines, etc.) */
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
    bm25?: BM25SearchConfig | boolean;
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
        hasBM25: state?.searchEngine.canBM25 ?? this.#enableBM25,
        hasVector: state?.searchEngine.canVector ?? !!this.#indexConfig,
      };
    });
  }

  async createNamespace(options: CreateNamespaceOptions): Promise<KnowledgeNamespaceInfo> {
    // Create in storage
    const storageInfo = await this.storage.createNamespace({
      namespace: options.namespace,
      description: options.description,
    });

    // Initialize namespace state with a SearchEngine
    const enableBM25 = options.enableBM25 ?? this.#enableBM25;
    const hasVectorConfig = !!options.vectorConfig || !!this.#indexConfig;

    // Build SearchEngine config for this namespace
    const searchEngineConfig: SearchEngineConfig = {};

    if (enableBM25) {
      searchEngineConfig.bm25 = {
        bm25: this.#bm25Config?.bm25,
        tokenize: this.#bm25Config?.tokenize,
      };
    }

    let vectorIndexName: string | undefined;
    if (hasVectorConfig && this.#indexConfig) {
      const prefix = (this.#indexConfig.indexNamePrefix || this.id).replace(/-/g, '_');
      const safeNamespace = options.namespace.replace(/-/g, '_');
      vectorIndexName = options.vectorConfig?.indexName || `${prefix}_${safeNamespace}`;

      searchEngineConfig.vector = {
        vectorStore: this.#indexConfig.vectorStore,
        embedder: this.#indexConfig.embedder,
        indexName: vectorIndexName,
      };
    }

    const searchEngine = new SearchEngine(searchEngineConfig);

    const state: NamespaceState = {
      searchEngine,
      vectorIndexName,
    };

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
    const state = await this.#ensureNamespaceState(namespace);

    // Store the artifact
    await this.storage.add(namespace, artifact);

    // Check if this is a static artifact (not indexed)
    const isStatic = artifact.key.startsWith(`${this.#staticPrefix}/`);

    // Index if not skipped and not static
    if (!options?.skipIndex && !isStatic) {
      await this.#indexArtifact(state, artifact, options?.metadata);
    }
  }

  async get(namespace: string, key: string): Promise<string> {
    return this.storage.get(namespace, key);
  }

  async delete(namespace: string, key: string): Promise<void> {
    await this.storage.delete(namespace, key);

    // Remove from search engine
    const state = this.#namespaceStates.get(namespace);
    if (state) {
      await state.searchEngine.remove(key);
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

    // Search using the SearchEngine
    const searchResults = await state.searchEngine.search(query, {
      topK,
      minScore,
      mode,
      vectorWeight: hybrid?.vectorWeight,
      filter,
    });

    // Transform to KnowledgeSearchResult
    return searchResults.map(result => {
      // Extract metadata, excluding internal fields
      const { key: _key, type: _type, text: _text, namespace: _ns, ...restMetadata } = result.metadata ?? {};

      return {
        key: result.id,
        content: result.content,
        score: result.score,
        lineRange: result.lineRange,
        metadata: Object.keys(restMetadata).length > 0 ? restMetadata : undefined,
        scoreDetails: result.scoreDetails,
      };
    });
  }

  async getNamespaceCapabilities(namespace: string): Promise<{
    canVectorSearch: boolean;
    canBM25Search: boolean;
    canHybridSearch: boolean;
  }> {
    const state = await this.#ensureNamespaceState(namespace);

    return {
      canVectorSearch: state.searchEngine.canVector,
      canBM25Search: state.searchEngine.canBM25,
      canHybridSearch: state.searchEngine.canHybrid,
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
        const searchEngineConfig: SearchEngineConfig = {};

        if (this.#enableBM25) {
          searchEngineConfig.bm25 = {
            bm25: this.#bm25Config?.bm25,
            tokenize: this.#bm25Config?.tokenize,
          };
        }

        let vectorIndexName: string | undefined;
        if (this.#indexConfig) {
          const prefix = (this.#indexConfig.indexNamePrefix || this.id).replace(/-/g, '_');
          const safeNamespace = namespace.replace(/-/g, '_');
          vectorIndexName = `${prefix}_${safeNamespace}`;

          searchEngineConfig.vector = {
            vectorStore: this.#indexConfig.vectorStore,
            embedder: this.#indexConfig.embedder,
            indexName: vectorIndexName,
          };
        }

        const searchEngine = new SearchEngine(searchEngineConfig);

        state = {
          searchEngine,
          vectorIndexName,
        };

        this.#namespaceStates.set(namespace, state);

        // Rebuild index from existing artifacts
        await this.#rebuildIndex(namespace, state);
      }
    }

    return state;
  }

  /**
   * Rebuild the search index from existing artifacts in storage
   */
  async #rebuildIndex(namespace: string, state: NamespaceState): Promise<void> {
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
          // Add to search engine
          await state.searchEngine.index({
            id: key,
            content,
            metadata: { key, type: 'text' },
          });
        } catch {
          // Skip artifacts that can't be read
        }
      }
    } catch {
      // Failed to rebuild index, will start empty
    }
  }

  /**
   * Index an artifact using the SearchEngine
   */
  async #indexArtifact(
    state: NamespaceState,
    artifact: AnyArtifact,
    additionalMetadata?: Record<string, unknown>,
  ): Promise<void> {
    const content = this.#getArtifactContent(artifact);

    const metadata: Record<string, unknown> = {
      key: artifact.key,
      type: artifact.type,
      ...additionalMetadata,
    };

    if (artifact.type === 'image' && 'mimeType' in artifact) {
      metadata.mimeType = artifact.mimeType;
    }

    await state.searchEngine.index({
      id: artifact.key,
      content,
      metadata,
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
