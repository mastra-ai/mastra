/** Opt-in limits for the Platform exporter's serialized upload queue. */
export interface PlatformByteBatchingConfig {
  /** UTF-8 JSON byte threshold that triggers an upload. Records are never split or truncated. Default: 8 MiB. */
  maxBatchBytes?: number;
  /** Maximum simultaneous uploads across all signal types. Default: 2. */
  maxConcurrentUploads?: number;
  /** Deadline for an upload including retries, in milliseconds. Default: 30000. */
  uploadTimeoutMs?: number;
}

export interface PlatformByteBatchingStats {
  pendingBytes: number;
  activeUploads: number;
}

type Batch<TSignal> = {
  signal: TSignal;
  prefix: string;
  records: string[];
  bytes: number;
};

export function resolveByteBatchingConfig(config: PlatformByteBatchingConfig): Required<PlatformByteBatchingConfig> {
  const resolved = {
    maxBatchBytes: config.maxBatchBytes ?? 8 * 1024 * 1024,
    maxConcurrentUploads: config.maxConcurrentUploads ?? 2,
    uploadTimeoutMs: config.uploadTimeoutMs ?? 30_000,
  };
  for (const [name, value] of Object.entries(resolved)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`byteBatching.${name} must be a positive safe integer`);
    }
  }
  if (resolved.maxBatchBytes < 32) throw new Error('byteBatching.maxBatchBytes must be at least 32');
  if (resolved.uploadTimeoutMs > 2_147_483_647) {
    throw new Error('byteBatching.uploadTimeoutMs must fit in a Node.js timer');
  }
  return resolved;
}

/**
 * Serialize each record once, before retaining it. The accounting includes open
 * batches, ready batches and uploads until they settle. This tracks retained
 * JSON bytes for diagnostics; queued bytes are not capped.
 */
export class PlatformByteBatcher<TSignal extends string> {
  private open = new Map<TSignal, Batch<TSignal>>();
  private ready: Batch<TSignal>[] = [];
  private active = new Set<Promise<void>>();
  private timer?: ReturnType<typeof setTimeout>;
  private pendingBytes = 0;

  constructor(
    private readonly config: Required<PlatformByteBatchingConfig>,
    private readonly maxBatchSize: number,
    private readonly maxBatchWaitMs: number,
    private readonly segments: Record<TSignal, string>,
    private readonly send: (signal: TSignal, body: string, count: number) => Promise<void>,
    private readonly onError: (error: unknown) => void,
  ) {
    if (!Number.isSafeInteger(maxBatchSize) || maxBatchSize <= 0) {
      throw new Error('maxBatchSize must be a positive safe integer in byte batching mode');
    }
    if (!Number.isSafeInteger(maxBatchWaitMs) || maxBatchWaitMs <= 0 || maxBatchWaitMs > 2_147_483_647) {
      throw new Error('maxBatchWaitMs must be a positive integer that fits in a Node.js timer');
    }
  }

  add(signal: TSignal, record: unknown): void {
    const json = JSON.stringify(record);
    if (json === undefined) throw new Error('Record has no JSON representation');
    const prefix = `{"${this.segments[signal]}":[`;
    const envelopeBytes = Buffer.byteLength(prefix) + 2; // closing ]}
    const recordBytes = Buffer.byteLength(json);

    let batch = this.open.get(signal);
    if (batch && recordBytes + envelopeBytes > this.config.maxBatchBytes) {
      this.seal(signal);
      batch = undefined;
    }
    const extraBytes = recordBytes + (batch ? 1 : envelopeBytes);
    if (!batch) {
      batch = { signal, prefix, records: [], bytes: envelopeBytes };
      this.open.set(signal, batch);
    }
    batch.bytes += recordBytes + (batch.records.length ? 1 : 0);
    batch.records.push(json);
    this.pendingBytes += extraBytes;
    if (batch.records.length >= this.maxBatchSize || batch.bytes >= this.config.maxBatchBytes) this.seal(signal);
    this.pump();
    if (this.open.size && !this.timer) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.sealAll();
        this.pump();
      }, this.maxBatchWaitMs);
    }
  }

  private seal(signal: TSignal): void {
    const batch = this.open.get(signal);
    if (batch) {
      this.open.delete(signal);
      this.ready.push(batch);
    }
  }

  private sealAll(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    for (const signal of this.open.keys()) this.seal(signal);
  }

  private pump(): void {
    while (this.ready.length && this.active.size < this.config.maxConcurrentUploads) {
      const batch = this.ready.shift()!;
      // Start in a microtask so the upload is tracked before send can settle.
      const task = Promise.resolve()
        .then(async () => {
          const count = batch.records.length;
          const body = batch.prefix + batch.records.join(',') + ']}';
          batch.records = []; // retain only the request body while awaiting HTTP
          await this.send(batch.signal, body, count);
        })
        .catch(error => this.onError(error))
        .finally(() => {
          this.pendingBytes -= batch.bytes;
          this.active.delete(task);
          this.pump();
        });
      this.active.add(task);
    }
  }

  /** Drop unsent batches after auth/quota rejection. In-flight uploads still remain accounted for. */
  clearQueued(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    for (const batch of [...this.open.values(), ...this.ready]) this.pendingBytes -= batch.bytes;
    this.open.clear();
    this.ready = [];
  }

  async flush(): Promise<void> {
    do {
      this.sealAll();
      this.pump();
      await Promise.allSettled([...this.active]);
    } while (this.open.size || this.ready.length || this.active.size);
  }

  getStats(): PlatformByteBatchingStats {
    return {
      pendingBytes: this.pendingBytes,
      activeUploads: this.active.size,
    };
  }
}
