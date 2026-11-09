import type { EventCallback, PubSub } from '@mastra/core/events';
import { withAck } from '@mastra/core/events';

/** One topic for every project: any replica's dispatcher claims across all of them. */
export const DISPATCH_WAKE_TOPIC = 'factory.dispatch';

/**
 * Tells dispatchers on other replicas that claimable work exists. Never
 * awaited — a slow or dead broker must not hold up the write it describes.
 * `origin` lets the publishing replica skip its own echo; it already woke
 * its dispatcher directly.
 */
export function publishDispatchWake(pubsub: PubSub, origin: string): void {
  pubsub
    .publish(DISPATCH_WAKE_TOPIC, { type: 'factory.dispatch.wake', runId: origin, data: {} })
    .catch((error: unknown) => {
      console.warn('[Factory] Failed to publish a dispatcher wake', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

/** Wakes on other replicas' writes; resolves to the unsubscribe. */
export async function subscribeDispatchWakes(
  pubsub: PubSub,
  origin: string,
  wake: () => void,
): Promise<() => Promise<void>> {
  const onEvent: EventCallback = withAck(async event => {
    if (event.runId !== origin) wake();
  });
  // Without `latest`, a retaining broker replays its backlog as spurious wakes.
  await pubsub.subscribe(DISPATCH_WAKE_TOPIC, onEvent, { startFrom: 'latest' });
  return () => pubsub.unsubscribe(DISPATCH_WAKE_TOPIC, onEvent);
}
