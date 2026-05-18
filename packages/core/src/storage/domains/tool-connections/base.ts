import { MastraBase } from '../../../base';
import type {
  StorageDeleteToolConnectionInput,
  StorageListToolConnectionsInput,
  StorageToolConnection,
  StorageToolConnectionKey,
  StorageUpsertToolConnectionInput,
} from '../../types';

/**
 * Abstract base class for the tool-connections storage domain.
 *
 * Persists a per-author, provider-agnostic registry of authorized tool
 * integration connections so the UI can surface a stable, user-supplied label
 * (e.g. "Work Gmail") across agents. Rows are keyed by
 * `(authorId, providerId, connectionId)`. The label is the only mutable field.
 *
 * Adapter-native connection state (status, scopes, expiry) still lives with the
 * provider — this domain is purely a name lookup.
 */
export abstract class ToolConnectionsStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'TOOL_CONNECTIONS',
    });
  }

  /** Initialize the store (create tables, indexes, etc). */
  abstract init(): Promise<void>;

  /**
   * Fetch a single tool connection row. Returns `null` when no row exists for
   * the given `(authorId, providerId, connectionId)`.
   */
  abstract get(key: StorageToolConnectionKey): Promise<StorageToolConnection | null>;

  /**
   * Insert or update a tool connection row. Idempotent on
   * `(authorId, providerId, connectionId)` — the existing label/toolService are
   * overwritten. `createdAt` is preserved on update.
   */
  abstract upsert(input: StorageUpsertToolConnectionInput): Promise<StorageToolConnection>;

  /**
   * List tool connection rows for the given author. Optionally narrow by
   * `providerId` and/or `toolService`. Order is not guaranteed.
   */
  abstract list(input: StorageListToolConnectionsInput): Promise<StorageToolConnection[]>;

  /**
   * Remove a single tool connection row. Idempotent — returns silently when the
   * row does not exist.
   */
  abstract delete(input: StorageDeleteToolConnectionInput): Promise<void>;

  /**
   * Delete every tool connection row. Used by tests.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
