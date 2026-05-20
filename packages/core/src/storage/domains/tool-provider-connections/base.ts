import { MastraBase } from '../../../base';
import type {
  StorageDeleteToolProviderConnectionInput,
  StorageListToolProviderConnectionsInput,
  StorageToolProviderConnection,
  StorageToolProviderConnectionKey,
  StorageUpsertToolProviderConnectionInput,
} from '../../types';

/**
 * Abstract base class for the tool-provider-connections storage domain.
 *
 * Persists a per-author, provider-agnostic registry of authorized tool
 * provider connections so the UI can surface a stable, user-supplied label
 * (e.g. "Work Gmail") across agents. Rows are keyed by
 * `(authorId, providerId, connectionId)`. The label is the only mutable field.
 *
 * Adapter-native connection state (status, scopes, expiry) still lives with the
 * provider — this domain is purely a name lookup.
 */
export abstract class ToolProviderConnectionsStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'TOOL_PROVIDER_CONNECTIONS',
    });
  }

  /** Initialize the store (create tables, indexes, etc). */
  abstract init(): Promise<void>;

  /**
   * Fetch a single tool provider connection row. Returns `null` when no row
   * exists for the given `(authorId, providerId, connectionId)`.
   */
  abstract get(key: StorageToolProviderConnectionKey): Promise<StorageToolProviderConnection | null>;

  /**
   * Insert or update a tool provider connection row. Idempotent on
   * `(authorId, providerId, connectionId)` — the existing label/toolkit are
   * overwritten. `createdAt` is preserved on update.
   */
  abstract upsert(input: StorageUpsertToolProviderConnectionInput): Promise<StorageToolProviderConnection>;

  /**
   * List tool provider connection rows for the given author. Optionally
   * narrow by `providerId` and/or `toolkit`. Order is not guaranteed.
   */
  abstract list(input: StorageListToolProviderConnectionsInput): Promise<StorageToolProviderConnection[]>;

  /**
   * Remove a single tool provider connection row. Idempotent — returns
   * silently when the row does not exist.
   */
  abstract delete(input: StorageDeleteToolProviderConnectionInput): Promise<void>;

  /**
   * Delete every tool provider connection row. Used by tests.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
