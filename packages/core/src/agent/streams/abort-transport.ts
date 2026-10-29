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
import { AGENT_CONTROL_TOPIC, AgentControlEventTypes } from './constants';

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
  const handler = async (event: { type?: string }, ack?: () => Promise<void>) => {
    if (event?.type === AgentControlEventTypes.ABORT_REQUEST) {
      onAbortRequested();
    }
    await ack?.();
  };

  await pubsub.subscribe(topic, handler as Parameters<PubSub['subscribe']>[1]);

  return async () => {
    await pubsub.unsubscribe(topic, handler as Parameters<PubSub['subscribe']>[1]);
  };
}
