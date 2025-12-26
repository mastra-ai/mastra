import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';

import type { AnyArtifact } from './types';

/**
 * Abstract base class for knowledge storage backends.
 * Implementations handle the actual persistence of artifacts.
 *
 * This class lives in @mastra/core so that storage adapters
 * can be built in separate packages.
 */
export abstract class KnowledgeStorage extends MastraBase {
  /**
   * Namespace for this storage instance.
   * Used to isolate different knowledge bases.
   */
  namespace: string;

  constructor({ namespace }: { namespace: string }) {
    super({ component: RegisteredLogger.KNOWLEDGE, name: namespace });
    this.namespace = namespace;
  }

  /**
   * Initialize the storage backend.
   * Called once before first use.
   */
  async init(): Promise<void> {
    // Default no-op - adapters override if they need initialization
  }

  /**
   * Add an artifact to storage.
   */
  abstract add(artifact: AnyArtifact): Promise<void>;

  /**
   * Get artifact content by key.
   */
  abstract get(key: string): Promise<string>;

  /**
   * Delete an artifact by key.
   */
  abstract delete(key: string): Promise<void>;

  /**
   * List all artifact keys.
   */
  abstract list(prefix?: string): Promise<string[]>;

  /**
   * Clear all artifacts from storage.
   * Destructive operation - use with caution.
   */
  abstract clear(): Promise<void>;
}
