/**
 * Cross-process abort transport for durable agents.
 *
 * `abort()` runs in the caller's process, but a durable run's steps may execute
 * in a different process entirely (a load-balanced server replica, or an Inngest
 * worker). Flipping a local `AbortController` is therefore invisible to the code
 * that is actually driving the model call.
 *
 * These helpers carry the abort *intent* over pubsub so the executing process
 * can flip its own controller and unwind gracefully — emitting the usual
 * `finish` event with reason `abort`. That matters: hard-cancelling the
 * underlying workflow run would tear execution down before the terminal stream
 * event is ever published, leaving stream consumers hanging forever.
 */
import type { PubSub } from '../../events';
import { isMastraTimeoutError, MastraTimeoutError } from '../../loop/timeout';
import type { Mastra } from '../../mastra';
import { subscribeToAbortRequests } from '../streams/abort-transport';
import { getRunRegistryEntry, setRunRegistryEntry } from './run-registry';
import type { RunRegistryEntry } from './types';

export { publishAbortRequest, requestAcknowledgedAbort, subscribeToAbortRequests } from '../streams/abort-transport';

/**
 * Make the current process responsive to abort requests for `runId`.
 *
 * Called by durable steps as they start work. The step may be running on a
 * worker that never saw the caller's `abort()`, so this is where that process
 * grows an `AbortController` of its own — the same one every downstream call
 * already reads off the run registry (`registryEntry.abortSignal`), so nothing
 * downstream needs to know abort arrived from elsewhere.
 *
 * Idempotent: a run executes many steps in the same process, and each of them
 * calls this. The subscription is torn down with the registry entry, whether
 * that happens on explicit cleanup or TTL eviction.
 */
export async function ensureRemoteAbortListener(
  pubsub: PubSub,
  runId: string,
  mastra?: Mastra,
  deadline?: RunDeadline,
): Promise<void> {
  let entry = getRunRegistryEntry(runId, mastra);

  if (!entry) {
    // A worker can reach its first step before anything has populated the
    // registry for this run. Returning early here would leave that run
    // permanently deaf to remote aborts, so seed a minimal entry instead. It is
    // marked as a placeholder (and carries no model) so `resolveRuntimeDependencies`
    // still rebuilds the real runtime state into it rather than trusting it.
    entry = { isPlaceholder: true } as RunRegistryEntry;
    // Another instance's live run holds this runId; don't wire our abort to it.
    if (!setRunRegistryEntry(runId, entry, mastra)) return;
  }

  // The owner process already has a controller wired to its `abort()`. A worker
  // rebuilding state from storage has none, so give it one — flipping it is
  // what actually stops the model call.
  if (!entry.abortController) giveWorkerController(entry);

  // The deadline's abort request is published once, live. A worker that subscribes after it went
  // out never hears it, so the run's deadline also travels with the run and is armed here. It is
  // armed whether or not the subscription below succeeds, and re-armed when a resumed segment
  // on a warm worker carries a new deadline.
  syncRunDeadline(entry, deadline);

  if (entry.remoteAbortListenerInstalled) return;

  // Claim before awaiting: two steps starting concurrently in this process
  // would otherwise both pass the check and install duplicate subscriptions.
  entry.remoteAbortListenerInstalled = true;

  let unsubscribe: () => Promise<void>;
  try {
    unsubscribe = await subscribeToAbortRequests(pubsub, runId, () => {
      const controller = getRunRegistryEntry(runId, mastra)?.abortController ?? entry.abortController;
      if (controller && !controller.signal.aborted) {
        controller.abort(new Error('Aborted'));
      }
    });
  } catch (error) {
    // Release the claim so the next step in this run can retry. Leaving it set
    // would make the run permanently deaf to remote aborts after one transient
    // pubsub failure.
    entry.remoteAbortListenerInstalled = false;
    throw error;
  }

  // Chain onto the entry's existing cleanup rather than replacing it: the
  // registry's dispose hook only calls `cleanup()`, and other owners of the
  // entry have their own teardown registered there.
  const previousCleanup = entry.cleanup;
  entry.cleanup = () => {
    try {
      previousCleanup?.();
    } finally {
      void unsubscribe();
    }
  };
}

/** Controllers this module created for a worker that had none, as opposed to an owner's controller wired to its `abort()`. */
const workerControllers = new WeakSet<AbortController>();

function giveWorkerController(entry: RunRegistryEntry): void {
  const controller = new AbortController();
  workerControllers.add(controller);
  entry.abortController = controller;
  entry.abortSignal = controller.signal;
}

/**
 * A new segment is starting on a warm worker. If the previous segment's total deadline already
 * stopped the worker's own controller (e.g. it passed while the run was suspended), the resumed
 * segment gets a fresh one instead of inheriting that abort. Any other abort is kept.
 */
function replaceTimedOutWorkerController(entry: RunRegistryEntry): void {
  const controller = entry.abortController;
  if (!controller || !workerControllers.has(controller) || !controller.signal.aborted) return;
  const reason: unknown = controller.signal.reason;
  if (!isMastraTimeoutError(reason) || reason.timeoutType !== 'total') return;
  giveWorkerController(entry);
}

/** The deadline each entry currently has armed, and the controller it stops, so a later segment can replace it. */
const armedDeadlines = new WeakMap<
  RunRegistryEntry,
  { at: number; controller?: AbortController; timer?: ReturnType<typeof setTimeout> }
>();

/** Arm the entry's deadline, replacing a timer armed for a different deadline. */
export function syncRunDeadline(entry: RunRegistryEntry, deadline: RunDeadline | undefined): void {
  const armed = armedDeadlines.get(entry);
  if (armed && armed.at !== deadline?.at) replaceTimedOutWorkerController(entry);
  if (!deadline) {
    // A segment without a deadline (e.g. resumed without totalMs) must not inherit the last one's.
    if (armed) {
      clearTimeout(armed.timer);
      armedDeadlines.delete(entry);
    }
    return;
  }
  // A warm resume swaps a fresh controller onto the entry, so the timer is re-armed for it too.
  if (armed?.at === deadline.at && armed.controller === entry.abortController) return;
  if (armed) {
    clearTimeout(armed.timer);
  } else {
    const previousCleanup = entry.cleanup;
    entry.cleanup = () => {
      try {
        previousCleanup?.();
      } finally {
        clearTimeout(armedDeadlines.get(entry)?.timer);
        armedDeadlines.delete(entry);
      }
    };
  }
  const controller = entry.abortController;
  armedDeadlines.set(entry, { at: deadline.at, controller, timer: armRunDeadline(controller, deadline) });
}

/**
 * Request-context key the caller sets to the run's absolute total deadline for one execution
 * segment (stream or resume), so every worker can stop at it on its own clock.
 */
export const RUN_DEADLINE_KEY = '__mastra_runDeadline';

/** The run's total deadline: when it fires (epoch ms) and the budget it enforces. */
export type RunDeadline = { at: number; timeoutMs: number };

/** The run deadline a step's request context carries, if any. */
export function readRunDeadline(requestContext?: { get(key: string): unknown }): RunDeadline | undefined {
  const value = requestContext?.get(RUN_DEADLINE_KEY) as Partial<RunDeadline> | undefined;
  if (typeof value?.at !== 'number' || typeof value.timeoutMs !== 'number') return undefined;
  return { at: value.at, timeoutMs: value.timeoutMs };
}

/**
 * Abort the controller with the deadline's timeout error now, or when the deadline arrives.
 * The timer is bound to the controller it was armed for: a warm resume swaps a fresh controller
 * onto the entry, and the previous segment's timer must not stop the resumed segment.
 */
function armRunDeadline(
  controller: AbortController | undefined,
  deadline: RunDeadline,
): ReturnType<typeof setTimeout> | undefined {
  const expire = () => {
    if (controller && !controller.signal.aborted) {
      controller.abort(new MastraTimeoutError({ timeoutType: 'total', timeoutMs: deadline.timeoutMs }));
    }
  };
  const remaining = deadline.at - Date.now();
  if (remaining <= 0) {
    expire();
    return undefined;
  }
  const timer = setTimeout(expire, remaining);
  timer.unref?.();
  return timer;
}
