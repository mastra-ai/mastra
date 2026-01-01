import { ContentStorage } from '../artifacts';
import { RegisteredLogger } from '../logger';

import type { AnyArtifact, KnowledgeNamespaceInfo, KnowledgeSource } from './types';

/**
 * Options for listing namespaces
 */
export interface ListNamespacesOptions {
  /** Only include namespaces from specific source types */
  sourceTypes?: Array<'external' | 'local' | 'managed'>;
}

/**
 * Options for creating a namespace in storage
 */
export interface CreateNamespaceStorageOptions {
  /** Namespace identifier */
  namespace: string;
  /** Optional description */
  description?: string;
}

/**
 * Abstract base class for knowledge storage backends.
 * Implementations handle the actual persistence of artifacts.
 *
 * Storage backends support multiple paths (external packages, local project, managed).
 * For filesystem storage, each path contains namespaces as subdirectories.
 * For key-value stores, paths can be prefixes.
 *
 * CRUD operations (create, update, delete) only work for writable sources:
 * - 'local' (./src/knowledge) - read-write
 * - 'managed' (.mastra/knowledge) - read-write
 * - 'external' (node_modules) - read-only
 *
 * This class lives in @mastra/core so that storage adapters
 * can be built in separate packages.
 */
export abstract class KnowledgeStorage extends ContentStorage {
  constructor({ paths }: { paths: string | string[] }) {
    super({ component: RegisteredLogger.KNOWLEDGE, paths });
  }

  // ============================================================================
  // Namespace Management
  // ============================================================================

  /**
   * List all namespaces from all configured paths.
   */
  abstract listNamespaces(options?: ListNamespacesOptions): Promise<KnowledgeNamespaceInfo[]>;

  /**
   * Create a new namespace.
   */
  abstract createNamespace(options: CreateNamespaceStorageOptions): Promise<KnowledgeNamespaceInfo>;

  /**
   * Delete a namespace and all its artifacts.
   */
  abstract deleteNamespace(namespace: string): Promise<void>;

  /**
   * Check if a namespace exists.
   */
  abstract hasNamespace(namespace: string): Promise<boolean>;

  /**
   * Get namespace info.
   */
  abstract getNamespaceInfo(namespace: string): Promise<KnowledgeNamespaceInfo | null>;

  // ============================================================================
  // Artifact Operations (within a namespace)
  // ============================================================================

  /**
   * Add an artifact to a namespace.
   */
  abstract add(namespace: string, artifact: AnyArtifact): Promise<void>;

  /**
   * Get artifact content by key from a namespace.
   */
  abstract get(namespace: string, key: string): Promise<string>;

  /**
   * Delete an artifact by key from a namespace.
   */
  abstract delete(namespace: string, key: string): Promise<void>;

  /**
   * List all artifact keys in a namespace.
   */
  abstract list(namespace: string, prefix?: string): Promise<string[]>;

  /**
   * Clear all artifacts from a namespace.
   * Destructive operation - use with caution.
   */
  abstract clear(namespace: string): Promise<void>;
}
