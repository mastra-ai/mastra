/**
 * Pubsub transport for run abort requests.
 *
 * `abort()` runs in the caller's process, but the run it targets may execute
 * in a different process (a load-balanced server replica, or a durable
 * execution worker). These helpers carry the abort *intent* over the run's
 * control topic so the executing process can flip its own controller and
 * unwind gracefully.
 */
import type { PubSub } from '../../events';
import { MastraTimeoutError } from '../../loop/timeout';
import { AGENT_CONTROL_TOPIC, AgentControlEventTypes } from './constants';

/**
 * Ask whichever process is executing `runId` to abort it.
 *
 * Safe to call from a process that is not running the steps, and safe to call
 * when nobody is listening — an unheard request is a no-op, exactly like
 * aborting a run that already finished.
 */
export async function publishAbortRequest(pubsub: PubSub, runId: string, reason?: MastraTimeoutError): Promise<void> {
  await pubsub.publish(AGENT_CONTROL_TOPIC(runId), {
    type: AgentControlEventTypes.ABORT_REQUEST,
    runId,
    data: reason ? { timeout: { timeoutType: reason.timeoutType, timeoutMs: reason.timeoutMs } } : {},
  });
}

type AbortRequestData = {
  requestId?: string;
  /** Set when a run deadline, not a caller, stopped the run. */
  timeout?: { timeoutType: MastraTimeoutError['timeoutType']; timeoutMs: number };
};

/** The reason the executing process aborts with: the deadline's timeout error, or a plain abort. */
function abortReason(data?: AbortRequestData): Error {
  return data?.timeout ? new MastraTimeoutError(data.timeout) : new Error('Aborted');
}

/**
 * Topic on which the process executing a run acknowledges abort requests that
 * carried a `requestId`. Kept apart from the control topic so a requester never
 * has to read (or replay) the control history to wait for its own reply.
 */
export const abortAckTopic = (runId: string): string => `agent.control.${runId}.ack`;
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
 * `onAbortRequested` returns `false` when there was nothing left to stop (the
 * run already ended here); the request is then not acknowledged, so a waiting
 * requester does not report a cancellation that never happened.
 *
 * @returns An unsubscribe function. Callers must invoke it when the run leaves
 * this process, otherwise the subscription outlives the work it guards.
 */
export async function subscribeToAbortRequests(
  pubsub: PubSub,
  runId: string,
  onAbortRequested: (reason: Error) => boolean | void,
): Promise<() => Promise<void>> {
  const topic = AGENT_CONTROL_TOPIC(runId);
  // Every delivery is acknowledged, including control events this listener
  // ignores. An ignored delivery is still a delivery, and a durable transport
  // keeps unacknowledged entries pending for the life of the subscription.
  const handler = async (event: { type?: string; data?: AbortRequestData }, ack?: () => Promise<void>) => {
    if (event?.type === AgentControlEventTypes.ABORT_REQUEST) {
      const stopped = onAbortRequested(abortReason(event.data)) !== false;
      const requestId = event.data?.requestId;
      if (requestId && stopped) {
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
