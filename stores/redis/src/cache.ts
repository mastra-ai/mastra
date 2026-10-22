import { MastraServerCache } from '@mastra/core/cache';

export interface RedisClient {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ...args: unknown[]): Promise<unknown>;
  llen(key: string): Promise<number>;
  rpush(key: string, ...values: unknown[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
  del(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number | boolean>;
  /**
   * Remaining lifetime of `key` in seconds: `-1` when it has no expiry, `-2`
   * when it does not exist. Required because {@link RedisServerCache.expire}
   * has to compare deadlines: without it a retention refresh could shorten a
   * longer configured TTL, expiring a parked run's replay log early.
   */
  ttl(key: string): Promise<number>;
  scan(cursor: string | number, ...args: unknown[]): Promise<[string | number, string[]]>;
  incr(key: string): Promise<number>;
  /**
   * Server-side Lua scripting. Optional: without it the cache cannot append
   * atomically, so `supportsAtomicAppend` is `false` and streams backed by this
   * cache publish live-only (no index, no replay).
   */
  eval?(...args: unknown[]): Promise<unknown>;
}

export interface RedisServerCacheOptions {
  keyPrefix?: string;
  /**
   * Lifetime of cached values in seconds, refreshed on every write. Defaults to
   * 300. `0` means no expiry.
   *
   * A cache list and its index counter always share this TTL: if the counter
   * outlived the list, index allocation would restart at 0 while subscribers
   * still expect the previous numbering, and every new frame would be dropped
   * as a duplicate.
   */
  ttlSeconds?: number;
  /**
   * Run a Lua script with the given KEYS and ARGV. Defaults to the ioredis
   * calling convention (`eval(script, numKeys, ...keys, ...args)`); use
   * `nodeRedisPreset` / `upstashPreset` for those clients.
   */
  evalScript?: (client: RedisClient, script: string, keys: string[], args: string[]) => Promise<unknown>;
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

const defaultEvalScript = (client: RedisClient, script: string, keys: string[], args: string[]): Promise<unknown> => {
  return client.eval!(script, keys.length, ...keys, ...args);
};

/**
 * Atomic "allocate index + append + refresh TTL" used by `listPushIndexed`.
 *
 * KEYS[1] = list key, KEYS[2] = counter key
 * ARGV[1] = JSON-serialized object WITHOUT an `index` property
 * ARGV[2] = TTL in seconds (0 = no expiry), applied to BOTH keys
 *
 * The list key and counter key must hash to the same Cluster slot. Use the
 * brace form for the shared part of the key (`pubsub:{topic}` and
 * `pubsub:{topic}:counter`) so the whole script runs in one slot.
 *
 * The index is spliced into the JSON text as the first property rather than
 * decoded/re-encoded with cjson, which would silently alter large integers
 * and sparse arrays. `JSON.stringify` of an object always starts with `{`,
 * so `{...}` → `{"index":N,...}` and `{}` → `{"index":N}`.
 */
export const LIST_PUSH_INDEXED_SCRIPT = `
local listTtl = redis.call('TTL', KEYS[1])
local counterTtl = redis.call('TTL', KEYS[2])
local i = redis.call('INCR', KEYS[2]) - 1
local body = ARGV[1]
local doc
if #body <= 2 then
  doc = '{"index":' .. i .. '}'
else
  doc = '{"index":' .. i .. ',' .. string.sub(body, 2)
end
redis.call('RPUSH', KEYS[1], doc)
local ttl = tonumber(ARGV[2])
if ttl > 0 then
  -- Extend-only. A run that parked on an approval has a log and counter with a
  -- longer deadline than the cache default; stamping the default back on the
  -- next append would discard that window. -2 means this call created the key,
  -- -1 means it is persistent on purpose; both cases leave the deadline alone
  -- except for the key this append just created.
  local function refresh(key, current)
    if current == -2 or (current ~= -1 and current < ttl) then
      redis.call('EXPIRE', key, ttl)
    end
  end
  refresh(KEYS[1], listTtl)
  refresh(KEYS[2], counterTtl)
end
return i
`.trim();

/**
 * Extend-only expiry for a single key: raise its deadline to ARGV[1] seconds
 * only when it currently has a shorter one.
 *
 * KEYS[1] = key, ARGV[1] = deadline in seconds
 *
 * Runs as one script so a check-then-set cannot race an append that is stamping
 * its own TTL: the cache never shortens a retention window it just extended.
 */
export const EXTEND_EXPIRY_SCRIPT = `
local current = redis.call('TTL', KEYS[1])
if current == -1 or current == -2 then return 0 end
local want = tonumber(ARGV[1])
if current >= want then return 0 end
redis.call('EXPIRE', KEYS[1], want)
return 1
`.trim();

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
  private evalScript: (client: RedisClient, script: string, keys: string[], args: string[]) => Promise<unknown>;
  /** Set once scripting is known to be unusable (the client has no `eval`). */
  private scriptingDisabled: boolean;

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
    this.evalScript = options.evalScript ?? defaultEvalScript;
    this.scriptingDisabled = typeof this.client.eval !== 'function';
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * True only while the Lua script is usable. A client without `eval` cannot
   * allocate and append atomically, so numbered streams are unavailable and
   * `CachingPubSub` publishes live-only.
   */
  get supportsAtomicAppend(): boolean {
    return !this.scriptingDisabled;
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

  async expire(key: string, ttlMs: number): Promise<void> {
    // A cache configured without expiry keeps that policy: granting a deadline
    // here would silently shorten keys (including a persistent run log) that
    // every writer treats as immortal.
    if (ttlMs <= 0 || this.ttlSeconds <= 0) return;
    const fullKey = this.getKey(key);
    const seconds = Math.max(1, Math.ceil(ttlMs / 1000));
    if (!this.scriptingDisabled) {
      // One script so the comparison and the write cannot interleave with an
      // append stamping its own deadline on the same key. The script reads TTL
      // itself, leaves persistent (-1) and missing (-2) keys alone and only
      // ever lengthens.
      await this.evalScript(this.client, EXTEND_EXPIRY_SCRIPT, [fullKey], [String(seconds)]);
      return;
    }
    if (typeof this.client.ttl !== 'function') {
      // `ttl` is part of the client contract, but an untyped client can still
      // omit it. Without the current deadline we cannot tell a longer configured
      // TTL from a shorter one, and applying ours anyway would shorten the very
      // log this call exists to protect, so skip instead of guessing.
      return;
    }
    const remainingSeconds = await this.client.ttl(fullKey);
    // `-1` is a key without expiry and `-2` one that is already gone: neither
    // should be given a (possibly shorter) deadline.
    if (remainingSeconds < 0 || remainingSeconds * 1000 >= ttlMs) return;
    await this.client.expire(fullKey, seconds);
  }

  /**
   * Single round-trip index allocation + list append + TTL refresh via Lua.
   * This is the durable stream per-chunk hot path (issue #22477).
   */
  async listPushIndexed(listKey: string, counterKey: string, value: Record<string, unknown>): Promise<number> {
    if (this.scriptingDisabled) {
      // `supportsAtomicAppend` is false here, so a caller reaching this point is
      // bypassing the capability check. Failing loudly beats a non-atomic append
      // that hands two frames the same index.
      throw new Error('[RedisServerCache] listPushIndexed requires scripting support (client.eval).');
    }

    const { index: _ignored, ...body } = value;
    const result = await this.evalScript(
      this.client,
      LIST_PUSH_INDEXED_SCRIPT,
      [this.getKey(listKey), this.getKey(counterKey)],
      [this.serialize(body), String(this.ttlSeconds)],
    );
    return Number(result);
  }
}

export const upstashPreset: Pick<RedisServerCacheOptions, 'setWithExpiry' | 'scanKeys' | 'evalScript'> = {
  setWithExpiry: (client, key, value, seconds) => client.set(key, value, { ex: seconds } as any),
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
  'setWithExpiry' | 'scanKeys' | 'getListLength' | 'pushToList' | 'getListRange' | 'evalScript'
> = {
  setWithExpiry: (client, key, value, seconds) => client.set(key, value, { EX: seconds } as any),
  scanKeys: (client, cursor, pattern, count) =>
    client.scan(cursor, { MATCH: pattern, COUNT: count } as any) as Promise<[string | number, string[]]>,
  getListLength: (client, key) => (client as any).lLen(key),
  pushToList: (client, key, value) => (client as any).rPush(key, value),
  getListRange: (client, key, start, stop) => (client as any).lRange(key, start, stop),
  evalScript: (client, script, keys, args) => client.eval!(script, { keys, arguments: args }),
};
