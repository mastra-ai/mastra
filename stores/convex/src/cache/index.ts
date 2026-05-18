import { MastraServerCache } from '@mastra/core/cache';

import { ConvexCacheClient } from './client';
import type { ConvexCacheClientConfig } from './client';

export type ConvexServerCacheConfig = {
  /**
   * Prefix applied to all cache keys. `clear()` removes rows whose stored
   * prefix exactly matches this value.
   */
  keyPrefix?: string;
  /**
   * Default cache TTL in milliseconds. Set to 0 to disable expiry.
   */
  ttlMs?: number;
} & ({ client: ConvexCacheClient } | ConvexCacheClientConfig);

const DEFAULT_KEY_PREFIX = 'mastra:cache:';
const DEFAULT_TTL_MS = 300_000;
const MAX_CACHE_OPERATION_BATCHES = 1000;

const isClientConfig = (
  config: ConvexServerCacheConfig,
): config is ConvexServerCacheConfig & { client: ConvexCacheClient } => 'client' in config;

export class ConvexServerCache extends MastraServerCache {
  private readonly client: ConvexCacheClient;
  private readonly keyPrefix: string;
  private readonly ttlMs: number;

  constructor(config: ConvexServerCacheConfig) {
    super({ name: 'ConvexServerCache' });

    this.client = isClientConfig(config) ? config.client : new ConvexCacheClient(config);
    this.keyPrefix = config.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.ttlMs = config.ttlMs ?? DEFAULT_TTL_MS;
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private getExpiresAt(ttlMs?: number): number | null {
    const effectiveTtlMs = ttlMs ?? this.ttlMs;
    return effectiveTtlMs > 0 ? Date.now() + effectiveTtlMs : null;
  }

  private async callUntilSettled<T>(request: () => Parameters<ConvexCacheClient['callCacheRaw']>[0]): Promise<T> {
    for (let batch = 0; batch < MAX_CACHE_OPERATION_BATCHES; batch += 1) {
      const response = await this.client.callCacheRaw({
        ...request(),
      });
      if (!response.hasMore) return response.result as T;
    }

    throw new Error(`ConvexServerCache operation exceeded ${MAX_CACHE_OPERATION_BATCHES} batches.`);
  }

  async get(key: string): Promise<unknown> {
    return this.callUntilSettled(() => ({
      op: 'get',
      key: this.getKey(key),
    }));
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    await this.callUntilSettled(() => ({
      op: 'set',
      key: this.getKey(key),
      keyPrefix: this.keyPrefix,
      value,
      expiresAt: this.getExpiresAt(ttlMs),
    }));
  }

  async listLength(key: string): Promise<number> {
    return this.callUntilSettled(() => ({
      op: 'listLength',
      key: this.getKey(key),
    }));
  }

  async listPush(key: string, value: unknown): Promise<void> {
    await this.callUntilSettled(() => ({
      op: 'listPush',
      key: this.getKey(key),
      keyPrefix: this.keyPrefix,
      value,
      expiresAt: this.getExpiresAt(),
    }));
  }

  async listFromTo(key: string, from: number, to: number = -1): Promise<unknown[]> {
    return this.callUntilSettled(() => ({
      op: 'listFromTo',
      key: this.getKey(key),
      from,
      to,
    }));
  }

  async delete(key: string): Promise<void> {
    await this.callUntilSettled(() => ({
      op: 'delete',
      key: this.getKey(key),
    }));
  }

  async clear(): Promise<void> {
    await this.callUntilSettled(() => ({
      op: 'clear',
      keyPrefix: this.keyPrefix,
    }));
  }

  async increment(key: string): Promise<number> {
    return this.callUntilSettled(() => ({
      op: 'increment',
      key: this.getKey(key),
      keyPrefix: this.keyPrefix,
      expiresAt: this.getExpiresAt(),
    }));
  }
}

export { ConvexCacheClient, type ConvexCacheClientConfig };
