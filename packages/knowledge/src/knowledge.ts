import type { KnowledgeStorage, AnyArtifact } from '@mastra/core/knowledge';
import type { MastraVector } from '@mastra/core/vector';

/** Default prefix for static knowledge artifacts */
export const STATIC_PREFIX = 'static';

/**
 * Embedder interface - any function that takes text and returns embeddings
 */
export interface Embedder {
  (text: string): Promise<number[]>;
}

/**
 * Configuration for Knowledge indexing
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
  /** Similarity score (0-1, higher is more similar) */
  score: number;
  /** Additional metadata stored with the artifact */
  metadata?: Record<string, unknown>;
}

/**
 * Options for searching knowledge
 */
export interface SearchOptions {
  /** Maximum number of results to return (default: 5) */
  topK?: number;
  /** Minimum similarity score threshold (0-1) */
  minScore?: number;
  /** Metadata filter */
  filter?: Record<string, unknown>;
}

export class Knowledge {
  storage: KnowledgeStorage;
  #indexConfig?: KnowledgeIndexConfig;
  #staticPrefix: string;

  constructor({
    storage,
    index,
    staticPrefix = STATIC_PREFIX,
  }: {
    storage: KnowledgeStorage;
    /** Optional indexing configuration for semantic search */
    index?: KnowledgeIndexConfig;
    /** Prefix for static knowledge artifacts (default: 'static') */
    staticPrefix?: string;
  }) {
    this.storage = storage;
    this.#indexConfig = index;
    this.#staticPrefix = staticPrefix;
  }

  /**
   * Add an artifact to the knowledge store.
   * If index config is provided, the artifact will also be indexed for semantic search.
   */
  async add(artifact: AnyArtifact, options?: AddArtifactOptions): Promise<void> {
    // Store the artifact
    await this.storage.add(artifact);

    // Index if configured and not skipped
    // Static artifacts (under static/) are not indexed by default
    const isStatic = artifact.key.startsWith(`${this.#staticPrefix}/`);
    if (this.#indexConfig && !options?.skipIndex && !isStatic) {
      await this.#indexArtifact(artifact, options?.metadata);
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

    // Clear from index if configured
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
  }

  /**
   * Search for relevant knowledge artifacts using semantic similarity.
   * Requires index configuration to be provided.
   *
   * @param query - The search query text
   * @param options - Search options (topK, minScore, filter)
   * @returns Array of matching artifacts with scores
   *
   * @example
   * ```typescript
   * const results = await knowledge.search('How do I reset my password?', {
   *   topK: 3,
   *   minScore: 0.7,
   * });
   *
   * for (const result of results) {
   *   console.log(`${result.key} (score: ${result.score})`);
   *   console.log(result.content);
   * }
   * ```
   */
  async search(query: string, options: SearchOptions = {}): Promise<KnowledgeSearchResult[]> {
    if (!this.#indexConfig) {
      throw new Error('Knowledge search requires index configuration. Provide index config when creating Knowledge.');
    }

    const { vectorStore, embedder, indexName } = this.#indexConfig;
    const { topK = 5, minScore, filter } = options;

    // Generate embedding for the query
    const queryEmbedding = await embedder(query);

    // Query the vector store
    // Note: filter is cast to any because VectorFilter type is complex and
    // we accept a simpler Record<string, unknown> from users
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
        });
      }
    }

    return searchResults;
  }

  /**
   * Check if this knowledge instance has search capabilities
   */
  get canSearch(): boolean {
    return this.#indexConfig !== undefined;
  }
}
