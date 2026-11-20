import type { BufferableEvent, BufferedEvent } from './event-buffer';

export interface StorageByteBatchingConfig {
  /** Serialized buffered-event byte threshold for flushing. Default: 8 MiB. Adapter encoding can add overhead. */
  maxBatchBytes?: number;
  /** Concurrent storage calls. Default: 1; update-based strategies always use 1 to preserve ordering. */
  maxConcurrentWrites?: number;
}

export interface StorageByteBatchingStats {
  pendingBytes: number;
  pendingRecords: number;
  activeWrites: number;
}

export function resolveStorageByteBatching(config: StorageByteBatchingConfig): Required<StorageByteBatchingConfig> {
  const resolved = {
    maxBatchBytes: config.maxBatchBytes ?? 8 * 1024 * 1024,
    maxConcurrentWrites: config.maxConcurrentWrites ?? 1,
  };
  for (const [key, value] of Object.entries(resolved)) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error(`byteBatching.${key} must be a positive safe integer`);
  }
  return resolved;
}

/** Counts each admitted event once until persistence or a definitive drop, even across retries. */
export class StorageByteTracker {
  private sizes = new WeakMap<BufferedEvent, number>();
  private queued = new WeakSet<BufferedEvent>();
  private pendingBytes = 0;
  private pendingRecords = 0;
  queuedBytes = 0;

  constructor(readonly config: Required<StorageByteBatchingConfig>) {}

  capture(event: BufferableEvent): BufferedEvent {
    // Preserve Dates and capture payloads at enqueue time. Serialization errors
    // propagate instead of silently discarding a record.
    const snapshot = { ...structuredClone(event), retryCount: 0 };
    const bytes = Buffer.byteLength(JSON.stringify(snapshot)) + 1;
    this.sizes.set(snapshot, bytes);
    this.pendingBytes += bytes;
    this.pendingRecords++;
    this.enqueue(snapshot);
    return snapshot;
  }

  size(event: BufferedEvent): number {
    return this.sizes.get(event) ?? 0;
  }

  enqueue(event: BufferedEvent): void {
    if (!this.queued.has(event)) {
      this.queued.add(event);
      this.queuedBytes += this.size(event);
    }
  }

  dequeue(event: BufferedEvent): void {
    if (this.queued.delete(event)) this.queuedBytes -= this.size(event);
  }

  releaseIfUnqueued(event: BufferedEvent): boolean {
    if (this.queued.has(event)) return false;
    const bytes = this.sizes.get(event);
    if (bytes === undefined) return false;
    this.sizes.delete(event);
    this.pendingBytes -= bytes;
    this.pendingRecords--;
    return true;
  }

  stats(activeWrites: number): StorageByteBatchingStats {
    return {
      pendingBytes: this.pendingBytes,
      pendingRecords: this.pendingRecords,
      activeWrites,
    };
  }
}
