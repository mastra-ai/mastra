import { MastraBase } from '../../../base';
import type { StorageBlobEntry } from '../../types';

/**
 * Abstract base class for content-addressable blob storage.
 * Used to store file contents for skill versioning.
 *
 * Blobs are keyed by their SHA-256 hash, providing natural deduplication.
 */
export abstract class BlobStore extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'BLOBS',
    });
  }

  /**
   * Initialize the blob store (create tables, etc).
   */
  abstract init(): Promise<void>;

  /**
   * Store a blob. If the hash already exists, this is a no-op.
   */
  abstract put(entry: StorageBlobEntry): Promise<void>;

  /**
   * Retrieve a blob by its hash.
   * Returns null if not found.
   */
  abstract get(hash: string): Promise<StorageBlobEntry | null>;

  /**
   * Check if a blob exists by hash.
   */
  abstract has(hash: string): Promise<boolean>;

  /**
   * Delete a blob by hash.
   * Returns true if the blob was deleted, false if it didn't exist.
   */
  abstract delete(hash: string): Promise<boolean>;

  /**
   * Store multiple blobs in a batch. Skips any that already exist.
   */
  abstract putMany(entries: StorageBlobEntry[]): Promise<void>;

  /**
   * Retrieve multiple blobs by their hashes.
   * Returns a Map of hash -> entry. Missing hashes are omitted.
   */
  abstract getMany(hashes: string[]): Promise<Map<string, StorageBlobEntry>>;

  /**
   * Delete all blobs. Used for testing.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
