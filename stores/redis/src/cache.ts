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
   * EVAL, in whichever shape the client speaks it: classic
   * `(script, numKeys, ...keysAndArgs)` (ioredis, node-redis v4) or
   * `(script, { keys, arguments })` (node-redis v5). The cache determines the
   * shape once per client with a side-effect-free probe script and then calls
   * real scripts in that shape only — a script is never retried in the other
   * shape, because some clients (e.g. @redis/client 5.12.1) execute the
   * wrong-shape call as `EVAL <script> 0` instead of rejecting it. If the
   * probe rejects both shapes, the result is cached and the cache silently
   * falls back to sequential commands. Optional: when absent, the same
   * fallback applies. Clients whose EVAL takes a different shape (e.g.
   * Upstash REST) should omit it and use the sequential presets to skip the
   * probe round trips entirely.
   */
  eval?(
    script: string,
    numKeysOrOptions: number | { keys?: string[]; arguments?: string[] },
    ...keysAndArgs: unknown[]
  ): Promise<unknown>;
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
  /**
   * Increment a counter and refresh its TTL in one round trip. Defaults to a
   * Lua script on clients that expose classic EVAL (ioredis, node-redis v4+),
   * falling back to sequential `INCR` + `EXPIRE` otherwise.
   */
  incrementWithExpiry?: (client: RedisClient, key: string, seconds: number) => Promise<number>;
  /**
   * Push a value onto a list and refresh its TTL in one round trip. Defaults
   * to a Lua script on clients that expose classic EVAL (ioredis, node-redis
   * v4+), falling back to sequential `RPUSH` + `EXPIRE` otherwise.
   */
  pushToListWithExpiry?: (client: RedisClient, key: string, value: unknown, seconds: number) => Promise<void>;
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

// "0" seconds means "no expiry refresh": the guard keeps the scripts usable
// for ttlSeconds: 0 configurations without a client-side branch. The tonumber
// guard must stay strictly-positive: Redis 7 deletes a key on a non-positive
// EXPIRE, so a negative configured TTL must not reach the command.
const INCREMENT_WITH_EXPIRY_SCRIPT =
  'local v = redis.call("INCR", KEYS[1]) if tonumber(ARGV[1]) > 0 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end return v';

const PUSH_TO_LIST_WITH_EXPIRY_SCRIPT =
  'redis.call("RPUSH", KEYS[1], ARGV[1]) if tonumber(ARGV[2]) > 0 then redis.call("EXPIRE", KEYS[1], ARGV[2]) end';

/**
 * EVAL calling conventions differ across clients: ioredis and node-redis v4
 * take the classic `(script, numKeys, ...keysAndArgs)` form, node-redis v5
 * takes `(script, { keys, arguments })`. A wrong-shape call is NOT guaranteed
 * to fail: @redis/client 5.12.1 serializes the classic form as
 * `EVAL <script> 0` and executes it, so retrying a mutative script in the
 * other shape could run INCR/RPUSH twice. The winning shape is therefore
 * determined with a probe script that only reads KEYS/ARGV (no redis.call,
 * nothing is written): it returns 'match' only when the client round-tripped
 * both correctly. The weak map keeps clients garbage-collectable.
 */
const evalStyleCache = new WeakMap<RedisClient, EvalStyle>();
// One shared probe per client: concurrent first calls (durable publishes burst
// increment + listPush per chunk) must not each pay the probe round trips.
const evalStyleProbes = new WeakMap<RedisClient, Promise<EvalStyle>>();

// 'malformed' = the shape dropped KEYS/ARGV (e.g. 0-key execution);
// 'mismatch' = the shape delivered them but garbled. Only 'match' wins.
const EVAL_PROBE_SCRIPT =
  "if KEYS[1] == nil or ARGV[1] == nil then return 'malformed' end if KEYS[1] ~= ARGV[1] then return 'mismatch' end return 'match'";
const EVAL_PROBE_KEY = '__mastra_eval_probe__';

type ClientEval = NonNullable<RedisClient['eval']>;
type EvalStyle = 'classic' | 'options' | 'unsupported';

// Sentinel telling the callers to take their sequential command path: the
// client exposes EVAL but speaks neither shape we know.
const EVAL_UNSUPPORTED = Symbol('eval-unsupported');

async function probeEvalStyle(clientEval: ClientEval): Promise<EvalStyle> {
  const attempts: Array<{ style: 'classic' | 'options'; call: () => Promise<unknown> }> = [
    { style: 'classic', call: () => clientEval(EVAL_PROBE_SCRIPT, 1, EVAL_PROBE_KEY, EVAL_PROBE_KEY) },
    {
      style: 'options',
      call: () => clientEval(EVAL_PROBE_SCRIPT, { keys: [EVAL_PROBE_KEY], arguments: [EVAL_PROBE_KEY] }),
    },
  ];
  for (const attempt of attempts) {
    try {
      if ((await attempt.call()) === 'match') {
        return attempt.style;
      }
    } catch {
      // A rejected shape just moves on to the other candidate; if both fail,
      // the loop yields 'unsupported', callEval returns the EVAL_UNSUPPORTED
      // sentinel, and callers fall through to their sequential command path.
    }
  }
  return 'unsupported';
}

async function resolveEvalStyle(client: RedisClient, clientEval: ClientEval): Promise<EvalStyle> {
  let pending = evalStyleProbes.get(client);
  if (!pending) {
    pending = probeEvalStyle(clientEval).then(style => {
      evalStyleCache.set(client, style);
      evalStyleProbes.delete(client);
      return style;
    });
    evalStyleProbes.set(client, pending);
  }
  return pending;
}

async function callEval(
  client: RedisClient,
  script: string,
  keys: string[],
  args: string[],
): Promise<unknown | typeof EVAL_UNSUPPORTED> {
  const clientEval = client.eval?.bind(client);
  if (!clientEval) {
    throw new Error('client does not expose EVAL');
  }
  let style = evalStyleCache.get(client);
  if (!style) {
    style = await resolveEvalStyle(client, clientEval);
  }
  if (style === 'unsupported') {
    return EVAL_UNSUPPORTED;
  }
  // Single shot in the winning shape: the script may be mutative, so a
  // rejection after execution must not trigger a second run in the other
  // shape.
  return style === 'classic'
    ? clientEval(script, keys.length, ...keys, ...args)
    : clientEval(script, { keys, arguments: args });
}

const defaultIncrementWithExpiry = async (client: RedisClient, key: string, seconds: number): Promise<number> => {
  if (typeof client.eval === 'function') {
    const result = await callEval(client, INCREMENT_WITH_EXPIRY_SCRIPT, [key], [String(seconds)]);
    if (result !== EVAL_UNSUPPORTED) {
      return Number(result);
    }
  }
  const value = await client.incr(key);
  if (seconds > 0) {
    await client.expire(key, seconds);
  }
  return value;
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
  private incrementWithExpiry: (client: RedisClient, key: string, seconds: number) => Promise<number>;
  private pushToListWithExpiry: (client: RedisClient, key: string, value: unknown, seconds: number) => Promise<void>;

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
    this.incrementWithExpiry = options.incrementWithExpiry ?? defaultIncrementWithExpiry;
    // Composed here rather than as a module default so the no-EVAL fallback
    // goes through the configured `pushToList` (e.g. node-redis camelCase).
    this.pushToListWithExpiry =
      options.pushToListWithExpiry ??
      (async (client, key, value, seconds) => {
        if (typeof client.eval === 'function') {
          const result = await callEval(
            client,
            PUSH_TO_LIST_WITH_EXPIRY_SCRIPT,
            [key],
            [String(value), String(seconds)],
          );
          if (result !== EVAL_UNSUPPORTED) {
            return;
          }
        }
        await this.pushToList(client, key, value);
        if (seconds > 0) {
          await client.expire(key, seconds);
        }
      });
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private serialize(value: unknown): string {
    const serialized = JSON.stringify(value);
    // JSON.stringify returns undefined for top-level undefined/functions/
    // symbols; pushing that on would store the literal string "undefined"
    // and hand it back from listFromTo as if it were data.
    if (serialized === undefined) {
      throw new TypeError(`RedisServerCache cannot serialize value: ${typeof value}`);
    }
    return serialized;
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
    await this.pushToListWithExpiry(this.client, fullKey, serialized, this.ttlSeconds);
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
    return this.incrementWithExpiry(this.client, fullKey, this.ttlSeconds);
  }
}

export const upstashPreset: Pick<
  RedisServerCacheOptions,
  'setWithExpiry' | 'scanKeys' | 'incrementWithExpiry' | 'pushToListWithExpiry'
> = {
  setWithExpiry: (client, key, value, seconds) => client.set(key, value, { ex: seconds } as any),
  scanKeys: (client, cursor, pattern, count) =>
    client.scan(cursor, { match: pattern, count } as any) as Promise<[string | number, string[]]>,
  // Upstash REST's EVAL does not take the classic (script, numKeys, ...) form,
  // so keep the sequential two-command path instead of the Lua fast path.
  incrementWithExpiry: async (client, key, seconds) => {
    const value = await client.incr(key);
    if (seconds > 0) {
      await client.expire(key, seconds);
    }
    return value;
  },
  pushToListWithExpiry: async (client, key, value, seconds) => {
    await client.rpush(key, value as any);
    if (seconds > 0) {
      await client.expire(key, seconds);
    }
  },
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
