import type { Lock, QueueEntry, StateAdapter } from 'chat';

import type { ChannelsStorage } from '../storage/domains/channels/base';
import type { MemoryStorage } from '../storage/domains/memory/base';

interface CachedValue<T = unknown> {
  value: T;
  expiresAt: number | null; // null = no expiry
}

/** Owner id used when no `getOwnerId` hook is supplied; the `ownerId` column is NOT NULL. */
const UNSCOPED_STATE_OWNER_ID = '__unscoped__';

/**
 * Dedupe keys are never read again once they expire, so nothing deletes them on read.
 * Without this sweep the table grows by one dead row per inbound message, forever.
 */
const STATE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Chat SDK StateAdapter backed by Mastra storage.
 *
 * Thread subscriptions are persisted to the Mastra `MemoryStorage` domain
 * using thread metadata (`channel_subscribed`), so they survive restarts.
 *
 * Cache and dedup keys are persisted to the `ChannelsStorage` domain when one is
 * supplied, so that instances behind a load balancer see each other's writes — a
 * per-process cache means every instance replies to the same inbound message.
 *
 * Locks, lists, and queues remain in-memory.
 */
export class MastraStateAdapter implements StateAdapter {
  private memoryStore: MemoryStorage;
  private getOwnerId?: () => string | null;
  private channelsStore?: ChannelsStorage;
  private connected = false;
  private connectPromise: Promise<void> | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  // In-memory ephemeral state (locks, lists, queues, and the cache when no channels store)
  private readonly cache = new Map<string, CachedValue>();
  private readonly locks = new Map<string, Lock>();
  private readonly lists = new Map<string, { values: unknown[]; expiresAt: number | null }>();
  private readonly queues = new Map<string, QueueEntry[]>();

  constructor(memoryStore: MemoryStorage, getOwnerId?: () => string | null, channelsStore?: ChannelsStorage) {
    this.memoryStore = memoryStore;
    this.getOwnerId = getOwnerId;
    // A store package older than this core implements the channels domain without the
    // state methods, so the domain being present is not enough to call them. Dropping it
    // here keeps every call site below on the in-memory path instead of crashing.
    this.channelsStore = channelsStore?.supportsChannelState ? channelsStore : undefined;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (!this.connectPromise) {
      this.connectPromise = Promise.resolve().then(() => {
        this.connected = true;
        this.startStateSweep();
      });
    }
    await this.connectPromise;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.connectPromise = null;
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    // Only the local Map is cleared — the channels store is shared with other instances,
    // and wiping it here would drop dedupe keys they are still relying on.
    this.cache.clear();
    this.locks.clear();
    this.lists.clear();
    this.queues.clear();
  }

  private startStateSweep(): void {
    const store = this.channelsStore;
    if (!store || this.sweepTimer) return;
    this.sweepTimer = setInterval(() => {
      // Best-effort: a failed sweep must not reject or stop later sweeps.
      void store.deleteExpiredState(Date.now()).catch(() => {});
    }, STATE_SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  // ---------------------------------------------------------------------------
  // Subscriptions — persisted via Mastra thread metadata
  // ---------------------------------------------------------------------------

  async subscribe(threadId: string): Promise<void> {
    // Find the Mastra thread mapped to this external thread ID and mark it
    const thread = await this.findThreadByExternalId(threadId);
    if (!thread) return; // Thread not yet mapped — subscribe will be a no-op
    await this.memoryStore.patchThread({
      id: thread.id,
      metadata: {
        ...thread.metadata,
        channel_subscribed: 'true',
        ...this.ownerStamp(thread.metadata as Record<string, unknown> | undefined),
      },
    });
  }

  async unsubscribe(threadId: string): Promise<void> {
    const thread = await this.findThreadByExternalId(threadId);
    if (!thread) return;
    await this.memoryStore.patchThread({
      id: thread.id,
      metadata: {
        ...((thread.metadata ?? {}) as Record<string, unknown>),
        channel_subscribed: 'false',
        ...this.ownerStamp(thread.metadata as Record<string, unknown> | undefined),
      },
    });
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    const thread = await this.findThreadByExternalId(threadId);
    if (!thread) return false;
    return (thread.metadata as Record<string, unknown>)?.channel_subscribed === 'true';
  }

  // ---------------------------------------------------------------------------
  // Cache — shared via the channels store when present, in-memory otherwise
  // ---------------------------------------------------------------------------

  private stateOwnerId(): string {
    return this.getOwnerId?.() ?? UNSCOPED_STATE_OWNER_ID;
  }

  private deadlineFrom(ttlMs?: number): number | null {
    return ttlMs ? Date.now() + ttlMs : null;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (this.channelsStore) {
      const entry = await this.channelsStore.getState(this.stateOwnerId(), key);
      return entry ? (entry.value as T) : null;
    }
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (cached.expiresAt !== null && cached.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return cached.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (this.channelsStore) {
      await this.channelsStore.setState(this.stateOwnerId(), key, value, this.deadlineFrom(ttlMs));
      return;
    }
    this.cache.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
  }

  async setIfNotExists(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
    if (this.channelsStore) {
      return this.channelsStore.setStateIfNotExists(this.stateOwnerId(), key, value, this.deadlineFrom(ttlMs));
    }
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
    if (this.channelsStore) {
      await this.channelsStore.deleteState(this.stateOwnerId(), key);
      return;
    }
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
   * Claim stamp for write paths: when an owner id is known and the thread has
   * not been claimed yet, include `channel_ownerId` so the write adopts the
   * legacy thread. Read paths (`isSubscribed`) never claim.
   */
  private ownerStamp(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
    const ownerId = this.getOwnerId?.() ?? null;
    if (ownerId === null) return {};
    if (metadata && 'channel_ownerId' in metadata) return {};
    return { channel_ownerId: ownerId };
  }

  /**
   * Find a Mastra thread by its external (SDK) thread ID.
   * External thread IDs are stored in `channel_externalThreadId` metadata.
   *
   * When an owner id is available, the lookup is scoped per agent via the
   * `channel_ownerId` metadata key, with a legacy fallback that matches only
   * threads no agent has claimed yet. Threads claimed by a different agent
   * are never returned. Without an owner id the old unscoped behavior is
   * preserved.
   */
  private async findThreadByExternalId(externalThreadId: string) {
    const ownerId = this.getOwnerId?.() ?? null;

    if (ownerId === null) {
      const { threads } = await this.memoryStore.listThreads({
        filter: { metadata: { channel_externalThreadId: externalThreadId } },
        perPage: 1,
      });
      return threads[0] ?? null;
    }

    // Primary lookup: the thread scoped to this agent.
    const { threads: scoped } = await this.memoryStore.listThreads({
      filter: { metadata: { channel_externalThreadId: externalThreadId, channel_ownerId: ownerId } },
      perPage: 1,
    });
    if (scoped[0]) return scoped[0];

    // Legacy fallback: metadata filters match subsets, so this also returns
    // threads claimed by other agents - only unclaimed rows are usable.
    const { threads: candidates } = await this.memoryStore.listThreads({
      filter: { metadata: { channel_externalThreadId: externalThreadId } },
      perPage: 10,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    return (
      candidates.find(candidate => {
        const metadata = (candidate.metadata ?? {}) as Record<string, unknown>;
        return !('channel_ownerId' in metadata);
      }) ?? null
    );
  }
}
