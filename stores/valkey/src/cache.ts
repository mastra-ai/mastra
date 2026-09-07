import { MastraServerCache } from '@mastra/core/cache';
import { Decoder, type GlideClient } from '@valkey/valkey-glide';

export interface ValkeyServerCacheOptions {
  keyPrefix?: string;
  ttlSeconds?: number;
}

const stringValue = (value: unknown): string => (Buffer.isBuffer(value) ? value.toString() : String(value));

/** GLIDE-backed Valkey cache for Mastra server state. */
export class ValkeyServerCache extends MastraServerCache {
  private readonly client: GlideClient;
  private readonly keyPrefix: string;
  private readonly ttlSeconds: number;

  constructor(config: { client: GlideClient }, options: ValkeyServerCacheOptions = {}) {
    super({ name: 'ValkeyServerCache' });
    this.client = config.client;
    this.keyPrefix = options.keyPrefix ?? 'mastra:cache:';
    this.ttlSeconds = options.ttlSeconds ?? 300;
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private async command(args: string[]): Promise<unknown> {
    return this.client.customCommand(args, { decoder: Decoder.String });
  }

  async get(key: string): Promise<unknown> {
    const value = await this.command(['GET', this.getKey(key)]);
    if (value === null) return null;
    const serialized = stringValue(value);
    try {
      return JSON.parse(serialized);
    } catch {
      return serialized;
    }
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const args = ['SET', this.getKey(key), JSON.stringify(value)];
    const seconds = ttlMs === undefined ? this.ttlSeconds : Math.max(1, Math.ceil(ttlMs / 1000));
    if (seconds > 0) args.push('EX', String(seconds));
    await this.command(args);
  }

  async listLength(key: string): Promise<number> {
    return Number(await this.command(['LLEN', this.getKey(key)]));
  }

  async listPush(key: string, value: unknown): Promise<void> {
    const fullKey = this.getKey(key);
    await this.command(['RPUSH', fullKey, JSON.stringify(value)]);
    if (this.ttlSeconds > 0) await this.command(['EXPIRE', fullKey, String(this.ttlSeconds)]);
  }

  async listFromTo(key: string, from: number, to: number = -1): Promise<unknown[]> {
    const values = (await this.command(['LRANGE', this.getKey(key), String(from), String(to)])) as unknown[];
    return values.map(value => {
      const serialized = stringValue(value);
      try {
        return JSON.parse(serialized);
      } catch {
        return serialized;
      }
    });
  }

  async delete(key: string): Promise<void> {
    await this.command(['DEL', this.getKey(key)]);
  }

  async clear(): Promise<void> {
    let cursor = '0';
    do {
      const result = (await this.command(['SCAN', cursor, 'MATCH', `${this.keyPrefix}*`, 'COUNT', '100'])) as [
        unknown,
        unknown[],
      ];
      cursor = stringValue(result[0]);
      const keys = result[1].map(stringValue);
      if (keys.length > 0) await this.command(['DEL', ...keys]);
    } while (cursor !== '0');
  }

  async increment(key: string): Promise<number> {
    const fullKey = this.getKey(key);
    const value = Number(await this.command(['INCR', fullKey]));
    if (this.ttlSeconds > 0) await this.command(['EXPIRE', fullKey, String(this.ttlSeconds)]);
    return value;
  }
}
