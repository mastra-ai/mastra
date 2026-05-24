import type {
  ChannelOutboxDispatchOptions,
  ChannelOutboxDispatchResult,
  HarnessChannelBinding,
} from '../../harness/v1';
import { MastraWorker } from '../worker';
import type { WorkerDeps } from '../worker';

const DEFAULT_POLL_INTERVAL_MS = 1_000;

type OutboxHarness = {
  listChannelBindings?: () => HarnessChannelBinding[];
  _internalGetSessionStorage?: () => unknown;
  channels?: {
    dispatchOutbox?: (opts?: ChannelOutboxDispatchOptions) => Promise<ChannelOutboxDispatchResult>;
  };
};

type OutboxMastra = {
  getHarnesses?: () => Record<string, OutboxHarness>;
};

export interface HarnessChannelOutboxWorkerConfig {
  enabled?: boolean;
  batchSize?: number;
  pollIntervalMs?: number;
  harnesses?: readonly string[];
  channels?: readonly string[];
}

export class HarnessChannelOutboxWorker extends MastraWorker {
  readonly name = 'harnessChannelOutbox';

  #config: {
    enabled: boolean;
    batchSize?: number;
    pollIntervalMs: number;
    harnesses?: ReadonlySet<string>;
    channels?: ReadonlySet<string>;
  };
  #running = false;
  #timer?: ReturnType<typeof setTimeout>;
  #tickInFlight = false;
  #pollGeneration = 0;
  #warnedNoHarnesses = false;
  #warnedNoBindings = false;
  #warnedNoStorage = false;

  constructor(config: HarnessChannelOutboxWorkerConfig = {}) {
    super();
    this.#config = {
      enabled: config.enabled === undefined ? true : booleanConfig('enabled', config.enabled),
      ...(config.batchSize !== undefined ? { batchSize: positiveIntegerConfig('batchSize', config.batchSize) } : {}),
      pollIntervalMs: positiveIntegerConfig('pollIntervalMs', config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS),
      ...(config.harnesses !== undefined ? { harnesses: stringSetConfig('harnesses', config.harnesses) } : {}),
      ...(config.channels !== undefined ? { channels: stringSetConfig('channels', config.channels) } : {}),
    };
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
  }

  async start(): Promise<void> {
    if (this.#running || !this.#config.enabled) return;
    if (!this.deps) throw new Error('HarnessChannelOutboxWorker: call init() before start()');
    this.#running = true;
    this.#pollGeneration += 1;
    this.#scheduleNextTick(0);
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;
    this.#pollGeneration += 1;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  }

  get isRunning(): boolean {
    return this.#running;
  }

  async runOnce(): Promise<number> {
    if (!this.#config.enabled || this.#tickInFlight) return 0;
    this.#tickInFlight = true;
    try {
      return await this.#dispatchPendingOutbox();
    } finally {
      this.#tickInFlight = false;
    }
  }

  #scheduleNextTick(delayMs: number, generation = this.#pollGeneration): void {
    if (!this.#running || generation !== this.#pollGeneration) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      void this.runOnce()
        .catch(error => this.deps?.logger?.error?.('HarnessChannelOutboxWorker: tick failed', error))
        .finally(() => this.#scheduleNextTick(this.#config.pollIntervalMs, generation));
    }, delayMs);
    this.#timer.unref?.();
  }

  async #dispatchPendingOutbox(): Promise<number> {
    const deps = this.deps;
    const mastra = deps?.mastra as OutboxMastra | undefined;
    const harnesses = mastra?.getHarnesses?.() ?? {};
    const entries = Object.entries(harnesses).filter(([name]) => this.#config.harnesses?.has(name) ?? true);
    if (entries.length === 0) {
      if (!this.#warnedNoHarnesses) {
        deps?.logger?.warn?.(
          'HarnessChannelOutboxWorker: no Harness instances registered, worker will not dispatch outbox items',
        );
        this.#warnedNoHarnesses = true;
      }
      return 0;
    }

    let claimed = 0;
    let sawDispatchableBinding = false;
    let sawStorageBackedBinding = false;
    const hasGlobalHarnessStorage = Boolean(
      (deps?.storage as { stores?: { harness?: unknown } } | undefined)?.stores?.harness,
    );
    for (const [harnessName, harness] of entries) {
      const bindings = this.#dispatchableBindings(harness);
      if (bindings.length === 0) continue;
      sawDispatchableBinding = true;
      if (!this.#hasHarnessStorage(harness, hasGlobalHarnessStorage)) continue;
      sawStorageBackedBinding = true;
      try {
        claimed += await this.#dispatchHarnessOutbox({ harnessName, harness, bindings });
      } catch (error) {
        deps?.logger?.error?.('HarnessChannelOutboxWorker: failed to dispatch harness channel outbox', {
          harnessName,
          error,
        });
      }
    }

    if (!sawDispatchableBinding && !this.#warnedNoBindings) {
      deps?.logger?.warn?.(
        'HarnessChannelOutboxWorker: no Harness channel bindings registered, worker will not dispatch outbox items',
      );
      this.#warnedNoBindings = true;
    }
    if (sawDispatchableBinding && !sawStorageBackedBinding && !this.#warnedNoStorage) {
      deps?.logger?.warn?.(
        'HarnessChannelOutboxWorker: no storage-backed Harness channel bindings registered, worker will not dispatch outbox items',
      );
      this.#warnedNoStorage = true;
    }
    return claimed;
  }

  #dispatchableBindings(harness: OutboxHarness): HarnessChannelBinding[] {
    const bindings = harness.listChannelBindings?.() ?? [];
    const channelFilter = this.#config.channels;
    if (!channelFilter) return bindings;
    return bindings.filter(binding => channelFilter.has(binding.channelId));
  }

  #hasHarnessStorage(harness: OutboxHarness, hasGlobalHarnessStorage: boolean): boolean {
    return hasGlobalHarnessStorage || harness._internalGetSessionStorage?.() !== undefined;
  }

  async #dispatchHarnessOutbox({
    harnessName,
    harness,
    bindings,
  }: {
    harnessName: string;
    harness: OutboxHarness;
    bindings: HarnessChannelBinding[];
  }): Promise<number> {
    const dispatchOutbox = harness.channels?.dispatchOutbox;
    if (typeof dispatchOutbox !== 'function') {
      this.deps?.logger?.warn?.('HarnessChannelOutboxWorker: Harness channel outbox dispatch is unavailable', {
        harnessName,
      });
      return 0;
    }

    const baseOptions = this.#config.batchSize !== undefined ? { limit: this.#config.batchSize } : {};
    if (!this.#config.channels) {
      const result = await dispatchOutbox(baseOptions);
      return result.claimed;
    }

    let claimed = 0;
    for (const channelId of new Set(bindings.map(binding => binding.channelId))) {
      try {
        const result = await dispatchOutbox({ ...baseOptions, channelId });
        claimed += result.claimed;
      } catch (error) {
        this.deps?.logger?.error?.('HarnessChannelOutboxWorker: failed to dispatch harness channel outbox', {
          harnessName,
          channelId,
          error,
        });
      }
    }
    return claimed;
  }
}

function booleanConfig(name: string, value: boolean): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`HarnessChannelOutboxWorker: ${name} must be a boolean`);
  }
  return value;
}

function positiveIntegerConfig(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`HarnessChannelOutboxWorker: ${name} must be a positive integer`);
  }
  return value;
}

function stringSetConfig(name: string, values: readonly string[]): ReadonlySet<string> {
  if (!Array.isArray(values)) {
    throw new Error(`HarnessChannelOutboxWorker: ${name} must be an array`);
  }
  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`HarnessChannelOutboxWorker: ${name} entries must be non-empty strings`);
    }
  }
  return new Set(values);
}
