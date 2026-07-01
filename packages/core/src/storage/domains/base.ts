import { MastraBase } from '../../base';
import type { PruneOptions, PruneResult, RetentionTablesDescriptor, TableRetentionPolicy } from '../retention';

/**
 * Base class for all storage domains.
 * Provides common interface for initialization and data clearing.
 */
export abstract class StorageDomain extends MastraBase {
  /**
   * Declares which of this domain's tables are eligible for age-based
   * retention, mapping a stable table key → physical table name, timestamp
   * anchor column, and whether that column is indexed.
   *
   * This is the single source of truth used by `prune()` implementations to
   * resolve policies to physical deletes. Domains that support retention
   * override this; the default is empty (nothing prunable).
   */
  static readonly retentionTables: RetentionTablesDescriptor = {};

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

  /**
   * Delete rows older than each policy's `maxAge`, batched, bounded, and
   * cancellable so it is safe to run against very large tables.
   *
   * - `policies` maps this domain's stable table keys to their retention policy.
   * - `options` bound the work (`maxBatches`/`maxRows`), pace it (`pauseMs`),
   *   and allow cooperative cancellation (`signal`).
   *
   * Returns one {@link PruneResult} per table touched. A result with
   * `done: false` means eligible rows remain — call `prune()` again to continue.
   *
   * `prune()` never runs a `VACUUM`; it only deletes rows. Freed pages are
   * reused by future writes so the file stops growing. Reclaiming disk to the OS
   * is the separate, user-invoked `vacuum()`.
   *
   * Default implementation is a no-op (retention not supported).
   */
  async prune(_policies: Record<string, TableRetentionPolicy>, _options?: PruneOptions): Promise<PruneResult[]> {
    return [];
  }
}
