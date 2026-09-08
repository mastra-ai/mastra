import type { RequestContext } from '../request-context';
import type { StorageThreadType } from './types';

export type MemoryRunStateAccessor = () => MemoryRunState | undefined;

type CacheEntry<T> = {
  promise: Promise<T>;
};

export interface MemoryRunStateOptions {
  memory: object;
  threadId?: string;
  resourceId?: string;
  thread?: StorageThreadType | null;
  ownershipValidated?: boolean;
}

/**
 * Non-serializable memory state shared by consumers within one agent run.
 */
export class MemoryRunState {
  readonly memory: object;
  readonly threadId?: string;
  readonly resourceId?: string;

  #threadLoaded = false;
  #thread: StorageThreadType | null = null;
  #ownershipValidated = false;
  #cache = new Map<string, CacheEntry<unknown>>();

  constructor(options: MemoryRunStateOptions) {
    this.memory = options.memory;
    this.threadId = options.threadId;
    this.resourceId = options.resourceId;
    if ('thread' in options) {
      this.#threadLoaded = true;
      this.#thread = options.thread ?? null;
    }
    this.#ownershipValidated = options.ownershipValidated ?? false;
  }

  matches(memory: object, threadId?: string, resourceId?: string): boolean {
    return this.memory === memory && this.threadId === threadId && this.resourceId === resourceId;
  }

  get threadLoaded(): boolean {
    return this.#threadLoaded;
  }

  get thread(): StorageThreadType | null | undefined {
    return this.#threadLoaded ? this.#thread : undefined;
  }

  get ownershipValidated(): boolean {
    return this.#ownershipValidated;
  }

  load<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = this.#cache.get(key);
    if (existing) return existing.promise as Promise<T>;

    const promise = loader().catch(error => {
      this.#cache.delete(key);
      throw error;
    });
    this.#cache.set(key, { promise });
    return promise;
  }

  set<T>(key: string, value: T): void {
    this.#cache.set(key, { promise: Promise.resolve(value) });
  }
}

export function getMemoryRunState(
  requestContext: RequestContext | undefined,
  memory: object,
  threadId?: string,
  resourceId?: string,
): MemoryRunState | undefined {
  const memoryContext = requestContext?.get('MastraMemory') as { runState?: MemoryRunStateAccessor } | null | undefined;
  const state = memoryContext?.runState?.();
  return state?.matches(memory, threadId, resourceId) ? state : undefined;
}
