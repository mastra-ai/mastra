import { Batch, Decoder, GlideClient, type GlideClientConfiguration, type GlideString } from '@valkey/valkey-glide';

export interface ValkeyMulti {
  del(key: string): ValkeyMulti;
  set(key: string, value: string): ValkeyMulti;
  zAdd(key: string, value: { score: number; value: string }): ValkeyMulti;
  zRem(key: string, value: string): ValkeyMulti;
  exec(): Promise<unknown[] | null>;
}

export interface ValkeyClient {
  readonly isOpen: boolean;
  connect(): Promise<void>;
  quit(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  mGet(keys: string[]): Promise<(string | null)[]>;
  del(keys: string | string[]): Promise<number>;
  scan(cursor: string, options: { MATCH: string; COUNT: number }): Promise<{ cursor: string; keys: string[] }>;
  zRange(key: string, start: number, stop: number): Promise<string[]>;
  zRank(key: string, value: string): Promise<number | null>;
  zAdd(key: string, value: { score: number; value: string }): Promise<number>;
  zRem(key: string, value: string): Promise<number>;
  multi(): ValkeyMulti;
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString();
  return String(value);
};

const asNullableString = (value: unknown): string | null => (value === null ? null : asString(value));
const asNumber = (value: unknown): number => Number(value);

class GlideMultiAdapter implements ValkeyMulti {
  private readonly batch = new Batch(true);

  constructor(private readonly getClient: () => Promise<GlideClient>) {}

  del(key: string): ValkeyMulti {
    this.batch.customCommand(['DEL', key]);
    return this;
  }

  set(key: string, value: string): ValkeyMulti {
    this.batch.customCommand(['SET', key, value]);
    return this;
  }

  zAdd(key: string, value: { score: number; value: string }): ValkeyMulti {
    this.batch.customCommand(['ZADD', key, String(value.score), value.value]);
    return this;
  }

  zRem(key: string, value: string): ValkeyMulti {
    this.batch.customCommand(['ZREM', key, value]);
    return this;
  }

  async exec(): Promise<unknown[] | null> {
    const client = await this.getClient();
    return client.exec(this.batch, true, { decoder: Decoder.String });
  }
}

export class GlideValkeyClient implements ValkeyClient {
  private clientPromise?: Promise<GlideClient>;

  constructor(
    private readonly config?: GlideClientConfiguration,
    private readonly suppliedClient?: GlideClient,
  ) {}

  get isOpen(): boolean {
    return this.clientPromise !== undefined || this.suppliedClient !== undefined;
  }

  connect(): Promise<void> {
    return this.getClient().then(() => undefined);
  }

  async quit(): Promise<void> {
    const client = await this.getClient();
    client.close();
  }

  async get(key: string): Promise<string | null> {
    return asNullableString(await this.command(['GET', key]));
  }

  async set(key: string, value: string): Promise<unknown> {
    return this.command(['SET', key, value]);
  }

  async mGet(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    const result = (await this.command(['MGET', ...keys])) as unknown[];
    return result.map(asNullableString);
  }

  async del(keys: string | string[]): Promise<number> {
    const values = Array.isArray(keys) ? keys : [keys];
    if (values.length === 0) return 0;
    return asNumber(await this.command(['DEL', ...values]));
  }

  async scan(cursor: string, options: { MATCH: string; COUNT: number }): Promise<{ cursor: string; keys: string[] }> {
    const result = (await this.command(['SCAN', cursor, 'MATCH', options.MATCH, 'COUNT', String(options.COUNT)])) as [
      unknown,
      unknown[],
    ];
    return { cursor: asString(result[0]), keys: result[1].map(asString) };
  }

  async zRange(key: string, start: number, stop: number): Promise<string[]> {
    const result = (await this.command(['ZRANGE', key, String(start), String(stop)])) as unknown[];
    return result.map(asString);
  }

  async zRank(key: string, value: string): Promise<number | null> {
    const result = await this.command(['ZRANK', key, value]);
    return result === null ? null : asNumber(result);
  }

  async zAdd(key: string, value: { score: number; value: string }): Promise<number> {
    return asNumber(await this.command(['ZADD', key, String(value.score), value.value]));
  }

  async zRem(key: string, value: string): Promise<number> {
    return asNumber(await this.command(['ZREM', key, value]));
  }

  multi(): ValkeyMulti {
    return new GlideMultiAdapter(() => this.getClient());
  }

  private getClient(): Promise<GlideClient> {
    if (this.suppliedClient) return Promise.resolve(this.suppliedClient);
    this.clientPromise ??= GlideClient.createClient(this.config!);
    return this.clientPromise;
  }

  private async command(args: GlideString[]): Promise<unknown> {
    const client = await this.getClient();
    return client.customCommand(args, { decoder: Decoder.String });
  }
}
