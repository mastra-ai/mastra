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
import type { Mastra } from '../../mastra';
import { AGENT_CONTROL_TOPIC, AgentControlEventTypes } from './constants';
import { getRunRegistryEntry, setRunRegistryEntry } from './run-registry';
import type { RunRegistryEntry } from './types';

/**
 * Ask whichever process is executing `runId` to abort it.
 *
 * Safe to call from a process that is not running the steps, and safe to call
 * when nobody is listening — an unheard request is a no-op, exactly like
 * aborting a run that already finished.
 */
export async function publishAbortRequest(pubsub: PubSub, runId: string): Promise<void> {
  await pubsub.publish(AGENT_CONTROL_TOPIC(runId), {
    type: AgentControlEventTypes.ABORT_REQUEST,
    runId,
    data: {},
  });
}

/**
 * Topic on which the process executing a run acknowledges abort requests that
 * carried a `requestId`. Kept apart from the control topic so a requester never
 * has to read (or replay) the control history to wait for its own reply.
 */
const abortAckTopic = (runId: string): string => `agent.control.${runId}.ack`;
const ABORT_ACK = 'abort-ack';

/** How long `requestAcknowledgedAbort` waits for the executing process to answer. */
const ABORT_ACK_TIMEOUT_MS = 2_000;

/**
 * Ask whichever process is executing `runId` to abort it, and wait for that
 * process to confirm it applied the request.
 *
 * Resolves `true` only when an executing process acknowledged the abort, and
 * `false` when nobody answered within `timeoutMs` (the run is not executing
 * anywhere, its owner died, or its listener is not installed yet). A publish
 * failure rejects: the caller cannot claim an abort it never sent.
 *
 * @internal Used by `@mastra/server`'s run abort route; not a public API.
 */
export async function requestAcknowledgedAbort(
  pubsub: PubSub,
  runId: string,
  timeoutMs: number = ABORT_ACK_TIMEOUT_MS,
): Promise<boolean> {
  const requestId = globalThis.crypto.randomUUID();
  const topic = abortAckTopic(runId);
  let acknowledge!: () => void;
  const acknowledged = new Promise<boolean>(resolve => {
    acknowledge = () => resolve(true);
  });
  const handler = async (
    event: { type?: string; data?: { requestId?: string } },
    ack?: () => Promise<void>,
  ): Promise<void> => {
    if (event?.type === ABORT_ACK && event.data?.requestId === requestId) acknowledge();
    await ack?.();
  };

  // The deadline bounds the whole exchange: a broker that stalls on subscribe or
  // publish must not hold the caller open past `timeoutMs`.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const deadline = new Promise<boolean>(resolve => {
    timer = setTimeout(() => {
      timedOut = true;
      resolve(false);
    }, timeoutMs);
  });
  // Subscribe before publishing so an acknowledgement cannot race past us.
  const subscribed = pubsub.subscribe(topic, handler as Parameters<PubSub['subscribe']>[1], { startFrom: 'latest' });
  const exchange = (async () => {
    await subscribed;
    await pubsub.publish(AGENT_CONTROL_TOPIC(runId), {
      type: AgentControlEventTypes.ABORT_REQUEST,
      runId,
      data: { requestId },
    });
    return acknowledged;
  })();
  // A setup failure after the deadline has nobody left to report to.
  exchange.catch(() => {});
  try {
    return await Promise.race([exchange, deadline]);
  } finally {
    clearTimeout(timer);
    // Unsubscribe once the subscription settles, even when it lands after the deadline.
    const cleanup = subscribed
      .then(() => pubsub.unsubscribe(topic, handler as Parameters<PubSub['subscribe']>[1]))
      .catch(() => {});
    if (!timedOut) await cleanup;
  }
}

/**
 * Listen for abort requests targeting `runId`.
 *
 * @returns An unsubscribe function. Callers must invoke it when the run leaves
 * this process, otherwise the subscription outlives the work it guards.
 */
export async function subscribeToAbortRequests(
  pubsub: PubSub,
  runId: string,
  onAbortRequested: () => void,
): Promise<() => Promise<void>> {
  const topic = AGENT_CONTROL_TOPIC(runId);
  // Every delivery is acknowledged, including control events this listener
  // ignores. An ignored delivery is still a delivery, and a durable transport
  // keeps unacknowledged entries pending for the life of the subscription.
  const handler = async (event: { type?: string; data?: { requestId?: string } }, ack?: () => Promise<void>) => {
    if (event?.type === AgentControlEventTypes.ABORT_REQUEST) {
      onAbortRequested();
      const requestId = event.data?.requestId;
      if (requestId) {
        // Confirm to a requester waiting on `requestAcknowledgedAbort`. A lost
        // acknowledgement only makes the requester retry; the abort has applied.
        await pubsub
          .publish(abortAckTopic(runId), {
            type: ABORT_ACK,
            runId,
            data: { requestId },
          })
          .catch(() => {});
      }
    }
    await ack?.();
  };

  await pubsub.subscribe(topic, handler as Parameters<PubSub['subscribe']>[1]);

  return async () => {
    await pubsub.unsubscribe(topic, handler as Parameters<PubSub['subscribe']>[1]);
  };
}

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
export async function ensureRemoteAbortListener(pubsub: PubSub, runId: string, mastra?: Mastra): Promise<void> {
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

  if (entry.remoteAbortListenerInstalled) return;

  // Claim before awaiting: two steps starting concurrently in this process
  // would otherwise both pass the check and install duplicate subscriptions.
  entry.remoteAbortListenerInstalled = true;

  // The owner process already has a controller wired to its `abort()`. A worker
  // rebuilding state from storage has none, so give it one — flipping it is
  // what actually stops the model call.
  if (!entry.abortController) {
    const controller = new AbortController();
    entry.abortController = controller;
    entry.abortSignal = controller.signal;
  }

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
