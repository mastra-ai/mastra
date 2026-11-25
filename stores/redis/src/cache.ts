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
  /**
   * Server-side Lua scripting. Optional: clients without it fall back to the
   * two-round-trip `increment` + `listPush` path for `listPushIndexed`.
   */
  eval?(...args: unknown[]): Promise<unknown>;
}

export interface RedisServerCacheOptions {
  keyPrefix?: string;
  /**
   * Lifetime of cached values in seconds, refreshed on every write. Defaults to
   * 300. `0` means no expiry.
   *
   * A cache list and its index counter always share this TTL: a counter that
   * expired before its list would be reseeded and reuse nothing, but a list
   * without its counter loses the hole accounting replay reads rely on.
   */
  ttlSeconds?: number;
  /**
   * Run a Lua script with the given KEYS and ARGV. Defaults to the ioredis
   * calling convention (`eval(script, numKeys, ...keys, ...args)`); use
   * `nodeRedisPreset` / `upstashPreset` for those clients.
   */
  evalScript?: (client: RedisClient, script: string, keys: string[], args: string[]) => Promise<unknown>;
  setWithExpiry?: (client: RedisClient, key: string, value: unknown, seconds: number) => Promise<unknown>;
  /**
   * `SET key value NX` (plus `EX seconds` when positive): write the key only
   * if it does not exist. Used by the non-scripting `listPushIndexed` fallback
   * to seed an absent index counter exactly once under concurrency; see
   * `composedPushIndexed`. Defaults to the ioredis argument style.
   */
  setIfAbsentWithExpiry?: (client: RedisClient, key: string, value: unknown, seconds: number) => Promise<unknown>;
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

const defaultSetIfAbsentWithExpiry = (
  client: RedisClient,
  key: string,
  value: unknown,
  seconds: number,
): Promise<unknown> => {
  return seconds > 0 ? client.set(key, value, 'NX', 'EX', seconds) : client.set(key, value, 'NX');
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

const defaultEvalScript = (client: RedisClient, script: string, keys: string[], args: string[]): Promise<unknown> => {
  return client.eval!(script, keys.length, ...keys, ...args);
};

/**
 * Atomic "seed + allocate index + append + refresh TTL" used by
 * `listPushIndexed`.
 *
 * KEYS[1] = list key, KEYS[2] = counter key
 * ARGV[1] = JSON-serialized object WITHOUT an `index` property
 * ARGV[2] = TTL in seconds (0 = no expiry), applied to BOTH keys
 *
 * An absent counter is seeded from the server clock (epoch MICROseconds)
 * before the INCR, so a log recreated after expiry or eviction does not
 * reissue an index a subscriber already consumed (see
 * `MastraServerCache.listPushIndexed`). Microseconds, not milliseconds: a hot
 * log appends faster than the millisecond clock advances, so a millisecond
 * reseed could land at or below the dead log's last index. The server clock,
 * not the client's, so two replicas recreating the same log cannot seed it
 * backwards relative to each other. Only on a miss: an existing counter keeps
 * counting, so rolling deploys never fork numbering. Epoch microseconds stay
 * well inside Number.MAX_SAFE_INTEGER (2^53 ≈ year 2255).
 *
 * This bounds the risk rather than eliminating it — the seed is only as
 * monotonic as the server clock, so a clock moved backwards can still repeat
 * an index. Readers detect a restarted log and resynchronise instead of
 * relying on that never happening.
 *
 * The index is spliced into the JSON text as the first property rather than
 * decoded/re-encoded with cjson, which would silently alter large integers
 * and sparse arrays. `JSON.stringify` of an object always starts with `{`,
 * so `{...}` → `{"index":N,...}` and `{}` → `{"index":N}`.
 */
export const LIST_PUSH_INDEXED_SCRIPT = `
if redis.call('EXISTS', KEYS[2]) == 0 then
  local t = redis.call('TIME')
  redis.call('SET', KEYS[2], string.format('%.0f', tonumber(t[1]) * 1000000 + tonumber(t[2])))
end
local i = redis.call('INCR', KEYS[2]) - 1
-- Epoch-microsecond indices exceed Lua 5.1's default 14-significant-digit
-- number formatting; %.0f keeps the full integer, where plain concatenation
-- would round it and store a different index than the one allocated.
local istr = string.format('%.0f', i)
local body = ARGV[1]
local doc
if #body <= 2 then
  doc = '{"index":' .. istr .. '}'
else
  doc = '{"index":' .. istr .. ',' .. string.sub(body, 2)
end
redis.call('RPUSH', KEYS[1], doc)
local ttl = tonumber(ARGV[2])
if ttl > 0 then
  redis.call('EXPIRE', KEYS[1], ttl)
  redis.call('EXPIRE', KEYS[2], ttl)
end
return istr
`.trim();

export class RedisServerCache extends MastraServerCache {
  private client: RedisClient;
  private keyPrefix: string;
  private ttlSeconds: number;
  private setWithExpiry: (client: RedisClient, key: string, value: unknown, seconds: number) => Promise<unknown>;
  private setIfAbsentWithExpiry: (
    client: RedisClient,
    key: string,
    value: unknown,
    seconds: number,
  ) => Promise<unknown>;
  private scanKeys: (
    client: RedisClient,
    cursor: string | number,
    pattern: string,
    count: number,
  ) => Promise<[string | number, string[]]>;
  private getListLength: (client: RedisClient, key: string) => Promise<number>;
  private pushToList: (client: RedisClient, key: string, value: unknown) => Promise<number>;
  private getListRange: (client: RedisClient, key: string, start: number, stop: number) => Promise<unknown[]>;
  private evalScript: (client: RedisClient, script: string, keys: string[], args: string[]) => Promise<unknown>;
  /** Set once scripting is known to be unusable (no `eval`, or Cluster CROSSSLOT). */
  private scriptingDisabled: boolean;

  constructor(config: { client: RedisClient }, options: RedisServerCacheOptions = {}) {
    super({ name: 'RedisServerCache' });

    this.client = config.client;
    this.keyPrefix = options.keyPrefix ?? 'mastra:cache:';
    this.ttlSeconds = options.ttlSeconds ?? 300;
    this.setWithExpiry = options.setWithExpiry ?? defaultSetWithExpiry;
    this.setIfAbsentWithExpiry = options.setIfAbsentWithExpiry ?? defaultSetIfAbsentWithExpiry;
    this.scanKeys = options.scanKeys ?? defaultScanKeys;
    this.getListLength = options.getListLength ?? defaultGetListLength;
    this.pushToList = options.pushToList ?? defaultPushToList;
    this.getListRange = options.getListRange ?? defaultGetListRange;
    this.evalScript = options.evalScript ?? defaultEvalScript;
    this.scriptingDisabled = typeof this.client.eval !== 'function';
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
    const value = await this.client.incr(fullKey);

    if (this.ttlSeconds > 0) {
      await this.client.expire(fullKey, this.ttlSeconds);
    }

    return value;
  }

  /**
   * Single round-trip index allocation + list append + TTL refresh via Lua.
   * This is the durable stream per-chunk hot path (issue #22477).
   */
  async listPushIndexed(
    listKey: string,
    counterKey: string,
    value: Record<string, unknown>,
    ttlMs?: number,
  ): Promise<number> {
    // The longer of the cache default and the requested minimum wins. An
    // explicit request applies even when the default expiry is disabled: the
    // caller is stating a retention bound for this log.
    const requestedSeconds = ttlMs !== undefined ? Math.max(1, Math.ceil(ttlMs / 1000)) : 0;
    const ttlSeconds = Math.max(this.ttlSeconds > 0 ? this.ttlSeconds : 0, requestedSeconds);
    if (this.scriptingDisabled) {
      return this.composedPushIndexed(listKey, counterKey, value, ttlSeconds);
    }

    const { index: _ignored, ...body } = value;
    try {
      const result = await this.evalScript(
        this.client,
        LIST_PUSH_INDEXED_SCRIPT,
        [this.getKey(listKey), this.getKey(counterKey)],
        [this.serialize(body), String(ttlSeconds)],
      );
      return Number(result);
    } catch (error) {
      // Untagged list and counter keys can still hit CROSSSLOT. Keep the
      // fallback for callers that have not opted into tagged cache keys.
      if (error instanceof Error && error.message.includes('CROSSSLOT')) {
        this.scriptingDisabled = true;
        this.logger.warn(
          '[RedisServerCache] listPushIndexed script rejected with CROSSSLOT; falling back to increment + listPush',
        );
        return this.composedPushIndexed(listKey, counterKey, value, ttlSeconds);
      }
      throw error;
    }
  }

  /**
   * Seed-if-absent, `INCR`, then `RPUSH`, each followed by the same `EXPIRE`
   * the script applies. Not atomic as a whole: concurrent writers can
   * interleave, so a list position may not match its index, and an append that
   * fails after its allocation leaves a hole (Redis Cluster atomicity is
   * tracked separately).
   *
   * The seed is written with `SET NX` *before* the increment rather than after
   * it. Incrementing first and then overwriting an absent counter with the seed
   * would discard an index a concurrent writer had already allocated and
   * published, and a subscriber that had advanced past the seed would drop that
   * writer's frame as stale. With `NX` exactly one writer establishes the seed
   * and everyone else counts on from it, whoever wins. The TTL rides on the
   * same `SET` so a crash between seeding and incrementing cannot leave an
   * unexpiring counter.
   */
  private async composedPushIndexed(
    listKey: string,
    counterKey: string,
    value: Record<string, unknown>,
    ttlSeconds: number,
  ): Promise<number> {
    const fullCounterKey = this.getKey(counterKey);
    // Epoch microseconds, like the script, so a log recreated after its
    // predecessor expired or was evicted does not reissue indices a subscriber
    // already consumed. The client clock stands in for the server's `TIME`.
    const seed = Date.now() * 1000;
    await this.setIfAbsentWithExpiry(this.client, fullCounterKey, String(seed), ttlSeconds);
    const index = (await this.client.incr(fullCounterKey)) - 1;
    if (ttlSeconds > 0) await this.client.expire(fullCounterKey, ttlSeconds);

    const fullListKey = this.getKey(listKey);
    await this.pushToList(this.client, fullListKey, this.serialize({ ...value, index }));
    if (ttlSeconds > 0) await this.client.expire(fullListKey, ttlSeconds);
    return index;
  }
}

export const upstashPreset: Pick<
  RedisServerCacheOptions,
  'setWithExpiry' | 'setIfAbsentWithExpiry' | 'scanKeys' | 'evalScript'
> = {
  setWithExpiry: (client, key, value, seconds) => client.set(key, value, { ex: seconds } as any),
  setIfAbsentWithExpiry: (client, key, value, seconds) =>
    client.set(key, value, (seconds > 0 ? { nx: true, ex: seconds } : { nx: true }) as any),
  scanKeys: (client, cursor, pattern, count) =>
    client.scan(cursor, { match: pattern, count } as any) as Promise<[string | number, string[]]>,
  evalScript: (client, script, keys, args) => client.eval!(script, keys, args),
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
  | 'setWithExpiry'
  | 'setIfAbsentWithExpiry'
  | 'scanKeys'
  | 'getListLength'
  | 'pushToList'
  | 'getListRange'
  | 'evalScript'
> = {
  setWithExpiry: (client, key, value, seconds) => client.set(key, value, { EX: seconds } as any),
  setIfAbsentWithExpiry: (client, key, value, seconds) =>
    client.set(key, value, (seconds > 0 ? { NX: true, EX: seconds } : { NX: true }) as any),
  scanKeys: (client, cursor, pattern, count) =>
    client.scan(cursor, { MATCH: pattern, COUNT: count } as any) as Promise<[string | number, string[]]>,
  getListLength: (client, key) => (client as any).lLen(key),
  pushToList: (client, key, value) => (client as any).rPush(key, value),
  getListRange: (client, key, start, stop) => (client as any).lRange(key, start, stop),
  evalScript: (client, script, keys, args) => client.eval!(script, { keys, arguments: args }),
};
