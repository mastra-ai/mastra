import type { PiExtensionGeneration } from './types.js';

export interface PiStateBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface PiStateEntry {
  version: 1;
  type: string;
  data: unknown;
  createdAt: string;
}

const stateWriteQueues = new Map<string, Promise<void>>();

function toJsonSafe(value: unknown): unknown {
  try {
    const json = JSON.stringify(value, (_key, nested) => {
      if (
        nested === undefined ||
        typeof nested === 'function' ||
        typeof nested === 'symbol' ||
        typeof nested === 'bigint'
      ) {
        throw new Error('value contains a non-JSON value');
      }
      return nested;
    });
    if (json === undefined) throw new Error('value is not JSON serializable');
    return JSON.parse(json) as unknown;
  } catch (error) {
    throw new Error(
      `Pi plugin state must be JSON serializable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export class PiStateStore {
  readonly #key: string;

  constructor(
    private readonly generation: PiExtensionGeneration,
    private readonly backend: PiStateBackend,
  ) {
    this.#key = `mastracode.pi.${generation.pluginId}.${generation.extensionId}.entries`;
  }

  async append(type: string, data: unknown): Promise<PiStateEntry> {
    this.generation.assertActive();
    if (!type.trim()) throw new Error('Pi appendEntry requires a non-empty type');
    const safeData = toJsonSafe(data);
    const entry: PiStateEntry = { version: 1, type, data: safeData, createdAt: new Date().toISOString() };
    const prior = stateWriteQueues.get(this.#key) ?? Promise.resolve();
    const operation = prior
      .catch(() => undefined)
      .then(async () => {
        const stored = await this.backend.get(this.#key);
        const entries = Array.isArray(stored)
          ? stored.filter(
              (candidate): candidate is PiStateEntry =>
                typeof candidate === 'object' &&
                candidate !== null &&
                (candidate as { version?: unknown }).version === 1,
            )
          : [];
        this.generation.assertActive();
        await this.backend.set(this.#key, [...entries, entry]);
      });
    const settled = operation.then(
      () => undefined,
      () => undefined,
    );
    stateWriteQueues.set(this.#key, settled);
    await operation;
    if (stateWriteQueues.get(this.#key) === settled) stateWriteQueues.delete(this.#key);
    return entry;
  }

  async list(): Promise<PiStateEntry[]> {
    this.generation.assertActive();
    await stateWriteQueues.get(this.#key);
    this.generation.assertActive();
    const stored = await this.backend.get(this.#key);
    if (!Array.isArray(stored)) return [];
    return stored.filter(
      (entry): entry is PiStateEntry =>
        typeof entry === 'object' && entry !== null && (entry as { version?: unknown }).version === 1,
    );
  }
}
