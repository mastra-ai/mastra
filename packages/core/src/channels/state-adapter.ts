import type { Lock, QueueEntry, StateAdapter } from 'chat';

import type { MemoryStorage } from '../storage/domains/memory/base';

interface CachedValue<T = unknown> {
  value: T;
  expiresAt: number | null; // null = no expiry
}

/**
 * Chat SDK StateAdapter backed by Mastra storage.
 *
 * Thread subscriptions are persisted to the Mastra `MemoryStorage` domain
 * using thread metadata (`channel_subscribed`), so they survive restarts.
 *
 * Cache, locks, and dedup keys remain in-memory — they are inherently
 * short-lived (seconds to minutes) and don't need persistence.
 */
export class MastraStateAdapter implements StateAdapter {
  private memoryStore: MemoryStorage;
  private connected = false;
  private connectPromise: Promise<void> | null = null;

  // In-memory ephemeral state (cache, locks, lists, queues)
  private readonly cache = new Map<string, CachedValue>();
  private readonly locks = new Map<string, Lock>();
  private readonly lists = new Map<string, { values: unknown[]; expiresAt: number | null }>();
  private readonly queues = new Map<string, QueueEntry[]>();

  constructor(memoryStore: MemoryStorage) {
    this.memoryStore = memoryStore;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (!this.connectPromise) {
      this.connectPromise = Promise.resolve().then(() => {
        this.connected = true;
      });
    }
    await this.connectPromise;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.connectPromise = null;
    this.cache.clear();
    this.locks.clear();
    this.lists.clear();
    this.queues.clear();
  }

  // ---------------------------------------------------------------------------
  // Subscriptions — persisted via Mastra thread metadata
  // ---------------------------------------------------------------------------

  async subscribe(threadId: string): Promise<void> {
    // Find the Mastra thread mapped to this external thread ID and mark it
    const thread = await this.findThreadByExternalId(threadId);
    if (!thread) return; // Thread not yet mapped — subscribe will be a no-op
    await this.memoryStore.updateThread({
      id: thread.id,
      title: thread.title ?? '',
      metadata: { ...thread.metadata, channel_subscribed: 'true' },
    });
  }

  async unsubscribe(threadId: string): Promise<void> {
    const thread = await this.findThreadByExternalId(threadId);
    if (!thread) return;
    await this.memoryStore.updateThread({
      id: thread.id,
      title: thread.title ?? '',
      metadata: { ...((thread.metadata ?? {}) as Record<string, unknown>), channel_subscribed: 'false' },
    });
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    const thread = await this.findThreadByExternalId(threadId);
    if (!thread) return false;
    return (thread.metadata as Record<string, unknown>)?.channel_subscribed === 'true';
  }

  // ---------------------------------------------------------------------------
  // Cache — in-memory with TTL
  // ---------------------------------------------------------------------------

  async get<T = unknown>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (cached.expiresAt !== null && cached.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return cached.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
  }

  async setIfNotExists(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
    const existing = this.cache.get(key);
    if (existing) {
      if (existing.expiresAt !== null && existing.expiresAt <= Date.now()) {
        this.cache.delete(key);
      } else {
        return false;
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
    return true;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  // ---------------------------------------------------------------------------
  // Lists — in-memory with TTL
  // ---------------------------------------------------------------------------

  async appendToList(key: string, value: unknown, options?: { maxLength?: number; ttlMs?: number }): Promise<void> {
    let entry = this.lists.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      entry = undefined;
    }
    const values = entry?.values ?? [];
    values.push(value);
    if (options?.maxLength && values.length > options.maxLength) {
      values.splice(0, values.length - options.maxLength);
    }
    this.lists.set(key, {
      values,
      expiresAt: options?.ttlMs ? Date.now() + options.ttlMs : (entry?.expiresAt ?? null),
    });
  }

  async getList<T = unknown>(key: string): Promise<T[]> {
    const entry = this.lists.get(key);
    if (!entry) return [];
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.lists.delete(key);
      return [];
    }
    return entry.values as T[];
  }

  // ---------------------------------------------------------------------------
  // Locks — in-memory
  // ---------------------------------------------------------------------------

  async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    this.cleanExpiredLocks();
    const existing = this.locks.get(threadId);
    if (existing && existing.expiresAt > Date.now()) return null;

    const lock: Lock = {
      threadId,
      token: crypto.randomUUID(),
      expiresAt: Date.now() + ttlMs,
    };
    this.locks.set(threadId, lock);
    return lock;
  }

  async releaseLock(lock: Lock): Promise<void> {
    const existing = this.locks.get(lock.threadId);
    if (existing && existing.token === lock.token) {
      this.locks.delete(lock.threadId);
    }
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    const existing = this.locks.get(lock.threadId);
    if (!existing || existing.token !== lock.token) return false;
    if (existing.expiresAt < Date.now()) {
      this.locks.delete(lock.threadId);
      return false;
    }
    existing.expiresAt = Date.now() + ttlMs;
    return true;
  }

  async forceReleaseLock(threadId: string): Promise<void> {
    this.locks.delete(threadId);
  }

  // ---------------------------------------------------------------------------
  // Queue — in-memory (for concurrency strategies)
  // ---------------------------------------------------------------------------

  async enqueue(threadId: string, entry: QueueEntry, maxSize: number): Promise<number> {
    let queue = this.queues.get(threadId);
    if (!queue) {
      queue = [];
      this.queues.set(threadId, queue);
    }
    queue.push(entry);
    if (queue.length > maxSize) {
      queue.splice(0, queue.length - maxSize);
    }
    return queue.length;
  }

  async dequeue(threadId: string): Promise<QueueEntry | null> {
    const queue = this.queues.get(threadId);
    if (!queue || queue.length === 0) return null;
    return queue.shift()!;
  }

  async queueDepth(threadId: string): Promise<number> {
    return this.queues.get(threadId)?.length ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private cleanExpiredLocks(): void {
    const now = Date.now();
    for (const [id, lock] of this.locks) {
      if (lock.expiresAt <= now) this.locks.delete(id);
    }
  }

  /**
   * Find a Mastra thread by its external (SDK) thread ID.
   * External thread IDs are stored in `channel_externalThreadId` metadata.
   */
  private async findThreadByExternalId(externalThreadId: string) {
    const { threads } = await this.memoryStore.listThreads({
      filter: { metadata: { channel_externalThreadId: externalThreadId } },
      perPage: 1,
    });
    return threads[0] ?? null;
  }
}
