import { Batch, Decoder, GlideClient, type GlideClientConfiguration, type GlideString } from '@valkey/valkey-glide';

export type ValkeyClientOptions = Omit<Partial<GlideClientConfiguration>, 'addresses'> & {
  url?: string;
  addresses?: GlideClientConfiguration['addresses'];
};

type StreamMessage = { id: string; message: Record<string, string> };
type StreamReply = { name: string; messages: StreamMessage[] };

const text = (value: unknown): string => (Buffer.isBuffer(value) ? value.toString() : String(value));
const messages = (value: unknown): StreamMessage[] =>
  ((value as unknown[] | null) ?? []).map(entry => {
    const [id, fields] = entry as [unknown, unknown[]];
    const message: Record<string, string> = {};
    for (let index = 0; index < fields.length; index += 2) message[text(fields[index])] = text(fields[index + 1]);
    return { id: text(id), message };
  });

class ValkeyMulti {
  readonly #batch = new Batch(true);
  constructor(private readonly getClient: () => Promise<GlideClient>) {}
  xAdd(key: string, id: string, fields: Record<string, string>, options: { TRIM?: { threshold: number } } = {}) {
    const args: GlideString[] = ['XADD', key];
    if (options.TRIM) args.push('MAXLEN', '~', String(options.TRIM.threshold));
    args.push(id, ...Object.entries(fields).flat());
    this.#batch.customCommand(args);
    return this;
  }
  pExpire(key: string, ttl: number) {
    this.#batch.customCommand(['PEXPIRE', key, String(ttl)]);
    return this;
  }
  xGroupCreate(key: string, group: string, id: string, options: { MKSTREAM?: boolean } = {}) {
    this.#batch.xgroupCreate(key, group, id, { mkStream: options.MKSTREAM });
    return this;
  }
  async exec(): Promise<unknown[]> {
    return (await (await this.getClient()).exec(this.#batch, true, { decoder: Decoder.String })) ?? [];
  }
}

export class ValkeyStreamsClient {
  #client?: Promise<GlideClient>;
  constructor(private readonly options: ValkeyClientOptions) {}
  get isOpen() {
    return this.#client !== undefined;
  }
  on(_event: 'error', _listener: (error: unknown) => void) {
    return this;
  }
  async connect() {
    await this.getClient();
  }
  async quit() {
    (await this.getClient()).close();
  }
  multi() {
    return new ValkeyMulti(() => this.getClient());
  }
  async command(args: GlideString[]) {
    return (await this.getClient()).customCommand(args, { decoder: Decoder.String });
  }
  async xAdd(key: string, id: string, fields: Record<string, string>, options: { TRIM?: { threshold: number } } = {}) {
    const args: GlideString[] = ['XADD', key];
    if (options.TRIM) args.push('MAXLEN', '~', String(options.TRIM.threshold));
    args.push(id, ...Object.entries(fields).flat());
    return text(await this.command(args));
  }
  async pExpire(key: string, ttl: number) {
    return Number(await this.command(['PEXPIRE', key, String(ttl)]));
  }
  async xGroupCreate(key: string, group: string, id: string, options: { MKSTREAM?: boolean } = {}) {
    return (await this.getClient()).xgroupCreate(key, group, id, { mkStream: options.MKSTREAM });
  }
  async xGroupDestroy(key: string, group: string) {
    return Number(await this.command(['XGROUP', 'DESTROY', key, group]));
  }
  async xReadGroup(
    group: string,
    consumer: string,
    streams: Array<{ key: string; id: string }>,
    options: { COUNT?: number; BLOCK?: number } = {},
  ): Promise<StreamReply[] | null> {
    const result = await (
      await this.getClient()
    ).xreadgroup(group, consumer, Object.fromEntries(streams.map(stream => [stream.key, stream.id])), {
      count: options.COUNT,
      block: options.BLOCK,
      decoder: Decoder.String,
    });
    return (
      result?.map(stream => ({
        name: text(stream.key),
        messages: Object.entries(stream.value ?? {}).map(([id, fields]) => ({
          id,
          message: Object.fromEntries(fields?.map(([field, value]) => [text(field), text(value)]) ?? []),
        })),
      })) ?? null
    );
  }
  async xAutoClaim(
    key: string,
    group: string,
    consumer: string,
    minIdle: number,
    start: string,
    options: { COUNT?: number } = {},
  ) {
    const result = await (
      await this.getClient()
    ).xautoclaim(key, group, consumer, minIdle, start, { count: options.COUNT, decoder: Decoder.String });
    return {
      nextId: text(result[0]),
      messages: Object.entries(result[1] ?? {}).map(([id, fields]) => ({
        id,
        message: Object.fromEntries(fields.map(([field, value]) => [text(field), text(value)])),
      })),
    };
  }
  async xAck(key: string, group: string, id: string) {
    return (await this.getClient()).xack(key, group, [id]);
  }
  async del(key: string) {
    return Number(await this.command(['DEL', key]));
  }
  async set(key: string, value: string, options: { NX?: boolean; PX?: number } = {}) {
    const args: GlideString[] = ['SET', key, value];
    if (options.NX) args.push('NX');
    if (options.PX) args.push('PX', String(options.PX));
    const result = await this.command(args);
    return result === null ? null : text(result);
  }
  async get(key: string) {
    const result = await this.command(['GET', key]);
    return result === null ? null : text(result);
  }
  async eval(script: string, options: { keys: string[]; arguments: string[] }) {
    return Number(
      await this.command(['EVAL', script, String(options.keys.length), ...options.keys, ...options.arguments]),
    );
  }
  private getClient() {
    if (!this.#client) {
      const { url, ...configuration } = this.options;
      const parsed = url ? new URL(url) : undefined;
      this.#client = GlideClient.createClient({
        ...configuration,
        addresses: configuration.addresses ?? [
          { host: parsed?.hostname ?? 'localhost', port: Number(parsed?.port || 6379) },
        ],
        credentials:
          configuration.credentials ??
          (parsed?.password ? { username: parsed.username || 'default', password: parsed.password } : undefined),
        databaseId: configuration.databaseId ?? (parsed?.pathname ? Number(parsed.pathname.slice(1) || 0) : undefined),
      });
    }
    return this.#client;
  }
}

export const createClient = (options: ValkeyClientOptions) => new ValkeyStreamsClient(options);
export type ValkeyClientType = ValkeyStreamsClient;
