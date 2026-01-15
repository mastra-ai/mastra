import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';

/**
 * Abstract base class for content storage backends.
 *
 * Provides common infrastructure for storing and retrieving searchable content.
 * Supports multiple container paths, allowing content from different sources
 * (local, managed, external packages).
 *
 * This class lives in @mastra/core so that storage adapters
 * can be built in separate packages.
 */
export abstract class ContentStorage extends MastraBase {
  /**
   * Paths to search for content.
   * Each path is a container that holds entities (skills or namespaces).
   */
  paths: string[];

  constructor({ component, paths }: { component: RegisteredLogger; paths: string | string[] }) {
    const pathsArray = Array.isArray(paths) ? paths : [paths];
    super({ component, name: pathsArray.join(', ') });
    this.paths = pathsArray;
  }

  /**
   * Initialize the storage backend.
   * Called once before first use.
   */
  async init(): Promise<void> {
    // Default no-op - adapters override if they need initialization
  }

  /**
   * Refresh the content cache by re-scanning all paths.
   */
  abstract refresh(): Promise<void>;
}
