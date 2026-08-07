import { MastraServerCache } from '@mastra/core/cache';

export interface RedisClient {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ...args: unknown[]): Promise<unknown>;
  llen(key: string): Promise<number>;
  rpush(key: string, ...values: unknown[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
  del(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number | boolean>;
  scan(cursor: string | number, ...args: unknown[]): Promise<[string | number, string[]]>;
  incr(key: string): Promise<number>;
}

export interface RedisServerCacheOptions {
  keyPrefix?: string;
  ttlSeconds?: number;
  setWithExpiry?: (client: RedisClient, key: string, value: unknown, seconds: number) => Promise<unknown>;
  scanKeys?: (
    client: RedisClient,
    cursor: string | number,
    pattern: string,
    count: number,
  ) => Promise<[string | number, string[]]>;
  getListLength?: (client: RedisClient, key: string) => Promise<number>;
  pushToList?: (client: RedisClient, key: string, value: unknown) => Promise<number>;
  getListRange?: (client: RedisClient, key: string, start: number, stop: number) => Promise<unknown[]>;
}

const defaultSetWithExpiry = (client: RedisClient, key: string, value: unknown, seconds: number): Promise<unknown> => {
  return client.set(key, value, 'EX', seconds);
};

const defaultScanKeys = (
  client: RedisClient,
  cursor: string | number,
  pattern: string,
  count: number,
): Promise<[string | number, string[]]> => {
  return client.scan(cursor, 'MATCH', pattern, 'COUNT', count);
};

const defaultGetListLength = (client: RedisClient, key: string): Promise<number> => {
  return client.llen(key);
};

const defaultPushToList = (client: RedisClient, key: string, value: unknown): Promise<number> => {
  return client.rpush(key, value);
};

const defaultGetListRange = (client: RedisClient, key: string, start: number, stop: number): Promise<unknown[]> => {
  return client.lrange(key, start, stop);
};

export class RedisServerCache extends MastraServerCache {
  private client: RedisClient;
  private keyPrefix: string;
  private ttlSeconds: number;
  private setWithExpiry: (client: RedisClient, key: string, value: unknown, seconds: number) => Promise<unknown>;
  private scanKeys: (
    client: RedisClient,
    cursor: string | number,
    pattern: string,
    count: number,
  ) => Promise<[string | number, string[]]>;
  private getListLength: (client: RedisClient, key: string) => Promise<number>;
  private pushToList: (client: RedisClient, key: string, value: unknown) => Promise<number>;
  private getListRange: (client: RedisClient, key: string, start: number, stop: number) => Promise<unknown[]>;

  constructor(config: { client: RedisClient }, options: RedisServerCacheOptions = {}) {
    super({ name: 'RedisServerCache' });

    this.client = config.client;
    this.keyPrefix = options.keyPrefix ?? 'mastra:cache:';
    this.ttlSeconds = options.ttlSeconds ?? 300;
    this.setWithExpiry = options.setWithExpiry ?? defaultSetWithExpiry;
    this.scanKeys = options.scanKeys ?? defaultScanKeys;
    this.getListLength = options.getListLength ?? defaultGetListLength;
    this.pushToList = options.pushToList ?? defaultPushToList;
    this.getListRange = options.getListRange ?? defaultGetListRange;
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private serialize(value: unknown): string {
    return JSON.stringify(value);
  }

  private deserialize(value: unknown): unknown {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  async get(key: string): Promise<unknown> {
    const fullKey = this.getKey(key);
    const value = await this.client.get(fullKey);
    if (value === null) {
      return null;
    }
    return this.deserialize(value);
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const fullKey = this.getKey(key);
    const serialized = this.serialize(value);
    const overrideSeconds = ttlMs !== undefined ? Math.max(1, Math.ceil(ttlMs / 1000)) : undefined;
    const effectiveSeconds = overrideSeconds ?? this.ttlSeconds;
    if (effectiveSeconds > 0) {
      await this.setWithExpiry(this.client, fullKey, serialized, effectiveSeconds);
    } else {
      await this.client.set(fullKey, serialized);
    }
  }

  async listLength(key: string): Promise<number> {
    const fullKey = this.getKey(key);
    return this.getListLength(this.client, fullKey);
  }

  async listPush(key: string, value: unknown): Promise<void> {
    const fullKey = this.getKey(key);
    const serialized = this.serialize(value);
    await this.pushToList(this.client, fullKey, serialized);

    if (this.ttlSeconds > 0) {
      await this.client.expire(fullKey, this.ttlSeconds);
    }
  }

  async listFromTo(key: string, from: number, to: number = -1): Promise<unknown[]> {
    const fullKey = this.getKey(key);
    const values = await this.getListRange(this.client, fullKey, from, to);
    return values.map(v => this.deserialize(v));
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    await this.client.del(fullKey);
  }

  async clear(): Promise<void> {
    const pattern = `${this.keyPrefix}*`;
    let cursor: string | number = '0';

    do {
      const [nextCursor, keys] = await this.scanKeys(this.client, cursor, pattern, 100);

      if (keys.length > 0) {
        await this.client.del(...keys);
      }

      cursor = nextCursor;
    } while (cursor !== '0' && cursor !== 0);
  }

  async increment(key: string): Promise<number> {
    const fullKey = this.getKey(key);
    return this.client.incr(fullKey);
  }
}

export const upstashPreset: Pick<RedisServerCacheOptions, 'setWithExpiry' | 'scanKeys'> = {
  setWithExpiry: (client, key, value, seconds) => client.set(key, value, { ex: seconds } as any),
  scanKeys: (client, cursor, pattern, count) =>
    client.scan(cursor, { match: pattern, count } as any) as Promise<[string | number, string[]]>,
};

// node-redis v4+ exposes Redis multi-word commands as camelCase only
// (lLen / rPush / lRange), not as lowercase aliases. The defaults in this
// module use ioredis-style lowercase, so node-redis users need adapters that
// forward to the camelCase methods. Single-word commands (set, scan, del,
// expire, incr, get) work in lowercase under node-redis and don't need
// adapters; the existing setWithExpiry / scanKeys adapters only exist to
// reshape arguments, not to alias method names.
export const nodeRedisPreset: Pick<
  RedisServerCacheOptions,
  'setWithExpiry' | 'scanKeys' | 'getListLength' | 'pushToList' | 'getListRange'
> = {
  setWithExpiry: (client, key, value, seconds) => client.set(key, value, { EX: seconds } as any),
  scanKeys: (client, cursor, pattern, count) =>
    client.scan(cursor, { MATCH: pattern, COUNT: count } as any) as Promise<[string | number, string[]]>,
  getListLength: (client, key) => (client as any).lLen(key),
  pushToList: (client, key, value) => (client as any).rPush(key, value),
  getListRange: (client, key, start, stop) => (client as any).lRange(key, start, stop),
};
