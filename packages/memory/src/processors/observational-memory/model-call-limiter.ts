import { AsyncLocalStorage } from 'node:async_hooks';

import { OBSERVATIONAL_MEMORY_DEFAULTS } from './constants';
import { omDebug } from './debug';

/**
 * Process-wide limit on how many Observer and Reflector model calls are in flight at once.
 *
 * Each run builds a large prompt, streams a long reply, and parses it on the shared event loop.
 * Without a limit, many threads crossing their thresholds together start that many runs at the
 * same moment, and every agent in the process stalls behind them. Runs beyond the limit wait here.
 *
 * Two priorities:
 * - `blocking`: an agent step is waiting for the result (sync observation, sync or manual reflection).
 * - `background`: async buffering of observations or reflections; nothing waits for it yet.
 *
 * A waiting blocking run starts before any waiting background run. A background run for a key
 * that an agent step is currently waiting on (see `markOMModelCallsUrgent`) counts as blocking.
 *
 * Each caller passes its own `limit`: a run starts only while fewer than `limit` runs are active
 * in the process. With one configured value this is a plain semaphore.
 *
 * A slot is held for one model call attempt (`limitOMModelCallAttempt`, passed to `withRetry`), not
 * for the run around it: a run waiting out a retry backoff holds no slot, and each request of a
 * run that makes several (resource-scoped batches, reflection retries, structured extraction)
 * takes its own. The run only sets who its attempts belong to (`withOMModelCallContext`). An
 * attempt never acquires a second slot, so slots always free up and the queue cannot deadlock.
 */

export type OMModelCallPriority = 'blocking' | 'background';

export interface OMModelCallSlotOptions {
  /** Thread or resource lock key (`getOMLockKey`) the run belongs to. */
  key: string;
  priority: OMModelCallPriority;
  /** Max runs active in the process for this run to start. `Infinity` disables the limit. */
  limit: number;
  /** Aborting while the run waits rejects with the signal's reason and skips the run. */
  abortSignal?: AbortSignal;
}

interface Waiter {
  key: string;
  priority: OMModelCallPriority;
  limit: number;
  start: () => void;
}

interface LimiterRegistry {
  active: number;
  waiting: Waiter[];
  /** Keys an agent step is waiting on, with the number of waits on each. */
  urgentKeys: Map<string, number>;
}

// Kept on globalThis so two loaded copies of this module (CJS + ESM, or duplicate installs) share one limit.
const REGISTRY = Symbol.for('@mastra/memory/om-model-call-limiter');
const registry: LimiterRegistry = ((globalThis as Record<symbol, LimiterRegistry | undefined>)[REGISTRY] ??= {
  active: 0,
  waiting: [],
  urgentKeys: new Map(),
});

function isBlocking(waiter: Waiter): boolean {
  return waiter.priority === 'blocking' || registry.urgentKeys.has(waiter.key);
}

function pickNext(): number {
  let background = -1;
  for (let i = 0; i < registry.waiting.length; i++) {
    const waiter = registry.waiting[i]!;
    if (registry.active >= waiter.limit) continue;
    if (isBlocking(waiter)) return i;
    if (background === -1) background = i;
  }
  return background;
}

function drain(): void {
  while (true) {
    const index = pickNext();
    if (index === -1) return;
    const [waiter] = registry.waiting.splice(index, 1);
    waiter!.start();
  }
}

/** Who a model call belongs to: set once per run, read by every model call attempt inside it. */
export type OMModelCallContext = Pick<OMModelCallSlotOptions, 'key' | 'priority' | 'limit'>;

const callContext = new AsyncLocalStorage<OMModelCallContext>();

/** Runs `run` with `context` applied to every Observer/Reflector model call attempt it makes. */
export function withOMModelCallContext<T>(context: OMModelCallContext, run: () => Promise<T>): Promise<T> {
  return callContext.run(context, run);
}

/**
 * Runs one model call attempt in a slot. Pass as `withRetry`'s `runAttempt`, so the slot is held
 * for one request and not for the backoff between retries or the time spent waiting here.
 */
export function limitOMModelCallAttempt(abortSignal?: AbortSignal) {
  return <T>(attempt: () => Promise<T>): Promise<T> => {
    const context = callContext.getStore() ?? {
      key: 'unknown',
      priority: 'blocking' as const,
      limit: OBSERVATIONAL_MEMORY_DEFAULTS.maxConcurrentModelCalls,
    };
    return runOMModelCall({ ...context, abortSignal }, attempt);
  };
}

/**
 * Runs `run` once a slot is free and resolves or rejects with its result. The slot is released
 * when `run` settles.
 */
export async function runOMModelCall<T>(options: OMModelCallSlotOptions, run: () => Promise<T>): Promise<T> {
  const release = await acquire(options);
  try {
    return await run();
  } finally {
    release();
  }
}

function acquire({ key, priority, limit, abortSignal }: OMModelCallSlotOptions): Promise<() => void> {
  abortSignal?.throwIfAborted();
  const queuedAt = Date.now();
  return new Promise<() => void>((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      registry.active--;
      drain();
    };
    const onAbort = () => {
      const index = registry.waiting.indexOf(waiter);
      if (index === -1) return;
      registry.waiting.splice(index, 1);
      reject(abortSignal!.reason);
    };
    const waiter: Waiter = {
      key,
      priority,
      limit,
      start: () => {
        abortSignal?.removeEventListener('abort', onAbort);
        registry.active++;
        const waitedMs = Date.now() - queuedAt;
        if (waitedMs > 0) {
          omDebug(`[OM:modelCallLimiter] ${priority} call for ${key} waited ${waitedMs}ms for a slot (limit ${limit})`);
        }
        resolve(release);
      },
    };
    abortSignal?.addEventListener('abort', onAbort, { once: true });
    registry.waiting.push(waiter);
    drain();
  });
}

/**
 * Marks `key` as one an agent step is waiting on, so its background runs, waiting now or queued
 * before the returned function is called, start ahead of other background runs. Call the
 * returned function when the step stops waiting; calling it more than once is a no-op.
 */
export function markOMModelCallsUrgent(key: string): () => void {
  registry.urgentKeys.set(key, (registry.urgentKeys.get(key) ?? 0) + 1);
  let cleared = false;
  return () => {
    if (cleared) return;
    cleared = true;
    const count = (registry.urgentKeys.get(key) ?? 1) - 1;
    if (count <= 0) registry.urgentKeys.delete(key);
    else registry.urgentKeys.set(key, count);
  };
}

/** Runs active and waiting in this process. Test-only. */
export function getOMModelCallStats(): { active: number; waiting: number } {
  return { active: registry.active, waiting: registry.waiting.length };
}
