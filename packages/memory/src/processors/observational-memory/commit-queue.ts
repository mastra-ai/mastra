import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';

/**
 * Process-wide queue for observational memory storage commits, keyed per thread or resource
 * (the `BufferingCoordinator.getLockKey` scheme).
 *
 * Storage alone keeps every commit correct (other processes never see this queue). The queue
 * adds a deterministic order inside one process: one commit at a time per key, and a waiting
 * reflection commit runs before waiting normal commits, so a due reflection is not held behind
 * a backlog of chunk writes. A running op is never preempted.
 *
 * Ops must contain only the storage commit and the head read it needs: no model calls,
 * indexing, or other slow work.
 *
 * Each op runs in the async context of the caller that enqueued it (tracing spans, logger
 * correlation), not the context of the op it waited behind.
 */

export type OMCommitPriority = 'reflection' | 'normal';

/** The per-thread / per-resource key shared by the commit queue and `BufferingCoordinator`. */
export function getOMLockKey(
  scope: 'thread' | 'resource',
  threadId: string | null | undefined,
  resourceId: string | null | undefined,
): string {
  if (scope === 'resource' && resourceId) {
    return `resource:${resourceId}`;
  }
  return `thread:${threadId ?? 'unknown'}`;
}

interface KeyQueue {
  /** Identifies the op currently holding the key; null when idle. */
  running: symbol | null;
  reflection: Array<() => void>;
  normal: Array<() => void>;
}

interface QueueRegistry {
  queues: Map<string, KeyQueue>;
  /** The keys held by the ops running in the current async context, with the token of each run. */
  heldKeys: AsyncLocalStorage<ReadonlyMap<string, symbol>>;
}

// Kept on globalThis so two loaded copies of this module (CJS + ESM, or duplicate installs) share one queue.
const REGISTRY = Symbol.for('@mastra/memory/om-commit-queue');
const registry: QueueRegistry = ((globalThis as Record<symbol, QueueRegistry | undefined>)[REGISTRY] ??= {
  queues: new Map(),
  heldKeys: new AsyncLocalStorage(),
});
const { queues, heldKeys } = registry;

function holdsKey(key: string): boolean {
  const token = heldKeys.getStore()?.get(key);
  // A token from a finished run (e.g. a fire-and-forget task started inside an op) no longer holds the key.
  return token !== undefined && queues.get(key)?.running === token;
}

function runNext(key: string, queue: KeyQueue): void {
  const next = queue.reflection.shift() ?? queue.normal.shift();
  if (!next) {
    queue.running = null;
    queues.delete(key);
    return;
  }
  next();
}

/**
 * Runs `op` once every earlier op on `key` has settled (reflection-priority ops first among those
 * still waiting) and resolves or rejects with its result. A rejection reaches only this caller.
 *
 * Enqueueing on a key from inside an op that holds the same key, directly or through nested ops
 * on other keys, would deadlock, so it rejects.
 */
export function runOMCommit<T>(
  key: string,
  op: () => Promise<T>,
  { priority = 'normal' }: { priority?: OMCommitPriority } = {},
): Promise<T> {
  if (holdsKey(key)) {
    return Promise.reject(
      new Error(`Re-entrant observational memory commit on "${key}": an op cannot enqueue on the key it holds.`),
    );
  }

  return new Promise<T>((resolve, reject) => {
    let queue = queues.get(key);
    if (!queue) {
      queue = { running: null, reflection: [], normal: [] };
      queues.set(key, queue);
    }
    const owner = queue;

    // Bound to the enqueuing caller's async context.
    const start = AsyncResource.bind(() => {
      const token = Symbol(key);
      owner.running = token;
      // Keep the keys the caller's own ops hold, so a nested op cannot enqueue on them either.
      const held = new Map(heldKeys.getStore());
      held.set(key, token);
      // Release the key before settling the caller, so the caller observes it free.
      heldKeys
        .run(held, () => Promise.resolve().then(op))
        .then(
          value => {
            runNext(key, owner);
            resolve(value);
          },
          error => {
            runNext(key, owner);
            reject(error);
          },
        );
    });

    (priority === 'reflection' ? owner.reflection : owner.normal).push(start);
    if (owner.running === null) runNext(key, owner);
  });
}

/** Whether the current async context runs inside an op holding `key`. Test-only. */
export function isInOMCommit(key: string): boolean {
  return holdsKey(key);
}

/** Number of keys with running or waiting ops. Test-only. */
export function activeOMCommitKeys(): number {
  return queues.size;
}

/** Ops waiting (not running) on `key`, by priority. Test-only. */
export function waitingOMCommits(key: string): { reflection: number; normal: number } {
  const queue = queues.get(key);
  return { reflection: queue?.reflection.length ?? 0, normal: queue?.normal.length ?? 0 };
}
