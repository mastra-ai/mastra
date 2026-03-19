import type { Lock, StateAdapter } from 'chat';

/**
 * In-memory StateAdapter implementation for the Chat SDK bridge.
 *
 * The Chat SDK adapters use StateAdapter for:
 * - Thread locking (concurrency control)
 * - Caching (user/channel lookups with TTL)
 * - Subscriptions (thread subscription tracking)
 *
 * This is a minimal in-memory implementation sufficient for single-instance
 * deployments. For production multi-instance deployments, users should provide
 * a proper StateAdapter (e.g. `@chat-adapter/state-redis`).
 */
export class InMemoryStateShim implements StateAdapter {
  private cache = new Map<string, { value: unknown; expiresAt?: number }>();
  private lists = new Map<string, { values: unknown[]; expiresAt?: number }>();
  private locks = new Map<string, { token: string; expiresAt: number }>();
  private subscriptions = new Set<string>();

  async connect(): Promise<void> {
    // No-op for in-memory
  }

  async disconnect(): Promise<void> {
    this.cache.clear();
    this.lists.clear();
    this.locks.clear();
    this.subscriptions.clear();
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  async setIfNotExists(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
    const existing = await this.get(key);
    if (existing !== null) return false;
    await this.set(key, value, ttlMs);
    return true;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async getList<T = unknown>(key: string): Promise<T[]> {
    const entry = this.lists.get(key);
    if (!entry) return [];
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.lists.delete(key);
      return [];
    }
    return entry.values as T[];
  }

  async appendToList(
    key: string,
    value: unknown,
    options?: { maxLength?: number; ttlMs?: number },
  ): Promise<void> {
    const entry = this.lists.get(key) ?? { values: [], expiresAt: undefined };
    entry.values.push(value);
    if (options?.maxLength && entry.values.length > options.maxLength) {
      entry.values = entry.values.slice(-options.maxLength);
    }
    if (options?.ttlMs) {
      entry.expiresAt = Date.now() + options.ttlMs;
    }
    this.lists.set(key, entry);
  }

  async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    const existing = this.locks.get(threadId);
    if (existing && Date.now() < existing.expiresAt) {
      return null;
    }
    const lock: Lock = {
      threadId,
      token: crypto.randomUUID(),
      expiresAt: Date.now() + ttlMs,
    };
    this.locks.set(threadId, lock);
    return lock;
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    const existing = this.locks.get(lock.threadId);
    if (!existing || existing.token !== lock.token) return false;
    existing.expiresAt = Date.now() + ttlMs;
    return true;
  }

  async releaseLock(lock: Lock): Promise<void> {
    const existing = this.locks.get(lock.threadId);
    if (existing?.token === lock.token) {
      this.locks.delete(lock.threadId);
    }
  }

  async forceReleaseLock(threadId: string): Promise<void> {
    this.locks.delete(threadId);
  }

  async subscribe(threadId: string): Promise<void> {
    this.subscriptions.add(threadId);
  }

  async unsubscribe(threadId: string): Promise<void> {
    this.subscriptions.delete(threadId);
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    return this.subscriptions.has(threadId);
  }
}
