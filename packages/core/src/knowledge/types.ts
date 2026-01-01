import type { BaseSearchResult, BaseSearchOptions, SearchMode } from '../artifacts';
import type { KnowledgeStorage } from './base';

/**
 * Supported artifact types for Knowledge storage
 */
export type ArtifactType = 'file' | 'image' | 'text';

/**
 * Base artifact interface
 */
export interface Artifact {
  type: ArtifactType;
  key: string;
}

/**
 * File artifact - stores file content from a path or buffer
 */
export interface FileArtifact extends Artifact {
  type: 'file';
  content: Buffer | string;
}

/**
 * Image artifact - stores image data with optional metadata
 */
export interface ImageArtifact extends Artifact {
  type: 'image';
  content: Buffer | string;
  mimeType?: string;
}

/**
 * Text artifact - stores plain text content
 */
export interface TextArtifact extends Artifact {
  type: 'text';
  content: string;
}

export type AnyArtifact = FileArtifact | ImageArtifact | TextArtifact;

/**
 * Factory function for creating KnowledgeStorage instances.
 * Used by Knowledge to create storage for new namespaces dynamically.
 */
export type KnowledgeStorageFactory = (namespace: string) => Promise<KnowledgeStorage>;

/**
 * Search mode for knowledge queries (alias for shared SearchMode)
 */
export type KnowledgeSearchMode = SearchMode;

/**
 * Search result from knowledge
 */
export interface KnowledgeSearchResult extends BaseSearchResult {
  /** Artifact key */
  key: string;
}

/**
 * Options for searching knowledge
 */
export interface KnowledgeSearchOptions extends BaseSearchOptions {
  /** Metadata filter (only applies to vector search) */
  filter?: Record<string, unknown>;
}

/**
 * Information about a knowledge namespace
 */
export interface KnowledgeNamespaceInfo {
  /** Namespace identifier */
  namespace: string;
  /** Optional description */
  description?: string;
  /** Number of artifacts in the namespace */
  artifactCount: number;
  /** Whether BM25 search is enabled */
  hasBM25: boolean;
  /** Whether vector search is enabled */
  hasVector: boolean;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Options for creating a namespace
 */
export interface CreateNamespaceOptions {
  /** Namespace identifier */
  namespace: string;
  /** Optional description */
  description?: string;
  /** Enable BM25 keyword search (default: true) */
  enableBM25?: boolean;
  /** Vector search configuration */
  vectorConfig?: {
    /** Name of the vector store to use */
    vectorStoreName?: string;
    /** Index name within the vector store */
    indexName?: string;
  };
}

/**
 * Base interface for Knowledge instances that can be registered with Mastra.
 * The actual Knowledge class in @mastra/skills implements this interface.
 *
 * A Knowledge instance manages multiple namespaces, each with its own
 * artifacts, BM25 index, and optional vector configuration.
 */
export interface MastraKnowledge {
  /** Unique identifier for this knowledge instance */
  id: string;

  // ============================================================================
  // Namespace Management
  // ============================================================================

  /**
   * List all namespaces
   */
  listNamespaces(): Promise<KnowledgeNamespaceInfo[]>;

  /**
   * Create a new namespace
   */
  createNamespace(options: CreateNamespaceOptions): Promise<KnowledgeNamespaceInfo>;

  /**
   * Delete a namespace and all its artifacts
   */
  deleteNamespace(namespace: string): Promise<void>;

  /**
   * Check if a namespace exists
   */
  hasNamespace(namespace: string): Promise<boolean>;

  // ============================================================================
  // Artifact Operations (within a namespace)
  // ============================================================================

  /**
   * Add an artifact to a namespace
   */
  add(
    namespace: string,
    artifact: AnyArtifact,
    options?: { skipIndex?: boolean; metadata?: Record<string, unknown> },
  ): Promise<void>;

  /**
   * Get artifact content by key
   */
  get(namespace: string, key: string): Promise<string>;

  /**
   * Delete an artifact by key
   */
  delete(namespace: string, key: string): Promise<void>;

  /**
   * List all artifact keys in a namespace
   */
  list(namespace: string, prefix?: string): Promise<string[]>;

  // ============================================================================
  // Search
  // ============================================================================

  /**
   * Search within a namespace
   */
  search(namespace: string, query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]>;

  /**
   * Check search capabilities for a namespace
   */
  getNamespaceCapabilities(namespace: string): Promise<{
    canVectorSearch: boolean;
    canBM25Search: boolean;
    canHybridSearch: boolean;
  }>;
}
