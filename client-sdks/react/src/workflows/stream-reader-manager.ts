import type { StreamOperation, WorkflowStreamReader } from './types';

/**
 * Manages multiple stream readers with automatic cleanup.
 * Uses a Map to track readers by operation type instead of separate refs.
 */
export class StreamReaderManager {
  private readers = new Map<StreamOperation, WorkflowStreamReader>();

  /**
   * Sets a reader for a specific operation, releasing any existing reader first.
   */
  set(key: StreamOperation, reader: WorkflowStreamReader): void {
    this.release(key);
    this.readers.set(key, reader);
  }

  /**
   * Gets a reader for a specific operation.
   */
  get(key: StreamOperation): WorkflowStreamReader | undefined {
    return this.readers.get(key);
  }

  /**
   * Releases a specific reader by key.
   */
  release(key: StreamOperation): void {
    const reader = this.readers.get(key);
    if (reader) {
      try {
        reader.releaseLock();
      } catch {
        // Reader might already be released, ignore
      }
      this.readers.delete(key);
    }
  }

  /**
   * Releases all readers.
   */
  releaseAll(): void {
    for (const key of this.readers.keys()) {
      this.release(key);
    }
  }

  /**
   * Checks if any reader is active.
   */
  hasActiveReaders(): boolean {
    return this.readers.size > 0;
  }
}
