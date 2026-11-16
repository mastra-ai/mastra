import type { Lock, QueueEntry, StateAdapter } from 'chat';

/**
 * Wraps a {@link StateAdapter} to apply a per-platform deduplication window.
 *
 * The Chat SDK keeps one deduplication TTL for the whole instance, so a single
 * `AgentChannels` serving several platforms cannot give one platform a short
 * window and another a long one. The SDK records its deduplication markers
 * through `setIfNotExists`, and the marker key carries the platform name, so
 * rewriting the TTL there is the one place that covers every delivery path
 * (webhooks and the Gateway listener alike).
 *
 * Everything else is forwarded untouched, and the original TTL is kept whenever
 * `getDedupeTtlMs` returns `undefined` — so an adapter that configures no
 * per-platform window behaves exactly as it did unwrapped.
 */
export class PlatformDedupeStateAdapter implements StateAdapter {
  private readonly inner: StateAdapter;
  private readonly getDedupeTtlMs: (key: string) => number | undefined;

  constructor(inner: StateAdapter, getDedupeTtlMs: (key: string) => number | undefined) {
    this.inner = inner;
    this.getDedupeTtlMs = getDedupeTtlMs;
  }

  async setIfNotExists(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
    return this.inner.setIfNotExists(key, value, this.getDedupeTtlMs(key) ?? ttlMs);
  }

  async connect(): Promise<void> {
    return this.inner.connect();
  }

  async disconnect(): Promise<void> {
    return this.inner.disconnect();
  }

  async subscribe(threadId: string): Promise<void> {
    return this.inner.subscribe(threadId);
  }

  async unsubscribe(threadId: string): Promise<void> {
    return this.inner.unsubscribe(threadId);
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    return this.inner.isSubscribed(threadId);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.inner.get<T>(key);
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    return this.inner.set(key, value, ttlMs);
  }

  async delete(key: string): Promise<void> {
    return this.inner.delete(key);
  }

  async appendToList(key: string, value: unknown, options?: { maxLength?: number; ttlMs?: number }): Promise<void> {
    return this.inner.appendToList(key, value, options);
  }

  async getList<T = unknown>(key: string): Promise<T[]> {
    return this.inner.getList<T>(key);
  }

  async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    return this.inner.acquireLock(threadId, ttlMs);
  }

  async releaseLock(lock: Lock): Promise<void> {
    return this.inner.releaseLock(lock);
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    return this.inner.extendLock(lock, ttlMs);
  }

  async forceReleaseLock(threadId: string): Promise<void> {
    return this.inner.forceReleaseLock(threadId);
  }

  async enqueue(threadId: string, entry: QueueEntry, maxSize: number): Promise<number> {
    return this.inner.enqueue(threadId, entry, maxSize);
  }

  async dequeue(threadId: string): Promise<QueueEntry | null> {
    return this.inner.dequeue(threadId);
  }

  async queueDepth(threadId: string): Promise<number> {
    return this.inner.queueDepth(threadId);
  }
}
