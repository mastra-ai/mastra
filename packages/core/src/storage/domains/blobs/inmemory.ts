import type { StorageBlobEntry } from '../../types';
import { BlobStore } from './base';

/**
 * In-memory implementation of BlobStore for testing.
 */
export class InMemoryBlobStore extends BlobStore {
  readonly #blobs = new Map<string, StorageBlobEntry>();

  async init(): Promise<void> {
    // No-op for in-memory store
  }

  async put(entry: StorageBlobEntry): Promise<void> {
    if (!this.#blobs.has(entry.hash)) {
      this.#blobs.set(entry.hash, entry);
    }
  }

  async get(hash: string): Promise<StorageBlobEntry | null> {
    return this.#blobs.get(hash) ?? null;
  }

  async has(hash: string): Promise<boolean> {
    return this.#blobs.has(hash);
  }

  async delete(hash: string): Promise<boolean> {
    return this.#blobs.delete(hash);
  }

  async putMany(entries: StorageBlobEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.put(entry);
    }
  }

  async getMany(hashes: string[]): Promise<Map<string, StorageBlobEntry>> {
    const result = new Map<string, StorageBlobEntry>();
    for (const hash of hashes) {
      const blob = this.#blobs.get(hash);
      if (blob) {
        result.set(hash, blob);
      }
    }
    return result;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#blobs.clear();
  }
}
