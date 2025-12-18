import { MastraBase } from '../../base';

/**
 * Base class for all storage domains.
 * Provides common interface for initialization and data clearing.
 */
export abstract class StorageDomain extends MastraBase {
  /**
   * Initialize the storage domain.
   * This should create any necessary tables/collections.
   * Default implementation is a no-op - override in adapters that need initialization.
   */
  async init(): Promise<void> {
    // Default no-op - adapters override if they need to create tables/collections
  }

  /**
   * Clears all data from this storage domain.
   * This is a destructive operation - use with caution.
   * Primarily used for testing.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
